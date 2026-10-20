import { API_BASE_URL, getAuthToken } from "@/lib/apiClient";
import { compressImage } from "@/components/editor/utils/imageCompressor";

export interface MediaUploadResponse {
  url: string;
  filename: string;
  size: number;
  mime_type: string;
  hash: string;
}

export interface UploadMediaResult {
  src: string;
  alt: string;
  isFallbackDataUrl?: boolean;
}

/**
 * Uploads an image file to the backend media endpoint with automatic client-side
 * WebP compression. If the backend is unavailable or the client is offline, it
 * gracefully falls back to a compact WebP Data URL to ensure user flow is uninterrupted.
 */
export async function uploadMediaAsset(file: File): Promise<UploadMediaResult> {
  let compressedBlob: Blob = file;
  let fallbackDataUrl = "";

  try {
    const compression = await compressImage(file, { maxWidth: 1920, quality: 0.82 });
    compressedBlob = compression.blob;
    fallbackDataUrl = compression.dataUrl;
  } catch (err) {
    console.warn("[MediaService] Client compression failed, using original file:", err);
  }

  try {
    const formData = new FormData();
    // Keep appropriate extension
    const ext = file.type === "image/svg+xml" ? ".svg" : ".webp";
    const baseName = file.name ? file.name.replace(/\.[^.]+$/, "") : "image";
    const uploadFilename = `${baseName}${ext}`;
    formData.append("file", compressedBlob, uploadFilename);

    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/media/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const data: MediaUploadResponse = await response.json();
    const fullUrl = data.url.startsWith("http") ? data.url : `${API_BASE_URL}${data.url}`;

    return {
      src: fullUrl,
      alt: file.name || "image",
      isFallbackDataUrl: false,
    };
  } catch (err) {
    console.warn("[MediaService] Backend upload failed, falling back to compressed Data URL:", err);

    if (!fallbackDataUrl) {
      fallbackDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || "");
        reader.readAsDataURL(file);
      });
    }

    return {
      src: fallbackDataUrl,
      alt: file.name || "image",
      isFallbackDataUrl: true,
    };
  }
}
