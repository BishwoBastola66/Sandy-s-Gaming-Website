'use client';

import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  ShieldCheck,
  Mail,
  FileText,
  HardDrive,
  Activity,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export interface AuditLogItem {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: {
    id: string;
    display_name: string;
    email: string;
    role: string;
  } | null;
}

interface AuditLogsClientProps {
  initialLogs: AuditLogItem[];
}

function formatActionLabel(action: string): string {
  const customMap: Record<string, string> = {
    MEDIA_ASSET_UPLOADED: 'Media Asset Uploaded',
    USER_ACCOUNT_SUSPENDED: 'Account Suspended',
    USER_ACCOUNT_REACTIVATED: 'Account Reactivated',
    USER_ROLE_UPDATED: 'Role Updated',
    USER_PROVISIONED: 'Account Provisioned',
    INQUIRY_REPLIED: 'Inquiry Reply Sent',
    INQUIRY_STATUS_CHANGED: 'Inquiry Status Changed',
    POST_CREATED: 'Post Created',
    POST_UPDATED: 'Post Updated',
    POST_DELETED: 'Post Deleted',
  };
  if (customMap[action]) return customMap[action];
  return action
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getActionBadgeStyle(action: string) {
  if (
    action.includes('SUSPEND') ||
    action.includes('DELETE') ||
    action.includes('DENIED') ||
    action.includes('UNASSIGNED')
  ) {
    return 'bg-red-500/10 text-red-400 border border-red-500/25';
  }
  if (
    action.includes('REACTIVATED') ||
    action.includes('PROVISIONED') ||
    action.includes('RESOLVED')
  ) {
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
  }
  if (
    action.includes('ASSIGN') ||
    action.includes('PROMOTED') ||
    action.includes('ROLE')
  ) {
    return 'bg-[#e8364b]/10 text-[#e8364b] border border-[#e8364b]/25';
  }
  if (action.includes('MEDIA') || action.includes('UPLOAD') || action.includes('STORAGE')) {
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/25';
  }
  return 'bg-white/[0.06] text-neutral-300 border border-white/[0.1]';
}

function getTargetIcon(targetType: string) {
  switch (targetType) {
    case 'account':
    case 'profile':
      return <User className="h-4 w-4 text-purple-400" />;
    case 'conversation':
      return <ShieldCheck className="h-4 w-4 text-[#e8364b]" />;
    case 'contact_inquiry':
      return <Mail className="h-4 w-4 text-amber-400" />;
    case 'post':
      return <FileText className="h-4 w-4 text-emerald-400" />;
    case 'storage':
      return <HardDrive className="h-4 w-4 text-blue-400" />;
    default:
      return <Activity className="h-4 w-4 text-neutral-400" />;
  }
}

export function AuditLogsClient({ initialLogs }: AuditLogsClientProps) {
  const [logs] = useState<AuditLogItem[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionCategory, setActionCategory] = useState<'all' | 'users' | 'inquiries'>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionCategory === 'users') {
        const isUserAction =
          log.action.startsWith('USER_') || log.target_type === 'account' || log.target_type === 'profile';
        if (!isUserAction) return false;
      } else if (actionCategory === 'inquiries') {
        const isInquiryAction =
          log.action.includes('INQUIRY') || log.target_type === 'contact_inquiry';
        if (!isInquiryAction) return false;
      }

      if (targetTypeFilter !== 'all' && log.target_type !== targetTypeFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const actionMatch = log.action.toLowerCase().includes(q);
        const formattedActionMatch = formatActionLabel(log.action).toLowerCase().includes(q);
        const targetTypeMatch = log.target_type.toLowerCase().includes(q);
        const targetIdMatch = log.target_id?.toLowerCase().includes(q) || false;
        const actorNameMatch = log.actor?.display_name.toLowerCase().includes(q) || false;
        const actorEmailMatch = log.actor?.email.toLowerCase().includes(q) || false;
        const metadataMatch = JSON.stringify(log.metadata || {}).toLowerCase().includes(q);

        return (
          actionMatch ||
          formattedActionMatch ||
          targetTypeMatch ||
          targetIdMatch ||
          actorNameMatch ||
          actorEmailMatch ||
          metadataMatch
        );
      }

      return true;
    });
  }, [logs, actionCategory, targetTypeFilter, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, actor, target ID, or metadata terms..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#141419] pl-10 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#141419] border border-white/[0.08] p-1 rounded-xl text-xs font-medium">
            <Filter className="h-3.5 w-3.5 text-neutral-400 ml-1.5 mr-0.5" />
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'users', label: 'Staff' },
                { key: 'inquiries', label: 'Inquiries' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActionCategory(cat.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  actionCategory === cat.key
                    ? 'bg-[#e8364b] text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="rounded-xl border border-white/[0.08] bg-[#141419] px-3 py-2 text-xs font-semibold text-neutral-200 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
          >
            <option value="all">All Targets</option>
            <option value="account">Accounts / Staff</option>
            <option value="contact_inquiry">Contact Inquiries</option>
            <option value="post">Posts</option>
            <option value="storage">Storage Assets</option>
          </select>
        </div>
      </div>

      {/* Log Feed */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={History}
          title={searchQuery || actionCategory !== 'all' || targetTypeFilter !== 'all' ? 'No matching audit events' : 'No audit events recorded'}
          description={
            searchQuery || actionCategory !== 'all' || targetTypeFilter !== 'all'
              ? 'Try relaxing your filter criteria or search terms.'
              : 'Sensitive administrative modifications will automatically generate event logs here.'
          }
        />
      ) : (
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.08]">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
            const actorName = log.actor?.display_name || 'System';

            return (
              <div
                key={log.id}
                className="py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-white mt-0.5">
                      {getTargetIcon(log.target_type)}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {actorName}
                        </span>
                        {log.actor?.email && (
                          <span className="text-xs text-neutral-500 font-mono">
                            ({log.actor.email})
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${getActionBadgeStyle(
                            log.action
                          )}`}
                        >
                          {formatActionLabel(log.action)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                        <span className="capitalize text-neutral-300">
                          Target: <span className="text-white font-medium">{log.target_type.replace(/_/g, ' ')}</span>
                        </span>
                        {log.target_id && (
                          <span className="font-mono text-neutral-500 text-[11px]">
                            #{log.target_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                      <Clock className="h-3.5 w-3.5 text-neutral-500" />
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>

                    {hasMetadata && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(log.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse details' : 'Expand metadata'}
                      >
                        <span>{isExpanded ? 'Hide' : 'Details'}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && hasMetadata && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] pl-0 sm:pl-12 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium">
                      <span>Event Payload Details</span>
                      <span className="font-mono text-neutral-500 text-[10px]">Log ID: {log.id}</span>
                    </div>
                    <pre className="rounded-xl bg-[#0a0a0d] border border-white/[0.06] p-3 text-[11px] font-mono text-neutral-300 overflow-x-auto leading-relaxed">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
