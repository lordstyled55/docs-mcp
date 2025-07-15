import { z } from 'zod';

export const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.enum(['markdown', 'html', 'pdf', 'text', 'json']),
  sourceId: z.string(),
  sourcePath: z.string(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  size: z.number().optional(),
  checksum: z.string().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;

export const DocumentSearchResultSchema = z.object({
  document: DocumentSchema,
  score: z.number(),
  highlights: z.array(z.string()).optional(),
});

export type DocumentSearchResult = z.infer<typeof DocumentSearchResultSchema>;

export const DocumentStatsSchema = z.object({
  totalDocuments: z.number(),
  documentsByType: z.record(z.number()),
  documentsBySource: z.record(z.number()),
  totalSize: z.number(),
  lastUpdated: z.date(),
});

export type DocumentStats = z.infer<typeof DocumentStatsSchema>;