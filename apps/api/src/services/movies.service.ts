import { RowDataPacket } from 'mysql2/promise';
import { Movie } from '@trakt/types';
import { getPool } from '../db';
import { fetchMovie } from './tmdb.client';

interface MovieRow extends RowDataPacket {
  id: number; tmdb_id: number; title: string; year: number;
  overview: string; tagline: string | null; poster_path: string | null; backdrop_path: string | null;
  runtime_min: number | null; genres: string; release_date: string | null;
}

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
  };
}

export async function getOrFetchMovie(tmdbId: number): Promise<Movie & { id: number }> {
  const pool = getPool();
  const [rows] = await pool.query<MovieRow[]>(
    'SELECT * FROM movies WHERE tmdb_id = ?', [tmdbId],
  );
  if (rows.length > 0) return rowToMovie(rows[0]);

  const movie = await fetchMovie(tmdbId);
  await pool.query(
    `INSERT INTO movies (tmdb_id, title, year, release_date, overview, tagline, poster_path, backdrop_path, runtime_min, genres)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE tagline = VALUES(tagline), release_date = VALUES(release_date)`,
    [tmdbId, movie.title, movie.year || null, movie.releaseDate ?? null, movie.overview,
     movie.tagline ?? null, movie.posterPath, movie.backdropPath, movie.runtimeMin, JSON.stringify(movie.genres)],
  );
  const [inserted] = await pool.query<MovieRow[]>('SELECT * FROM movies WHERE tmdb_id = ?', [tmdbId]);
  return rowToMovie(inserted[0]);
}
