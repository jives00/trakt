import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';
import { getPool } from '../db';
import { UserProfile } from '@trakt/types';

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  displayName: string | null;
}

export async function getProfile(userId: number): Promise<UserProfile | null> {
  const [rows] = await getPool().query<UserRow[]>(
    'SELECT id, username, display_name AS displayName FROM users WHERE id = ?',
    [userId],
  );
  return rows[0] ?? null;
}

export async function updateProfile(userId: number, displayName: string): Promise<UserProfile> {
  try {
    const [result] = await getPool().query<ResultSetHeader>(
      'UPDATE users SET display_name = ? WHERE id = ?',
      [displayName, userId],
    );
    console.log(`Updated user ${userId} displayName, affected rows: ${result.affectedRows}`);
    const profile = await getProfile(userId);
    if (!profile) throw new Error('Failed to fetch updated profile');
    return profile;
  } catch (err) {
    console.error('updateProfile error:', err);
    throw err;
  }
}

interface UserPasswordRow extends RowDataPacket {
  password_hash: string;
}

export async function updatePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
  try {
    const [rows] = await getPool().query<UserPasswordRow[]>(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId],
    );
    if (!rows[0]) throw new Error('User not found');

    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) return false;

    const newHash = await bcrypt.hash(newPassword, 10);
    const [result] = await getPool().query<ResultSetHeader>(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newHash, userId],
    );
    console.log(`Updated user ${userId} password, affected rows: ${result.affectedRows}`);
    return true;
  } catch (err) {
    console.error('updatePassword error:', err);
    throw err;
  }
}

export async function updateUsername(userId: number, newUsername: string): Promise<UserProfile> {
  try {
    const [result] = await getPool().query<ResultSetHeader>(
      'UPDATE users SET username = ? WHERE id = ?',
      [newUsername, userId],
    );
    console.log(`Updated user ${userId} username, affected rows: ${result.affectedRows}`);
    const profile = await getProfile(userId);
    if (!profile) throw new Error('Failed to fetch updated profile');
    return profile;
  } catch (err) {
    console.error('updateUsername error:', err);
    throw err;
  }
}
