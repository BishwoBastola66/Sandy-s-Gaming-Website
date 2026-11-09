/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
  XCircle,
  Paperclip,
  Mic,
  Square,
  Play,
  Pause,
  Download,
  FileText,
  X,
  ImageIcon,
  Eye,
} from 'lucide-react';
import type { ConversationStatus } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

export interface ChatAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number | null;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id?: string;
  body: string;
  message_type: string;
  created_at: string;
  is_self: boolean;
  sender_name: string;
  sender_role: string;
  status?: 'pending' | 'sent' | 'failed';
  errorDetails?: string;
  attachments?: ChatAttachment[];
}

interface ConversationData {
  id: string;
  customer_id: string;
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string;
  created_at: string;
}

interface CustomerChatClientProps {
  initialConversation: ConversationData | null;
  initialMessages: ChatMessage[];
  currentUserId: string;
  customerDisplayName: string;
  customerEmail?: string;
}

interface MediaPayload {
  type: 'image' | 'video' | 'voice' | 'doc';
  url: string;
  name?: string;
  size?: number;
  caption?: string;
}

/**
 * Meta-style (WhatsApp / Messenger) client-side image compression.
 * Downscales images to max 1920px and compresses to JPEG/WebP at 0.82 quality.
 */
async function compressImageMeta(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const maxDimension = 1920;
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
          } else {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }
        },
        'image/jpeg',
        0.82
      );
    };

    img.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function parseMediaMessage(body: string): MediaPayload | null {
  try {
    if (!body || !body.startsWith('{')) return null;
    const parsed = JSON.parse(body);
    if (parsed && parsed.url) {
      let type: 'image' | 'video' | 'voice' | 'doc' = 'doc';
      if (parsed.type) type = parsed.type;
      else if (parsed.category === 'images') type = 'image';
      else if (parsed.category === 'videos') type = 'video';
      else if (parsed.category === 'voice') type = 'voice';

      return {
        type,
        url: parsed.url,
        name: parsed.name,
        size: parsed.size,
        caption: parsed.caption,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Dedicated Voice Note audio player message widget.
 */
function AudioPlayerMessage({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/35 border border-white/[0.08] min-w-[210px] sm:min-w-[240px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8364b] text-white hover:bg-[#d12a3e] transition-colors cursor-pointer"
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 w-full bg-white/[0.12] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#e8364b] transition-all"
            style={{ width: duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%' }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : 'Voice note'}</span>
        </div>
      </div>
      <Mic className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
    </div>
  );
}

const CHAT_CACHE_KEY_PREFIX = 'sandy_chat_cache_v2_';

function getChatCacheKey(userId: string, convId?: string): string {
  return `${CHAT_CACHE_KEY_PREFIX}${userId}${convId ? `_${convId}` : ''}`;
}

function loadChatCache(userId: string, convId?: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getChatCacheKey(userId, convId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // LocalStorage parse or access error
  }
  return [];
}

function saveChatCache(userId: string, convId: string | undefined, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    const toCache = messages
      .filter((m) => m.status !== 'failed')
      .slice(-100);
    localStorage.setItem(getChatCacheKey(userId, convId), JSON.stringify(toCache));
  } catch {
    // LocalStorage quota exceeded
  }
}

export function CustomerChatClient({
  initialConversation,
  initialMessages,
  currentUserId,
  customerDisplayName,
}: CustomerChatClientProps) {
  const [conversation, setConversation] = useState<ConversationData | null>(initialConversation);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }
    const cached = loadChatCache(currentUserId, initialConversation?.id);
    return cached.length > 0 ? cached : initialMessages;
  });
  const [inputText, setInputText] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 30);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  // File Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Lightbox Preview Modal for Images
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Discord-style on-demand image loading (do not download images on load; load only when clicked)
  const [loadedImageIds, setLoadedImageIds] = useState<Record<string, boolean>>({});

  const toggleLoadImage = (id: string) => {
    setLoadedImageIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Lock window scroll so ONLY the center chat messages scroll inside the viewport
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    window.scrollTo(0, 0);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
    };
  }, []);

  const tempCounterRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const hasInitialScrolledRef = useRef(false);
  const prevMessagesCountRef = useRef(initialMessages.length);

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // Initial load: Scroll to bottom immediately so bottom/latest messages show first
  useEffect(() => {
    if (!hasInitialScrolledRef.current && messages.length > 0) {
      hasInitialScrolledRef.current = true;
      scrollToBottom(false);
    }
  }, [messages.length]);

  // Handle automatic scrolling on new messages
  useEffect(() => {
    if (isPrependingRef.current) return;
    if (messages.length > prevMessagesCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.is_self || isNearBottomRef.current) {
        scrollToBottom(true);
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages]);

  // Scroll listener: detects top of scroll for bottom-first infinite history loading
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 100;

    // When scrolled near top (scrollTop <= 40px), load earlier messages automatically
    if (container.scrollTop <= 40 && hasMore && !isLoadingMore && messages.length > 0) {
      handleLoadEarlier();
    }
  };

  // Save messages to browser local cache whenever updated
  useEffect(() => {
    if (messages.length > 0) {
      saveChatCache(currentUserId, conversation?.id, messages);
    }
  }, [messages, currentUserId, conversation?.id]);

  // Fallback auto-provisioning: If conversation is not yet loaded, resolve or create it
  useEffect(() => {
    if (conversation?.id) return;
    let isCancelled = false;

    const resolveConversation = async () => {
      try {
        const res = await fetch('/api/conversations?auto_create=true');
        if (!res.ok || isCancelled) return;
        setIsLiveConnected(true);
        const data = await res.json();
        if (data?.conversation && !isCancelled) {
          setConversation(data.conversation);
          setIsLiveConnected(true);
        }
      } catch {
        // Silently continue
      }
    };

    resolveConversation();
    return () => {
      isCancelled = true;
    };
  }, [conversation?.id]);

  // Connect to Supabase Realtime WebSocket for instant live messaging
  useEffect(() => {
    if (!conversation?.id) return;
    const convId = conversation.id;

    const supabase = createClient();
    const topic = `chat:${convId}`;

    const handleIncomingMsg = (newMsg: {
      id: string;
      conversation_id: string;
      body: string;
      message_type?: string;
      created_at: string;
      sender_id?: string;
      sender_role?: string;
      sender_name?: string;
      attachments?: ChatAttachment[];
    }) => {
      if (!newMsg || !newMsg.id) return;

      const isSelf = newMsg.sender_id === currentUserId;
      const formattedMsg: ChatMessage = {
        id: newMsg.id,
        conversation_id: newMsg.conversation_id,
        body: newMsg.body,
        message_type: newMsg.message_type || 'text',
        created_at: newMsg.created_at,
        is_self: isSelf,
        sender_name: isSelf ? 'You' : newMsg.sender_name || 'Sandy Gaming',
        sender_role: isSelf ? 'customer' : (newMsg.sender_role as 'customer' | 'staff') || 'staff',
        status: 'sent',
        attachments: newMsg.attachments || [],
      };

      setMessages((prev) => {
        const idxById = prev.findIndex((m) => m.id === newMsg.id);
        if (idxById !== -1) {
          const updated = [...prev];
          updated[idxById] = { ...updated[idxById], ...formattedMsg, status: 'sent' };
          return updated;
        }

        if (isSelf) {
          const pendingIdx = prev.findIndex(
            (m) =>
              (m.status === 'pending' || m.id.startsWith('temp-')) &&
              m.body.trim() === newMsg.body.trim()
          );
          if (pendingIdx !== -1) {
            const updated = [...prev];
            updated[pendingIdx] = { ...updated[pendingIdx], ...formattedMsg, status: 'sent' };
            return updated;
          }
        }

        return [...prev, formattedMsg];
      });
    };

    const channel = supabase.channel(topic, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'new_message' }, (resp) => {
        if (resp?.payload && typeof resp.payload === 'object') {
          handleIncomingMsg(resp.payload as any);
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          if (payload?.new && typeof payload.new === 'object') {
            handleIncomingMsg(payload.new as any);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsLiveConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsLiveConnected(false);
        }
      });

    const handleOnline = () => {
      setIsLiveConnected(true);
    };
    const handleOffline = () => {
      setIsLiveConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      channelRef.current = null;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, currentUserId]);

  // Active database synchronization fallback:
  // If Realtime is silent, delayed, or disconnected, periodically check for new messages in the DB
  const latestMessageTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      const persistedMessages = messages.filter((m) => m.status !== 'pending' && !m.id.startsWith('temp-'));
      if (persistedMessages.length > 0) {
        latestMessageTimestampRef.current = persistedMessages[persistedMessages.length - 1].created_at;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (!conversation?.id) return;

    let isCancelled = false;
    const convId = conversation.id;

    const syncNewMessages = async () => {
      const since = latestMessageTimestampRef.current;
      if (!since) return;

      try {
        const url = `/api/conversations/${convId}/messages?after=${encodeURIComponent(since)}&limit=30`;
        const res = await fetch(url);
        if (!res.ok || isCancelled) return;
        setIsLiveConnected(true);
        const data = await res.json();
        const incoming: ChatMessage[] = data.messages || [];

        if (incoming.length > 0 && !isCancelled) {
          setMessages((prev) => {
            let hasNew = false;
            const updated = [...prev];

            for (const newMsg of incoming) {
              const existingIdx = updated.findIndex((m) => m.id === newMsg.id);
              if (existingIdx !== -1) {
                updated[existingIdx] = { ...updated[existingIdx], ...newMsg, status: 'sent' };
              } else {
                const pendingIdx = updated.findIndex(
                  (m) =>
                    (m.status === 'pending' || m.id.startsWith('temp-')) &&
                    m.body.trim() === newMsg.body.trim()
                );
                if (pendingIdx !== -1) {
                  updated[pendingIdx] = { ...updated[pendingIdx], ...newMsg, status: 'sent' };
                } else {
                  updated.push({ ...newMsg, status: 'sent' });
                  hasNew = true;
                }
              }
            }

            return hasNew ? updated : updated;
          });
        }
      } catch {
        // Silently continue
      }
    };

    // Poll every 2.5 seconds
    const interval = setInterval(syncNewMessages, 2500);

    const handleFocus = () => syncNewMessages();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNewMessages();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [conversation?.id]);

  // Load earlier messages with bounded pagination
  const handleLoadEarlier = async () => {
    if (!conversation || isLoadingMore || !hasMore || messages.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsLoadingMore(true);
    isPrependingRef.current = true;
    prevScrollHeightRef.current = container.scrollHeight;

    const earliestTimestamp = messages[0].created_at;
    try {
      const res = await fetch(
        `/api/conversations/${conversation.id}/messages?limit=30&before=${encodeURIComponent(
          earliestTimestamp
        )}`
      );
      if (!res.ok) throw new Error('Failed to load earlier messages');
      const data = await res.json();
      const olderMessages: ChatMessage[] = (data.messages || []).map((m: ChatMessage) => ({
        ...m,
        status: 'sent',
      }));

      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages, ...prev]);
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newHeight = scrollContainerRef.current.scrollHeight;
            scrollContainerRef.current.scrollTop = newHeight - prevScrollHeightRef.current;
          }
          isPrependingRef.current = false;
        });
      } else {
        isPrependingRef.current = false;
      }
      setHasMore(Boolean(data.has_more));
    } catch (err: unknown) {
      isPrependingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Error loading history';
      setErrorBanner(msg);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send message
  const handleSendMessage = async (
    customBody?: string,
    retryId?: string,
    customType: 'text' | 'media' = 'text',
    customAttachments?: ChatAttachment[]
  ) => {
    const text = customBody !== undefined ? customBody : inputText.trim();
    const attachments = customAttachments || [];
    if ((!text && attachments.length === 0) || !conversation) return;

    if (customBody === undefined) {
      setInputText('');
    }

    tempCounterRef.current += 1;
    const tempId = retryId || `temp-${tempCounterRef.current}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversation_id: conversation.id,
      body: text,
      message_type: customType,
      created_at: new Date().toISOString(),
      is_self: true,
      sender_name: 'You',
      sender_role: 'customer',
      status: 'pending',
      attachments,
    };

    if (!retryId) {
      setMessages((prev) => [...prev, optimisticMessage]);
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === retryId ? { ...m, status: 'pending', errorDetails: undefined } : m))
      );
    }

    // Instant client-side broadcast dispatch over Supabase Realtime WebSocket
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: tempId,
          conversation_id: conversation.id,
          body: text,
          message_type: customType,
          created_at: optimisticMessage.created_at,
          sender_id: currentUserId,
          sender_role: 'customer',
          sender_name: customerDisplayName || 'You',
          attachments,
        },
      }).catch(() => {});
    }

    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: text,
          message_type: customType,
          attachments,
          attachment_ids: attachments
            .map((a) => a.id)
            .filter((id) => id && !id.startsWith('temp-') && !id.startsWith('legacy-')),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to dispatch message');
      }

      const data = await res.json();
      const realMessage = data.message;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                ...realMessage,
                id: realMessage.id,
                status: 'sent',
                created_at: realMessage.created_at,
                attachments: realMessage.attachments || attachments,
              }
            : m
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Message transmission failed';
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed', errorDetails: msg } : m))
      );
    }
  };

  // Upload attachment & send media message
  const handleUploadAndSend = async (rawFile: File, explicitCategory?: 'images' | 'videos' | 'voice' | 'docs') => {
    if (!conversation) return;

    setIsUploading(true);
    setErrorBanner(null);

    try {
      let fileToUpload = rawFile;

      // Meta client-side image compression
      if (rawFile.type.startsWith('image/')) {
        setUploadStatus('Compressing media...');
        fileToUpload = await compressImageMeta(rawFile);
      }

      setUploadStatus(`Uploading ${fileToUpload.name}...`);
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('conversation_id', conversation.id);
      if (explicitCategory) {
        formData.append('category', explicitCategory);
      }

      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload attachment');
      }

      let mediaType: 'image' | 'video' | 'voice' | 'doc' = 'doc';
      if (data.category === 'images' || data.mimeType?.startsWith('image/')) mediaType = 'image';
      else if (data.category === 'videos' || data.mimeType?.startsWith('video/')) mediaType = 'video';
      else if (data.category === 'voice' || data.mimeType?.startsWith('audio/')) mediaType = 'voice';

      tempCounterRef.current += 1;
      const attachmentObj: ChatAttachment = data.attachment || {
        id: `att-${tempCounterRef.current}`,
        file_name: data.originalName,
        file_url: data.url,
        file_type: mediaType,
        file_size: data.sizeBytes,
      };

      await handleSendMessage('', undefined, 'media', [attachmentObj]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending file';
      setErrorBanner(msg);
    } finally {
      setIsUploading(false);
      setUploadStatus(null);
    }
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setErrorBanner(`Could not access microphone: ${msg}`);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !conversation) return;

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingSeconds(0);

    mediaRecorderRef.current.onstop = async () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (audioBlob.size < 100) return;

      const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      await handleUploadAndSend(audioFile, 'voice');
    };

    mediaRecorderRef.current.stop();
  };

  const formatRecordingTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex-1 w-full h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] flex flex-col bg-[#0d0d11] overflow-hidden">
      {/* Lightbox Preview Modal for Full Size Images */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close image preview"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size view"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Alert Banner if any */}
      {errorBanner && (
        <div className="shrink-0 flex items-center justify-between bg-red-950/80 border-b border-red-500/30 px-4 py-2.5 text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-red-400 hover:text-red-200 font-semibold text-xs ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Full-Bleed Unified Direct Chat (Only One Continuous Chat) */}
      <div className="flex-1 w-full flex flex-col h-full min-h-0 min-w-0 bg-[#111115] relative overflow-hidden">
        {/* Chat Header (Clean Messenger Style, No chunky live pill) */}
        <div className="h-14 sm:h-16 px-3 sm:px-6 border-b border-white/[0.06] bg-[#141419]/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 relative z-10">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-black/40 border border-white/[0.08] p-1 overflow-hidden">
              <Image
                src="/brand/sandys-gaming-logo.png"
                alt="Sandy's Gaming"
                width={36}
                height={36}
                className="h-full w-full object-contain"
                priority
              />
              <span
                className={`absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border border-black ${
                  isLiveConnected ? 'bg-emerald-400' : 'bg-neutral-500'
                }`}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate leading-tight">
                Sandy Gaming
              </h2>
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5 leading-tight">
                <span className={`h-1.5 w-1.5 rounded-full ${isLiveConnected ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
                <span>{isLiveConnected ? 'Official Support • Active' : 'Connecting...'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* WhatsApp-Style Chat Background Watermark Logo (Fixed in center, transparent backdrop) */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
        >
          <div className="relative h-64 w-64 sm:h-80 sm:w-80 md:h-[420px] md:w-[420px] opacity-[0.06]">
            <Image
              src="/brand/sandys-gaming-logo.png"
              alt=""
              fill
              sizes="(max-width: 768px) 256px, 420px"
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Message Thread Scroll Area (Center Chat Only Scrolls) */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="relative z-[1] flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 space-y-4 bg-transparent"
        >
          {/* Top History Indicator for Bottom-First / Scroll-Up Pagination */}
          {isLoadingMore ? (
            <div className="flex justify-center pb-2 animate-fade-in">
              <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/50 px-3.5 py-1 text-xs text-neutral-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff6b7d]" />
                <span>Loading earlier messages...</span>
              </div>
            </div>
          ) : hasMore ? (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={handleLoadEarlier}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                <span>Scroll up or click to load history</span>
              </button>
            </div>
          ) : messages.length > 20 ? (
            <div className="text-center py-2 text-[11px] text-neutral-500 font-medium">
              Beginning of chat history
            </div>
          ) : null}

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#e8364b]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Welcome to Sandy&apos;s Gaming Chat, {customerDisplayName}!
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                Send messages, voice notes, screenshots, gameplay clips, or tournament documents anytime. Our specialists are always here.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isSelf = Boolean(
              msg.is_self ||
              msg.sender_name === 'You' ||
              (currentUserId && msg.sender_id && msg.sender_id === currentUserId) ||
              (customerDisplayName && msg.sender_name === customerDisplayName)
            );
            const legacyMedia = parseMediaMessage(msg.body);
            const attachments: ChatAttachment[] = (msg.attachments && msg.attachments.length > 0)
              ? msg.attachments
              : (legacyMedia ? [{
                  id: `legacy-${msg.id}`,
                  file_name: legacyMedia.name || 'Attachment',
                  file_url: legacyMedia.url,
                  file_type: legacyMedia.type,
                  file_size: legacyMedia.size,
                }] : []);

            const textContent = legacyMedia ? (legacyMedia.caption || '') : msg.body;

            return (
              <div
                key={msg.id}
                className={`w-full flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`flex items-center gap-1.5 mb-1 px-1 text-[11px] text-neutral-500 ${
                    isSelf ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span className="font-medium text-neutral-300">
                    {msg.sender_name}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Text Bubble (if message has body text) */}
                {textContent && textContent.trim().length > 0 && (
                  <div
                    className={`max-w-md sm:max-w-lg rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isSelf
                        ? 'bg-[#e8364b] text-white rounded-tr-xs shadow-[0_2px_12px_rgba(232,54,75,0.25)]'
                        : 'bg-[#181820] border border-white/[0.07] text-neutral-100 rounded-tl-xs'
                    }`}
                  >
                    {textContent}
                  </div>
                )}

                {/* Discord-Style Attachments Section */}
                {attachments.length > 0 && (
                  <div className={`flex flex-col gap-2 ${textContent && textContent.trim().length > 0 ? 'mt-1.5' : ''}`}>
                    {attachments.map((att) => {
                      const isImage =
                        att.file_type.startsWith('image') ||
                        att.file_type === 'images' ||
                        /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(att.file_url);
                      const isVideo =
                        att.file_type.startsWith('video') ||
                        att.file_type === 'videos' ||
                        /\.(mp4|webm|mov)$/i.test(att.file_url);
                      const isAudio =
                        att.file_type.startsWith('audio') ||
                        att.file_type === 'voice' ||
                        /\.(mp3|wav|ogg|webm)$/i.test(att.file_url);

                      if (isImage) {
                        const imageKey = att.id || att.file_url;
                        const isLoaded = Boolean(loadedImageIds[imageKey]);

                        return (
                          <div
                            key={att.id}
                            className="overflow-hidden rounded-xl bg-[#14151c] border border-white/[0.08] hover:border-white/[0.18] transition-all max-w-xs sm:max-w-sm shadow-md"
                          >
                            <div
                              onClick={() => !isLoaded && toggleLoadImage(imageKey)}
                              className={`flex items-center justify-between px-3 py-2 bg-black/40 text-xs select-none transition-colors ${
                                !isLoaded ? 'hover:bg-black/60 cursor-pointer' : 'border-b border-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/[0.06] text-[#ff6b7d]">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                </div>
                                <span className="truncate max-w-[170px] font-medium text-neutral-200">
                                  {att.file_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {att.file_size ? (
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    {att.file_size > 1024 * 1024
                                      ? `${(att.file_size / (1024 * 1024)).toFixed(1)} MB`
                                      : `${Math.round(att.file_size / 1024)} KB`}
                                  </span>
                                ) : null}
                                <a
                                  href={att.file_url}
                                  download={att.file_name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                                  title="Download"
                                >
                                  <Download className="h-3 w-3" />
                                </a>
                                {isLoaded && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLoadImage(imageKey);
                                    }}
                                    className="text-[10px] text-neutral-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                                    title="Hide preview"
                                  >
                                    Hide
                                  </button>
                                )}
                              </div>
                            </div>

                            {!isLoaded ? (
                              <button
                                type="button"
                                onClick={() => toggleLoadImage(imageKey)}
                                className="w-full py-4 px-3 flex items-center justify-center gap-2 bg-black/20 hover:bg-black/35 transition-colors cursor-pointer text-xs text-neutral-300 hover:text-white group border-t border-white/[0.04]"
                              >
                                <Eye className="h-3.5 w-3.5 text-neutral-400 group-hover:text-[#ff6b7d] transition-colors" />
                                <span className="font-medium text-[11px]">Click to load image</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setLightboxUrl(att.file_url)}
                                className="block w-full overflow-hidden bg-black/40 text-left transition-opacity hover:opacity-95 cursor-zoom-in"
                                title="Click to view full size"
                              >
                                <img
                                  src={att.file_url}
                                  alt={att.file_name}
                                  loading="eager"
                                  className="w-full max-h-72 object-contain bg-black/30"
                                />
                              </button>
                            )}
                          </div>
                        );
                      }

                      if (isVideo) {
                        return (
                          <div
                            key={att.id}
                            className="overflow-hidden rounded-xl bg-[#14151c] border border-white/[0.08] max-w-xs sm:max-w-sm"
                          >
                            <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/[0.06] text-xs">
                              <span className="truncate max-w-[190px] font-medium text-neutral-200">{att.file_name}</span>
                              {att.file_size ? (
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {(att.file_size / (1024 * 1024)).toFixed(1)} MB
                                </span>
                              ) : null}
                            </div>
                            <video src={att.file_url} controls playsInline preload="metadata" className="w-full max-h-72 bg-black" />
                          </div>
                        );
                      }

                      if (isAudio) {
                        return (
                          <div key={att.id} className="mt-1">
                            <AudioPlayerMessage url={att.file_url} />
                          </div>
                        );
                      }

                      return (
                        <a
                          key={att.id}
                          href={att.file_url}
                          download={att.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl bg-[#14151c] border border-white/[0.08] hover:bg-[#181924] hover:border-white/[0.18] transition-all max-w-xs sm:max-w-sm group"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-white">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate group-hover:text-[#ff6b7d] transition-colors">
                              {att.file_name}
                            </p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              {att.file_size ? `${Math.round(att.file_size / 1024)} KB` : 'Download document'}
                            </p>
                          </div>
                          <Download className="h-4 w-4 text-neutral-400 group-hover:text-white shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                )}

                {isSelf && msg.status === 'failed' && (
                  <div className="mt-1 flex items-center justify-end gap-1.5 px-1 text-[10px] text-red-400 font-medium">
                    <XCircle className="h-3 w-3" />
                    <span>Failed to send</span>
                    <button
                      type="button"
                      onClick={() => handleSendMessage(msg.body, msg.id, msg.message_type as 'text' | 'media')}
                      className="inline-flex items-center gap-0.5 underline hover:text-red-300 ml-1 cursor-pointer"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Upload Status Notification Bar */}
        {uploadStatus && (
          <div className="px-5 py-2 bg-neutral-900 border-t border-white/[0.06] flex items-center gap-2 text-xs text-neutral-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#e8364b]" />
            <span>{uploadStatus}</span>
          </div>
        )}

        {/* Sticky Bottom Message & Media Input Bar */}
        <div className="border-t border-white/[0.06] p-3 sm:p-4 bg-[#141419]/90 backdrop-blur-md shrink-0 relative z-10">
          {/* Voice Recording Active UI */}
          {isRecording ? (
            <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto p-2 bg-red-950/25 border border-red-500/30 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse ml-2" />
                <span className="text-xs font-semibold text-white">Recording Voice Note...</span>
                <span className="text-xs font-mono text-red-300">{formatRecordingTimer(recordingSeconds)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#e8364b] hover:bg-[#d12a3e] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Send Voice</span>
                </button>
              </div>
            </div>
          ) : (
            /* Standard Text & Attachment Input */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto"
            >
              {/* Hidden multi-purpose file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUploadAndSend(file);
                    e.target.value = '';
                  }
                }}
              />

              {/* Attachment Button (Images, Videos, Docs) */}
              <button
                type="button"
                disabled={isUploading || !conversation}
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0d0d11] text-neutral-400 hover:text-white hover:border-white/[0.15] transition-colors cursor-pointer disabled:opacity-50"
                title="Send photo, video, or document"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {/* Text Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your message to Sandy's Team..."
                  maxLength={5000}
                  disabled={!conversation || isUploading}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0d0d11] px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none disabled:opacity-50 transition-colors"
                />
              </div>

              {/* Voice Note Button (when input is empty) */}
              {!inputText.trim() && (
                <button
                  type="button"
                  disabled={isUploading || !conversation}
                  onClick={startRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0d0d11] text-neutral-400 hover:text-white hover:border-[#e8364b] hover:text-[#e8364b] transition-colors cursor-pointer disabled:opacity-50"
                  title="Record voice note"
                  aria-label="Record voice note"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || !conversation || isUploading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8364b] text-white hover:bg-[#d12a3e] disabled:opacity-40 disabled:hover:bg-[#e8364b] transition-colors cursor-pointer shadow-sm shadow-[#e8364b]/20"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
