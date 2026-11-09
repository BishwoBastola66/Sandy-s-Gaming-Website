/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useTransition, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

function emptySubscribe() {
  return () => {};
}

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
import {
  Ticket,
  Search,
  Paperclip,
  X,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Filter,
  MessageSquare,
  Send,
} from 'lucide-react';
import type { TicketItem } from '@/types/tickets';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

const TICKET_CATEGORIES: Record<string, string> = {
  tournament: 'Tournament Dispute / Entry',
  account: 'Account & Security',
  gameplay: 'Gameplay & Meta',
  payment: 'Payment & Billing',
  bug: 'Bug / Technical Glitch',
  general: 'General Support',
};

function formatCategory(cat: string) {
  return TICKET_CATEGORIES[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'General');
}

interface AdminTicketsClientProps {
  initialTickets: TicketItem[];
  adminDisplayName: string;
}

export function AdminTicketsClient({
  initialTickets,
  adminDisplayName,
}: AdminTicketsClientProps) {
  const [tickets, setTickets] = useState<TicketItem[]>(initialTickets);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isUpdatingStatus, startStatusTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const mounted = useMounted();

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<TicketItem['status'] | 'keep'>('keep');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Filter logic
  const filteredTickets = tickets.filter((t) => {
    if (activeFilter !== 'all' && t.status !== activeFilter) {
      return false;
    }
    if (selectedCategory !== 'all' && t.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description.toLowerCase().includes(q);
      const matchEmail = (t.customer_email || '').toLowerCase().includes(q);
      const matchName = (t.customer_name || '').toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchEmail || matchName || matchId;
    }
    return true;
  });

  const counts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
  };

  const handleUpdateStatus = (ticketId: string, newStatus: TicketItem['status']) => {
    startStatusTransition(async () => {
      // Optimistic update
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status: newStatus,
                resolved_at: newStatus === 'resolved' || newStatus === 'closed' ? new Date().toISOString() : null,
              }
            : t
        )
      );

      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      try {
        const res = await fetch(`/api/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update ticket status');
        }

        setToastMessage({
          type: 'success',
          text: `Ticket status successfully changed to "${newStatus.replace('_', ' ')}".`,
        });
      } catch (err: unknown) {
        const msg = sanitizeErrorMessage(err, 'Update failed.');
        setToastMessage({ type: 'error', text: msg });
        // Revert on failure
        setTickets(initialTickets);
      }
    });
  };

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTicket || !replyText.trim() || isSendingReply) return;

    setIsSendingReply(true);
    const messageToSend = replyText.trim();
    const statusToSend = replyStatus === 'keep' ? undefined : replyStatus;

    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          new_status: statusToSend,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post reply');
      }

      const updatedTicket: TicketItem = data.ticket;
      setSelectedTicket(updatedTicket);
      setTickets((prev) =>
        prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
      );
      setReplyText('');
      setReplyStatus('keep');
      setToastMessage({
        type: 'success',
        text: 'Reply sent successfully to customer.',
      });
    } catch (err: unknown) {
      const msg = sanitizeErrorMessage(err, 'Failed to send reply.');
      setToastMessage({ type: 'error', text: msg });
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 animate-page-enter">
      {/* Lightbox Preview Modal */}
      {mounted && lightboxUrl
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-fade-in"
              onClick={() => setLightboxUrl(null)}
            >
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="Close preview"
              >
                <X className="h-6 w-6" />
              </button>
              <img
                src={lightboxUrl}
                alt="Full size attachment"
                className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body
          )
        : null}

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-xs border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="font-medium underline hover:opacity-80 ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header with Straight Line Divider */}
      <div className="border-b border-white/[0.08] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <Ticket className="h-5 w-5 text-[#e8364b]" />
            <span>Support Tickets Operations</span>
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Triage and resolve player disputes, gameplay bugs, and account issues. Operating as <span className="text-neutral-200 font-medium">{adminDisplayName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-400 font-medium">Open Queue:</span>
          <span className="font-semibold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {counts.open} open
          </span>
          <span className="font-semibold text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {counts.in_progress} in progress
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Tickets', count: counts.all },
            { id: 'open', label: 'Open', count: counts.open },
            { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
            { id: 'resolved', label: 'Resolved', count: counts.resolved },
            { id: 'closed', label: 'Closed', count: counts.closed },
          ].map(({ id, label, count }) => {
            const isActive = activeFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveFilter(id as typeof activeFilter)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.1] text-white border border-white/[0.14]'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-[#e8364b] text-white' : 'bg-white/[0.06] text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <Filter className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-[#141419] pl-8 pr-3 py-1.5 text-xs text-white focus:border-[#e8364b] focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="tournament">Tournament Dispute / Entry</option>
              <option value="account">Account &amp; Security</option>
              <option value="gameplay">Gameplay &amp; Meta</option>
              <option value="payment">Payment &amp; Billing</option>
              <option value="bug">Bug / Technical Glitch</option>
              <option value="general">General Support</option>
            </select>
          </div>

          <div className="relative w-full md:w-64 shrink-0">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, ID, customer..."
              className="w-full rounded-lg border border-white/[0.08] bg-[#141419] pl-9 pr-3.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Tickets List (Full Area, Flat Divided Rows) */}
      {filteredTickets.length === 0 ? (
        <div className="w-full flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-3.5 text-neutral-400">
            <Ticket className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-white">No Tickets Found</h3>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-md leading-relaxed">
            {searchQuery || activeFilter !== 'all' || selectedCategory !== 'all'
              ? 'No support tickets match the current search or filter query.'
              : 'There are currently no tickets submitted by customers.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTickets.map((ticket) => {
            const hasAttachments = ticket.attachments && ticket.attachments.length > 0;

            const priorityBadge =
              ticket.priority === 'urgent'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : ticket.priority === 'high'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : ticket.priority === 'medium'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-neutral-500/10 border-neutral-500/20 text-neutral-400';

            const statusBadge =
              ticket.status === 'open'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : ticket.status === 'in_progress'
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                : ticket.status === 'resolved'
                ? 'bg-purple-500/10 border-purple-500/25 text-purple-400'
                : 'bg-neutral-500/10 border-neutral-500/20 text-neutral-400';

            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="group p-3.5 sm:p-4 rounded-xl border border-white/[0.06] bg-[#111116] hover:bg-white/[0.03] hover:border-white/[0.12] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize border ${statusBadge}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          ticket.status === 'open'
                            ? 'bg-emerald-400'
                            : ticket.status === 'in_progress'
                            ? 'bg-amber-400'
                            : ticket.status === 'resolved'
                            ? 'bg-purple-400'
                            : 'bg-neutral-400'
                        }`}
                      />
                      {ticket.status.replace('_', ' ')}
                    </span>

                    {(ticket.priority === 'urgent' || ticket.priority === 'high') && (
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${priorityBadge}`}>
                        {ticket.priority}
                      </span>
                    )}

                    <span className="text-[11px] text-neutral-400 font-medium truncate">
                      {formatCategory(ticket.category)}
                    </span>
                    <span className="text-neutral-600 text-xs">•</span>
                    <span className="font-mono text-[11px] text-neutral-500">
                      #{ticket.id.slice(0, 8)}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-[#ff6b7d] transition-colors truncate">
                    {ticket.title}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span className="text-neutral-300 font-medium">{ticket.customer_name || 'Customer'}</span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-neutral-500 text-[11px] truncate">{ticket.customer_email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-neutral-400 sm:justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                  {hasAttachments && (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-white/[0.04] px-2 py-0.5 rounded-md text-neutral-300">
                      <Paperclip className="h-3 w-3 text-neutral-400" />
                      <span>{ticket.attachments.length}</span>
                    </span>
                  )}

                  {ticket.replies && ticket.replies.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md text-purple-300">
                      <MessageSquare className="h-3 w-3" />
                      <span>{ticket.replies.length}</span>
                    </span>
                  )}

                  <span className="text-[11px] text-neutral-500 font-mono">
                    {new Date(ticket.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>

                  <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          VIEW & TRIAGE TICKET DETAILS (Dedicated Slide-Over Sheet / Full View on Mobile)
          ========================================================================= */}
      {mounted && selectedTicket
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[80] flex justify-end bg-black/75 backdrop-blur-xs animate-fade-in"
              onClick={() => setSelectedTicket(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:w-[580px] lg:w-[700px] xl:w-[780px] h-full bg-[#0d0d12] border-l border-white/[0.1] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden"
              >
                {/* Clean Linear-Style Header */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-white/[0.08] bg-[#111116] shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(null)}
                      className="p-1.5 -ml-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      aria-label="Back to tickets"
                      title="Back to tickets"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-neutral-500 font-semibold">
                          #{selectedTicket.id.slice(0, 8)}
                        </span>
                        <span className="text-neutral-600 text-xs">•</span>
                        <span className="text-[11px] text-neutral-400 truncate font-medium">
                          {formatCategory(selectedTicket.category)}
                        </span>
                      </div>
                      <h2 className="text-sm sm:text-base font-bold text-white leading-snug truncate mt-0.5">
                        {selectedTicket.title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize border ${
                        selectedTicket.status === 'open'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                          : selectedTicket.status === 'in_progress'
                          ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                          : selectedTicket.status === 'resolved'
                          ? 'bg-purple-500/10 border-purple-500/25 text-purple-400'
                          : 'bg-neutral-500/10 border-neutral-500/20 text-neutral-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          selectedTicket.status === 'open'
                            ? 'bg-emerald-400'
                            : selectedTicket.status === 'in_progress'
                            ? 'bg-amber-400'
                            : selectedTicket.status === 'resolved'
                            ? 'bg-purple-400'
                            : 'bg-neutral-400'
                        }`}
                      />
                      {selectedTicket.status.replace('_', ' ')}
                    </span>

                    {(selectedTicket.priority === 'urgent' || selectedTicket.priority === 'high') && (
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-red-500/10 border border-red-500/30 text-red-400">
                        {selectedTicket.priority}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedTicket(null)}
                      className="hidden sm:flex p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Conversation Stream */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                  {/* Status Quick-Triage Bar */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-neutral-300">Set Ticket Status:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { id: 'open', label: 'Open' },
                        { id: 'in_progress', label: 'In Progress' },
                        { id: 'resolved', label: 'Resolved' },
                        { id: 'closed', label: 'Closed' },
                      ].map((s) => {
                        const isCurrent = selectedTicket.status === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={isUpdatingStatus}
                            onClick={() => handleUpdateStatus(selectedTicket.id, s.id as TicketItem['status'])}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-[#e8364b] text-white'
                                : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Customer Request Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#131318] border border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-300 font-semibold flex items-center justify-center text-[10px]">
                          {selectedTicket.customer_name ? selectedTicket.customer_name.slice(0, 2).toUpperCase() : 'CU'}
                        </div>
                        <div>
                          <span className="font-semibold text-white block leading-tight">
                            {selectedTicket.customer_name || 'Customer'}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono block leading-tight">
                            {selectedTicket.customer_email}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-neutral-500">
                        {new Date(selectedTicket.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
                      {selectedTicket.description}
                    </p>

                    {/* Attachments inside customer request card */}
                    {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                      <div className="pt-2.5 border-t border-white/[0.06] space-y-1.5">
                        <span className="text-[11px] font-medium text-neutral-400 block">
                          Attachments ({selectedTicket.attachments.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedTicket.attachments.map((att, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2.5 p-2 rounded-lg bg-black/40 border border-white/[0.06]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {att.type === 'image' ? (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxUrl(att.url)}
                                    className="h-8 w-8 rounded overflow-hidden shrink-0 border border-white/[0.1] cursor-zoom-in"
                                  >
                                    <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
                                  </button>
                                ) : (
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white">
                                    <FileText className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white truncate">{att.name}</p>
                                  <p className="text-[10px] text-neutral-500">
                                    {att.size ? `${(att.size / 1024).toFixed(0)} KB` : 'Attachment'}
                                  </p>
                                </div>
                              </div>
                              <a
                                href={att.url}
                                download={att.name}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
                                title="Download attachment"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Staff Responses / Conversation Thread */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 px-1">
                      <MessageSquare className="h-3.5 w-3.5 text-[#e8364b]" />
                      <span>Staff Responses &amp; Discussion</span>
                      {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/[0.08] text-white">
                          {selectedTicket.replies.length}
                        </span>
                      )}
                    </div>

                    {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                      <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-neutral-400">
                        No responses in this ticket thread yet. Use the composer below to reply to the customer.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedTicket.replies.map((reply) => {
                          const isFromStaff = reply.sender_role === 'admin' || reply.sender_role === 'super_admin';
                          return (
                            <div
                              key={reply.id}
                              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                                isFromStaff
                                  ? 'bg-[#18151f] border-purple-500/25'
                                  : 'bg-[#141419] border-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white">
                                    {reply.sender_name}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                      reply.sender_role === 'super_admin'
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                        : reply.sender_role === 'admin'
                                        ? 'bg-[#e8364b]/20 text-[#ff6b7d] border border-[#e8364b]/30'
                                        : 'bg-white/[0.08] text-neutral-300'
                                    }`}
                                  >
                                    {reply.sender_role.replace('_', ' ')}
                                  </span>
                                </div>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {new Date(reply.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-neutral-200 whitespace-pre-wrap leading-relaxed">
                                {reply.message}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reply Composer (Pinned to Bottom of Drawer) */}
                <form
                  onSubmit={handleSendReply}
                  className="border-t border-white/[0.08] p-3 sm:p-4 bg-[#111116] shrink-0 space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type response to player..."
                      disabled={isSendingReply}
                      className="flex-1 rounded-xl border border-white/[0.08] bg-[#16161d] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none transition-colors"
                    />
                    <select
                      value={replyStatus}
                      onChange={(e) => setReplyStatus(e.target.value as typeof replyStatus)}
                      className="rounded-xl border border-white/[0.08] bg-[#16161d] px-2.5 py-2.5 text-xs text-white focus:border-[#e8364b] focus:outline-none cursor-pointer"
                      disabled={isSendingReply}
                    >
                      <option value="keep">Keep status</option>
                      <option value="in_progress">Set In Progress</option>
                      <option value="resolved">Set Resolved</option>
                      <option value="closed">Set Closed</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isSendingReply || !replyText.trim()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e8364b] px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-[#d02c40] transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isSendingReply ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Send</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
