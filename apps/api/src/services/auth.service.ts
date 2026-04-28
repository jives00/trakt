import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2';
import { getPool } from '../db';

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
}

interface RefreshRow extends RowDataPacket {
  user_id: number;
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const [rows] = await getPool().query<UserRow[]>(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username],
  );
  return rows[0] ?? null;
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function createAccessToken(userId: number): string {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET ?? 'dev-secret-change-me',
    { expiresIn: '15m' },
  );
}

export async function createRefreshToken(userId: number): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await getPool().query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt],
  );
  return token;
}

export async function validateRefreshToken(token: string): Promise<number | null> {
  const [rows] = await getPool().query<RefreshRow[]>(
    'SELECT user_id FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
    [token],
  );
  return rows[0]?.user_id ?? null;
}

export async function deleteRefreshToken(token: string): Promise<void> {
  await getPool().query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
}

export async function ensureAdminUser(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;

  const user = await findUserByUsername(username);
  if (user) return;

  const hash = await bcrypt.hash(password, 10);
  await getPool().query(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    [username, hash],
  );
}
