import { z } from 'zod';

export const CreateExclusionBody = z.object({
  integration: z.enum(['emby', 'stremio', 'kodi']),
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'show']),
  title: z.string().min(1),
});
export type CreateExclusionBody = z.infer<typeof CreateExclusionBody>;

export interface ScrobbleExclusion {
  id: number;
  integration: 'emby' | 'stremio' | 'kodi';
  tmdbId: number;
  mediaType: 'movie' | 'show';
  title: string;
  createdAt: string;
}
