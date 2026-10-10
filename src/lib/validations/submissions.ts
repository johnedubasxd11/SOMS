import { z } from 'zod';

import type { SubmissionStatus } from '@/lib/labels';

/**
 * Same list the `submissions` bucket enforces (defense in depth: the server
 * validates again before anything touches storage).
 */
export const ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
] as const;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_REQUEST = 5;

/**
 * Statuses that must carry reviewer remarks before the transition runs.
 * Matches what transition_submission() enforces server-side (approving at a
 * step may stay remark-free; rejecting or sending back may not).
 */
export const REMARKS_REQUIRED_STATUSES: SubmissionStatus[] = [
  'rejected',
  'revision_requested',
];

export const transitionSchema = z.object({
  id: z.uuid('Invalid record id'),
  module: z.string(),
  to_status: z.enum([
    'draft',
    'submitted',
    'under_review',
    'revision_requested',
    'approved',
    'rejected',
  ]),
  remarks: z.string().trim().max(1000, 'Remarks are too long').optional(),
});

export type TransitionInput = z.infer<typeof transitionSchema>;

export const commentSchema = z.object({
  id: z.uuid('Invalid record id'),
  module: z.string(),
  remarks: z
    .string()
    .trim()
    .min(2, 'Write a remark before posting')
    .max(1000, 'Remarks are too long'),
});

export type CommentInput = z.infer<typeof commentSchema>;

export const attachmentSchema = z.object({
  id: z.uuid('Invalid record id'),
  module: z.string(),
});

/** OSA logging the paper copy of a submission. */
export const markHardcopySchema = z.object({
  record_type: z.enum([
    'activity_proposal',
    'accomplishment_report',
    'audit_document',
    'other_document',
  ]),
  record_id: z.uuid('Invalid record id'),
  receiver_name: z
    .string()
    .trim()
    .min(2, 'Receiver name is required')
    .max(200, 'Receiver name is too long'),
  remarks: z.string().trim().max(1000, 'Remarks are too long').optional(),
});

export type MarkHardcopyInput = z.infer<typeof markHardcopySchema>;
