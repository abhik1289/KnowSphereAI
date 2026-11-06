import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { auth } from "@/features/auth/server/auth";
import { db } from "@/prisma/db";
import {
  ApiErrorSchema,
  ChatMessageSchema,
  ConversationCreateSchema,
  ConversationDtoSchema,
  ConversationIdSchema,
  ConversationUpdateSchema,
  DocumentDtoSchema,
  DocumentIdSchema,
  DocumentUpdateSchema,
  DocumentUploadSchema,
  MessageDtoSchema,
  PaginationSchema,
  WorkspaceCreateSchema,
  WorkspaceDtoSchema,
  WorkspaceIdSchema,
  WorkspaceUpdateSchema,
} from "../shared/schemas";
import { generateDummyResponse } from "./dummy-response";
import {
  createPrivateFileUrl,
  deletePrivateFile,
  inspectDocumentFile,
  StorageValidationError,
  uploadPrivateDocument,
} from "./imagekit-storage";

type ApiVariables = { userId: string };
type ApiContext = Context<{ Variables: ApiVariables }>;
const api = new Hono<{ Variables: ApiVariables }>();
const pageSizeBytes = 25 * 1024 * 1024;

function errorResponse(
  c: ApiContext,
  status: 400 | 401 | 404 | 409 | 413 | 415 | 500,
  code: string,
  message: string,
) {
  const payload = ApiErrorSchema.parse({
    success: false,
    error: { code, message },
  });
  return c.json(payload, status);
}

function dataResponse(c: ApiContext, data: unknown) {
  return c.json({ success: true as const, data, meta: null });
}

api.use("*", async (c, next) => {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse(c, 401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  c.set("userId", session.user.id);
  await next();
});

api.onError((error, c) => {
  console.error("Workspace API request failed", {
    path: c.req.path,
    error: error instanceof Error ? error.message : "Unknown error",
  });
  return errorResponse(c, 500, "INTERNAL_ERROR", "Something went wrong.");
});

async function findOwnedWorkspace(id: string, ownerId: string) {
  return db.orm.public.Workspace.first({ id, ownerId });
}

async function findOwnedConversation(id: string, ownerId: string) {
  const conversation = await db.orm.public.Conversation.first({ id });
  if (!conversation) return null;
  const workspace = await findOwnedWorkspace(conversation.workspaceId, ownerId);
  return workspace ? conversation : null;
}

async function processCleanup(ownerId: string) {
  const now = new Date();
  const cleanupItems = await db.orm.public.StorageCleanup
    .where({ ownerId })
    .orderBy((item) => item.nextAttemptAt.asc())
    .all();
  const dueItems = cleanupItems
    .filter((item) => item.nextAttemptAt <= now)
    .slice(0, 10);

  for (const item of dueItems) {
    try {
      await deletePrivateFile(item.imagekitFileId);
      await db.orm.public.StorageCleanup
        .where({ id: item.id })
        .delete();
    } catch (error) {
      const attempts = item.attempts + 1;
      const retryMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
      console.error("ImageKit cleanup failed; queued for retry", {
        cleanupId: item.id,
        attempts,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      await db.orm.public.StorageCleanup.where({ id: item.id }).update({
        attempts,
        nextAttemptAt: new Date(Date.now() + retryMinutes * 60_000),
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      });
    }
  }
}

function workspaceDto(
  workspace: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  documentCount: number,
  conversationCount: number,
) {
  return WorkspaceDtoSchema.parse({
    ...workspace,
    documentCount,
    conversationCount,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  });
}

function documentDto(document: {
  id: string;
  workspaceId: string;
  originalName: string;
  mimeType: string;
  size: number;
  processingStatus: string;
  createdAt: Date;
}) {
  return DocumentDtoSchema.parse({
    ...document,
    createdAt: document.createdAt.toISOString(),
  });
}

function conversationDto(conversation: {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return ConversationDtoSchema.parse({
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  });
}

function messageDto(message: {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: Date;
}) {
  return MessageDtoSchema.parse({
    ...message,
    createdAt: message.createdAt.toISOString(),
  });
}

api.get("/workspaces", async (c) => {
  const query = PaginationSchema.safeParse(c.req.query());
  if (!query.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid pagination or search.");
  }
  const { page, limit, search } = query.data;
  const ownerId = c.get("userId");
  await processCleanup(ownerId);
  let workspaces = db.orm.public.Workspace.where({ ownerId });
  if (search) {
    workspaces = workspaces.where((workspace) =>
      workspace.name.ilike(`%${search}%`),
    );
  }
  const rows = await workspaces
    .orderBy((workspace) => workspace.updatedAt.desc())
    .limit(limit)
    .offset((page - 1) * limit)
    .all();
  const data = await Promise.all(
    rows.map(async (workspace) => {
      const documents = await db.orm.public.Document.where({
        workspaceId: workspace.id,
      }).all();
      const conversations = await db.orm.public.Conversation.where({
        workspaceId: workspace.id,
      }).all();
      return workspaceDto(workspace, documents.length, conversations.length);
    }),
  );
  return dataResponse(c, data);
});

api.post("/workspaces", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = WorkspaceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid workspace details.");
  }
  const now = new Date();
  const workspace = await db.orm.public.Workspace.create({
    id: randomUUID(),
    ...parsed.data,
    description: parsed.data.description ?? null,
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
    ownerId: c.get("userId"),
    createdAt: now,
    updatedAt: now,
  });
  return dataResponse(c, workspaceDto(workspace, 0, 0));
});

api.get("/workspaces/:workspaceId", async (c) => {
  const id = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  if (!id.success) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const workspace = await findOwnedWorkspace(id.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const documents = await db.orm.public.Document.where({
    workspaceId: workspace.id,
  }).all();
  const conversations = await db.orm.public.Conversation.where({
    workspaceId: workspace.id,
  }).all();
  return dataResponse(c, workspaceDto(workspace, documents.length, conversations.length));
});

api.patch("/workspaces/:workspaceId", async (c) => {
  const id = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  const body = await c.req.json().catch(() => null);
  const parsed = WorkspaceUpdateSchema.safeParse(body);
  if (!id.success) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  if (!parsed.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid workspace details.");
  }
  const workspace = await findOwnedWorkspace(id.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const updated = await db.orm.public.Workspace.where({ id: workspace.id }).update({
    ...parsed.data,
    updatedAt: new Date(),
  });
  if (!updated) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  return dataResponse(c, workspaceDto(updated, 0, 0));
});

api.delete("/workspaces/:workspaceId", async (c) => {
  const id = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  if (!id.success) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const workspace = await findOwnedWorkspace(id.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const documents = await db.orm.public.Document.where({
    workspaceId: workspace.id,
  }).all();
  await db.transaction(async (tx) => {
    for (const document of documents) {
      await tx.orm.public.StorageCleanup.create({
        id: randomUUID(),
        ownerId: c.get("userId"),
        imagekitFileId: document.imagekitFileId,
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        createdAt: new Date(),
      });
    }
    await tx.orm.public.Workspace.where({ id: workspace.id }).delete();
  });
  await processCleanup(c.get("userId"));
  return dataResponse(c, { deleted: true });
});

api.get("/workspaces/:workspaceId/documents", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  if (!workspaceId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const documents = await db.orm.public.Document
    .where({ workspaceId: workspace.id })
    .orderBy((document) => document.createdAt.desc())
    .all();
  return dataResponse(c, documents.map(documentDto));
});

api.post("/workspaces/:workspaceId/documents", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  if (!workspaceId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > pageSizeBytes + 1024 * 1024) {
    return errorResponse(c, 413, "FILE_TOO_LARGE", "File exceeds the 25 MB limit.");
  }
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Select a document to upload.");
  }
  const metadata = DocumentUploadSchema.safeParse({
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  });
  if (!metadata.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid document metadata or size.");
  }
  let inspected: Awaited<ReturnType<typeof inspectDocumentFile>>;
  try {
    inspected = await inspectDocumentFile(file);
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return errorResponse(c, 415, "UNSUPPORTED_FILE", error.message);
    }
    throw error;
  }
  const duplicate = await db.orm.public.Document.first({
    workspaceId: workspace.id,
    checksum: inspected.checksum,
  });
  if (duplicate) {
    return errorResponse(c, 409, "DUPLICATE_FILE", "This document is already in this workspace.");
  }

  const uploaded = await uploadPrivateDocument(file, c.get("userId"), workspace.id);
  try {
    const now = new Date();
    const document = await db.orm.public.Document.create({
      id: randomUUID(),
      workspaceId: workspace.id,
      originalName: metadata.data.originalName,
      storageKey: uploaded.filePath,
      imagekitFileId: uploaded.fileId,
      mimeType: metadata.data.mimeType,
      size: metadata.data.size,
      checksum: uploaded.checksum,
      processingStatus: "ready",
      createdAt: now,
      updatedAt: now,
    });
    await db.orm.public.Workspace.where({ id: workspace.id }).update({
      updatedAt: now,
    });
    return dataResponse(c, documentDto(document));
  } catch (error) {
    try {
      await deletePrivateFile(uploaded.fileId);
    } catch (cleanupError) {
      await db.orm.public.StorageCleanup.create({
        id: randomUUID(),
        ownerId: c.get("userId"),
        imagekitFileId: uploaded.fileId,
        attempts: 1,
        nextAttemptAt: new Date(Date.now() + 60_000),
        lastError:
          cleanupError instanceof Error ? cleanupError.message.slice(0, 500) : "Cleanup failed",
        createdAt: new Date(),
      });
      console.error("Failed to clean up an unrecorded ImageKit upload", {
        fileId: uploaded.fileId,
      });
    }
    throw error;
  }
});

api.patch("/workspaces/:workspaceId/documents/:documentId", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  const documentId = DocumentIdSchema.safeParse(c.req.param("documentId"));
  const body = await c.req.json().catch(() => null);
  const parsed = DocumentUpdateSchema.safeParse(body);
  if (!workspaceId.success || !documentId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  }
  if (!parsed.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid document name.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  const document = await db.orm.public.Document.first({
    id: documentId.data,
    workspaceId: workspace.id,
  });
  if (!document) return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  const updated = await db.orm.public.Document.where({ id: document.id }).update({
    originalName: parsed.data.originalName,
    updatedAt: new Date(),
  });
  if (!updated) return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  return dataResponse(c, documentDto(updated));
});

api.delete("/workspaces/:workspaceId/documents/:documentId", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  const documentId = DocumentIdSchema.safeParse(c.req.param("documentId"));
  if (!workspaceId.success || !documentId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  const document = await db.orm.public.Document.first({
    id: documentId.data,
    workspaceId: workspace.id,
  });
  if (!document) return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  await db.transaction(async (tx) => {
    await tx.orm.public.StorageCleanup.create({
      id: randomUUID(),
      ownerId: c.get("userId"),
      imagekitFileId: document.imagekitFileId,
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      createdAt: new Date(),
    });
    await tx.orm.public.Document.where({ id: document.id }).delete();
  });
  await processCleanup(c.get("userId"));
  return dataResponse(c, { deleted: true });
});

api.get("/workspaces/:workspaceId/documents/:documentId/download", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  const documentId = DocumentIdSchema.safeParse(c.req.param("documentId"));
  if (!workspaceId.success || !documentId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  const document = await db.orm.public.Document.first({
    id: documentId.data,
    workspaceId: workspace.id,
  });
  if (!document) return errorResponse(c, 404, "NOT_FOUND", "Document not found.");
  return c.redirect(createPrivateFileUrl(document.storageKey), 302);
});

api.get("/workspaces/:workspaceId/conversations", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  const query = PaginationSchema.safeParse(c.req.query());
  if (!workspaceId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  }
  if (!query.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid pagination or search.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const { page, limit, search } = query.data;
  let conversations = db.orm.public.Conversation.where({
    workspaceId: workspace.id,
  });
  if (search) {
    conversations = conversations.where((conversation) =>
      conversation.title.ilike(`%${search}%`),
    );
  }
  const rows = await conversations
    .orderBy((conversation) => conversation.updatedAt.desc())
    .limit(limit)
    .offset((page - 1) * limit)
    .all();
  return dataResponse(c, rows.map(conversationDto));
});

api.post("/workspaces/:workspaceId/conversations", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  const body = await c.req.json().catch(() => ({}));
  const parsed = ConversationCreateSchema.safeParse(body);
  if (!workspaceId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  }
  if (!parsed.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid conversation details.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  if (!workspace) return errorResponse(c, 404, "NOT_FOUND", "Workspace not found.");
  const now = new Date();
  const conversation = await db.orm.public.Conversation.create({
    id: randomUUID(),
    workspaceId: workspace.id,
    title: parsed.data.title,
    createdAt: now,
    updatedAt: now,
  });
  return dataResponse(c, conversationDto(conversation));
});

api.patch("/workspaces/:workspaceId/conversations/:conversationId", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  const conversationId = ConversationIdSchema.safeParse(c.req.param("conversationId"));
  const body = await c.req.json().catch(() => null);
  const parsed = ConversationUpdateSchema.safeParse(body);
  if (!workspaceId.success || !conversationId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  if (!parsed.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid conversation title.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  const conversation = await db.orm.public.Conversation.first({
    id: conversationId.data,
    workspaceId: workspaceId.data,
  });
  if (!workspace || !conversation) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  const updated = await db.orm.public.Conversation.where({
    id: conversation.id,
  }).update({ title: parsed.data.title, updatedAt: new Date() });
  if (!updated) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  return dataResponse(c, conversationDto(updated));
});

api.delete("/workspaces/:workspaceId/conversations/:conversationId", async (c) => {
  const workspaceId = WorkspaceIdSchema.safeParse(c.req.param("workspaceId"));
  const conversationId = ConversationIdSchema.safeParse(c.req.param("conversationId"));
  if (!workspaceId.success || !conversationId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  const workspace = await findOwnedWorkspace(workspaceId.data, c.get("userId"));
  const conversation = await db.orm.public.Conversation.first({
    id: conversationId.data,
    workspaceId: workspaceId.data,
  });
  if (!workspace || !conversation) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  await db.orm.public.Conversation.where({ id: conversation.id }).delete();
  return dataResponse(c, { deleted: true });
});

api.get("/conversations/:conversationId/messages", async (c) => {
  const conversationId = ConversationIdSchema.safeParse(
    c.req.param("conversationId"),
  );
  if (!conversationId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  const conversation = await findOwnedConversation(
    conversationId.data,
    c.get("userId"),
  );
  if (!conversation) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  const messages = await db.orm.public.Message
    .where({ conversationId: conversation.id })
    .orderBy((message) => message.createdAt.asc())
    .all();
  return dataResponse(c, messages.map(messageDto));
});

api.post("/conversations/:conversationId/messages", async (c) => {
  const conversationId = ConversationIdSchema.safeParse(
    c.req.param("conversationId"),
  );
  const body = await c.req.json().catch(() => null);
  const parsed = ChatMessageSchema.safeParse(body);
  if (!conversationId.success) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  if (!parsed.success) {
    return errorResponse(c, 400, "VALIDATION_ERROR", "Invalid message.");
  }
  const conversation = await findOwnedConversation(
    conversationId.data,
    c.get("userId"),
  );
  if (!conversation) {
    return errorResponse(c, 404, "NOT_FOUND", "Conversation not found.");
  }
  const reusedRequest = await db.orm.public.Message.first({
    requestId: parsed.data.requestId,
  });
  if (
    reusedRequest &&
    (reusedRequest.conversationId !== conversation.id ||
      reusedRequest.role !== "user")
  ) {
    return errorResponse(c, 409, "REQUEST_ID_REUSED", "This request ID was already used.");
  }
  const userMessage =
    reusedRequest ??
    (await db.orm.public.Message.create({
      id: randomUUID(),
      conversationId: conversation.id,
      role: "user",
      content: parsed.data.content,
      requestId: parsed.data.requestId,
      createdAt: new Date(),
    }));

  const previousMessages = await db.orm.public.Message
    .where({ conversationId: conversation.id })
    .limit(2)
    .all();
  const title =
    conversation.title === "New chat" && previousMessages.length <= 1
      ? parsed.data.content.slice(0, 60)
      : conversation.title;
  await db.orm.public.Conversation.where({ id: conversation.id }).update({
    title,
    updatedAt: new Date(),
  });

  const assistantRequestId = `${parsed.data.requestId}:assistant`;
  const existingAssistant = await db.orm.public.Message.first({
    requestId: assistantRequestId,
  });
  if (
    existingAssistant &&
    existingAssistant.conversationId !== conversation.id
  ) {
    return errorResponse(c, 409, "REQUEST_ID_REUSED", "This request ID was already used.");
  }

  return streamSSE(
    c,
    async (stream) => {
      const assistantMessageId = existingAssistant?.id ?? randomUUID();
      await stream.writeSSE({
        event: "message_start",
        data: JSON.stringify({ messageId: assistantMessageId }),
      });
      const response =
        existingAssistant?.content ?? generateDummyResponse(userMessage.content);
      const characters = Array.from(response);
      let interrupted = false;
      stream.onAbort(() => {
        interrupted = true;
      });
      for (let index = 0; index < characters.length; index += 24) {
        const content = characters.slice(index, index + 24).join("");
        if (interrupted || stream.aborted) return;
        await stream.writeSSE({
          event: "message_delta",
          data: JSON.stringify({ content }),
        });
        await stream.sleep(24);
      }
      if (interrupted || stream.aborted) return;
      if (!existingAssistant) {
        await db.orm.public.Message.create({
          id: assistantMessageId,
          conversationId: conversation.id,
          role: "assistant",
          content: response,
          requestId: assistantRequestId,
          createdAt: new Date(),
        });
      }
      await stream.writeSSE({
        event: "message_complete",
        data: JSON.stringify({ messageId: assistantMessageId }),
      });
    },
    async (error, stream) => {
      console.error("Chat response stream failed", {
        conversationId: conversation.id,
        error: error.message,
      });
      await stream.writeSSE({
        event: "message_error",
        data: JSON.stringify({ message: "The response could not be completed." }),
      });
    },
  );
});

export { api as workspaceApi };
