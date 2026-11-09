import { useSyncExternalStore } from 'react';

export interface PostMediaItem {
  storage_path: string;
  media_type: string;
  alt_text?: string | null;
  sort_order: number;
  url?: string;
  dataUrl?: string;
}

export interface PostData {
  id?: string;
  title: string;
  slug: string;
  post_type: 'blog' | 'poster' | 'photo';
  status: 'draft' | 'published' | 'archived';
  excerpt: string;
  body: string;
  cover_image: string | null;
  media?: PostMediaItem[];
}

export interface PostEditorProps {
  initialData?: PostData;
  isEditMode?: boolean;
}

export interface CompressedResult {
  blob: Blob;
  dataUrl: string;
  name: string;
  type: string;
  size: number;
}

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function emptySubscribe() {
  return () => {};
}

export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Client-side image compression: maintains aspect ratio, converts to modern WebP, limits dimensions
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.8
): Promise<CompressedResult> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          blob: file,
          dataUrl: reader.result as string,
          name: file.name,
          type: file.type,
          size: file.size,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      const MAX_DIM = maxWidth;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            blob: file,
            dataUrl: reader.result as string,
            name: file.name,
            type: file.type,
            size: file.size,
          });
        };
        reader.readAsDataURL(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const outputType = 'image/webp';
      const dataUrl = canvas.toDataURL(outputType, quality);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              blob: file,
              dataUrl,
              name: file.name,
              type: file.type,
              size: file.size,
            });
            return;
          }

          const compressedName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          const compressedFile = new File([blob], compressedName, { type: outputType });

          resolve({
            blob: compressedFile,
            dataUrl,
            name: compressedName,
            type: outputType,
            size: blob.size,
          });
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image "${file.name}" for compression.`));
    };

    img.src = objectUrl;
  });
}

