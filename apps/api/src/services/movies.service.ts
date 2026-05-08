import { RowDataPacket } from 'mysql2/promise';
import { Movie, MovieCastMember, CrewMember } from '@trakt/types';
import { getPool } from '../db';
import { fetchMovie, fetchMovieCredits, fetchMovieImdbId } from './tmdb-movies.client';
import { fetchRtRatings } from './omdb.client';

interface MovieRow extends RowDataPacket {
  id: number; tmdb_id: number; title: string; year: number;
  overview: string; tagline: string | null; poster_path: string | null; backdrop_path: string | null;
  runtime_min: number | null; genres: string; release_date: string | null;
  origin_country: string | null; original_language: string | null; production_company: string | null;
  rt_critic_score: number | null; rt_audience_score: number | null;
}

interface ExternalIdRow extends RowDataPacket { external_id: string }

function rowToMovie(row: MovieRow): Movie & { id: number } {
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
    originCountry: row.origin_country,
    originalLanguage: row.original_language,
    productionCompany: row.production_company,
    rtCriticScore: row.rt_critic_score,
    rtAudienceScore: row.rt_audience_score,
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

async function backfillMovieRtScores(movieInternalId: number, movieTmdbId: number): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT rt_critic_score FROM movies WHERE id = ? AND rt_critic_score IS NULL',
    [movieInternalId],
  );
  if (rows.length === 0) return;

  const imdbId = await getOrCacheMovieImdbId(movieInternalId, movieTmdbId);
  if (!imdbId) return;

  const { criticScore, audienceScore } = await fetchRtRatings(imdbId);
  if (criticScore === null && audienceScore === null) return;

  await pool.query(
    'UPDATE movies SET rt_critic_score = ?, rt_audience_score = ? WHERE id = ?',
    [criticScore, audienceScore, movieInternalId],
  );
}

export async function getOrFetchMovie(tmdbId: number): Promise<Movie & { id: number }> {
  const pool = getPool();
  const [rows] = await pool.query<MovieRow[]>(
    'SELECT * FROM movies WHERE tmdb_id = ?', [tmdbId],
  );
  if (rows.length > 0) {
    const movie = rowToMovie(rows[0]);
    backfillMovieRtScores(movie.id, tmdbId).catch(() => {});
    return movie;
  }

  const movie = await fetchMovie(tmdbId);
  await pool.query(
    `INSERT INTO movies (tmdb_id, title, year, release_date, overview, tagline, poster_path, backdrop_path, runtime_min, genres, origin_country, original_language, production_company)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tagline = VALUES(tagline), release_date = VALUES(release_date), origin_country = VALUES(origin_country), original_language = VALUES(original_language), production_company = VALUES(production_company)`,
    [tmdbId, movie.title, movie.year || null, movie.releaseDate ?? null, movie.overview,
     movie.tagline ?? null, movie.posterPath, movie.backdropPath, movie.runtimeMin, JSON.stringify(movie.genres),
     movie.originCountry, movie.originalLanguage, movie.productionCompany],
  );
  const [inserted] = await pool.query<MovieRow[]>('SELECT * FROM movies WHERE tmdb_id = ?', [tmdbId]);
  const result = rowToMovie(inserted[0]);
  backfillMovieRtScores(result.id, tmdbId).catch(() => {});
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
    for (const m of cast) {
      await pool.query('INSERT IGNORE INTO people (tmdb_id, name, profile_path) VALUES (?, ?, ?)', [m.tmdbId, m.name, m.profilePath]);
      const [pRows] = await pool.query<RowDataPacket[]>('SELECT id FROM people WHERE tmdb_id = ?', [m.tmdbId]);
      await pool.query(
        'INSERT INTO credits (media_type, media_id, person_id, `character`, `role`, `order`) VALUES ("movie", ?, ?, ?, "cast", ?) ON DUPLICATE KEY UPDATE `character` = VALUES(`character`)',
        [movieId, (pRows[0] as any).id, m.character, m.order],
      );
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
    for (const c of crew) {
      await pool.query('INSERT IGNORE INTO people (tmdb_id, name, profile_path) VALUES (?, ?, ?)', [c.tmdbId, c.name, c.profilePath]);
      const [pRows] = await pool.query<RowDataPacket[]>('SELECT id FROM people WHERE tmdb_id = ?', [c.tmdbId]);
      await pool.query(
        'INSERT INTO credits (media_type, media_id, person_id, `character`, `role`, department) VALUES ("movie", ?, ?, ?, "crew", ?) ON DUPLICATE KEY UPDATE `character` = VALUES(`character`), department = VALUES(department)',
        [movieId, (pRows[0] as any).id, c.job, c.department],
      );
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

export async function forceRefreshMovieMetadata(tmdbId: number): Promise<Movie & { id: number }> {
  const pool = getPool();
  await pool.query('DELETE FROM movies WHERE tmdb_id = ?', [tmdbId]);
  return getOrFetchMovie(tmdbId);
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
