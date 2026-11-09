/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

function emptySubscribe() {
  return () => { };
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
  Plus,
  Search,
  Paperclip,
  X,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
  Send,
} from 'lucide-react';
import type { TicketItem, TicketAttachment } from '@/types/tickets';
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

interface TicketsClientProps {
  initialTickets: TicketItem[];
  customerEmail: string;
  customerName: string;
}

/**
 * Meta-style client-side image compression.
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

export function TicketsClient({
  initialTickets,
}: TicketsClientProps) {
  const [tickets, setTickets] = useState<TicketItem[]>(initialTickets);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Issue Ticket Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<'tournament' | 'account' | 'gameplay' | 'payment' | 'bug' | 'general'>('tournament');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [formDescription, setFormDescription] = useState('');
  const [pendingFiles, setPendingFiles] = useState<{
    id: string;
    file: File;
    name: string;
    size: number;
    type: 'image' | 'video' | 'doc';
    previewUrl?: string;
  }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Status feedback toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const mounted = useMounted();

  // Customer Reply State
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTicket || !replyText.trim() || isSendingReply) return;

    setIsSendingReply(true);
    const messageToSend = replyText.trim();

    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend }),
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
      setToastMessage({
        type: 'success',
        text: 'Reply submitted successfully.',
      });
    } catch (err: unknown) {
      const msg = sanitizeErrorMessage(err, 'Failed to send reply.');
      setToastMessage({ type: 'error', text: msg });
    } finally {
      setIsSendingReply(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filtered tickets list
  const filteredTickets = tickets.filter((t) => {
    if (activeFilter !== 'all' && t.status !== activeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description.toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchId;
    }
    return true;
  });

  // Handle stage/add file into local device state (before submit)
  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: {
      id: string;
      file: File;
      name: string;
      size: number;
      type: 'image' | 'video' | 'doc';
      previewUrl?: string;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        setFormError(`"${file.name}" exceeds the 50MB file limit.`);
        setToastMessage({ type: 'error', text: `"${file.name}" exceeds the 50MB file limit.` });
        continue;
      }
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      newItems.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        size: file.size,
        type: isImage ? 'image' : isVideo ? 'video' : 'doc',
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      });
    }

    setPendingFiles((prev) => [...prev, ...newItems].slice(0, 10));
  };

  const handleRemovePending = (id: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // Handle Submit New Ticket: Store file in device first, then submit
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle || trimmedTitle.length < 3) {
      setFormError('Please enter a descriptive title (at least 3 characters).');
      return;
    }
    const trimmedDesc = formDescription.trim();
    if (!trimmedDesc || trimmedDesc.length < 3) {
      setFormError('Please provide more details in the description (at least 3 characters).');
      return;
    }

    setIsSubmitting(true);
    setToastMessage(null);

    try {
      // 1. FIRST store the pending files in device when submit button is clicked
      const storedAttachments: TicketAttachment[] = [];

      if (pendingFiles.length > 0) {
        for (let i = 0; i < pendingFiles.length; i++) {
          const item = pendingFiles[i];
          const displayName = item.name.length > 25 ? `${item.name.slice(0, 22)}...` : item.name;
          setSubmittingStatus(`Storing "${displayName}" in device (${i + 1}/${pendingFiles.length})...`);

          let fileToUpload = item.file;
          if (item.file.type.startsWith('image/')) {
            fileToUpload = await compressImageMeta(item.file);
          }

          const formData = new FormData();
          formData.append('file', fileToUpload);

          const uploadRes = await fetch('/api/tickets/upload', {
            method: 'POST',
            body: formData,
          });

          const uploadData = await uploadRes.json();
          if (!uploadRes.ok) {
            throw new Error(uploadData.error || `Failed to store "${item.name}" in device`);
          }

          storedAttachments.push({
            name: uploadData.name || item.name,
            url: uploadData.url,
            type: uploadData.type || item.type,
            size: uploadData.size || item.size,
          });
        }
      }

      // 2. THEN submit the ticket with stored file attachments
      setSubmittingStatus('Submitting support ticket...');
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          category: formCategory,
          priority: formPriority,
          description: formDescription.trim(),
          attachments: storedAttachments,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to issue ticket');
      }

      // Clean up local preview object URLs
      pendingFiles.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });

      setTickets((prev) => [data.ticket, ...prev]);
      setIsCreateModalOpen(false);
      setFormError(null);
      setFormTitle('');
      setFormDescription('');
      setFormCategory('tournament');
      setFormPriority('medium');
      setPendingFiles([]);
      setToastMessage({ type: 'success', text: 'Your ticket has been successfully issued.' });
    } catch (err: unknown) {
      const msg = sanitizeErrorMessage(err, 'Could not submit ticket.');
      setFormError(msg);
      setToastMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
      setSubmittingStatus(null);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 animate-page-enter">
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
              aria-label="Close image preview"
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

      {/* Toast Feedback (Global Floating Foreground Toast) */}
      {mounted && toastMessage
        ? createPortal(
            <div className="fixed top-5 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md z-[120] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
              <div
                className={`flex items-center justify-between rounded-xl p-4 text-xs border shadow-2xl backdrop-blur-md pointer-events-auto ${
                  toastMessage.type === 'success'
                    ? 'bg-[#0f1f17]/95 border-emerald-500/40 text-emerald-300'
                    : 'bg-[#220d11]/95 border-red-500/40 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {toastMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span className="font-medium truncate sm:whitespace-normal">{toastMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="font-medium underline hover:opacity-80 ml-3 cursor-pointer shrink-0 text-[11px]"
                >
                  Dismiss
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Page Header with Straight Line Divider */}
      <div className="border-b border-white/[0.08] pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <Ticket className="h-5 w-5 text-[#e8364b]" />
            <span>Support Tickets</span>
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Submit formal support inquiries, report game bugs, or request assistance with screenshot and file attachments.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
            setToastMessage(null);
          }}
          className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-[#e8364b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d12a3e] active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-[#e8364b]/20 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Issue New Ticket</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar (Flat with Straight Line Separation) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Tickets' },
            { id: 'open', label: 'Open' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'resolved', label: 'Resolved' },
            { id: 'closed', label: 'Closed' },
          ].map(({ id, label }) => {
            const isActive = activeFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveFilter(id as typeof activeFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${isActive
                  ? 'bg-white/[0.1] text-white border border-white/[0.14]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets by title or ID..."
            className="w-full rounded-lg border border-white/[0.08] bg-[#141419] pl-9 pr-3.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Tickets List Area */}
      {filteredTickets.length === 0 ? (
        <div className="w-full flex-1 flex flex-col items-center justify-center py-16 sm:py-24 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-3.5 text-neutral-400">
            <Ticket className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-white">No Tickets Found</h3>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-md leading-relaxed">
            {searchQuery || activeFilter !== 'all'
              ? 'No support tickets match your current search or filter query.'
              : "You haven't issued any support tickets yet. Click below to create your first ticket."}
          </p>
          {!searchQuery && activeFilter === 'all' && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setIsCreateModalOpen(true);
                setToastMessage(null);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#e8364b] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#d12a3e] active:scale-[0.98] transition-all cursor-pointer shadow-sm shadow-[#e8364b]/20"
            >
              <Plus className="h-4 w-4" />
              <span>Issue First Ticket</span>
            </button>
          )}
        </div>
      ) : (
        <div className="w-full divide-y divide-white/[0.08] border-y sm:border border-white/[0.08] sm:rounded-xl overflow-hidden bg-transparent sm:bg-[#111116]/40">
          {filteredTickets.map((ticket) => {
            const isSelected = selectedTicket?.id === ticket.id;
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
                className={`group w-full flex items-center justify-between py-3.5 px-3 sm:px-4 text-left transition-colors duration-150 cursor-pointer ${
                  isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Circular Icon Container */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
                      ticket.status === 'open'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/25'
                        : ticket.status === 'in_progress'
                        ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:bg-amber-500/25'
                        : ticket.status === 'resolved'
                        ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400 group-hover:bg-purple-500/25'
                        : 'bg-white/[0.04] border border-white/[0.07] text-neutral-400 group-hover:text-white'
                    }`}
                  >
                    <Ticket className="h-4 w-4 transition-transform duration-150 group-hover:scale-105" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white group-hover:text-[#ff6b7d] transition-colors truncate">
                        {ticket.title}
                      </span>
                      {(ticket.priority === 'urgent' || ticket.priority === 'high') && (
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider border shrink-0 ${priorityBadge}`}>
                          {ticket.priority}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400 truncate">
                      <span className="font-medium text-neutral-300">
                        {formatCategory(ticket.category)}
                      </span>
                      <span className="text-neutral-600">•</span>
                      <span className="font-mono text-[11px] text-neutral-500">
                        #{ticket.id.slice(0, 8)}
                      </span>
                      <span className="text-neutral-600">•</span>
                      <span className="text-[11px] text-neutral-500">
                        {new Date(ticket.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {hasAttachments && (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md text-neutral-300">
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

                  <ChevronRight
                    className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                      isSelected
                        ? 'text-[#e8364b] translate-x-0.5'
                        : 'text-neutral-500 group-hover:text-white group-hover:translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

                  {/* =========================================================================
          ISSUE TICKET (Dedicated Full Page on Mobile, Slide-Over Sheet on Laptop)
          ========================================================================= */}
      {mounted && isCreateModalOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[80] flex justify-end bg-black/75 sm:bg-black/60 sm:backdrop-blur-sm animate-fade-in"
              onClick={() => setIsCreateModalOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:w-[560px] lg:w-[680px] xl:w-[760px] h-full bg-[#0d0d12] sm:border-l sm:border-white/[0.1] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden relative"
              >
                {/* Center Loading Overlay with Straight Line Loading Bar */}
                {isSubmitting && (
                  <div className="absolute inset-0 z-50 bg-[#0d0d12]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                    <div className="w-full max-w-xs sm:max-w-sm flex flex-col items-center space-y-4 p-6 rounded-2xl bg-[#141419] border border-white/[0.08] shadow-2xl">
                      <div className="w-10 h-10 rounded-full bg-[#e8364b]/10 border border-[#e8364b]/20 flex items-center justify-center text-[#e8364b]">
                        <Ticket className="h-5 w-5" />
                      </div>

                      <div className="space-y-1 w-full">
                        <h4 className="text-sm font-semibold text-white">Submitting Ticket</h4>
                        <p className="text-xs text-neutral-400 truncate w-full px-2">
                          {submittingStatus || 'Processing ticket and attachments...'}
                        </p>
                      </div>

                      {/* Straight Line Loading Bar */}
                      <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-[#e8364b] via-[#ff6b7d] to-[#e8364b] rounded-full animate-straight-loading" />
                      </div>

                      <p className="text-[11px] text-neutral-500 font-mono">
                        Please wait, do not close this window
                      </p>
                    </div>
                  </div>
                )}
            {/* Header (Top navigation on Mobile, Drawer header on Laptop) */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.08] bg-[#111116] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="sm:hidden p-1.5 -ml-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  aria-label="Back to Tickets"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                    <Ticket className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-[#e8364b] shrink-0" />
                    <span>Issue Support Ticket</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5 truncate hidden sm:block">
                    Submit a ticket directly to staff without chat. Provide screenshots, files, and description.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="hidden sm:flex p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

                          {/* Form */}
                          <form onSubmit={handleSubmitTicket} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
                              {/* Form Error Banner - immediately visible on mobile and desktop inside modal */}
                              {formError && (
                                <div
                                  role="alert"
                                  className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 animate-in fade-in duration-200"
                                >
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                                    <span className="font-medium leading-relaxed break-words">{formError}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setFormError(null)}
                                    className="p-1 -mr-1 rounded-md text-red-300 hover:text-white hover:bg-red-500/20 transition-colors cursor-pointer shrink-0"
                                    aria-label="Dismiss error"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* Title Field */}
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-neutral-300 block">
                                  Ticket Title <span className="text-[#e8364b]">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={formTitle}
                                  onChange={(e) => setFormTitle(e.target.value)}
                                  placeholder="e.g. Tournament match dispute in round 3 / Account login 2FA issue"
                                  maxLength={200}
                                  required
                                  className="w-full rounded-xl border border-white/[0.08] bg-[#16161d] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none transition-colors"
                                />
                              </div>

                              {/* Category & Priority Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[11px] font-medium text-neutral-300 block">
                                    Category
                                  </label>
                                  <select
                                    value={formCategory}
                                    onChange={(e) => setFormCategory(e.target.value as typeof formCategory)}
                                    className="w-full rounded-xl border border-white/[0.08] bg-[#16161d] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-[#e8364b] focus:outline-none cursor-pointer"
                                  >
                                    <option value="tournament">Tournament Dispute / Entry</option>
                                    <option value="account">Account &amp; Security</option>
                                    <option value="gameplay">Gameplay &amp; Tournament Meta</option>
                                    <option value="payment">Payment &amp; Billing</option>
                                    <option value="bug">Bug / Technical Glitch</option>
                                    <option value="general">General Support</option>
                                  </select>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[11px] font-medium text-neutral-300 block">
                                    Priority Level
                                  </label>
                                  <select
                                    value={formPriority}
                                    onChange={(e) => setFormPriority(e.target.value as typeof formPriority)}
                                    className="w-full rounded-xl border border-white/[0.08] bg-[#16161d] px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-[#e8364b] focus:outline-none cursor-pointer"
                                  >
                                    <option value="low">Low (General guidance)</option>
                                    <option value="medium">Medium (Standard request)</option>
                                    <option value="high">High (Time sensitive issue)</option>
                                    <option value="urgent">Urgent (Account / match blocking)</option>
                                  </select>
                                </div>
                              </div>

                              {/* Description Field */}
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-neutral-300 block">
                                  Issue Description <span className="text-[#e8364b]">*</span>
                                </label>
                                <textarea
                                  rows={5}
                                  value={formDescription}
                                  onChange={(e) => setFormDescription(e.target.value)}
                                  placeholder="Explain what happened in detail. Include player IDs, tournament names, error codes, or steps to reproduce..."
                                  maxLength={10000}
                                  required
                                  className="w-full rounded-xl border border-white/[0.08] bg-[#16161d] p-3.5 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none leading-relaxed transition-colors"
                                />
                              </div>

                              {/* Attachments Section (Images, Screenshots, Docs) */}
                              <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-medium text-neutral-300 block">
                                    Proof &amp; Attachments (Screenshots, Images, Documents)
                                  </label>
                                  <span className="text-[10px] text-neutral-500">Max 10 files (up to 50MB each)</span>
                                </div>

                                {/* Hidden File Picker */}
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  multiple
                                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                                  className="hidden"
                                  onChange={(e) => {
                                    handleAddFiles(e.target.files);
                                    e.target.value = '';
                                  }}
                                />

                                {/* Upload Button Box */}
                                <div
                                  onClick={() => fileInputRef.current?.click()}
                                  className="border border-dashed border-white/[0.12] hover:border-white/[0.25] rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-colors bg-white/[0.01] hover:bg-white/[0.03]"
                                >
                                  <Paperclip className="h-5 w-5 mx-auto text-neutral-400 mb-1" />
                                  <p className="text-xs text-neutral-300 font-medium">Click to upload screenshot, gameplay photo, or doc</p>
                                  <p className="text-[10px] text-neutral-500 mt-0.5">Files will be stored in device when Submit Ticket is clicked</p>
                                </div>

                                {/* Attached Files List (selected locally, pending submit) */}
                                {pendingFiles.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {pendingFiles.map((att) => (
                                      <div
                                        key={att.id}
                                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-white/[0.08] bg-[#16161d]"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          {att.type === 'image' && att.previewUrl ? (
                                            <img
                                              src={att.previewUrl}
                                              alt={att.name}
                                              className="h-8 w-8 rounded-lg object-cover shrink-0 border border-white/[0.1]"
                                            />
                                          ) : (
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white">
                                              <FileText className="h-4 w-4" />
                                            </div>
                                          )}
                                          <div className="min-w-0">
                                            <p className="text-xs font-semibold text-white truncate">{att.name}</p>
                                            <p className="text-[10px] text-neutral-500">
                                              {att.size ? `${(att.size / 1024).toFixed(0)} KB` : 'Ready to store'}
                                            </p>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          disabled={isSubmitting}
                                          onClick={() => handleRemovePending(att.id)}
                                          className="p-1 rounded-md text-neutral-400 hover:text-red-400 hover:bg-white/[0.04] transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Form Action Buttons (Pinned to bottom of drawer/page) */}
                            <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-white/[0.08] bg-[#111116] shrink-0">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setIsCreateModalOpen(false)}
                                className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#e8364b] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#d12a3e] disabled:opacity-50 transition-colors cursor-pointer shadow-sm shadow-[#e8364b]/20 shrink-0"
                              >
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Submitting...</span>
                                  </>
                                ) : (
                                  <>
                                    <Ticket className="h-3.5 w-3.5" />
                                    <span>Submit Ticket</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>,
                      document.body
                    ) : null}

      {/* =========================================================================
          VIEW TICKET DETAILS (Dedicated Slide-Over / Full View on Mobile)
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
                className="w-full sm:w-[560px] lg:w-[680px] xl:w-[760px] h-full bg-[#0d0d12] border-l border-white/[0.1] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden"
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
                  {/* Original Request Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#131318] border border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-[#e8364b]/20 text-[#e8364b] font-semibold flex items-center justify-center text-[10px]">
                          You
                        </div>
                        <span className="font-semibold text-white">Your Request</span>
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

                    {/* Attachments inside the request card */}
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
                                    {att.size ? `${(att.size / 1024).toFixed(0)} KB` : 'File'}
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
                      <span>Discussion Thread</span>
                      {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/[0.08] text-white">
                          {selectedTicket.replies.length}
                        </span>
                      )}
                    </div>

                    {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                      <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center gap-3 text-xs text-neutral-400">
                        <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                        <span>Sandy&apos;s Gaming support is reviewing your request. Staff replies will appear here.</span>
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
                                    {isFromStaff ? `Sandy's Staff (${reply.sender_name})` : 'You'}
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
                                    {reply.sender_role === 'customer' ? 'Player' : reply.sender_role.replace('_', ' ')}
                                  </span>
                                </div>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  className="border-t border-white/[0.08] p-3 sm:p-4 bg-[#111116] shrink-0"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Add more details or reply to staff..."
                      disabled={isSendingReply}
                      className="flex-1 rounded-xl border border-white/[0.08] bg-[#16161d] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none transition-colors"
                    />

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
                          <span className="hidden sm:inline">Reply</span>
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

      {/* Mobile Floating Action Button (+) in Footer Area */}
      <div className="sm:hidden fixed bottom-6 right-5 z-30">
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsCreateModalOpen(true);
            setToastMessage(null);
          }}
          className="flex h-13 w-13 items-center justify-center rounded-full bg-[#e8364b] text-white shadow-xl shadow-[#e8364b]/40 border border-white/10 hover:bg-[#d12a3e] active:scale-90 transition-all cursor-pointer"
          aria-label="Issue New Ticket"
          title="Issue New Ticket"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}
