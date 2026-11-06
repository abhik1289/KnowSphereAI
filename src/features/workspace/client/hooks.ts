"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  ChatMessageSchema,
  ConversationDtoSchema,
  ConversationUpdateSchema,
  DocumentDtoSchema,
  DocumentUploadSchema,
  DocumentUpdateSchema,
  MessageDtoSchema,
  WorkspaceCreateSchema,
  WorkspaceDtoSchema,
  WorkspaceUpdateSchema,
  type WorkspaceCreate,
} from "../shared/schemas";
import { sendMessageStream } from "./chat-stream";
import { apiRequest, createWorkspace, uploadDocument } from "./api-client";

const workspaceListSchema = z.array(WorkspaceDtoSchema);
const documentListSchema = z.array(DocumentDtoSchema);
const conversationListSchema = z.array(ConversationDtoSchema);
const messageListSchema = z.array(MessageDtoSchema);
const deletedSchema = z.object({ deleted: z.literal(true) });

function jsonBody(value: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(value) };
}

export function useWorkspaces(search: string, page = 1) {
  return useQuery({
    queryKey: ["workspaces", search, page],
    queryFn: () =>
      apiRequest(
        `/api/user/workspaces?search=${encodeURIComponent(search)}&page=${page}&limit=12`,
        workspaceListSchema,
      ),
  });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () =>
      apiRequest(`/api/user/workspaces/${workspaceId}`, WorkspaceDtoSchema),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkspaceCreate) =>
      createWorkspace(WorkspaceCreateSchema.parse(input)),
    onSuccess: () => client.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; description?: string }) => {
      const parsed = WorkspaceUpdateSchema.parse(input);
      return apiRequest(
        `/api/user/workspaces/${workspaceId}`,
        WorkspaceDtoSchema,
        { method: "PATCH", body: JSON.stringify(parsed) },
      );
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      client.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

export function useDeleteWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiRequest(
        `/api/user/workspaces/${workspaceId}`,
        deletedSchema,
        { method: "DELETE" },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useDocuments(workspaceId: string) {
  return useQuery({
    queryKey: ["documents", workspaceId],
    queryFn: () =>
      apiRequest(
        `/api/user/workspaces/${workspaceId}/documents`,
        documentListSchema,
      ),
    enabled: Boolean(workspaceId),
  });
}

export function useUploadDocument(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      signal,
      onProgress,
    }: {
      file: File;
      signal: AbortSignal;
      onProgress: (progress: number) => void;
    }) => {
      DocumentUploadSchema.parse({
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
      return uploadDocument(workspaceId, file, signal, onProgress);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["documents", workspaceId] });
      client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
  });
}

export function useUpdateDocument(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, originalName }: { documentId: string; originalName: string }) => {
      const parsed = DocumentUpdateSchema.parse({ originalName });
      return apiRequest(
        `/api/user/workspaces/${workspaceId}/documents/${documentId}`,
        DocumentDtoSchema,
        { method: "PATCH", body: JSON.stringify(parsed) },
      );
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["documents", workspaceId] }),
  });
}

export function useDeleteDocument(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      apiRequest(
        `/api/user/workspaces/${workspaceId}/documents/${documentId}`,
        deletedSchema,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["documents", workspaceId] });
      client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
  });
}

export function useConversations(workspaceId: string, search: string) {
  return useQuery({
    queryKey: ["conversations", workspaceId, search],
    queryFn: () =>
      apiRequest(
        `/api/user/workspaces/${workspaceId}/conversations?search=${encodeURIComponent(search)}&page=1&limit=50`,
        conversationListSchema,
      ),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateConversation(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/user/workspaces/${workspaceId}/conversations`,
        ConversationDtoSchema,
        jsonBody({}),
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["conversations", workspaceId] });
      client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
  });
}

export function useRenameConversation(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) => {
      const parsed = ConversationUpdateSchema.parse({ title });
      return apiRequest(
        `/api/user/workspaces/${workspaceId}/conversations/${conversationId}`,
        ConversationDtoSchema,
        { method: "PATCH", body: JSON.stringify(parsed) },
      );
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["conversations", workspaceId] });
    },
  });
}

export function useDeleteConversation(workspaceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiRequest(
        `/api/user/workspaces/${workspaceId}/conversations/${conversationId}`,
        deletedSchema,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["conversations", workspaceId] });
      client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    },
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () =>
      apiRequest(
        `/api/user/conversations/${conversationId}/messages`,
        messageListSchema,
      ),
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: ({
      conversationId,
      content,
      requestId,
      signal,
      onStart,
      onDelta,
      onComplete,
    }: {
      conversationId: string;
      content: string;
      requestId: string;
      signal: AbortSignal;
      onStart: (messageId: string) => void;
      onDelta: (content: string) => void;
      onComplete: (messageId: string) => void;
    }) => {
      const parsed = ChatMessageSchema.parse({ content, requestId });
      return sendMessageStream(conversationId, parsed, signal, {
        onStart,
        onDelta,
        onComplete,
      });
    },
  });
}

export { apiRequest };
