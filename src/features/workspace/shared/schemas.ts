import { z } from "zod";

export const WorkspaceIdSchema = z.string().uuid();
export const ConversationIdSchema = z.string().uuid();
export const DocumentIdSchema = z.string().uuid();

export const WorkspaceCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional().nullable(),
    icon: z.string().trim().max(16).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  })
  .strict();

export const WorkspaceUpdateSchema = WorkspaceCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one field to update",
);

export const DocumentUploadSchema = z
  .object({
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.string().min(1).max(128),
    size: z.number().int().positive().max(25 * 1024 * 1024),
  })
  .strict();

export const DocumentUpdateSchema = z
  .object({
    originalName: z.string().trim().min(1).max(255),
  })
  .strict();

export const ConversationCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).default("New chat"),
  })
  .strict();

export const ConversationUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
  })
  .strict();

export const ChatMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(8000),
    requestId: z.string().uuid(),
  })
  .strict();

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).default(""),
});

export const WorkspaceDtoSchema = z.object({
  id: WorkspaceIdSchema,
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  documentCount: z.number().int().nonnegative(),
  conversationCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DocumentDtoSchema = z.object({
  id: DocumentIdSchema,
  workspaceId: WorkspaceIdSchema,
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  processingStatus: z.string(),
  createdAt: z.string().datetime(),
});

export const ConversationDtoSchema = z.object({
  id: ConversationIdSchema,
  workspaceId: WorkspaceIdSchema,
  title: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const MessageDtoSchema = z.object({
  id: z.string().uuid(),
  conversationId: ConversationIdSchema,
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type WorkspaceCreate = z.infer<typeof WorkspaceCreateSchema>;
export type WorkspaceDto = z.infer<typeof WorkspaceDtoSchema>;
export type DocumentDto = z.infer<typeof DocumentDtoSchema>;
export type ConversationDto = z.infer<typeof ConversationDtoSchema>;
export type MessageDto = z.infer<typeof MessageDtoSchema>;
