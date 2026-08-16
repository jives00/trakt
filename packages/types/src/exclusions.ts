import { z } from 'zod';

export const CreateExclusionBody = z.object({
  integration: z.enum(['emby', 'kodi', 'nuvio']),
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'show']),
  title: z.string().min(1),
});
export type CreateExclusionBody = z.infer<typeof CreateExclusionBody>;

export interface ScrobbleExclusion {
  id: number;
  integration: 'emby' | 'kodi' | 'nuvio';
  tmdbId: number;
  mediaType: 'movie' | 'show';
  title: string;
  createdAt: string;
}
