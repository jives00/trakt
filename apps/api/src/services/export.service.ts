import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';

export type StremioSort = 'added_date' | 'alpha' | 'random';

export interface ExportableList {
  id: number;
  name: string;
  slug: string;
  listType: string;
  movieCount: number;
  showCount: number;
  stremioSort: StremioSort;
}

export interface ExportableItem {
  mediaType: 'movie' | 'show';
  mediaId: number;
  addedAt: string;
  tmdbId: number | null;
  title: string | null;
  posterPath: string | null;
  year: number | null;
  imdbId: string | null;
  tvdbId: string | null;
}

export async function getExportableLists(userId: number): Promise<ExportableList[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT l.id, l.name, l.slug, l.list_type AS listType, l.stremio_sort AS stremioSort,
       SUM(li.media_type = 'movie') AS movieCount,
       SUM(li.media_type = 'show')  AS showCount
     FROM lists l
     LEFT JOIN list_items li ON li.list_id = l.id AND li.media_type != 'episode'
     WHERE l.user_id = ? AND l.stremio_catalog = TRUE
     GROUP BY l.id
     HAVING movieCount > 0 OR showCount > 0
     ORDER BY l.is_system DESC, l.created_at ASC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    listType: r.listType as string,
    movieCount: Number(r.movieCount),
    showCount: Number(r.showCount),
    stremioSort: (r.stremioSort as StremioSort) ?? 'added_date',
  }));
}

export async function filterShowsWithUnwatchedEpisodes(
  userId: number,
  showIds: number[],
): Promise<Set<number>> {
  if (showIds.length === 0) return new Set();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT DISTINCT e.show_id AS showId
     FROM episodes e
     JOIN seasons s ON s.id = e.season_id
       AND s.season_number > 0 AND (s.season_type IS NULL OR s.season_type != 'special')
     WHERE e.show_id IN (${showIds.map(() => '?').join(',')})
       AND e.air_date IS NOT NULL AND e.air_date <= CURDATE()
       AND NOT EXISTS (
         SELECT 1 FROM watch_history wh
         WHERE wh.media_type = 'episode' AND wh.media_id = e.id AND wh.user_id = ?
       )`,
    [...showIds, userId],
  );
  return new Set(rows.map((r) => r.showId as number));
}

export async function getExportableList(
  userId: number,
  slugOrId: string,
): Promise<{ list: ExportableList; items: ExportableItem[] } | null> {
  const pool = getPool();
  const isNumeric = /^\d+$/.test(slugOrId);
  const whereClause = isNumeric ? 'l.id = ?' : 'l.slug = ?';

  const [[listRow]] = await pool.query<RowDataPacket[]>(
    `SELECT l.id, l.name, l.slug, l.list_type AS listType, l.stremio_sort AS stremioSort,
       SUM(li.media_type = 'movie') AS movieCount,
       SUM(li.media_type = 'show')  AS showCount
     FROM lists l
     LEFT JOIN list_items li ON li.list_id = l.id AND li.media_type != 'episode'
     WHERE l.user_id = ? AND ${whereClause}
     GROUP BY l.id`,
    [userId, slugOrId],
  );
  if (!listRow) return null;

  const stremioSort: StremioSort = (listRow.stremioSort as StremioSort) ?? 'added_date';
  const orderBy =
    stremioSort === 'alpha'  ? 'COALESCE(m.title, ts.title) ASC' :
    stremioSort === 'random' ? 'RAND()' :
                               'li.added_at DESC';

  const list: ExportableList = {
    id: listRow.id as number,
    name: listRow.name as string,
    slug: listRow.slug as string,
    listType: listRow.listType as string,
    movieCount: Number(listRow.movieCount),
    showCount: Number(listRow.showCount),
    stremioSort,
  };

  const [itemRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       li.media_type AS mediaType, li.media_id AS mediaId, li.added_at AS addedAt,
       COALESCE(m.tmdb_id, ts.tmdb_id)          AS tmdbId,
       COALESCE(m.title, ts.title)              AS title,
       COALESCE(m.poster_path, ts.poster_path)  AS posterPath,
       COALESCE(m.year, ts.year)               AS year,
       imdb_ext.external_id                     AS imdbId,
       tvdb_ext.external_id                     AS tvdbId
     FROM list_items li
     LEFT JOIN movies   m  ON li.media_type = 'movie' AND m.id = li.media_id
     LEFT JOIN tv_shows ts ON li.media_type = 'show'  AND ts.id = li.media_id
     LEFT JOIN external_ids imdb_ext
       ON imdb_ext.media_type = li.media_type AND imdb_ext.media_id = li.media_id AND imdb_ext.source = 'imdb'
     LEFT JOIN external_ids tvdb_ext
       ON tvdb_ext.media_type = 'show' AND tvdb_ext.media_id = li.media_id AND tvdb_ext.source = 'tvdb'
     WHERE li.list_id = ? AND li.media_type != 'episode'
       AND (li.media_type != 'movie' OR m.release_date IS NULL OR m.release_date <= CURDATE())
     ORDER BY ${orderBy}`,
    [list.id],
  );

  const items: ExportableItem[] = itemRows.map((r) => ({
    mediaType: r.mediaType as 'movie' | 'show',
    mediaId: r.mediaId as number,
    addedAt: r.addedAt as string,
    tmdbId: (r.tmdbId as number | null) ?? null,
    title: (r.title as string | null) ?? null,
    posterPath: (r.posterPath as string | null) ?? null,
    year: (r.year as number | null) ?? null,
    imdbId: (r.imdbId as string | null) ?? null,
    tvdbId: (r.tvdbId as string | null) ?? null,
  }));

  return { list, items };
}
