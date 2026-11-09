import crypto from 'crypto';
import { createAdminClient } from './server';

export const SAFE_ATTACHMENT_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
};

export const SAFE_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function sanitizeStorageSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 64) || 'general';
}

export function classifyAttachmentType(mimeType: string): 'image' | 'video' | 'audio' | 'doc' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'doc';
}

export async function uploadFileToSupabaseStorage(options: {
  file: File;
  folder: string;
  bucket?: 'public-media' | 'draft-media';
  maxSizeBytes?: number;
  allowedMimeMap?: Record<string, string>;
}): Promise<{
  publicUrl: string;
  storagePath: string;
  fileType: 'image' | 'video' | 'audio' | 'doc';
  mimeType: string;
  sizeBytes: number;
}> {
  const {
    file,
    folder,
    bucket = 'public-media',
    maxSizeBytes = 25 * 1024 * 1024,
    allowedMimeMap = SAFE_ATTACHMENT_MIME_TO_EXT,
  } = options;

  if (!file || file.size === 0) {
    throw new Error('File is empty or missing.');
  }

  if (file.size > maxSizeBytes) {
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`File size exceeds the ${limitMb} MB limit.`);
  }

  // Strip codec parameters e.g. "audio/webm;codecs=opus" -> "audio/webm"
  const normalizedMime = (file.type || '').split(';')[0].trim().toLowerCase();
  const ext = allowedMimeMap[normalizedMime];

  if (!ext) {
    throw new Error(
      `Unsupported or restricted file type "${file.type || 'unknown'}". Allowed formats: JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV, Audio, PDF, TXT.`
    );
  }

  const randomHex = crypto.randomBytes(12).toString('hex');
  const filename = `${Date.now()}_${randomHex}.${ext}`;
  const cleanFolder = folder
    .split('/')
    .map((seg) => sanitizeStorageSegment(seg))
    .filter(Boolean)
    .join('/');
  const storagePath = `${cleanFolder}/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const adminClient = await createAdminClient();

  const { error: uploadError } = await adminClient.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: normalizedMime,
      upsert: false,
    });

  if (uploadError) {
    // If bucket does not exist yet, create it and retry once
    if (uploadError.message.toLowerCase().includes('not found')) {
      await adminClient.storage.createBucket(bucket, {
        public: bucket === 'public-media',
      });
      const retry = await adminClient.storage.from(bucket).upload(storagePath, buffer, {
        contentType: normalizedMime,
        upsert: false,
      });
      if (retry.error) {
        console.error('[Storage] Upload retry error:', retry.error);
        throw new Error('Failed to upload file. Please try again.');
      }
    } else {
      console.error('[Storage] Upload error:', uploadError);
      throw new Error('Failed to upload file. Please try again.');
    }
  }

  let publicUrl = '';
  if (bucket === 'public-media') {
    const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(storagePath);
    publicUrl = urlData.publicUrl;
  } else {
    const { data: signData, error: signErr } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);
    if (signErr || !signData?.signedUrl) {
      throw new Error('Failed to generate signed URL for draft media');
    }
    publicUrl = signData.signedUrl;
  }

  return {
    publicUrl,
    storagePath,
    fileType: classifyAttachmentType(normalizedMime),
    mimeType: normalizedMime,
    sizeBytes: file.size,
  };
}

