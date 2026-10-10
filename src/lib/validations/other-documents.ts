import { z } from 'zod';

export const OTHER_DOCUMENT_CATEGORIES = [
  'constitution_by_laws',
  'resolution',
  'memo',
  'minutes',
  'other',
] as const;

export type OtherDocumentCategory = (typeof OTHER_DOCUMENT_CATEGORIES)[number];

export const OTHER_DOCUMENT_CATEGORY_LABELS: Record<OtherDocumentCategory, string> = {
  constitution_by_laws: 'Constitution & By-Laws',
  resolution: 'Resolution',
  memo: 'Memo',
  minutes: 'Minutes',
  other: 'Other',
};

export const otherDocumentSchema = z.object({
  id: z.uuid('Invalid document id').optional(),
  title: z
    .string()
    .trim()
    .min(5, 'Enter a descriptive title (at least 5 characters)')
    .max(200, 'Title is too long'),
  description: z.string().trim().max(4000, 'Description is too long').optional(),
  category: z.enum(OTHER_DOCUMENT_CATEGORIES, 'Pick a category'),
});

export type OtherDocumentInput = z.infer<typeof otherDocumentSchema>;
