export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputMimeType?: string;
}

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

/**
 * Compresses an image file client-side using offscreen canvas to WebP/JPEG format
 * with dimension constraints. Leaves SVGs untouched to preserve vector quality.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    outputMimeType = "image/webp",
  } = options;

  // Don't rasterize vector SVGs
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    const dataUrl = await readFileAsDataURL(file);
    return {
      blob: file,
      dataUrl,
      width: 0,
      height: 0,
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  // If in non-browser environment, fallback gracefully
  if (typeof window === "undefined" || typeof document === "undefined") {
    const dataUrl = await readFileAsDataURL(file);
    return {
      blob: file,
      dataUrl,
      width: 0,
      height: 0,
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  return new Promise<CompressedImageResult>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let targetWidth = img.naturalWidth || img.width;
      let targetHeight = img.naturalHeight || img.height;

      // Calculate constrained dimensions preserving aspect ratio
      if (targetWidth > maxWidth || targetHeight > maxHeight) {
        const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
        targetWidth = Math.round(targetWidth * ratio);
        targetHeight = Math.round(targetHeight * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback to original file
        readFileAsDataURL(file).then((dataUrl) => {
          resolve({
            blob: file,
            dataUrl,
            width: img.width,
            height: img.height,
            originalSize: file.size,
            compressedSize: file.size,
          });
        });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Attempt webp export
      const dataUrl = canvas.toDataURL(outputMimeType, quality);

      canvas.toBlob(
        (blob) => {
          const finalBlob = blob || file;
          resolve({
            blob: finalBlob,
            dataUrl,
            width: targetWidth,
            height: targetHeight,
            originalSize: file.size,
            compressedSize: finalBlob.size,
          });
        },
        outputMimeType,
        quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

export function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}
