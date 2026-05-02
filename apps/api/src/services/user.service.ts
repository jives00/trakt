import { RowDataPacket, ResultSetHeader } from 'mysql2';
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
