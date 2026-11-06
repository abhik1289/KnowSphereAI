import ImageKit from "@imagekit/nodejs";
import { getImageKitEnv } from "@/lib/config/server.config";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const allowedTypes: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ],
  ".doc": ["application/msword", "application/octet-stream"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
  ],
  ".md": ["text/markdown", "text/plain", "text/x-markdown"],
};

let imageKit: ImageKit | undefined;

function getImageKit() {
  imageKit ??= new ImageKit({
    privateKey: getImageKitEnv().IMAGEKIT_PRIVATE_KEY,
  });
  return imageKit;
}

export function validateDocumentFile(file: File) {
  const extension = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  if (!extension || !allowedTypes[extension]) {
    throw new StorageValidationError(
      "Unsupported file type. Upload PDF, DOCX, DOC, TXT, CSV, XLSX, or MD files.",
    );
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE) {
    throw new StorageValidationError("Files must be between 1 byte and 25 MB.");
  }
  if (!allowedTypes[extension].includes(file.type || "application/octet-stream")) {
    throw new StorageValidationError("The file extension and MIME type do not match.");
  }
}

export class StorageValidationError extends Error {}

export async function uploadPrivateDocument(
  file: File,
  userId: string,
  workspaceId: string,
) {
  const { bytes, checksum } = await inspectDocumentFile(file);

  const safeName = file.name
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(-180);
  const uploaded = await getImageKit().files.upload({
    file: new File([bytes], safeName, { type: file.type }),
    fileName: safeName,
    folder: `/knowsphere/${userId}/${workspaceId}`,
    isPrivateFile: true,
    useUniqueFileName: true,
  });

  if (!uploaded.fileId || !uploaded.filePath) {
    throw new Error("ImageKit did not return a file ID and path for the upload");
  }

  return {
    fileId: uploaded.fileId,
    filePath: uploaded.filePath,
    checksum,
  };
}

export async function inspectDocumentFile(file: File) {
  validateDocumentFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase();

  if (extension === ".pdf" && new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new StorageValidationError("This file is not a valid PDF.");
  }
  if (
    [".docx", ".xlsx"].includes(extension ?? "") &&
    !(bytes[0] === 0x50 && bytes[1] === 0x4b)
  ) {
    throw new StorageValidationError("This file is not a valid Office document.");
  }
  if ([".txt", ".csv", ".md"].includes(extension ?? "")) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new StorageValidationError("Text files must use valid UTF-8 encoding.");
    }
    if (bytes.includes(0)) {
      throw new StorageValidationError("Text files cannot contain binary data.");
    }
  }

  const checksum = await crypto.subtle
    .digest("SHA-256", bytes)
    .then((hash) =>
      [...new Uint8Array(hash)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
    );

  return { bytes, checksum };
}

export async function deletePrivateFile(fileId: string) {
  await getImageKit().files.delete(fileId);
}

export function createPrivateFileUrl(filePath: string) {
  const { IMAGEKIT_URL_ENDPOINT } = getImageKitEnv();
  return getImageKit().helper.buildSrc({
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    src: filePath,
    signed: true,
    expiresIn: 300,
  });
}
