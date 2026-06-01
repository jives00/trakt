import { z } from 'zod';

export const EmbyWebhookPayload = z.object({
  Event: z.string().optional(),
  Item: z.object({
    Type: z.enum(['Movie', 'Episode']),
    ProviderIds: z.record(z.string()).optional(),
    SeriesProviderIds: z.record(z.string()).optional(),
    IndexNumber: z.number().int().optional(),
    ParentIndexNumber: z.number().int().optional(),
    RunTimeTicks: z.number().int(),
  }),
  PlaybackInfo: z.object({
    PositionTicks: z.number().int(),
  }),
});
export type EmbyWebhookPayload = z.infer<typeof EmbyWebhookPayload>;
