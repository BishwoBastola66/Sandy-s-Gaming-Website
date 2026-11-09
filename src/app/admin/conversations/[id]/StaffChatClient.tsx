'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import type { ConversationStatus } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface StaffChatMessage {
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
}

interface StaffChatClientProps {
  conversationId: string;
  initialConversation: {
    id: string;
    customer_id: string;
    subject: string | null;
    status: ConversationStatus;
    last_message_at: string;
    created_at: string;
    customer?: {
      id: string;
      display_name: string;
      role: string;
    } | null;
  };
  initialMessages: StaffChatMessage[];
  currentUser: {
    id: string;
    role: string;
    displayName: string;
  };
}

const STAFF_CHAT_CACHE_PREFIX = 'sandy_staff_chat_cache_v2_';

function loadStaffChatCache(convId: string): StaffChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STAFF_CHAT_CACHE_PREFIX}${convId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Quota or parse issue
  }
  return [];
}

function saveStaffChatCache(convId: string, messages: StaffChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    const toCache = messages.filter((m) => m.status !== 'failed').slice(-100);
    localStorage.setItem(`${STAFF_CHAT_CACHE_PREFIX}${convId}`, JSON.stringify(toCache));
  } catch {
    // Quota issue
  }
}

export function StaffChatClient({
  conversationId,
  initialConversation,
  initialMessages,
  currentUser,
}: StaffChatClientProps) {
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState<StaffChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages;
    }
    const cached = loadStaffChatCache(conversationId);
    return cached.length > 0 ? cached : initialMessages;
  });
  const [inputText, setInputText] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const customerDisplayName = conversation.customer?.display_name || 'Customer';

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Save messages to browser local cache whenever updated
  useEffect(() => {
    if (messages.length > 0) {
      saveStaffChatCache(conversationId, messages);
    }
  }, [messages, conversationId]);

  // Realtime subscription for conversation over Supabase WebSockets
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    const topic = `chat:${conversationId}`;

    const handleIncomingMsg = (newMsg: {
      id: string;
      conversation_id: string;
      body: string;
      message_type?: string;
      created_at: string;
      sender_id?: string;
      sender_role?: string;
      sender_name?: string;
      true_sender_name?: string;
    }) => {
      if (!newMsg || !newMsg.id) return;

      const isSelf = newMsg.sender_id === currentUser.id;
      const staffSenderName = newMsg.true_sender_name || newMsg.sender_name || 'Staff Specialist';

      const formattedMsg: StaffChatMessage = {
        id: newMsg.id,
        conversation_id: newMsg.conversation_id,
        sender_id: newMsg.sender_id,
        body: newMsg.body,
        message_type: newMsg.message_type || 'text',
        created_at: newMsg.created_at,
        is_self: isSelf,
        sender_name: isSelf ? 'You' : newMsg.sender_role === 'customer' ? (newMsg.sender_name || customerDisplayName) : staffSenderName,
        sender_role: isSelf ? currentUser.role : (newMsg.sender_role as 'customer' | 'admin' | 'super_admin') || 'customer',
        status: 'sent',
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
          filter: `conversation_id=eq.${conversationId}`,
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
      channelRef.current = null;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUser.id, currentUser.role, customerDisplayName]);

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
    if (!conversationId) return;

    let isCancelled = false;

    const syncNewMessages = async () => {
      const since = latestMessageTimestampRef.current;
      if (!since) return;

      try {
        const url = `/api/conversations/${conversationId}/messages?after=${encodeURIComponent(since)}&limit=30`;
        const res = await fetch(url);
        if (!res.ok || isCancelled) return;
        const data = await res.json();
        const incoming: StaffChatMessage[] = data.messages || [];

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
  }, [conversationId]);

  const handleLoadEarlier = async () => {
    if (messages.length === 0 || isLoadingMore) return;
    setIsLoadingMore(true);
    setErrorBanner(null);

    const oldest = messages[0];
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?before=${encodeURIComponent(
          oldest.created_at
        )}&limit=30`
      );
      if (!res.ok) throw new Error('Failed to load earlier messages');
      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.has_more);
      } else {
        setHasMore(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading earlier history';
      setErrorBanner(msg);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async (textToSend?: string, retryId?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    if (text.length > 5000) {
      setErrorBanner('Message is too long. Limit is 5000 characters.');
      return;
    }

    setErrorBanner(null);

    // eslint-disable-next-line react-hooks/purity
    const tempId = retryId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimisticMessage: StaffChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      body: text,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_self: true,
      sender_name: 'You',
      sender_role: currentUser.role,
      status: 'sent',
    };

    if (retryId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === retryId ? { ...m, status: 'sent', errorDetails: undefined } : m))
      );
    } else {
      setMessages((prev) => [...prev, optimisticMessage]);
      setInputText('');
    }

    // Instant client-side broadcast dispatch over Supabase Realtime WebSocket
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: tempId,
          conversation_id: conversationId,
          body: text,
          message_type: 'text',
          created_at: optimisticMessage.created_at,
          sender_id: currentUser.id,
          sender_role: currentUser.role,
          sender_name: 'Sandy Gaming',
          true_sender_name: currentUser.displayName || 'Staff Specialist',
        },
      }).catch(() => {});
    }

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, message_type: 'text' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      const realMessage = data.message;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...realMessage,
                status: 'sent',
              }
            : m
        )
      );

      if (conversation.status === 'open') {
        handleUpdateStatus('in_progress');
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Delivery error';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                status: 'failed',
                errorDetails: errText,
              }
            : m
        )
      );
      setErrorBanner(errText);
    }
  };

  const handleUpdateStatus = async (newStatus: ConversationStatus) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setConversation(data.conversation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      setErrorBanner(msg);
    }
  };

  const isSuperAdmin = currentUser.role === 'super_admin';

  return (
    <div className="w-full flex-1 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-page-enter">
      {/* Back and Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href={isSuperAdmin ? '/super-admin/conversations' : '/admin/conversations'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Conversations</span>
        </Link>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div className="flex items-center justify-between rounded-xl bg-red-950/30 p-4 border border-red-500/30 text-red-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-red-400 hover:text-red-300 font-semibold text-xs ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Chat Workspace + Assignment Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Chat Thread (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl border border-white/[0.08] bg-[#111116] overflow-hidden flex flex-col h-[650px] relative">
          {/* Thread Header */}
          <div className="border-b border-white/[0.08] bg-[#15151c] px-6 py-4 flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  Customer: {customerDisplayName}
                </h2>
                <span className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                  ID: {conversation.id.slice(0, 8)}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Created {new Date(conversation.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
            </div>
          </div>

          {/* WhatsApp-Style Chat Background Watermark Logo */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
          >
            <div className="relative h-64 w-64 sm:h-80 sm:w-80 opacity-[0.05]">
              <Image
                src="/brand/sandys-gaming-logo.png"
                alt=""
                fill
                sizes="(max-width: 768px) 256px, 320px"
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={scrollContainerRef}
            className="relative z-[1] flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-4 bg-transparent"
          >
            {hasMore && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={handleLoadEarlier}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#16161d] px-3.5 py-1 text-xs font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading history...</span>
                    </>
                  ) : (
                    <span>Load earlier messages</span>
                  )}
                </button>
              </div>
            )}

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-neutral-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  No messages yet
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm">
                  Send a response below to initiate specialist contact with the customer.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const isSelf = Boolean(
                msg.is_self ||
                msg.sender_name === 'You' ||
                (currentUser?.id && msg.sender_id && msg.sender_id === currentUser.id) ||
                (currentUser?.displayName && msg.sender_name === currentUser.displayName)
              );
              const isCustomer = msg.sender_role === 'customer';

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
                    <span
                      className={`font-semibold ${
                        isCustomer
                          ? 'text-purple-400'
                          : isSelf
                          ? 'text-[#e8364b]'
                          : 'text-amber-400'
                      }`}
                    >
                      {msg.sender_name}
                      {msg.sender_role ? ` (${msg.sender_role})` : ''}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`max-w-lg rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isSelf
                        ? 'bg-gradient-to-r from-[#e8364b] to-[#b01328] text-white rounded-tr-xs shadow-[0_4px_16px_rgba(232,54,75,0.25)]'
                        : isCustomer
                        ? 'bg-[#181820] border border-white/[0.08] text-white rounded-tl-xs'
                        : 'bg-amber-950/30 border border-amber-500/30 text-amber-100 rounded-tl-xs'
                    }`}
                  >
                    {msg.body}
                  </div>

                  {isSelf && msg.status === 'failed' && (
                    <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-red-400 font-medium">
                      <span>Failed to send</span>
                      <button
                        type="button"
                        onClick={() => handleSendMessage(msg.body, msg.id)}
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

          {/* Staff Reply Bar */}
          <div className="border-t border-white/[0.08] p-4 bg-[#15151c] relative z-10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-3"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Write a specialist response to customer..."
                  maxLength={5000}
                  className="w-full rounded-xl border border-white/[0.1] bg-[#111116] px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none focus:ring-1 focus:ring-[#e8364b]"
                />
                {inputText.length > 3000 && (
                  <span className="absolute right-3 top-3 text-[10px] text-neutral-400">
                    {inputText.length}/5000
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Send Reply</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Conversation Metadata (1 col) */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111116] p-5 text-xs text-neutral-400 space-y-2">
            <p className="font-bold text-white">
              Staff Attribution &amp; Privacy
            </p>
            <p className="text-[11px] leading-relaxed">
              When you send a reply, the customer sees it labeled as <strong className="text-neutral-200">Support Team</strong> to protect individual staff privacy while preserving internal attribution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
