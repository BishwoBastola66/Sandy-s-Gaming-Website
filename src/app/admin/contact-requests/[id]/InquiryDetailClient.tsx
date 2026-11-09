'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Phone,
  User,
  Clock,
  Send,
  Loader2,
  History,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmailDeliveryStatus } from '@/types/database';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

interface InquiryData {
  id: string;
  name: string | null;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'in_progress' | 'replied' | 'closed';
  replied_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReplyData {
  id: string;
  inquiry_id: string;
  admin_id: string;
  body: string;
  email_delivery_status: EmailDeliveryStatus;
  provider_message_id: string | null;
  last_delivery_error?: string | null;
  idempotency_key?: string | null;
  retry_count?: number;
  last_attempted_at?: string | null;
  sent_at: string | null;
  created_at: string;
  admin?: {
    display_name: string;
    email: string | null;
  } | null;
}

interface AdminProfile {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
}

export interface EmailConfigInfo {
  isConfigured: boolean;
  provider: string;
  fromAddress: string;
}

interface InquiryDetailClientProps {
  inquiry: InquiryData;
  replies: ReplyData[];
  availableStaff: AdminProfile[];
  currentUserId: string;
  emailConfig: EmailConfigInfo;
}

function getStatusBadge(status: EmailDeliveryStatus) {
  switch (status) {
    case 'accepted':
      return {
        label: 'Accepted by Provider',
        className: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
        icon: CheckCircle2,
      };
    case 'sent':
      return {
        label: 'Dispatched / Sent',
        className: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
        icon: CheckCircle2,
      };
    case 'delivered':
      return {
        label: 'Delivered to Inbox',
        className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
        icon: CheckCircle2,
      };
    case 'queued':
      return {
        label: 'Queued',
        className: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        icon: Clock,
      };
    case 'failed':
      return {
        label: 'Delivery Failed',
        className: 'bg-red-500/15 text-red-300 border border-red-500/30',
        icon: AlertCircle,
      };
    case 'bounced':
      return {
        label: 'Bounced',
        className: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
        icon: AlertCircle,
      };
    case 'pending':
    default:
      return {
        label: 'Draft / Pending Dispatch',
        className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        icon: Clock,
      };
  }
}

export function InquiryDetailClient({
  inquiry: initialInquiry,
  replies: initialReplies,
  availableStaff,
  currentUserId,
  emailConfig,
}: InquiryDetailClientProps) {
  const router = useRouter();

  const [inquiry, setInquiry] = useState<InquiryData>(initialInquiry);
  const [replies, setReplies] = useState<ReplyData[]>(initialReplies);
  const [status, setStatus] = useState(initialInquiry.status);

  const [replyBody, setReplyBody] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [retryingReplyId, setRetryingReplyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: 'new' | 'in_progress' | 'replied' | 'closed') => {
    setActionError(null);
    setActionSuccess(null);
    setIsUpdatingStatus(true);

    try {
      const res = await fetch(`/api/admin/contact-requests/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      setStatus(newStatus);
      setInquiry((prev) => ({ ...prev, status: newStatus }));
      setActionSuccess(`Inquiry status updated to "${newStatus.replace('_', ' ')}".`);
      router.refresh();
    } catch (err: unknown) {
      setActionError(sanitizeErrorMessage(err, 'Error updating status.'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setActionError(null);
    setActionSuccess(null);
    setIsSendingReply(true);

    try {
      const idempotencyKey = `reply_${inquiry.id}_${Date.now()}`;

      const res = await fetch(`/api/admin/contact-requests/${inquiry.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: replyBody.trim(),
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record response');

      const currentStaff = availableStaff.find((s) => s.id === currentUserId);
      const newReply: ReplyData = {
        ...data.reply,
        admin: currentStaff || { display_name: 'Current Staff', email: null },
      };

      setReplies((prev) => [...prev, newReply]);
      setReplyBody('');
      setStatus('replied');
      setInquiry((prev) => ({ ...prev, status: 'replied', replied_at: new Date().toISOString() }));

      if (data.isConfigured && data.status === 'accepted') {
        setActionSuccess(data.message || 'Email response accepted by provider.');
      } else {
        setActionSuccess(
          data.isConfigured
            ? `Dispatch attempted via ${data.provider}: ${data.status}`
            : 'Draft reply saved. (Email provider is unconfigured in server environment).'
        );
      }
      router.refresh();
    } catch (err: unknown) {
      setActionError(sanitizeErrorMessage(err, 'Error submitting reply.'));
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleRetryReply = async (replyId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setRetryingReplyId(replyId);

    try {
      const res = await fetch(
        `/api/admin/contact-requests/${inquiry.id}/replies/${replyId}/retry`,
        {
          method: 'POST',
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry attempt failed');

      setReplies((prev) =>
        prev.map((r) => (r.id === replyId ? { ...r, ...data.reply } : r))
      );

      setActionSuccess(data.message || 'Retry completed.');
      router.refresh();
    } catch (err: unknown) {
      setActionError(sanitizeErrorMessage(err, 'Error executing retry.'));
    } finally {
      setRetryingReplyId(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {!emailConfig.isConfigured ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200">
              <span className="font-semibold block text-sm mb-0.5">
                Email Provider in Draft Persistence Mode
              </span>
              No <code className="bg-amber-900/40 px-1 py-0.5 rounded font-mono">EMAIL_API_KEY</code> is set in the environment. Staff replies are safely saved with status <code className="font-mono">pending</code> and can be retried at any time.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-blue-500/25 bg-blue-950/20 p-4 flex items-center justify-between text-xs text-blue-200 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
            <span>
              <strong>Active Email Provider:</strong> {emailConfig.provider.toUpperCase()} &bull; Sending from{' '}
              <code className="font-mono bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-500/20 text-blue-100">{emailConfig.fromAddress}</code>
            </span>
          </div>
          <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300 border border-blue-500/30">
            Connected
          </span>
        </div>
      )}

      {actionError && (
        <Alert variant="error" title="Action Failed">
          {actionError}
        </Alert>
      )}

      {actionSuccess && (
        <Alert variant="success" title="Notification">
          {actionSuccess}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Inquiry Content & Reply History */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#12131a]/90 backdrop-blur-sm p-6 shadow-md transition-all">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Inquiry Message
              </span>
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                <Clock className="h-3.5 w-3.5" />
                <span>{new Date(inquiry.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
              {inquiry.message}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#12131a]/90 backdrop-blur-sm p-6 space-y-5 shadow-md">
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
              <History className="h-4 w-4 text-neutral-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Follow-up Reply History ({replies.length})
              </h3>
            </div>

            {replies.length === 0 ? (
              <p className="text-xs text-neutral-400 italic py-2">
                No replies recorded yet for this inquiry. Compose a response below.
              </p>
            ) : (
              <div className="space-y-4">
                {replies.map((reply) => {
                  const badge = getStatusBadge(reply.email_delivery_status);
                  const BadgeIcon = badge.icon;
                  const canRetry =
                    ['failed', 'pending'].includes(reply.email_delivery_status) &&
                    (reply.retry_count ?? 0) < 5;

                  return (
                    <div
                      key={reply.id}
                      className="rounded-xl border border-white/[0.08] bg-[#171822] p-4 space-y-2.5 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{reply.admin?.display_name || 'Staff Member'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                          >
                            <BadgeIcon className="h-3 w-3" />
                            <span>{badge.label}</span>
                          </span>
                          <span className="text-[11px] text-neutral-400 font-mono">
                            {new Date(reply.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed">
                        {reply.body}
                      </div>

                      <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
                        <div className="flex items-center gap-3">
                          {reply.provider_message_id && (
                            <span className="font-mono">
                              ID: {reply.provider_message_id}
                            </span>
                          )}
                          {reply.retry_count && reply.retry_count > 0 ? (
                            <span>Retries: {reply.retry_count}</span>
                          ) : null}
                          {reply.sent_at && (
                            <span>Sent: {new Date(reply.sent_at).toLocaleTimeString()}</span>
                          )}
                        </div>

                        {canRetry && (
                          <button
                            type="button"
                            onClick={() => handleRetryReply(reply.id)}
                            disabled={retryingReplyId === reply.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#111116] px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/[0.08] transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {retryingReplyId === reply.id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            <span>Retry Send</span>
                          </button>
                        )}
                      </div>

                      {reply.last_delivery_error && (
                        <div className="rounded-md bg-red-950/30 border border-red-500/30 p-2 text-[11px] text-red-300 font-mono">
                          {reply.last_delivery_error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSendReply} className="pt-4 border-t border-white/[0.08] space-y-3.5">
              <div>
                <label
                  htmlFor="staff-reply-box"
                  className="block text-xs font-semibold text-neutral-300 mb-1.5"
                >
                  Send Response to <span className="text-white font-mono">{inquiry.email}</span>
                </label>
                <textarea
                  id="staff-reply-box"
                  rows={4}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Compose email response..."
                  className="w-full rounded-xl border border-white/[0.1] bg-[#161720] p-3.5 text-xs text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/[0.08] focus:bg-[#1a1c28] transition-all resize-y"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <span className="text-[11px] text-neutral-400">
                  {emailConfig.isConfigured
                    ? `Will dispatch live email via ${emailConfig.provider}`
                    : 'Will save internal draft reply'}
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSendingReply || !replyBody.trim()}
                  className="btn-primary text-xs font-semibold shadow-md"
                >
                  {isSendingReply ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      <span>
                        {emailConfig.isConfigured ? 'Send Email Response' : 'Save Draft Reply'}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Metadata, Triage Controls & Assignment */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#12131a]/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3.5">
              Triage Status
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { val: 'new', label: 'New', desc: 'Unreviewed' },
                { val: 'in_progress', label: 'In Progress', desc: 'Under review' },
                { val: 'replied', label: 'Replied', desc: 'Response drafted/sent' },
                { val: 'closed', label: 'Closed', desc: 'Resolved' },
              ].map((item) => {
                const isSelected = status === item.val;
                return (
                  <button
                    key={item.val}
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => handleStatusChange(item.val as 'new' | 'in_progress' | 'replied' | 'closed')}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#e8364b]/60 bg-[#e8364b]/10 text-white font-semibold ring-1 ring-[#e8364b]/30 shadow-sm'
                        : 'border-white/[0.08] bg-[#161720]/80 hover:bg-[#1a1c28] hover:border-white/15 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs capitalize">{item.label}</span>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-[#e8364b]" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#12131a]/90 backdrop-blur-sm p-5 sm:p-6 space-y-4 shadow-md">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              Guest Sender Info
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 block mb-0.5">Name</span>
                <span className="font-semibold text-white">
                  {inquiry.name || 'Anonymous Visitor'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-neutral-400 block mb-0.5">Email Address</span>
                <a
                  href={`mailto:${inquiry.email}`}
                  className="font-mono text-xs text-neutral-200 hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <Mail className="h-3.5 w-3.5 text-neutral-400 group-hover:text-white transition-colors" />
                  <span className="underline underline-offset-2">{inquiry.email}</span>
                </a>
              </div>

              {inquiry.phone && (
                <div>
                  <span className="text-[10px] text-neutral-400 block mb-0.5">Phone Number</span>
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="font-mono text-xs text-neutral-200 hover:text-white transition-colors flex items-center gap-1.5 group"
                  >
                    <Phone className="h-3.5 w-3.5 text-neutral-400 group-hover:text-white transition-colors" />
                    <span className="underline underline-offset-2">{inquiry.phone}</span>
                  </a>
                </div>
              )}

              <div className="pt-3 border-t border-white/[0.08] text-[11px] text-neutral-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Inquiry ID:</span>
                  <span className="font-mono text-[10px] text-neutral-300">{inquiry.id.slice(0, 18)}...</span>
                </div>
                {inquiry.replied_at && (
                  <div className="flex items-center justify-between">
                    <span>Last Replied:</span>
                    <span className="text-neutral-300">{new Date(inquiry.replied_at).toLocaleString()}</span>
                  </div>
                )}
                {inquiry.closed_at && (
                  <div className="flex items-center justify-between">
                    <span>Closed At:</span>
                    <span className="text-neutral-300">{new Date(inquiry.closed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
