"use client";

import { z } from "zod";
import {
  ApiErrorSchema,
  DocumentDtoSchema,
  type DocumentDto,
  type WorkspaceCreate,
  WorkspaceDtoSchema,
} from "../shared/schemas";

const envelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  meta: z.unknown().nullable(),
});

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(payload);
    throw new Error(
      error.success ? error.data.error.message : "The request could not be completed.",
    );
  }
  const envelope = envelopeSchema.parse(payload);
  return schema.parse(envelope.data);
}

export function createWorkspace(input: WorkspaceCreate) {
  return apiRequest(
    "/api/user/workspaces",
    WorkspaceDtoSchema,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function uploadDocument(
  workspaceId: string,
  file: File,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
) {
  return new Promise<DocumentDto>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);
    request.open("POST", `/api/user/workspaces/${workspaceId}/documents`);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const payload: unknown = request.response;
      if (request.status < 200 || request.status >= 300) {
        const error = ApiErrorSchema.safeParse(payload);
        reject(
          new Error(
            error.success
              ? error.data.error.message
              : "The upload could not be completed.",
          ),
        );
        return;
      }
      try {
        const envelope = envelopeSchema.parse(payload);
        resolve(DocumentDtoSchema.parse(envelope.data));
      } catch {
        reject(new Error("The server returned an invalid upload response."));
      }
    };
    request.onerror = () => reject(new Error("Network error while uploading."));
    request.onabort = () => reject(new DOMException("Upload cancelled.", "AbortError"));
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(body);
  });
}
