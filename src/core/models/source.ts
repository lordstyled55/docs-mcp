import { z } from 'zod';

export const SourceTypeSchema = z.enum(['local', 'git', 'web', 'api']);

export const SourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: SourceTypeSchema,
  url: z.string(),
  enabled: z.boolean().default(true),
  schedule: z.string().optional(), // cron expression
  lastCrawled: z.date().optional(),
  settings: z.record(z.unknown()).optional(),
  filters: z.object({
    include: z.array(z.string()).optional(), // glob patterns
    exclude: z.array(z.string()).optional(), // glob patterns
    maxDepth: z.number().optional(),
    maxSize: z.number().optional(), // bytes
  }).optional(),
});

export type SourceConfig = z.infer<typeof SourceConfigSchema>;

export const SourceStatusSchema = z.object({
  sourceId: z.string(),
  status: z.enum(['idle', 'crawling', 'success', 'error']),
  lastRun: z.date().optional(),
  lastError: z.string().optional(),
  documentsFound: z.number().default(0),
  documentsProcessed: z.number().default(0),
  documentsSkipped: z.number().default(0),
  duration: z.number().optional(), // milliseconds
});

export type SourceStatus = z.infer<typeof SourceStatusSchema>;