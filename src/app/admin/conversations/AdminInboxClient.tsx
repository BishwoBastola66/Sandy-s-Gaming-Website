'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  MessageSquare,
  Clock,
  Search,
  Send,
  Loader2,
  RotateCcw,
  ArrowLeft,
  Paperclip,
  Check,
  X,
  FileText,
  Download,
  ImageIcon,
  Eye,
} from 'lucide-react';
import type { ConversationStatus } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

export interface InboxConversationItem {
  id: string;
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string;
  created_at: string;
  customer?: {
    id: string;
    display_name: string;
    role: string;
  } | null;
}

export interface StaffMessageAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number | null;
}

export interface StaffMessage {
  id: string;
  conversation_id: string;
  body: string;
  message_type: string;
  created_at: string;
  is_self: boolean;
  sender_id?: string;
  sender_name: string;
  sender_role: string;
  status?: 'pending' | 'sent' | 'failed';
  attachments?: StaffMessageAttachment[];
}

interface MediaPayload {
  type: 'image' | 'video' | 'voice' | 'doc';
  url: string;
  name?: string;
  size?: number;
  caption?: string;
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

interface AdminInboxClientProps {
  initialConversations: InboxConversationItem[];
  initialMessages?: StaffMessage[];
  userRole: string;
  currentUserId?: string;
  currentUserName?: string;
}

export function AdminInboxClient({
  initialConversations,
  initialMessages = [],
  userRole,
  currentUserId = '',
  currentUserName = 'Support Specialist',
}: AdminInboxClientProps) {
  const [conversations, setConversations] = useState<InboxConversationItem[]>(initialConversations);
  const [selectedConv, setSelectedConv] = useState<InboxConversationItem | null>(null);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [loadedImageIds, setLoadedImageIds] = useState<Record<string, boolean>>({});

  const toggleLoadImage = (id: string) => {
    setLoadedImageIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const prevMessagesCountRef = useRef(initialMessages.length);
  const tempCounterRef = useRef(0);

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // Scroll to bottom when conversation is opened
  useEffect(() => {
    scrollToBottom(false);
  }, [selectedConv?.id]);

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

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 100;

    if (container.scrollTop <= 40 && hasMore && !isLoadingMore && messages.length > 0) {
      handleLoadEarlier();
    }
  };

  const handleLoadEarlier = async () => {
    if (!selectedConv || isLoadingMore || !hasMore || messages.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    setIsLoadingMore(true);
    isPrependingRef.current = true;
    prevScrollHeightRef.current = container.scrollHeight;

    const earliestTimestamp = messages[0].created_at;
    try {
      const res = await fetch(
        `/api/conversations/${selectedConv.id}/messages?limit=30&before=${encodeURIComponent(
          earliestTimestamp
        )}`
      );
      if (!res.ok) throw new Error('Failed to load earlier messages');
      const data = await res.json();
      const olderMessages: StaffMessage[] = (data.messages || []).map((m: StaffMessage) => ({
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
    } catch {
      isPrependingRef.current = false;
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Lock outer window scroll so ONLY the center chat messages scroll inside the viewport
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

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const customerName = c.customer?.display_name?.toLowerCase() || '';
        const subject = c.subject?.toLowerCase() || '';
        const id = c.id.toLowerCase();
        return customerName.includes(query) || subject.includes(query) || id.includes(query);
      }

      return true;
    });
  }, [conversations, searchQuery]);

  // Fetch messages when selected conversation changes (bottom messages first)
  useEffect(() => {
    const convId = selectedConv?.id;
    if (!convId) return;

    let isCancelled = false;

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations/${convId}/messages?limit=30`);
        const data = await res.json();
        if (isCancelled) return;
        setMessages(
          (data.messages || []).map((m: StaffMessage) => ({
            ...m,
            status: 'sent',
          }))
        );
        setHasMore(Boolean(data.has_more));
      } catch {
        if (!isCancelled) setMessages([]);
      } finally {
        if (!isCancelled) setIsLoadingMessages(false);
      }
    };

    loadMessages();

    return () => {
      isCancelled = true;
    };
  }, [selectedConv?.id]);

  // Realtime subscription for the active conversation over Supabase WebSockets
  useEffect(() => {
    if (!selectedConv?.id) return;
    const convId = selectedConv.id;

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
      attachments?: StaffMessageAttachment[];
    }) => {
      if (!newMsg || !newMsg.id) return;

      const isSelf = newMsg.sender_id === currentUserId;
      const isCustomer = newMsg.sender_id === selectedConv.customer?.id;

      const formattedMsg: StaffMessage = {
        id: newMsg.id,
        conversation_id: newMsg.conversation_id,
        body: newMsg.body,
        message_type: newMsg.message_type || 'text',
        created_at: newMsg.created_at,
        is_self: isSelf,
        sender_id: newMsg.sender_id,
        sender_name: isSelf
          ? currentUserName
          : isCustomer
          ? selectedConv.customer?.display_name || 'Customer'
          : newMsg.sender_name || 'Staff Member',
        sender_role: isSelf ? userRole : isCustomer ? 'customer' : (newMsg.sender_role as 'admin' | 'super_admin') || 'admin',
        status: 'sent',
        attachments: newMsg.attachments || [],
      };

      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, last_message_at: newMsg.created_at } : c))
      );

      setMessages((prev) => {
        const idxById = prev.findIndex((m) => m.id === newMsg.id);
        if (idxById !== -1) {
          const updated = [...prev];
          updated[idxById] = { ...updated[idxById], ...formattedMsg, status: 'sent' };
          return updated;
        }

        if (isSelf) {
          const pendingIdx = prev.findIndex(
            (m) => (m.status === 'pending' || m.id.startsWith('temp-')) && m.body.trim() === newMsg.body.trim()
          );
          if (pendingIdx !== -1) {
            const updated = [...prev];
            updated[pendingIdx] = { ...updated[pendingIdx], ...formattedMsg, status: 'sent' };
            return updated;
          }
        }

        const idxByContent = prev.findIndex(
          (m) =>
            m.body.trim() === newMsg.body.trim() &&
            m.is_self === isSelf &&
            Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 15000
        );
        if (idxByContent !== -1) {
          const updated = [...prev];
          updated[idxByContent] = { ...updated[idxByContent], ...formattedMsg, status: 'sent' };
          return updated;
        }

        return [...prev, formattedMsg];
      });
    };

    const channel = supabase.channel(topic, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

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
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('disconnected');
        }
      });

    const handleOnline = () => {
      setRealtimeStatus('connected');
    };
    const handleOffline = () => {
      setRealtimeStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(channel);
    };
  }, [selectedConv?.id, selectedConv?.customer?.id, selectedConv?.customer?.display_name, currentUserId, currentUserName, userRole]);

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
    const convId = selectedConv?.id;
    if (!convId) return;

    let isCancelled = false;

    const syncNewMessages = async () => {
      const since = latestMessageTimestampRef.current;
      if (!since) return;

      try {
        const url = `/api/conversations/${convId}/messages?after=${encodeURIComponent(since)}&limit=30`;
        const res = await fetch(url);
        if (!res.ok || isCancelled) return;
        const data = await res.json();
        const incoming: StaffMessage[] = data.messages || [];

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
  }, [selectedConv?.id]);

  const handleSendMessage = async (
    textToSend?: string,
    retryId?: string,
    messageType: string = 'text',
    attachmentsToSend?: StaffMessageAttachment[]
  ) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    const attachments = attachmentsToSend || [];
    if ((!text && attachments.length === 0) || !selectedConv) return;

    const nowIso = new Date().toISOString();
    tempCounterRef.current += 1;
    const tempId = retryId || `temp-${tempCounterRef.current}`;
    const optimisticMsg: StaffMessage = {
      id: tempId,
      conversation_id: selectedConv.id,
      body: text,
      message_type: messageType,
      created_at: nowIso,
      is_self: true,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_role: userRole,
      status: 'pending',
      attachments,
    };

    if (retryId) {
      setMessages((prev) => prev.map((m) => (m.id === retryId ? { ...m, status: 'pending' } : m)));
    } else {
      setMessages((prev) => [...prev, optimisticMsg]);
      if (textToSend === undefined) {
        setInputText('');
      }
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConv.id ? { ...c, last_message_at: nowIso } : c))
    );

    try {
      const res = await fetch(`/api/conversations/${selectedConv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: text,
          message_type: messageType,
          attachments,
          attachment_ids: attachments
            .map((a) => a.id)
            .filter((id) => id && !id.startsWith('temp-') && !id.startsWith('legacy-')),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply');

      const realMessage = data.message;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...realMessage, status: 'sent', attachments: realMessage.attachments || attachments }
            : m
        )
      );
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConv) return;

    setIsUploading(true);
    setUploadStatus(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversation_id', selectedConv.id);

      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload attachment');
      }

      let mediaType = 'image';
      if (data.category === 'images' || data.mimeType?.startsWith('image/')) mediaType = 'image';
      else if (data.category === 'videos' || data.mimeType?.startsWith('video/')) mediaType = 'video';
      else if (data.category === 'voice' || data.mimeType?.startsWith('audio/')) mediaType = 'voice';
      else mediaType = 'doc';

      tempCounterRef.current += 1;
      const attachmentObj: StaffMessageAttachment = data.attachment || {
        id: `att-${tempCounterRef.current}`,
        file_name: data.originalName,
        file_url: data.url,
        file_type: mediaType,
        file_size: data.sizeBytes,
      };

      await handleSendMessage('', undefined, 'media', [attachmentObj]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      alert(msg);
    } finally {
      setIsUploading(false);
      setUploadStatus(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex-1 w-full h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] flex flex-col md:flex-row bg-[#09090c] overflow-hidden select-text">
      {/* Lightbox Preview for Images */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm cursor-zoom-out animate-fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Enlarged preview"
              className="max-h-[85vh] max-w-full object-contain rounded-xl"
            />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 rounded-full bg-black/70 p-2 text-white hover:bg-black transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* LEFT PANE: Customer Conversation Thread List */}
      <div
        className={`w-full md:w-[320px] lg:w-[360px] xl:w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-white/[0.08] bg-[#0d0d11] flex flex-col h-full min-h-0 overflow-hidden ${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Search & Status Filters */}
        <div className="p-3.5 border-b border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Live Chat Queue
            </span>
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-neutral-300">
              {filteredConversations.length}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, subject, ID..."
              className="w-full rounded-lg border border-white/[0.08] bg-[#141419] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Customer Thread List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = selectedConv?.id === c.id;
              const customerName = c.customer?.display_name || 'Customer';

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedConv(c);
                    setMobileView('chat');
                  }}
                  className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'md:bg-white/[0.06]'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold border ${
                      isSelected
                        ? 'md:bg-white/[0.08] text-white md:border-white/[0.14]'
                        : 'bg-white/[0.04] text-neutral-300 border-white/[0.08]'
                    }`}
                  >
                    {customerName.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-white">
                        {customerName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(c.last_message_at || c.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500">
                      <span className="font-mono">#{c.id.slice(0, 8)}</span>
                      <span className="capitalize px-1.5 py-0.5 rounded text-[9px] bg-white/[0.05] text-neutral-400">
                        {c.status || 'open'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE: Full-Screen Active Chat */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-0 bg-[#09090c] h-full relative overflow-hidden ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 mb-3">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Select a customer</h3>
            <p className="mt-1 text-xs text-neutral-400 max-w-xs">
              Choose a live thread from the list on the left to start chatting in real time.
            </p>
          </div>
        ) : (
          <>
            {/* Active Chat Header */}
            <div className="border-b border-white/[0.08] bg-[#0d0d11] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setMobileView('list');
                    setSelectedConv(null);
                  }}
                  className="md:hidden p-1.5 -ml-1 text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer shrink-0"
                  aria-label="Back to conversations"
                  title="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8364b]/15 border border-[#e8364b]/30 text-[#e8364b] font-semibold text-xs">
                  {(selectedConv.customer?.display_name || 'CU').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {selectedConv.customer?.display_name || 'Customer'}
                    </h3>
                    <span className="text-[11px] font-mono text-neutral-500">
                      #{selectedConv.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Body with Transparent Watermark Logo */}
            <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
              {/* WhatsApp-Style Chat Background Watermark Logo (Fixed in center, transparent backdrop) */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 select-none">
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 opacity-[0.035] filter grayscale contrast-125">
                  <Image
                    src="/brand/sandys-gaming-logo.png"
                    alt=""
                    fill
                    sizes="(max-width: 768px) 256px, 384px"
                    className="object-contain"
                    priority={false}
                  />
                </div>
              </div>

              {/* Message Stream (Bottom-First with Scroll-Up History) */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 space-y-4"
              >
                {/* Scroll-Up History Loading Indicator */}
                {isLoadingMore ? (
                  <div className="flex justify-center pb-2 animate-fade-in">
                    <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/50 px-3.5 py-1 text-xs text-neutral-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff6b7d]" />
                      <span>Loading older messages...</span>
                    </div>
                  </div>
                ) : hasMore && messages.length > 0 ? (
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
                    Beginning of conversation history
                  </div>
                ) : null}

                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-[#e8364b]" />
                    <span className="text-xs">Loading conversation...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-2">
                    <MessageSquare className="h-8 w-8 text-neutral-600" />
                    <p className="text-xs text-neutral-400 max-w-sm">
                      No messages in this thread yet. Send a message below to reach out to the customer.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = Boolean(
                      msg.is_self ||
                      msg.sender_name === 'You' ||
                      (currentUserId && msg.sender_id && msg.sender_id === currentUserId) ||
                      (currentUserName && msg.sender_name === currentUserName)
                    );
                    const isCustomer = msg.sender_role === 'customer';
                    const legacyMedia = parseMediaMessage(msg.body);
                    const attachments: StaffMessageAttachment[] = (msg.attachments && msg.attachments.length > 0)
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
                          className={`flex items-center gap-1.5 mb-1 px-1 text-[11px] text-neutral-400 ${
                            isSelf ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <span className="font-medium text-neutral-200">
                            {isSelf ? 'You' : msg.sender_name}
                          </span>
                          {!isSelf && !isCustomer && (
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                                msg.sender_role === 'super_admin'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-[#e8364b]/20 text-[#ff6b7d]'
                              }`}
                            >
                              {msg.sender_role === 'super_admin' ? 'Super Admin' : 'Admin'}
                            </span>
                          )}
                          <span>•</span>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Text Bubble (if body text exists) */}
                        {textContent && textContent.trim().length > 0 && (
                          <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                              isSelf
                                ? 'bg-[#e8364b] text-white rounded-tr-xs shadow-[0_2px_12px_rgba(232,54,75,0.25)]'
                                : 'bg-[#181820] border border-white/[0.08] text-neutral-100 rounded-tl-xs'
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
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                                    <audio src={att.file_url} controls className="max-w-xs sm:max-w-sm" />
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

                        {/* Delivery Status for Self Messages */}
                        {isSelf && (
                          <div className="mt-1 px-1 flex items-center justify-end gap-1 text-[10px] text-neutral-500">
                            {msg.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-neutral-400">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                <span>Sending...</span>
                              </span>
                            )}
                            {msg.status === 'sent' && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-400">
                                <Check className="h-2.5 w-2.5" />
                                <span>Sent</span>
                              </span>
                            )}
                            {msg.status === 'failed' && (
                              <button
                                type="button"
                                onClick={() => handleSendMessage(msg.body, msg.id, msg.message_type)}
                                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 underline cursor-pointer"
                              >
                                <RotateCcw className="h-2.5 w-2.5" />
                                <span>Failed. Click to retry</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Input Area */}
            <div className="border-t border-white/[0.08] bg-[#0d0d11] p-3 sm:p-4 shrink-0 z-10">
              {uploadStatus && (
                <div className="mb-2 flex items-center gap-2 text-xs text-[#e8364b]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{uploadStatus}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  title="Attach screenshot or file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Type your reply to ${selectedConv.customer?.display_name || 'customer'}...`}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-[#141419] px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-[#e8364b] text-white hover:bg-[#d12a3e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                  title="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
