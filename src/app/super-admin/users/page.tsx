'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ban,
  Check,
  Search,
  KeyRound,
  Plus,
  ShieldCheck,
  X,
  Mail,
  User,
} from 'lucide-react';
import type { Database, UserRole } from '@/types/database';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

function emptySubscribe() {
  return () => {};
}

function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

type AccountRow = Omit<Database['public']['Tables']['accounts']['Row'], 'password_hash'>;

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal & Speed Dial states
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const mounted = useMounted();

  // Provisioning form state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');

  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        throw new Error('Failed to load user directory.');
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Error loading users.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/admin/users')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load user directory.');
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setUsers(data.users || []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setErrorMsg(sanitizeErrorMessage(err, 'Error loading users.'));
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (u.display_name || '').toLowerCase();
        const mail = (u.email || '').toLowerCase();
        return name.includes(q) || mail.includes(q) || u.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, roleFilter, searchQuery]);

  const handleOpenProvisionModal = (targetRole: UserRole = 'admin') => {
    setRole(targetRole);
    setEmail('');
    setDisplayName('');
    setPassword('');
    setErrorMsg(null);
    setProvisionModalOpen(true);
  };

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const cleanPassword = password.trim();

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Display name must be at least 2 characters long.');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (cleanPassword && cleanPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long (or leave blank to auto-generate).');
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          displayName: cleanName,
          role,
          password: cleanPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to provision user.');
      }

      setSuccessMsg(data.message || `Account for "${displayName || email}" provisioned successfully.`);
      setEmail('');
      setDisplayName('');
      setPassword('');
      setProvisionModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Error provisioning user.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, currentRole: UserRole, newStatus: 'active' | 'suspended') => {
    const warning =
      newStatus === 'suspended'
        ? `Are you sure you want to SUSPEND this account?\n\n• All active sessions will be invalidated.\n• Portal access will be blocked.`
        : `Are you sure you want to REACTIVATE this account?`;

    if (!confirm(warning)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: currentRole, accountStatus: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update account status.');
      }

      setSuccessMsg(data.message || `Account successfully ${newStatus === 'suspended' ? 'suspended' : 'activated'}.`);
      fetchUsers();
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Error updating status.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!confirm(`Are you sure you want to change this user's role to "${newRole.toUpperCase()}"?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update role.');
      }

      setSuccessMsg(`Role updated to ${newRole}.`);
      fetchUsers();
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Error updating role.'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 animate-page-enter">
      {/* Toast Feedback */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-4 text-xs text-emerald-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-400 underline hover:text-emerald-200 cursor-pointer ml-3 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl bg-red-950/40 border border-red-500/30 p-4 text-xs text-red-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-400 underline hover:text-red-200 cursor-pointer ml-3 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header with Straight Line Divider */}
      <div className="border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <Users className="h-5 w-5 text-[#e8364b]" />
            <span>Admin Management</span>
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Manage specialist accounts, role elevations, and account governance.
          </p>
        </div>
      </div>

      {/* Role Segmented Switch & Search Control (Like Settings) */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Role Filter Switch */}
        <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-x-auto scrollbar-none">
          {(['all', 'super_admin', 'admin', 'customer'] as const).map((r) => {
            const active = roleFilter === r;
            const count = r === 'all' ? users.length : users.filter((u) => u.role === r).length;
            const labelMap: Record<string, string> = {
              all: 'All Accounts',
              super_admin: 'Super Admin',
              admin: 'Admins',
              customer: 'Customers',
            };
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-[#e8364b] text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>{labelMap[r] || r}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px] sm:w-72">
          <Search className="h-3.5 w-3.5 text-neutral-500 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, or ID..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#141419] pl-9 pr-3.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Directory Table (Clean border divide layout, no heavy container card) */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#e8364b]" />
          <p className="mt-2 text-xs text-neutral-400">Loading directory...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center text-xs text-neutral-400">No matching accounts found.</div>
      ) : (
        <div className="overflow-x-auto border-y border-white/[0.08]">
          <table className="min-w-full divide-y divide-white/[0.06] text-left text-xs">
            <thead className="bg-white/[0.02] text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">User</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Email</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Role</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs font-bold text-neutral-200">
                        {(u.display_name || u.email || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {u.display_name || 'Unnamed'}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-500">
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-neutral-300">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <select
                      value={u.role}
                      disabled={actionLoading}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold bg-[#17171e] focus:outline-none transition-colors ${
                        u.role === 'super_admin'
                          ? 'border-[#e8364b]/40 text-[#ff6b7d]'
                          : u.role === 'admin'
                          ? 'border-blue-500/40 text-blue-300'
                          : 'border-white/[0.12] text-neutral-300'
                      }`}
                    >
                      <option value="customer">Customer</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        u.account_status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/15 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {u.account_status === 'active' ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <Ban className="h-3 w-3" />
                          <span>Suspended</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {u.account_status === 'active' ? (
                      <button
                        type="button"
                        disabled={actionLoading || u.role === 'super_admin'}
                        onClick={() => handleStatusChange(u.id, u.role, 'suspended')}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-950/40 disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <Ban className="h-3 w-3" />
                        <span>Suspend</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange(u.id, u.role, 'active')}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-30 transition-colors cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        <span>Activate</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Provision New Account Modal */}
      {provisionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setProvisionModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#121217] shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8364b]/15 text-[#e8364b] border border-[#e8364b]/30">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {role === 'super_admin' ? 'Provision Super Admin' : 'Provision Specialist Account'}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Create a new account or elevate permissions by email.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProvisionModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleProvisionUser} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-300 mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@sandygamings.com"
                    className="block w-full rounded-xl border border-white/[0.1] bg-[#17171e] pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
                  />
                  <Mail className="h-3.5 w-3.5 text-neutral-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 mb-1.5">
                  Display Name / Alias
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="block w-full rounded-xl border border-white/[0.1] bg-[#17171e] pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
                  />
                  <User className="h-3.5 w-3.5 text-neutral-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 mb-1.5">
                  Initial Password <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="block w-full rounded-xl border border-white/[0.1] bg-[#17171e] pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
                  />
                  <KeyRound className="h-3.5 w-3.5 text-neutral-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-300 mb-1.5">
                  Role Assignment
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="block w-full rounded-xl border border-white/[0.1] bg-[#17171e] px-3.5 py-2 text-xs text-white focus:border-[#e8364b]/50 focus:outline-none transition-colors"
                >
                  <option value="admin">Admin (Staff Specialist)</option>
                  <option value="super_admin">Super Admin (Governance)</option>
                  <option value="customer">Customer</option>
                </select>
              </div>

              <div className="pt-2 border-t border-white/[0.08] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProvisionModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e8364b] hover:bg-[#d12a3e] px-4 py-2 text-xs font-bold text-white shadow-[0_2px_12px_rgba(232,54,75,0.3)] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Provision Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sticky Footer Floating (+) Button with Speed-Dial directly in document.body via Portal */}
      {mounted
        ? createPortal(
            <>
              {/* Backdrop when speed dial is open */}
              {speedDialOpen && (
                <div
                  onClick={() => setSpeedDialOpen(false)}
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity"
                />
              )}

              <div className="fixed bottom-6 right-5 sm:right-8 z-50 flex flex-col items-end gap-2.5">
                {/* 2 Buttons Pop-Up Menu: Super Admin & Admin */}
                {speedDialOpen && (
                  <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    {/* Button 2: Provision Super Admin */}
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedDialOpen(false);
                        handleOpenProvisionModal('super_admin');
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#1a1a24] hover:bg-[#222230] text-white border border-white/10 shadow-2xl transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-neutral-200 group-hover:text-white">
                          Provision Super Admin
                        </span>
                        <span className="block text-[10px] text-neutral-400">
                          Full governance &amp; security access
                        </span>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                    </button>

                    {/* Button 1: Provision Admin Specialist */}
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedDialOpen(false);
                        handleOpenProvisionModal('admin');
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#1a1a24] hover:bg-[#222230] text-white border border-white/10 shadow-2xl transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-neutral-200 group-hover:text-white">
                          Provision Admin Specialist
                        </span>
                        <span className="block text-[10px] text-neutral-400">
                          Support tickets &amp; live chat staff
                        </span>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8364b]/20 text-[#ff6b7d] border border-[#e8364b]/30 shrink-0">
                        <UserPlus className="h-4 w-4" />
                      </div>
                    </button>
                  </div>
                )}

                {/* Main Floating Action Button (+) */}
                <button
                  type="button"
                  onClick={() => setSpeedDialOpen(!speedDialOpen)}
                  className={`flex h-13 w-13 items-center justify-center rounded-full bg-[#e8364b] text-white shadow-2xl shadow-[#e8364b]/50 border border-white/20 hover:bg-[#d12a3e] hover:scale-105 active:scale-90 transition-all cursor-pointer ${
                    speedDialOpen ? 'rotate-45' : 'rotate-0'
                  }`}
                  aria-label={speedDialOpen ? 'Close Menu' : 'Provision Account'}
                  title={speedDialOpen ? 'Close' : 'Provision Account'}
                >
                  <Plus className="h-6 w-6 stroke-[2.5] transition-transform duration-200" />
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
