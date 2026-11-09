'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Search,
  Clock,
  Send,
  Loader2,
  User,
  ExternalLink,
  RotateCcw,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface SuperAdminConversationItem {
  id: string;
  subject: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
  customer?: { id: string; display_name: string; role: string } | null;
}

interface StaffMessage {
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
}

interface SuperAdminConversationsClientProps {
  initialConversations: SuperAdminConversationItem[];
  currentUserId?: string;
  currentUserName?: string;
}

export function SuperAdminConversationsClient({
  initialConversations,
  currentUserId = '',
  currentUserName = 'Super Admin',
}: SuperAdminConversationsClientProps) {
  const [conversations, setConversations] = useState<SuperAdminConversationItem[]>(initialConversations);
  const [selectedConv, setSelectedConv] = useState<SuperAdminConversationItem | null>(null);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const customerName = c.customer?.display_name?.toLowerCase() || '';
        const id = c.id.toLowerCase();

        return customerName.includes(query) || id.includes(query);
      }

      return true;
    });
  }, [conversations, searchQuery]);

  // Fetch messages when selected conversation changes
  useEffect(() => {
    const convId = selectedConv?.id;
    if (!convId) return;

    let isCancelled = false;

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations/${convId}/messages?limit=50`);
        const data = await res.json();
        if (isCancelled) return;
        setMessages(
          (data.messages || []).map((m: StaffMessage) => ({
            ...m,
            status: 'sent',
          }))
        );
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

  // Realtime subscription over Supabase WebSockets
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
        sender_role: isSelf ? 'super_admin' : isCustomer ? 'customer' : (newMsg.sender_role as 'super_admin' | 'admin' | 'customer') || 'admin',
        status: 'sent',
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
  }, [selectedConv?.id, selectedConv?.customer?.id, selectedConv?.customer?.display_name, currentUserId, currentUserName]);

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

  const handleSendMessage = async (textToSend?: string, retryId?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !selectedConv) return;

    const nowIso = new Date().toISOString();
    // eslint-disable-next-line react-hooks/purity
    const tempId = retryId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimisticMsg: StaffMessage = {
      id: tempId,
      conversation_id: selectedConv.id,
      body: text,
      message_type: 'text',
      created_at: nowIso,
      is_self: true,
      sender_id: currentUserId,
      sender_name: currentUserName,
      sender_role: 'super_admin',
      status: 'sent',
    };

    if (retryId) {
      setMessages((prev) => prev.map((m) => (m.id === retryId ? { ...m, status: 'sent' } : m)));
    } else {
      setMessages((prev) => [...prev, optimisticMsg]);
      setInputText('');
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConv.id ? { ...c, last_message_at: nowIso } : c))
    );

    try {
      const res = await fetch(`/api/conversations/${selectedConv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, message_type: 'text' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      const realMessage = data.message;

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...realMessage, status: 'sent' } : m))
      );
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-page-enter min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 sm:pb-4 border-b border-white/[0.08] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              System-Wide Conversations
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
              Live Feed
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            Monitor incoming customer chats and reply directly in real time.
          </p>
        </div>
      </div>

      {/* Split-Pane Messenger Layout */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d11] overflow-hidden flex flex-col md:flex-row flex-1 min-h-[500px] h-[calc(100dvh-13.5rem)] shadow-xl">
        {/* LEFT PANE: Conversations List */}
        <div
          className={`w-full md:w-[350px] lg:w-[390px] shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] bg-[#0d0d11] flex flex-col h-full ${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-3.5 border-b border-white/[0.06] space-y-2.5 bg-[#0e0e12]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer..."
                className="w-full rounded-xl border border-white/[0.08] bg-[#141419] pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">
                No conversations match your filter.
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
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold border ${
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
                          {new Date(c.last_message_at || c.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-500">
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

        {/* RIGHT PANE: Live Chat with Selected Customer */}
        <div
          className={`flex-1 flex-col min-w-0 bg-[#111115] h-full ${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 mb-3">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">No conversation selected</h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-xs">
                Choose a customer thread on the left to view messages and reply directly.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-white/[0.06] bg-[#141419]/60 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
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

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8364b]/15 border border-[#e8364b]/30 text-[#e8364b]">
                    <User className="h-4 w-4" />
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

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/super-admin/conversations/${selectedConv.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-white/[0.07] hover:text-white transition-colors"
                    title="Open full thread"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <div
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4 bg-[#0b0b0e]/50"
              >
                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-[#e8364b]" />
                    <span className="text-xs">Loading conversation...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-2">
                    <MessageSquare className="h-7 w-7 text-neutral-600" />
                    <p className="text-xs text-neutral-400">
                      No messages in this thread yet. Send a message below to reply to the customer.
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

                        <div
                          className={`max-w-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isSelf
                              ? 'bg-[#e8364b] text-white rounded-tr-xs'
                              : isCustomer
                              ? 'bg-[#1a1a22] border border-white/[0.08] text-neutral-100 rounded-tl-xs'
                              : 'bg-purple-950/60 border border-purple-500/30 text-purple-100 rounded-tl-xs'
                          }`}
                        >
                          {msg.body}
                        </div>

                        {isSelf && msg.status === 'failed' && (
                          <div className="mt-1 flex items-center justify-end gap-1.5 px-1 text-[10px] text-red-400 font-medium">
                            <XCircle className="h-3 w-3" />
                            <span>Failed</span>
                            <button
                              type="button"
                              onClick={() => handleSendMessage(msg.body, msg.id)}
                              className="inline-flex items-center gap-0.5 underline hover:text-red-300 ml-1"
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                              <span>Retry</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-white/[0.06] p-3.5 bg-[#141419]/60">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2.5"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Reply to ${selectedConv.customer?.display_name || 'Customer'}...`}
                    maxLength={5000}
                    className="flex-1 rounded-xl border border-white/[0.08] bg-[#0d0d11] px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#e8364b] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#d12a3e] disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
