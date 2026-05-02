import { z } from 'zod';

export const UpdateProfileBody = z.object({
  displayName: z.string().trim().min(1).max(50),
});
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

export interface UserProfile {
  id: number;
  username: string;
  displayName: string | null;
}
