import ExcelJS from 'exceljs';
import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';

async function getAllHistory(userId: number): Promise<RowDataPacket[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       wh.media_type AS mediaType,
       CASE WHEN wh.media_type='movie' THEN m.title ELSE ts.title END AS showTitle,
       e.title AS episodeTitle,
       seas.season_number AS seasonNumber,
       e.episode_number AS episodeNumber,
       wh.watched_at AS watchedAt,
       wh.progress_pct AS progressPct,
       wh.source,
       COALESCE(m.year, ts.year) AS year,
       COALESCE(m.tmdb_id, ts.tmdb_id) AS tmdbId
     FROM watch_history wh
     LEFT JOIN movies m ON wh.media_type='movie' AND m.id=wh.media_id
     LEFT JOIN episodes e ON wh.media_type='episode' AND e.id=wh.media_id
     LEFT JOIN seasons seas ON e.season_id=seas.id
     LEFT JOIN tv_shows ts ON e.show_id=ts.id
     WHERE wh.user_id=?
     ORDER BY wh.watched_at DESC`,
    [userId],
  );
  return rows;
}

async function getAllRatings(userId: number): Promise<RowDataPacket[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       r.media_type AS mediaType,
       COALESCE(m.title, ts.title) AS title,
       COALESCE(m.year, ts.year) AS year,
       show_for_ep.title AS showTitle,
       seas.season_number AS seasonNumber,
       e.episode_number AS episodeNumber,
       e.title AS episodeTitle,
       r.rating,
       r.rated_at AS ratedAt,
       COALESCE(m.tmdb_id, ts.tmdb_id) AS tmdbId
     FROM ratings r
     LEFT JOIN movies m ON r.media_type='movie' AND m.id=r.media_id
     LEFT JOIN tv_shows ts ON r.media_type='show' AND ts.id=r.media_id
     LEFT JOIN episodes e ON r.media_type='episode' AND e.id=r.media_id
     LEFT JOIN seasons seas ON e.season_id=seas.id
     LEFT JOIN tv_shows show_for_ep ON e.show_id=show_for_ep.id
     WHERE r.user_id=?
     ORDER BY r.rated_at DESC`,
    [userId],
  );
  return rows;
}

async function getAllListItems(userId: number): Promise<RowDataPacket[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       l.name AS listName,
       li.media_type AS mediaType,
       COALESCE(m.title, ts.title) AS title,
       COALESCE(m.year, ts.year) AS year,
       li.added_at AS addedAt,
       COALESCE(m.tmdb_id, ts.tmdb_id) AS tmdbId
     FROM list_items li
     JOIN lists l ON li.list_id=l.id
     LEFT JOIN movies m ON li.media_type='movie' AND m.id=li.media_id
     LEFT JOIN tv_shows ts ON li.media_type='show' AND ts.id=li.media_id
     WHERE l.user_id=?
     ORDER BY l.name, li.added_at DESC`,
    [userId],
  );
  return rows;
}

function headerStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } },
    alignment: { vertical: 'middle' },
  };
}

export async function buildExcelExport(userId: number): Promise<Buffer> {
  const [history, ratings, listItems] = await Promise.all([
    getAllHistory(userId),
    getAllRatings(userId),
    getAllListItems(userId),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Trakt';

  // Watch History sheet
  const histSheet = wb.addWorksheet('Watch History');
  histSheet.columns = [
    { header: 'Type', key: 'mediaType', width: 10 },
    { header: 'Title', key: 'showTitle', width: 40 },
    { header: 'Episode Title', key: 'episodeTitle', width: 35 },
    { header: 'Season', key: 'seasonNumber', width: 10 },
    { header: 'Episode', key: 'episodeNumber', width: 10 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Watched At', key: 'watchedAt', width: 22 },
    { header: 'Progress %', key: 'progressPct', width: 12 },
    { header: 'Source', key: 'source', width: 14 },
    { header: 'TMDB ID', key: 'tmdbId', width: 12 },
  ];
  histSheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle()));
  for (const row of history) {
    histSheet.addRow({
      mediaType: row.mediaType,
      showTitle: row.showTitle,
      episodeTitle: row.episodeTitle ?? '',
      seasonNumber: row.seasonNumber ?? '',
      episodeNumber: row.episodeNumber ?? '',
      year: row.year ?? '',
      watchedAt: row.watchedAt ? new Date(row.watchedAt).toISOString().replace('T', ' ').slice(0, 19) : '',
      progressPct: row.progressPct ?? '',
      source: row.source ?? '',
      tmdbId: row.tmdbId ?? '',
    });
  }

  // Ratings sheet
  const ratSheet = wb.addWorksheet('Ratings');
  ratSheet.columns = [
    { header: 'Type', key: 'mediaType', width: 10 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Show', key: 'showTitle', width: 35 },
    { header: 'Season', key: 'seasonNumber', width: 10 },
    { header: 'Episode', key: 'episodeNumber', width: 10 },
    { header: 'Episode Title', key: 'episodeTitle', width: 35 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Rated At', key: 'ratedAt', width: 22 },
    { header: 'TMDB ID', key: 'tmdbId', width: 12 },
  ];
  ratSheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle()));
  for (const row of ratings) {
    ratSheet.addRow({
      mediaType: row.mediaType,
      title: row.mediaType === 'episode' ? row.episodeTitle : row.title,
      showTitle: row.showTitle ?? '',
      seasonNumber: row.seasonNumber ?? '',
      episodeNumber: row.episodeNumber ?? '',
      episodeTitle: row.episodeTitle ?? '',
      year: row.year ?? '',
      rating: row.rating,
      ratedAt: row.ratedAt ? new Date(row.ratedAt).toISOString().replace('T', ' ').slice(0, 19) : '',
      tmdbId: row.tmdbId ?? '',
    });
  }

  // Lists sheet
  const listSheet = wb.addWorksheet('Lists');
  listSheet.columns = [
    { header: 'List', key: 'listName', width: 20 },
    { header: 'Type', key: 'mediaType', width: 10 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'Added At', key: 'addedAt', width: 22 },
    { header: 'TMDB ID', key: 'tmdbId', width: 12 },
  ];
  listSheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle()));
  for (const row of listItems) {
    listSheet.addRow({
      listName: row.listName,
      mediaType: row.mediaType,
      title: row.title ?? '',
      year: row.year ?? '',
      addedAt: row.addedAt ? new Date(row.addedAt).toISOString().replace('T', ' ').slice(0, 19) : '',
      tmdbId: row.tmdbId ?? '',
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
