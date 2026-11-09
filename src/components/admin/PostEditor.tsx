'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Link2,
  X,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Alert';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  type PostData,
  type PostEditorProps,
  type PostMediaItem,
  compressImage,
  slugify,
  useMounted,
} from './post-editor/utils';
import { MarkdownPreview } from './post-editor/MarkdownPreview';
import { EditorToolbar } from './post-editor/EditorToolbar';
import { AiGeneratorModal, type AiTone } from './post-editor/AiGeneratorModal';

export type { PostData, PostEditorProps };

export function PostEditor({ initialData, isEditMode = false }: PostEditorProps) {
  const mounted = useMounted();
  const router = useRouter();
  const pathname = usePathname();
  const postsBasePath = pathname.startsWith('/super-admin') ? '/super-admin/posts' : '/admin/posts';
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const docImageInputRef = useRef<HTMLInputElement>(null);

  // Core Form State
  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [autoSlug, setAutoSlug] = useState(!isEditMode);
  const [postType, setPostType] = useState<'blog' | 'poster' | 'photo'>(
    initialData?.post_type || 'blog'
  );
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    initialData?.status || 'draft'
  );
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || '');
  const [body, setBody] = useState(initialData?.body || '');
  const [coverImage, setCoverImage] = useState<string | null>(initialData?.cover_image || null);
  const [mediaList, setMediaList] = useState<PostMediaItem[]>(initialData?.media || []);

  // AI Generator State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState<AiTone>('exciting');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Drag and Drop & Document Image Upload
  const [isDraggingOverDoc, setIsDraggingOverDoc] = useState(false);
  const [uploadingDocImage, setUploadingDocImage] = useState(false);

  // Unlimited Images & Media Reordering State
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const imagesSliderRef = useRef<HTMLDivElement>(null);
  const [isDraggingOverImages, setIsDraggingOverImages] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Top Highlighted Cover Upload Controls
  const topCoverInputRef = useRef<HTMLInputElement>(null);
  const [showTopUrlInput, setShowTopUrlInput] = useState(false);
  const [topUrlInput, setTopUrlInput] = useState('');

  // In-memory pending compressed image blobs (held locally until post submission)
  const pendingBlobsRef = useRef<Map<string, Blob>>(new Map());

  // General UI State
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const draftKey = `sandys_cms_draft_${isEditMode && initialData?.id ? initialData.id : 'new'}`;

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      try {
        if (!title && !body && mediaList.length === 0) return;
        const draft = {
          title,
          slug,
          postType,
          excerpt,
          body,
          coverImage,
          mediaList,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // quota exceeded or private mode
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [mounted, title, slug, postType, excerpt, body, coverImage, mediaList, draftKey]);

  const embeddedDocImages = React.useMemo(() => {
    const list: Array<{ alt: string; url: string; raw: string }> = [];
    const regex = /!\[([\s\S]*?)\]\(([\s\S]*?)\)/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
      list.push({
        alt: match[1]?.trim() || 'Embedded Image',
        url: match[2]?.trim().replace(/\s+/g, ''),
        raw: match[0],
      });
    }
    return list;
  }, [body]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (autoSlug) {
      setSlug(slugify(val));
    }
  };

  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const selectedText = body.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 10);
  };

  const insertImageIntoDoc = async (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError(`Unsupported image type (${file.type}). Allowed: JPEG, PNG, WebP, AVIF.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image size exceeds the 5MB limit.');
      return;
    }

    setUploadingDocImage(true);
    setError(null);

    try {
      const compressed = await compressImage(file);
      const localUrl = URL.createObjectURL(compressed.blob);
      pendingBlobsRef.current.set(localUrl, compressed.blob);

      const cleanAlt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const imageMarkdown = `\n\n![${cleanAlt}](${localUrl})\n\n`;

      const textarea = bodyTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart ?? body.length;
        const end = textarea.selectionEnd ?? body.length;
        const newBody = body.substring(0, start) + imageMarkdown + body.substring(end);
        setBody(newBody);
      } else {
        setBody((prev) => prev + imageMarkdown);
      }

      setMediaList((prev) => [
        ...prev,
        {
          storage_path: localUrl,
          media_type: compressed.type,
          alt_text: cleanAlt,
          sort_order: prev.length,
          url: localUrl,
          dataUrl: compressed.dataUrl,
        },
      ]);

      if (!coverImage) {
        setCoverImage(localUrl);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Image compression failed';
      setError(msg);
    } finally {
      setUploadingDocImage(false);
      setIsDraggingOverDoc(false);
    }
  };

  const handleDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverDoc(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          insertImageIntoDoc(files[i]);
          break;
        }
      }
    }
  };

  const handleDocDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOverDoc) setIsDraggingOverDoc(true);
  };

  const handleDocDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverDoc(false);
  };

  const handleGenerateAiPost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPrompt.trim()) {
      setError('Please enter a topic or gaming description for the AI to write about.');
      return;
    }

    setIsGeneratingAi(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          tone: aiTone,
          postType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to auto-write blog');
      }

      if (data.title) setTitle(data.title);
      if (data.slug) setSlug(data.slug);
      if (data.excerpt) setExcerpt(data.excerpt);
      if (data.body) setBody(data.body);

      setShowAiModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation error';
      setError(msg);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleTopCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError(`Unsupported image type (${file.type}). Allowed: JPEG, PNG, WebP, AVIF.`);
      return;
    }
    try {
      const compressed = await compressImage(file);
      const localUrl = URL.createObjectURL(compressed.blob);
      pendingBlobsRef.current.set(localUrl, compressed.blob);

      setCoverImage(localUrl);

      setMediaList((prev) => {
        if (prev.some((m) => m.url === localUrl)) return prev;
        return [
          {
            storage_path: localUrl,
            media_type: compressed.type,
            alt_text: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            sort_order: 0,
            url: localUrl,
            dataUrl: compressed.dataUrl,
          },
          ...prev,
        ];
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    }
  };

  const handleAttachTopUrl = () => {
    const trimmed = topUrlInput.trim();
    if (!trimmed) return;
    setCoverImage(trimmed);
    setMediaList((prev) => {
      if (prev.some((m) => m.url === trimmed)) return prev;
      return [
        {
          storage_path: trimmed,
          media_type: 'image/jpeg',
          alt_text: title || 'Cover Image',
          sort_order: 0,
          url: trimmed,
        },
        ...prev,
      ];
    });
    setTopUrlInput('');
    setShowTopUrlInput(false);
  };

  const handleImagesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    setError(null);

    try {
      const newItems: PostMediaItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          throw new Error(
            `File "${file.name}" has unsupported type (${file.type}). Allowed: JPEG, PNG, WebP, AVIF.`
          );
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File "${file.name}" exceeds the 5MB limit.`);
        }

        const compressed = await compressImage(file);
        const localUrl = URL.createObjectURL(compressed.blob);
        pendingBlobsRef.current.set(localUrl, compressed.blob);

        const cleanAlt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        newItems.push({
          storage_path: localUrl,
          media_type: compressed.type,
          alt_text: cleanAlt,
          sort_order: mediaList.length + newItems.length,
          url: localUrl,
          dataUrl: compressed.dataUrl,
        });
      }

      setMediaList((prev) => {
        const updated = [...prev, ...newItems];
        if (!coverImage && newItems.length > 0 && newItems[0].url) {
          setCoverImage(newItems[0].url);
        }
        return updated;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Compression failed';
      setError(msg);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleAttachImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('/')
    ) {
      setError('Please provide a valid image URL starting with http://, https://, or /');
      return;
    }

    const newItem: PostMediaItem = {
      storage_path: trimmed,
      media_type: 'image/jpeg',
      alt_text: title || 'Post Image',
      sort_order: mediaList.length,
      url: trimmed,
    };

    setMediaList((prev) => [...prev, newItem]);
    if (!coverImage) {
      setCoverImage(trimmed);
    }
    setImageUrlInput('');
    setShowUrlInput(false);
  };

  const toggleCoverHighlight = (imgUrl?: string) => {
    if (!imgUrl) return;
    if (coverImage === imgUrl) {
      setCoverImage(null);
    } else {
      setCoverImage(imgUrl);
    }
  };

  const chooseImageIntoText = (item: {
    url?: string;
    storage_path: string;
    alt_text?: string | null;
  }) => {
    const imgUrl = item.url || item.storage_path;
    if (!imgUrl) return;

    const alt = item.alt_text || title || 'Post image';
    const md = `\n\n![${alt}](${imgUrl})\n\n`;
    const textarea = bodyTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? body.length;
      const end = textarea.selectionEnd ?? body.length;
      const newBody = body.substring(0, start) + md + body.substring(end);
      setBody(newBody);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + md.length, start + md.length);
      }, 10);
    } else {
      setBody((prev) => prev + md);
    }
  };

  const scrollImagesSlider = (direction: 'left' | 'right') => {
    if (!imagesSliderRef.current) return;
    const scrollAmount = 240;
    imagesSliderRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const removeImage = (index: number) => {
    const itemToRemove = mediaList[index];
    if (!itemToRemove) return;

    const imgUrl = itemToRemove.url || itemToRemove.storage_path;

    if (imgUrl && pendingBlobsRef.current.has(imgUrl)) {
      pendingBlobsRef.current.delete(imgUrl);
      if (imgUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imgUrl);
      }
    }

    setMediaList((prev) => prev.filter((_, i) => i !== index));

    if (imgUrl && coverImage === imgUrl) {
      setCoverImage(null);
    }

    if (imgUrl) {
      const escapedUrl = imgUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      setBody((prev) =>
        prev
          .replace(new RegExp(`!\\[[^\\]]*\\]\\(${escapedUrl}\\)\\s*`, 'g'), '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      );
    }
  };

  const moveImage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= mediaList.length) return;
    setMediaList((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated.map((m, idx) => ({ ...m, sort_order: idx }));
    });
  };

  const handleSubmit = async (targetStatus?: 'draft' | 'published') => {
    const finalStatus = targetStatus || status;
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    if (!slug.trim()) {
      setError('Slug is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const pendingMap = pendingBlobsRef.current;
      const urlReplacements: Record<string, string> = {};
      const pathReplacements: Record<string, string> = {};

      if (pendingMap.size > 0) {
        for (const [localUrl, blob] of pendingMap.entries()) {
          const matchingMedia = mediaList.find(
            (m) => m.url === localUrl || m.storage_path === localUrl
          );
          const rawName = matchingMedia?.alt_text || 'post-media';
          const fileName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.webp';

          const formData = new FormData();
          formData.append('file', blob, fileName);
          formData.append('isDraft', 'false');
          formData.append('folder', 'docs');

          const uploadRes = await fetch('/api/admin/media/upload', {
            method: 'POST',
            body: formData,
          });

          const uploadData = await uploadRes.json();
          if (!uploadRes.ok) {
            throw new Error(
              uploadData.error ||
                `Failed to upload image "${matchingMedia?.alt_text || fileName}"`
            );
          }

          const serverUrl = uploadData.url as string;
          const storagePath = (uploadData.storagePath as string) || serverUrl;

          urlReplacements[localUrl] = serverUrl;
          pathReplacements[localUrl] = storagePath;

          if (localUrl.startsWith('blob:')) {
            URL.revokeObjectURL(localUrl);
          }
        }

        pendingBlobsRef.current.clear();
      }

      let finalBody = body;
      let finalCoverImage = coverImage;

      for (const [localUrl, serverUrl] of Object.entries(urlReplacements)) {
        const escaped = localUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        finalBody = finalBody.replace(new RegExp(escaped, 'g'), serverUrl);

        if (finalCoverImage === localUrl) {
          finalCoverImage = serverUrl;
        }
      }

      const finalMedia = mediaList.map((m, idx) => {
        const finalPath =
          pathReplacements[m.storage_path] ||
          urlReplacements[m.storage_path] ||
          m.storage_path;
        return {
          storage_path: finalPath,
          media_type: m.media_type,
          alt_text: m.alt_text || title,
          sort_order: idx,
        };
      });

      setBody(finalBody);
      setCoverImage(finalCoverImage);
      setMediaList((prev) =>
        prev.map((m, idx) => ({
          ...m,
          url: urlReplacements[m.url || ''] || m.url,
          storage_path:
            pathReplacements[m.storage_path] ||
            urlReplacements[m.storage_path] ||
            m.storage_path,
          sort_order: idx,
        }))
      );

      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        post_type: postType,
        status: finalStatus,
        excerpt: excerpt.trim() || null,
        body: finalBody || null,
        cover_image: finalCoverImage || null,
        media: finalMedia,
      };

      const url =
        isEditMode && initialData?.id
          ? `/api/admin/posts/${initialData.id}`
          : '/api/admin/posts';

      const method = isEditMode ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to save post.');
      }

      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }

      setTimeout(() => {
        router.push(postsBasePath);
        router.refresh();
      }, 600);
    } catch (err: unknown) {
      setError(sanitizeErrorMessage(err, 'Unable to save post. Please try again.'));
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/posts/${initialData.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete post');
      }

      setShowDeleteModal(false);
      router.push(postsBasePath);
      router.refresh();
    } catch (err: unknown) {
      setError(sanitizeErrorMessage(err, 'Unable to delete post.'));
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3.5 max-w-5xl mx-auto pb-24 sm:pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 border-b border-white/[0.08] pb-3 w-full">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Link
            href={postsBasePath}
            className="p-1 -ml-1 text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Back to Posts"
            title="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate max-w-[130px] xs:max-w-none">
            {isEditMode ? 'Edit Post' : 'Create New Post'}
          </h1>
          <button
            type="button"
            onClick={() => setStatus(status === 'draft' ? 'published' : 'draft')}
            className={`text-[9px] sm:text-[10px] font-semibold uppercase px-1.5 sm:px-2 py-0.5 rounded border transition-colors cursor-pointer shrink-0 ${
              status === 'published'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/40 hover:bg-amber-900/60'
            }`}
            title="Click to toggle status"
          >
            {status}
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isEditMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-400 border-red-500/30 hover:bg-red-950/30 h-7 sm:h-8 text-[11px] sm:text-xs px-2 sm:px-2.5"
              title="Delete Post"
            >
              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSubmit('draft')}
            className="h-7 sm:h-8 text-[11px] sm:text-xs px-2 sm:px-3 whitespace-nowrap"
            title="Save as Draft"
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin sm:mr-1" />
            ) : (
              <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
            )}
            <span className="hidden xs:inline sm:inline">Save Draft</span>
            <span className="xs:hidden sm:hidden">Draft</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSubmit('published')}
            className="bg-[#e8364b] hover:bg-[#b01328] text-white shadow-[0_0_12px_rgba(232,54,75,0.35)] h-7 sm:h-8 text-[11px] sm:text-xs px-2.5 sm:px-3.5 font-bold whitespace-nowrap"
            title="Publish Post"
          >
            {isSubmitting ? (
              <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin sm:mr-1" />
            ) : (
              <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
            )}
            <span className="hidden xs:inline sm:inline">Publish</span>
            <span className="xs:hidden sm:hidden">Post</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Notice">
          {error}
        </Alert>
      )}

      {/* Main Post Details */}
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <label htmlFor="post-title" className="block text-[11px] font-semibold text-neutral-300">
              Post Title <span className="text-[#e8364b]">*</span>
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. Fire Kirin Strategy: High Multipliers & Boss Battles"
              className="w-full rounded-xl border border-white/[0.1] bg-[#16161d] px-3.5 py-2 text-sm font-semibold text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none h-[38px]"
            />
          </div>

          <div className="w-36 sm:w-48 shrink-0 space-y-1">
            <label htmlFor="post-category" className="block text-[11px] font-semibold text-neutral-300">
              Category <span className="text-[#e8364b]">*</span>
            </label>
            <div className="relative">
              <select
                id="post-category"
                value={postType}
                onChange={(e) => setPostType(e.target.value as 'blog' | 'poster' | 'photo')}
                className="w-full appearance-none rounded-xl border border-white/[0.1] bg-[#16161d] px-3 py-2 text-xs font-semibold text-white focus:border-[#e8364b] focus:outline-none cursor-pointer pr-8 h-[38px]"
              >
                <option value="blog" className="bg-[#16161d] text-white">
                  Blog Article
                </option>
                <option value="poster" className="bg-[#16161d] text-white">
                  Tournament Poster
                </option>
                <option value="photo" className="bg-[#16161d] text-white">
                  Esports Photography
                </option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            </div>
          </div>
        </div>

        {/* URL Slug + Top Highlighted Cover */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="post-slug" className="block text-[11px] font-semibold text-neutral-300">
              URL Slug <span className="text-[#e8364b]">*</span>
            </label>
            <button
              type="button"
              onClick={() => setAutoSlug(!autoSlug)}
              className="text-[10px] text-[#ff6b7d] hover:underline cursor-pointer"
            >
              {autoSlug ? 'Auto-synced' : 'Manual'}
            </button>
          </div>
          <div className="flex items-center rounded-xl border border-white/[0.1] bg-[#16161d] px-3 py-2 h-[38px]">
            <span className="text-xs text-neutral-500 font-mono">
              {postType === 'blog' ? '/blog/' : '/posts/'}
            </span>
            <input
              id="post-slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                setAutoSlug(false);
              }}
              placeholder="post-slug"
              className="w-full bg-transparent text-xs font-mono text-white focus:outline-none ml-0.5"
            />
          </div>

          <input
            ref={topCoverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              handleTopCoverUpload(e);
              e.target.value = '';
            }}
            className="hidden"
          />

          {!coverImage ? (
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => topCoverInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#e8364b] hover:bg-[#b01328] px-3 py-1.5 text-xs font-bold text-white transition-all shadow-sm cursor-pointer h-[34px]"
                title="Upload top cover image"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Cover</span>
              </button>

              {!showTopUrlInput ? (
                <button
                  type="button"
                  onClick={() => setShowTopUrlInput(true)}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/[0.1] bg-[#16161d] px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-white/20 transition-colors cursor-pointer h-[34px]"
                  title="Paste Cover Image URL"
                >
                  <Link2 className="h-3.5 w-3.5 text-neutral-400" />
                  <span>or URL</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 h-[34px] flex-wrap">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={topUrlInput}
                    onChange={(e) => setTopUrlInput(e.target.value)}
                    className="w-48 sm:w-60 rounded-xl border border-white/[0.1] bg-[#16161d] px-2.5 py-1 text-xs text-white h-[34px] focus:border-[#e8364b] focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAttachTopUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAttachTopUrl}
                    className="rounded-xl bg-white text-neutral-900 px-2.5 text-xs font-bold h-[34px] hover:bg-neutral-200 transition-colors cursor-pointer"
                  >
                    Attach
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTopUrlInput(false)}
                    className="text-neutral-400 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <span className="text-[10px] text-neutral-500 ml-1 hidden sm:inline">
                Top highlighted cover image (or star an image below)
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] mt-1.5 animate-fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImage}
                  alt="Top Cover"
                  className="h-10 w-16 rounded-lg object-cover border border-amber-500/40 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    <span className="truncate">Top Highlighted Cover</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button
                      type="button"
                      onClick={() => topCoverInputRef.current?.click()}
                      className="text-[11px] text-blue-400 hover:underline cursor-pointer font-medium"
                    >
                      Replace
                    </button>
                    <span className="text-white/20">&bull;</span>
                    <button
                      type="button"
                      onClick={() => setCoverImage(null)}
                      className="text-[11px] text-red-400 hover:underline cursor-pointer font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCoverImage(null)}
                className="text-[11px] text-neutral-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
                title="Remove top cover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Description / Short Excerpt */}
        <div className="space-y-1">
          <label htmlFor="post-excerpt" className="block text-[11px] font-semibold text-neutral-300">
            Description / Short Excerpt
          </label>
          <textarea
            id="post-excerpt"
            rows={2}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="A compelling 1-2 sentence synopsis shown on search engines and card previews..."
            className="w-full rounded-xl border border-white/[0.1] bg-[#16161d] p-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none leading-relaxed resize-none"
          />
        </div>

        {/* Unlimited Images Grid & Drag-and-Drop */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="block text-[11px] font-semibold text-neutral-300">Images</label>
              <span className="text-[10px] text-neutral-500 font-mono">
                ({mediaList.length} unlimited)
              </span>
            </div>
            {mediaList.length > 0 && (
              <span className="text-[10px] text-neutral-400 hidden sm:inline">
                Reorder with finger or drag &amp; drop
              </span>
            )}
          </div>

          <input
            ref={multiFileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              if (e.target.files) handleImagesUpload(e.target.files);
              e.target.value = '';
            }}
            disabled={uploadingImages}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => multiFileInputRef.current?.click()}
              disabled={uploadingImages}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#e8364b] hover:bg-[#b01328] px-3.5 py-2 text-xs font-bold text-white transition-all shadow-sm cursor-pointer h-[38px]"
              title="Upload images"
            >
              {uploadingImages ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>{uploadingImages ? 'Uploading...' : 'Upload'}</span>
            </button>

            {!showUrlInput ? (
              <button
                type="button"
                onClick={() => setShowUrlInput(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-white/[0.1] bg-[#16161d] px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:border-white/20 transition-colors cursor-pointer h-[38px]"
                title="Paste Image URL"
              >
                <Link2 className="h-3.5 w-3.5 text-neutral-400" />
                <span>or URL</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 h-[38px] flex-wrap">
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="w-48 sm:w-64 rounded-xl border border-white/[0.1] bg-[#16161d] px-2.5 py-1.5 text-xs text-white h-[38px] focus:border-[#e8364b] focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAttachImageUrl();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAttachImageUrl}
                  className="rounded-xl bg-white text-neutral-900 px-3 text-xs font-bold h-[38px] hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  Attach
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className="text-neutral-400 hover:text-white p-1 cursor-pointer"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div
            className={`rounded-xl border transition-colors p-2.5 ${
              isDraggingOverImages
                ? 'border-[#e8364b] bg-[#e8364b]/10'
                : 'border-white/[0.08] bg-[#16161d]/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOverImages(true);
            }}
            onDragLeave={() => setIsDraggingOverImages(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOverImages(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleImagesUpload(e.dataTransfer.files);
              }
            }}
          >
            {mediaList.length === 0 ? (
              <div
                onClick={() => multiFileInputRef.current?.click()}
                className="py-6 text-center cursor-pointer hover:bg-white/[0.02] rounded-lg transition-colors"
              >
                <Upload className="h-6 w-6 text-neutral-500 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-neutral-300">
                  Drop unlimited images here or tap Upload
                </p>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  Drag and drop with finger &bull; Star to highlight as cover &bull; Mark in text
                </p>
              </div>
            ) : (
              <div className="relative group/slider">
                <div
                  ref={imagesSliderRef}
                  className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 px-1 scroll-smooth scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent snap-x"
                >
                  {mediaList.map((item, idx) => {
                    const imgUrl = item.url || item.storage_path;
                    const isCover = coverImage === imgUrl;
                    const countInText = imgUrl
                      ? (
                          body.match(
                            new RegExp(imgUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
                          ) || []
                        ).length
                      : 0;

                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => setDraggedIdx(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedIdx !== null && draggedIdx !== idx) {
                            moveImage(draggedIdx, idx);
                            setDraggedIdx(null);
                          }
                        }}
                        onClick={() => chooseImageIntoText(item)}
                        className={`group relative h-20 w-20 sm:h-24 sm:w-24 aspect-square rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer snap-start select-none bg-black/60 shadow-md ${
                          isCover
                            ? 'border-amber-400 ring-2 ring-amber-400/20'
                            : 'border-white/10 hover:border-[#e8364b] hover:scale-[1.03]'
                        }`}
                        title="Click to choose & insert into text (can be chosen multiple times)"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={item.alt_text || 'Post image'}
                          className="h-full w-full object-cover pointer-events-none"
                        />

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCoverHighlight(imgUrl);
                          }}
                          className={`absolute top-1 left-1 p-1 rounded-md backdrop-blur-md transition-all cursor-pointer ${
                            isCover
                              ? 'bg-amber-400 text-black shadow-sm'
                              : 'bg-black/60 text-white/70 hover:text-amber-300 hover:bg-black/80'
                          }`}
                          title={isCover ? 'Remove top cover' : 'Star as top cover'}
                        >
                          <Star className={`h-3 w-3 ${isCover ? 'fill-black' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white/70 hover:text-red-400 hover:bg-black/90 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                          title="Remove image (vanishes from text)"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>

                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent py-1 px-1.5 flex items-center justify-between text-[9px] font-bold text-white pointer-events-none">
                          <span className="truncate group-hover:text-[#ff6b7d] transition-colors">
                            + Choose
                          </span>
                          {countInText > 0 && (
                            <span className="bg-emerald-500/90 text-black text-[8px] font-black px-1 rounded">
                              {countInText}x
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {mediaList.length > 3 && (
                  <>
                    <button
                      type="button"
                      onClick={() => scrollImagesSlider('left')}
                      className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/80 border border-white/10 text-white hover:bg-black hover:scale-110 transition-all opacity-0 group-hover/slider:opacity-100 cursor-pointer shadow-lg"
                      title="Slide left"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollImagesSlider('right')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/80 border border-white/10 text-white hover:bg-black hover:scale-110 transition-all opacity-0 group-hover/slider:opacity-100 cursor-pointer shadow-lg"
                      title="Slide right"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rich Content Composer */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">Article Content &amp; Media</span>
          </div>

          <div className="inline-flex rounded-lg border border-white/[0.08] bg-[#16161d] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('write')}
              className={`rounded-md px-3 py-1 font-semibold transition-colors cursor-pointer ${
                activeTab === 'write'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1 rounded-md px-3 py-1 font-semibold transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {activeTab === 'write' && (
          <EditorToolbar
            onInsertFormatting={insertFormatting}
            onInsertImageFile={insertImageIntoDoc}
            docImageInputRef={docImageInputRef}
          />
        )}

        {embeddedDocImages.length > 0 && activeTab === 'write' && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/[0.08] animate-fade-in">
            <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5 mr-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Attached Images ({embeddedDocImages.length}):
            </span>
            {embeddedDocImages.map((img, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#16161d] px-2 py-1 text-xs text-neutral-200 shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt}
                  className="h-7 w-7 rounded object-cover border border-white/15"
                />
                <span
                  className="max-w-[130px] truncate text-[11px] text-neutral-300 font-medium"
                  title={img.alt}
                >
                  {img.alt}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newBody = body
                      .replace(img.raw, '')
                      .replace(/\n\n\n+/g, '\n\n')
                      .trim();
                    setBody(newBody);
                  }}
                  className="text-neutral-500 hover:text-red-400 p-0.5 cursor-pointer transition-colors"
                  title="Remove image from document"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className="relative min-h-[380px] rounded-xl overflow-hidden"
          onDragOver={handleDocDragOver}
          onDragEnter={handleDocDragOver}
          onDragLeave={handleDocDragLeave}
          onDrop={handleDocDrop}
        >
          {isDraggingOverDoc && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 border-2 border-dashed border-[#e8364b] rounded-xl backdrop-blur-xs animate-fade-in pointer-events-none">
              <Upload className="h-10 w-10 text-[#ff6b7d] animate-bounce" />
              <p className="mt-2 text-sm font-bold text-white">Drop image to upload &amp; insert</p>
              <p className="text-xs text-neutral-400">
                Compresses to WebP and uploads to cloud storage on publish
              </p>
            </div>
          )}

          {uploadingDocImage && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 rounded-xl backdrop-blur-xs">
              <Loader2 className="h-8 w-8 animate-spin text-[#e8364b]" />
              <p className="mt-2 text-xs font-semibold text-white">Optimizing image...</p>
            </div>
          )}

          {activeTab === 'write' ? (
            <textarea
              ref={bodyTextareaRef}
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Start composing your article here... Use the Word-like toolbar above or drag and drop images anywhere into this box."
              className="w-full rounded-xl border border-white/[0.1] bg-[#16161d] p-3.5 font-sans text-sm leading-relaxed text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none transition-colors"
            />
          ) : (
            <div className="min-h-[360px] rounded-xl border border-white/[0.08] bg-[#16161d] p-4 sm:p-6 overflow-y-auto">
              <MarkdownPreview content={body} />
            </div>
          )}
        </div>
      </div>

      {/* AI Generator Modal & Floating Action Button */}
      <AiGeneratorModal
        mounted={mounted}
        isOpen={showAiModal}
        onOpen={() => setShowAiModal(true)}
        onClose={() => setShowAiModal(false)}
        aiPrompt={aiPrompt}
        onPromptChange={setAiPrompt}
        aiTone={aiTone}
        onToneChange={setAiTone}
        isGenerating={isGeneratingAi}
        onSubmit={handleGenerateAiPost}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Post Deletion"
        description="This action will permanently delete this post and remove all associated media from storage."
      >
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-500 text-white"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                <span>Deleting Assets...</span>
              </>
            ) : (
              <span>Confirm &amp; Delete</span>
            )}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
