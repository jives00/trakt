import { z } from 'zod';

export const UpdateProfileBody = z.object({
  displayName: z.string().trim().min(1).max(50),
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

export const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;

export const ChangeUsernameBody = z.object({
  newUsername: z.string().trim().min(1).max(255),
});
export type ChangeUsernameBody = z.infer<typeof ChangeUsernameBody>;

export interface UserProfile {
  id: number;
  username: string;
  displayName: string | null;
}
