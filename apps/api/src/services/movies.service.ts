import { RowDataPacket } from 'mysql2/promise';
import { Movie, MovieDetail, MovieCastMember, CrewMember } from '@trakt/types';
import { getPool } from '../db';
import { fetchMovie, fetchMovieCredits, fetchMovieImdbId } from './tmdb-movies.client';
import { fetchImdbRating } from './omdb.client';

interface MovieRow extends RowDataPacket {
  id: number; tmdb_id: number; title: string; year: number;
  overview: string; tagline: string | null; poster_path: string | null; backdrop_path: string | null;
  runtime_min: number | null; genres: string; release_date: string | null;
  origin_country: string | null; original_language: string | null; production_company: string | null;
  rt_critic_score: number | null; rt_audience_score: number | null;
  tmdb_rating: number | null; trailer_youtube_key: string | null;
}

interface ExternalIdRow extends RowDataPacket { external_id: string }

async function getMovieImdbId(movieInternalId: number): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query<ExternalIdRow[]>(
    `SELECT external_id FROM external_ids WHERE media_type = 'movie' AND media_id = ? AND source = 'imdb'`,
    [movieInternalId],
  );
  return rows.length > 0 ? rows[0].external_id : null;
}

function rowToMovie(row: MovieRow, imdbId?: string | null): MovieDetail & { id: number } {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year ?? 0,
    overview: row.overview ?? '',
    tagline: row.tagline ?? null,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    runtimeMin: row.runtime_min,
    genres: typeof row.genres === 'string' ? JSON.parse(row.genres) : (row.genres ?? []),
    releaseDate: row.release_date ?? null,
    originCountry: row.origin_country ?? null,
    originalLanguage: row.original_language ?? null,
    productionCompany: row.production_company ?? null,
    rtCriticScore: row.rt_critic_score,
    rtAudienceScore: row.rt_audience_score,
    imdbId: imdbId ?? null,
    tmdbRating: row.tmdb_rating,
    trailerYoutubeKey: row.trailer_youtube_key ?? null,
  };
}

async function getOrCacheMovieImdbId(movieInternalId: number, movieTmdbId: number): Promise<string | null> {
  const pool = getPool();
  const [rows] = await pool.query<ExternalIdRow[]>(
    `SELECT external_id FROM external_ids WHERE media_type = 'movie' AND media_id = ? AND source = 'imdb'`,
    [movieInternalId],
  );
  if (rows.length > 0) return rows[0].external_id;

  const imdbId = await fetchMovieImdbId(movieTmdbId);
  if (!imdbId) return null;

  await pool.query(
    `INSERT IGNORE INTO external_ids (media_type, media_id, source, external_id) VALUES ('movie', ?, 'imdb', ?)`,
    [movieInternalId, imdbId],
  );
  return imdbId;
}

async function backfillMovieImdbRating(movieInternalId: number, movieTmdbId: number): Promise<void> {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT rt_critic_score FROM movies WHERE id = ? AND rt_critic_score IS NULL',
      [movieInternalId],
    );
    if (rows.length === 0) return;

    const imdbId = await getOrCacheMovieImdbId(movieInternalId, movieTmdbId);
    if (!imdbId) return;

    const rating = await fetchImdbRating(imdbId);
    if (rating === null) return;

    await pool.query(
      'UPDATE movies SET rt_critic_score = ? WHERE id = ?',
      [rating, movieInternalId],
    );
  } catch (err) {
    console.error(`[IMDb] Error backfilling movie ${movieTmdbId}:`, err);
  }
}

async function backfillMovieTmdbRating(movieInternalId: number, movieTmdbId: number): Promise<void> {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT tmdb_rating FROM movies WHERE id = ? AND tmdb_rating IS NULL',
      [movieInternalId],
    );
    if (rows.length === 0) return;

    const movie = await fetchMovie(movieTmdbId);
    if (movie.tmdbRating === null) return;

    await pool.query(
      'UPDATE movies SET tmdb_rating = ? WHERE id = ?',
      [movie.tmdbRating, movieInternalId],
    );
  } catch (err) {
    console.error(`[TMDB] Error backfilling movie ${movieTmdbId}:`, err);
  }
}

export async function getOrFetchMovie(tmdbId: number): Promise<MovieDetail & { id: number }> {
  const pool = getPool();
  const [rows] = await pool.query<MovieRow[]>(
    'SELECT * FROM movies WHERE tmdb_id = ?', [tmdbId],
  );
  if (rows.length > 0) {
    const imdbId = await getMovieImdbId(rows[0].id);
    const movie = rowToMovie(rows[0], imdbId);
    if (process.env.NODE_ENV !== 'test') {
      backfillMovieImdbRating(movie.id, tmdbId).catch(() => {});
      backfillMovieTmdbRating(movie.id, tmdbId).catch(() => {});
    }
    return movie;
  }

  const movieData = await fetchMovie(tmdbId);
  const tmdbRating = movieData.tmdbRating ?? null;
  await pool.query(
    `INSERT INTO movies (tmdb_id, title, year, release_date, overview, tagline, poster_path, backdrop_path, runtime_min, genres, origin_country, original_language, production_company, tmdb_rating, trailer_youtube_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tagline = VALUES(tagline), release_date = VALUES(release_date), origin_country = VALUES(origin_country), original_language = VALUES(original_language), production_company = VALUES(production_company), tmdb_rating = VALUES(tmdb_rating), trailer_youtube_key = VALUES(trailer_youtube_key)`,
    [tmdbId, movieData.title, movieData.year || null, movieData.releaseDate ?? null, movieData.overview,
     movieData.tagline ?? null, movieData.posterPath, movieData.backdropPath, movieData.runtimeMin, JSON.stringify(movieData.genres),
     movieData.originCountry, movieData.originalLanguage, movieData.productionCompany, tmdbRating, movieData.trailerYoutubeKey ?? null],
  );
  const movie = movieData;
  const [inserted] = await pool.query<MovieRow[]>('SELECT * FROM movies WHERE tmdb_id = ?', [tmdbId]);
  const imdbId = await getMovieImdbId(inserted[0].id);
  const result = rowToMovie(inserted[0], imdbId);
  if (process.env.NODE_ENV !== 'test') {
    backfillMovieImdbRating(result.id, tmdbId).catch(() => {});
    backfillMovieTmdbRating(result.id, tmdbId).catch(() => {});
  }
  return result;
}

export async function getOrFetchMovieCast(tmdbId: number): Promise<MovieCastMember[]> {
  const pool = getPool();
  const [movieRows] = await pool.query<MovieRow[]>('SELECT id FROM movies WHERE tmdb_id = ?', [tmdbId]);
  if (!movieRows.length) return [];
  const movieId = movieRows[0].id;

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM credits WHERE media_type = "movie" AND media_id = ? AND role = "cast"', [movieId],
  );
  const hasExisting = Number((existing[0] as any).cnt) > 0;

  if (!hasExisting) {
    const { cast } = await fetchMovieCredits(tmdbId);

    if (cast.length > 0) {
      const peopleValues = cast.map(m => [m.tmdbId, m.name, m.profilePath]);
      const placeholders = peopleValues.map(() => '(?, ?, ?)').join(',');
      const flatValues = peopleValues.flat();
      await pool.query(
        `INSERT IGNORE INTO people (tmdb_id, name, profile_path) VALUES ${placeholders}`,
        flatValues,
      );

      const tmdbIds = cast.map(m => m.tmdbId);
      const placeholders2 = tmdbIds.map(() => '?').join(',');
      const [personRows] = await pool.query<RowDataPacket[]>(
        `SELECT tmdb_id, id FROM people WHERE tmdb_id IN (${placeholders2})`,
        tmdbIds,
      );
      const personMap = new Map(personRows.map(r => [(r as any).tmdb_id, (r as any).id]));

      const creditValues: any[] = [];
      for (const m of cast) {
        const personId = personMap.get(m.tmdbId);
        if (personId) {
          creditValues.push([movieId, personId, m.character, m.order]);
        }
      }

      if (creditValues.length > 0) {
        const creditsPlaceholders = creditValues.map(() => '("movie", ?, ?, ?, "cast", ?)').join(',');
        const creditsFlatValues = creditValues.flat();
        await pool.query(
          `INSERT INTO credits (media_type, media_id, person_id, \`character\`, \`role\`, \`order\`) VALUES ${creditsPlaceholders} ON DUPLICATE KEY UPDATE \`character\` = VALUES(\`character\`)`,
          creditsFlatValues,
        );
      }
    }
  }

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT DISTINCT p.tmdb_id, p.name, p.profile_path, c.character, c.\`order\`
    FROM credits c JOIN people p ON p.id = c.person_id
    WHERE c.media_type = 'movie' AND c.media_id = ? AND c.role = 'cast'
    ORDER BY c.\`order\` LIMIT 100
  `, [movieId]);

  return rows.map(r => ({
    tmdbId: r.tmdb_id,
    name: r.name,
    profilePath: r.profile_path,
    character: r.character ?? '',
    order: r.order ?? 0,
  }));
}

export async function getOrFetchMovieCrew(tmdbId: number): Promise<CrewMember[]> {
  const pool = getPool();
  const [movieRows] = await pool.query<MovieRow[]>('SELECT id FROM movies WHERE tmdb_id = ?', [tmdbId]);
  if (!movieRows.length) return [];
  const movieId = movieRows[0].id;

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM credits WHERE media_type = "movie" AND media_id = ? AND role = "crew"', [movieId],
  );
  const hasExisting = Number((existing[0] as any).cnt) > 0;

  if (!hasExisting) {
    const { crew } = await fetchMovieCredits(tmdbId);

    if (crew.length > 0) {
      const peopleValues = crew.map(c => [c.tmdbId, c.name, c.profilePath]);
      const placeholders = peopleValues.map(() => '(?, ?, ?)').join(',');
      const flatValues = peopleValues.flat();
      await pool.query(
        `INSERT IGNORE INTO people (tmdb_id, name, profile_path) VALUES ${placeholders}`,
        flatValues,
      );

      const tmdbIds = crew.map(c => c.tmdbId);
      const placeholders2 = tmdbIds.map(() => '?').join(',');
      const [personRows] = await pool.query<RowDataPacket[]>(
        `SELECT tmdb_id, id FROM people WHERE tmdb_id IN (${placeholders2})`,
        tmdbIds,
      );
      const personMap = new Map(personRows.map(r => [(r as any).tmdb_id, (r as any).id]));

      const creditValues: any[] = [];
      for (const c of crew) {
        const personId = personMap.get(c.tmdbId);
        if (personId) {
          creditValues.push([movieId, personId, c.job, c.department]);
        }
      }

      if (creditValues.length > 0) {
        const creditsPlaceholders = creditValues.map(() => '("movie", ?, ?, ?, "crew", ?)').join(',');
        const creditsFlatValues = creditValues.flat();
        await pool.query(
          `INSERT INTO credits (media_type, media_id, person_id, \`character\`, \`role\`, department) VALUES ${creditsPlaceholders} ON DUPLICATE KEY UPDATE \`character\` = VALUES(\`character\`), department = VALUES(department)`,
          creditsFlatValues,
        );
      }
    }
  }

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT DISTINCT p.tmdb_id, p.name, p.profile_path, c.character, c.department
    FROM credits c JOIN people p ON p.id = c.person_id
    WHERE c.media_type = 'movie' AND c.media_id = ? AND c.role = 'crew'
  `, [movieId]);

  return rows.map(r => ({
    tmdbId: r.tmdb_id,
    name: r.name,
    profilePath: r.profile_path,
    job: r.character ?? '',
    department: r.department ?? '',
  }));
}

export async function forceRefreshMovieMetadata(tmdbId: number): Promise<MovieDetail & { id: number }> {
  const pool = getPool();
  const movieData = await fetchMovie(tmdbId);
  await pool.query(
    `UPDATE movies SET title = ?, year = ?, release_date = ?, overview = ?, tagline = ?, runtime_min = ?,
     genres = ?, origin_country = ?, original_language = ?, production_company = ?, tmdb_rating = ?, trailer_youtube_key = ?
     WHERE tmdb_id = ?`,
    [movieData.title, movieData.year || null, movieData.releaseDate ?? null, movieData.overview,
     movieData.tagline ?? null, movieData.runtimeMin, JSON.stringify(movieData.genres),
     movieData.originCountry, movieData.originalLanguage, movieData.productionCompany,
     movieData.tmdbRating ?? null, movieData.trailerYoutubeKey ?? null, tmdbId],
  );
  const [rows] = await pool.query<MovieRow[]>('SELECT * FROM movies WHERE tmdb_id = ?', [tmdbId]);
  if (!rows.length) return getOrFetchMovie(tmdbId);
  const imdbId = await getMovieImdbId(rows[0].id);
  return rowToMovie(rows[0], imdbId);
}

export async function forceRefreshMovieCast(tmdbId: number): Promise<{ cast: MovieCastMember[]; crew: CrewMember[] }> {
  const pool = getPool();
  const [movieRows] = await pool.query<MovieRow[]>('SELECT id FROM movies WHERE tmdb_id = ?', [tmdbId]);
  if (!movieRows.length) return { cast: [], crew: [] };
  const movieId = movieRows[0].id;

  await pool.query('DELETE FROM credits WHERE media_type = "movie" AND media_id = ?', [movieId]);
  const cast = await getOrFetchMovieCast(tmdbId);
  const crew = await getOrFetchMovieCrew(tmdbId);
  return { cast, crew };
}
