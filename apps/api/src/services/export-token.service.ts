import { randomBytes } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db';

export async function getExportToken(userId: number): Promise<string | null> {
  const [[row]] = await getPool().query<RowDataPacket[]>(
    'SELECT export_token FROM users WHERE id = ?',
    [userId],
  );
  return (row?.export_token as string | null) ?? null;
}

export async function rotateExportToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await getPool().query('UPDATE users SET export_token = ? WHERE id = ?', [token, userId]);
  return token;
}

export async function getUserByExportToken(token: string): Promise<number | null> {
  const [[row]] = await getPool().query<RowDataPacket[]>(
    'SELECT id FROM users WHERE export_token = ?',
    [token],
  );
  return (row?.id as number) ?? null;
}
