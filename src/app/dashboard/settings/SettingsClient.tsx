'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Key,
  Lock,
  CheckCircle2,
  LogOut,
  Save,
  Edit2,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronRight,
  Shield,
  Laptop,
  Smartphone,
  X,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

export interface UserSessionItem {
  id: string;
  ipAddress: string;
  userAgent?: string | null;
  createdAt: string;
  isCurrent: boolean;
}

interface SettingsClientProps {
  user: {
    id: string;
    email: string;
    phone?: string | null;
    displayName: string;
    role: string;
    accountStatus: string;
    createdAt?: string;
  };
  totalThreads?: number;
  recentConv?: {
    id: string;
    subject: string | null;
    status: string;
    last_message_at: string;
    created_at: string;
  } | null;
  initialSessions?: UserSessionItem[];
}

export function SettingsClient({ user, initialSessions = [] }: SettingsClientProps) {
  const router = useRouter();

  // Active Category Tab: 'personal' | 'security'
  const [activeCategory, setActiveCategory] = useState<'personal' | 'security'>('personal');

  // Mobile Navigation: whether mobile view is showing category detail or the category menu
  const [isMobileViewingDetail, setIsMobileViewingDetail] = useState(false);

  const handleSelectCategory = (id: 'personal' | 'security') => {
    setActiveCategory(id);
    setStatusMessage(null);
    setIsMobileViewingDetail(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleBackToSettingsMenu = () => {
    setIsMobileViewingDetail(false);
    setSecuritySubTab(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleToggleSecuritySubTab = (tab: 'password' | 'devices') => {
    setSecuritySubTab((prev) => (prev === tab ? null : tab));
    setStatusMessage(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // Security Sub-View Tab: 'password' | 'devices' | null
  const [securitySubTab, setSecuritySubTab] = useState<'password' | 'devices' | null>(null);

  // Sessions State for Logged in devices
  const [sessionsList, setSessionsList] = useState<UserSessionItem[]>(initialSessions);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Personal Information States
  const [displayName, setDisplayName] = useState(user.displayName);
  const [phone, setPhone] = useState(user.phone || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState(user.displayName);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editPhoneInput, setEditPhoneInput] = useState(user.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password & Security States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Status feedback toast
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const initials = displayName.slice(0, 2).toUpperCase();

  // Handle Save Display Name
  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = editNameInput.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setStatusMessage({ type: 'error', text: 'Display name must be at least 2 characters long.' });
      return;
    }
    if (trimmedName.length > 50) {
      setStatusMessage({ type: 'error', text: 'Display name cannot exceed 50 characters.' });
      return;
    }

    setIsSavingProfile(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: trimmedName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update display name');

      setDisplayName(data.account.display_name);
      setIsEditingName(false);
      setStatusMessage({ type: 'success', text: 'Display name updated successfully.' });
      router.refresh();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: sanitizeErrorMessage(err, 'Could not save display name.') });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Save Phone Number
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPhone = editPhoneInput.trim();
    if (trimmedPhone && (trimmedPhone.length < 7 || trimmedPhone.length > 20 || !/^\+?[0-9\s\-()]+$/.test(trimmedPhone))) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid phone number (7–20 digits).' });
      return;
    }

    setIsSavingProfile(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmedPhone || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update phone number');

      setPhone(data.account.phone || '');
      setIsEditingPhone(false);
      setStatusMessage({ type: 'success', text: 'Contact phone number updated successfully.' });
      router.refresh();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: sanitizeErrorMessage(err, 'Could not save phone number.') });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Change Password (Facebook Style)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!currentPassword) {
      setStatusMessage({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setStatusMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'New passwords do not match. Please re-type.' });
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setStatusMessage({ type: 'success', text: 'Your password has been changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: sanitizeErrorMessage(err, 'Error updating password.') });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    router.push('/login');
    router.refresh();
  };

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      handleSignOut();
      return;
    }

    setRevokingId(sessionId);
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke device session');

      setSessionsList((prev) => prev.filter((s) => s.id !== sessionId));
      setStatusMessage({ type: 'success', text: 'Device session signed out successfully.' });
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: sanitizeErrorMessage(err, 'Error revoking session.') });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    setRevokingAll(true);
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAllOthers: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke other sessions');

      setSessionsList((prev) => prev.filter((s) => s.isCurrent));
      setStatusMessage({ type: 'success', text: 'Signed out of all other devices.' });
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: sanitizeErrorMessage(err, 'Error revoking sessions.') });
    } finally {
      setRevokingAll(false);
    }
  };

  const parseDeviceDetails = (ua?: string | null) => {
    if (!ua) {
      return {
        name: 'Current Browser Session',
        os: 'Desktop',
        browser: 'Web Browser',
        isMobile: false,
      };
    }

    let browser = 'Web Browser';
    if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Chrome/')) browser = 'Google Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
    else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';

    let os = 'Desktop';
    let isMobile = false;
    if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
      os = 'iOS';
      isMobile = true;
    } else if (ua.includes('Android')) {
      os = 'Android';
      isMobile = true;
    } else if (ua.includes('Windows NT')) {
      os = 'Windows PC';
    } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
      os = 'macOS';
    } else if (ua.includes('Linux')) {
      os = 'Linux';
    }

    return {
      name: `${os} • ${browser}`,
      os,
      browser,
      isMobile,
    };
  };

  return (
    <div className="space-y-6">
      {/* Status Feedback Toast */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-xs border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="font-medium underline hover:opacity-80 ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Facebook-Style Accounts Center Layout (Clean straight line breaking sections, no outer cards) */}
      <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12 w-full pt-2">
        {/* =========================================================================
            LEFT COLUMN: Settings Category Selector (Clean, flat with vertical dividing line)
            ========================================================================= */}
        <div
          className={`w-full lg:w-72 xl:w-80 shrink-0 space-y-5 lg:border-r lg:border-white/[0.08] lg:pr-8 lg:pb-0 ${
            isMobileViewingDetail ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* User Profile Mini Header (Hidden on mobile per request; visible on desktop) */}
          <div className="hidden lg:flex items-center gap-3 pb-4 border-b border-white/[0.08]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8364b]/15 border border-[#e8364b]/30 text-xs font-semibold text-[#e8364b]">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">{displayName}</h2>
              <p className="text-xs text-neutral-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Category Navigation Menu (Continuous flush human-crafted list, zero disjointed gaps) */}
          <nav className="divide-y divide-white/[0.08] border-y border-white/[0.08] lg:border lg:rounded-xl overflow-hidden bg-transparent lg:bg-[#111116]/40">
            {[
              {
                id: 'personal',
                label: 'Personal details',
                desc: 'Name, email, phone & identity',
                icon: User,
              },
              {
                id: 'security',
                label: 'Password and security',
                desc: 'Login credentials & protection',
                icon: Lock,
              },
            ].map(({ id, label, desc, icon: Icon }) => {
              const isActive = activeCategory === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectCategory(id as 'personal' | 'security')}
                  className={`group relative w-full flex items-center justify-between py-3.5 px-3 sm:px-4 text-left transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? 'lg:bg-white/[0.04] text-white'
                      : 'hover:bg-white/[0.025] text-neutral-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
                        isActive
                          ? 'bg-white/[0.06] border border-white/[0.12] text-white'
                          : 'bg-white/[0.04] border border-white/[0.07] text-neutral-400 group-hover:text-white group-hover:bg-white/[0.06]'
                      }`}
                    >
                      <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-105" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-white block leading-tight">
                        {label}
                      </span>
                      <span className="text-xs text-neutral-400 block leading-tight mt-1 truncate">
                        {desc}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-150 group-hover:text-neutral-200 group-hover:translate-x-0.5"
                  />
                </button>
              );
            })}
          </nav>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: Categorized Content (Clean sections broken by straight lines)
            ========================================================================= */}
        <div className={`flex-1 w-full min-w-0 space-y-6 ${!isMobileViewingDetail ? 'hidden lg:block' : 'block'}`}>
          {/* CATEGORY 1: PERSONAL DETAILS */}
          {activeCategory === 'personal' && (
            <div className="w-full space-y-6 animate-fade-up">
              <div className="pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBackToSettingsMenu}
                    className="lg:hidden p-1.5 -ml-1 text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer shrink-0"
                    aria-label="Back to Settings"
                    title="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h3 className="text-base font-semibold text-white">Personal details</h3>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Sandy&apos;s Gaming uses this information to verify your identity and protect your account.
                </p>
              </div>

              {/* Categorized List of Rows (Straight Line Breaking Each Field) */}
              <div className="divide-y divide-white/[0.08]">
                {/* 1. Name Row */}
                <div className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium text-neutral-400">Name</span>
                      {!isEditingName && (
                        <p className="text-sm font-semibold text-white mt-0.5">{displayName}</p>
                      )}
                    </div>
                    {!isEditingName ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditNameInput(displayName);
                          setIsEditingName(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#e8364b] hover:text-[#ff6b7d] transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    ) : null}
                  </div>

                  {/* Inline Edit Name Form */}
                  {isEditingName && (
                    <form onSubmit={handleSaveDisplayName} className="mt-3 space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/[0.08]">
                      <div>
                        <label className="text-[11px] font-medium text-neutral-300 block mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={editNameInput}
                          onChange={(e) => setEditNameInput(e.target.value)}
                          maxLength={50}
                          className="w-full rounded-lg border border-white/[0.1] bg-[#0d0d11] px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none"
                          placeholder="Enter your name..."
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#e8364b] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#d12a3e] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {isSavingProfile ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-3 w-3" />
                              <span>Save changes</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingProfile}
                          onClick={() => setIsEditingName(false)}
                          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* 2. Contact Info: Email Address */}
                <div className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[11px] font-medium text-neutral-400">Email address</span>
                    <p className="text-sm font-semibold text-white mt-0.5 truncate">{user.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400 shrink-0">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Verified</span>
                  </span>
                </div>

                {/* 3. Contact Info: Phone Number */}
                <div className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium text-neutral-400">Phone number</span>
                      {!isEditingPhone && (
                        <p className="text-sm font-semibold text-white mt-0.5">
                          {phone ? phone : <span className="text-neutral-500 italic font-normal">No phone number added</span>}
                        </p>
                      )}
                    </div>
                    {!isEditingPhone ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPhoneInput(phone);
                          setIsEditingPhone(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#e8364b] hover:text-[#ff6b7d] transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>{phone ? 'Edit' : 'Add phone'}</span>
                      </button>
                    ) : null}
                  </div>

                  {/* Inline Edit Phone Form */}
                  {isEditingPhone && (
                    <form onSubmit={handleSavePhone} className="mt-3 space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/[0.08]">
                      <div>
                        <label className="text-[11px] font-medium text-neutral-300 block mb-1">
                          Phone Number (Optional)
                        </label>
                        <input
                          type="tel"
                          value={editPhoneInput}
                          onChange={(e) => setEditPhoneInput(e.target.value)}
                          maxLength={20}
                          className="w-full rounded-lg border border-white/[0.1] bg-[#0d0d11] px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none"
                          placeholder="+1 555-0199..."
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#e8364b] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#d12a3e] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {isSavingProfile ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-3 w-3" />
                              <span>Save</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingProfile}
                          onClick={() => setIsEditingPhone(false)}
                          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* 4. Account Ownership & Status */}
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-medium text-neutral-400">Account status &amp; role</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-semibold capitalize text-white">
                        {(user.role || 'customer').replace('_', ' ')}
                      </p>
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 capitalize">
                        {user.accountStatus || 'Active'}
                      </span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] font-medium text-neutral-400">Member since</span>
                    <p className="text-xs font-semibold text-white mt-0.5">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Active Member'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY 2: PASSWORD AND SECURITY */}
          {activeCategory === 'security' && (
            <div className="w-full space-y-6 animate-fade-up">
              {/* Header with Straight Line Divider */}
              <div className="pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBackToSettingsMenu}
                    className="lg:hidden p-1.5 -ml-1 text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer shrink-0"
                    aria-label="Back to Settings"
                    title="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h3 className="text-base font-semibold text-white">Password and security</h3>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Manage your account credentials, password security, and active device sessions.
                </p>
              </div>

              {/* Sub-buttons and Side Content Panel Layout */}
              <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8 w-full">
                {/* SUB-BUTTONS LIST (Displays Change Password & Logged In Devices) */}
                <div className={`w-full lg:w-72 xl:w-80 shrink-0 space-y-3 lg:space-y-2.5 ${securitySubTab !== null ? 'hidden lg:block' : 'block'}`}>
                  <span className="text-[11px] font-medium text-neutral-400 px-1 block mb-1">
                    Login &amp; Security Controls
                  </span>

                  <div className="divide-y divide-white/[0.08] border-y border-white/[0.08] lg:border lg:rounded-xl overflow-hidden bg-transparent lg:bg-[#111116]/40">
                    {/* Button 1: Change password */}
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySubTab('password')}
                      className={`group relative w-full flex items-center justify-between py-3.5 px-3 sm:px-4 text-left transition-colors duration-150 cursor-pointer ${
                        securitySubTab === 'password'
                          ? 'bg-white/[0.05] text-white'
                          : 'hover:bg-white/[0.025] text-neutral-300 hover:text-white'
                      }`}
                    >
                      {securitySubTab === 'password' && (
                        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#e8364b]" />
                      )}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
                            securitySubTab === 'password'
                              ? 'bg-[#e8364b]/20 border border-[#e8364b]/40 text-[#e8364b]'
                              : 'bg-white/[0.04] border border-white/[0.07] text-neutral-400 group-hover:text-white group-hover:bg-white/[0.06]'
                          }`}
                        >
                          <Key className="h-4 w-4 transition-transform duration-150 group-hover:scale-105" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-white block leading-tight">
                            Change password
                          </span>
                          <span className="text-xs text-neutral-400 block leading-tight mt-1 truncate">
                            Update account password
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                          securitySubTab === 'password'
                            ? 'text-[#e8364b] translate-x-0.5'
                            : 'text-neutral-500 group-hover:text-neutral-200 group-hover:translate-x-0.5'
                        }`}
                      />
                    </button>

                    {/* Button 2: Logged in devices */}
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySubTab('devices')}
                      className={`group relative w-full flex items-center justify-between py-3.5 px-3 sm:px-4 text-left transition-colors duration-150 cursor-pointer ${
                        securitySubTab === 'devices'
                          ? 'bg-white/[0.05] text-white'
                          : 'hover:bg-white/[0.025] text-neutral-300 hover:text-white'
                      }`}
                    >
                      {securitySubTab === 'devices' && (
                        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#e8364b]" />
                      )}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
                            securitySubTab === 'devices'
                              ? 'bg-[#e8364b]/20 border border-[#e8364b]/40 text-[#e8364b]'
                              : 'bg-white/[0.04] border border-white/[0.07] text-neutral-400 group-hover:text-white group-hover:bg-white/[0.06]'
                          }`}
                        >
                          <Laptop className="h-4 w-4 transition-transform duration-150 group-hover:scale-105" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-white block leading-tight">
                            Logged in devices
                          </span>
                          <span className="text-xs text-neutral-400 block leading-tight mt-1 truncate">
                            Where you&apos;re logged in
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
                          securitySubTab === 'devices'
                            ? 'text-[#e8364b] translate-x-0.5'
                            : 'text-neutral-500 group-hover:text-neutral-200 group-hover:translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* SIDE CONTENT PANEL (Opens Change Password or Logged In Devices in the side) */}
                <div className={`flex-1 w-full min-w-0 lg:border-l lg:border-white/[0.08] lg:pl-8 ${securitySubTab === null ? 'hidden lg:block' : 'block'}`}>
                  {/* Default State: When user hasn't clicked a sub-button yet */}
                  {securitySubTab === null && (
                    <div className="flex flex-col items-center justify-center text-center p-8 min-h-[220px]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3">
                        <Shield className="h-5 w-5 text-neutral-400" />
                      </div>
                      <p className="text-xs font-semibold text-white">Select a Security Setting</p>
                      <p className="text-[11px] text-neutral-400 mt-1 max-w-xs leading-relaxed">
                        Choose <span className="text-neutral-200 font-medium">Change password</span> or <span className="text-neutral-200 font-medium">Logged in devices</span> on the left to view and manage details.
                      </p>
                    </div>
                  )}

                  {/* 1. SIDE: Change Password Panel */}
                  {securitySubTab === 'password' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">
                      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSecuritySubTab(null)}
                            className="lg:hidden p-1.5 -ml-1 text-neutral-400 hover:text-white cursor-pointer"
                            aria-label="Back to Security Options"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <div>
                            <h4 className="text-sm font-semibold text-white">Change password</h4>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              Choose a strong, unique password with at least 6 characters.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSecuritySubTab(null)}
                          className="hidden lg:flex p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                          title="Close panel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                        {/* Current Password Field */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-neutral-300">
                            Current password
                          </label>
                          <div className="relative">
                            <input
                              type={showCurrentPassword ? 'text' : 'password'}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Enter your current password..."
                              className="w-full rounded-xl border border-white/[0.08] bg-[#16161d] px-3.5 py-2.5 pr-10 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute right-3 top-2.5 text-neutral-400 hover:text-white cursor-pointer"
                              tabIndex={-1}
                            >
                              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* New Password Field */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-neutral-300">
                            New password
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter your new password (min. 6 characters)..."
                              className="w-full rounded-xl border border-white/[0.08] bg-[#16161d] px-3.5 py-2.5 pr-10 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-2.5 text-neutral-400 hover:text-white cursor-pointer"
                              tabIndex={-1}
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Re-type New Password Field */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-neutral-300">
                            Re-type new password
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your new password..."
                            className="w-full rounded-xl border border-white/[0.08] bg-[#16161d] px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none"
                          />
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isChangingPassword || !currentPassword || !newPassword}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#e8364b] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#d12a3e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
                          >
                            {isChangingPassword ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Updating password...</span>
                              </>
                            ) : (
                              <>
                                <Key className="h-3.5 w-3.5" />
                                <span>Change password</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>

                      {/* Security Architecture Note */}
                      <div className="border-t border-white/[0.08] pt-4 mt-6 flex items-start gap-2.5 text-[11px] text-neutral-400">
                        <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <p>
                          Passwords are cryptographically salted and hashed with PBKDF2-SHA512 (100,000 iterations). Plaintext credentials are never stored.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 2. SIDE: Logged In Devices Panel */}
                  {securitySubTab === 'devices' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-3 duration-200">
                      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSecuritySubTab(null)}
                            className="lg:hidden p-1.5 -ml-1 text-neutral-400 hover:text-white cursor-pointer"
                            aria-label="Back to Security Options"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <div>
                            <h4 className="text-sm font-semibold text-white">Where you&apos;re logged in</h4>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              Review devices and browsers that currently have active sessions on your account.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSecuritySubTab(null)}
                          className="hidden lg:flex p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                          title="Close panel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Active Sessions List */}
                      <div className="space-y-4">
                        {/* Current Device Section */}
                        {(() => {
                          const currentSession = sessionsList.find((s) => s.isCurrent) || sessionsList[0];
                          const parsed = currentSession ? parseDeviceDetails(currentSession.userAgent) : parseDeviceDetails();
                          const DeviceIcon = parsed.isMobile ? Smartphone : Laptop;

                          return (
                            <div className="space-y-2">
                              <span className="text-[11px] font-medium text-neutral-400 px-1">
                                This device
                              </span>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mt-0.5">
                                    <DeviceIcon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-semibold text-white truncate">
                                        {parsed.name}
                                      </p>
                                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Active now
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-400 mt-0.5">
                                      {currentSession?.ipAddress || 'Current Network'} • Signed in{' '}
                                      {currentSession
                                        ? new Date(currentSession.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                          })
                                        : 'Today'}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={handleSignOut}
                                  disabled={loggingOut}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40 transition-colors cursor-pointer self-start sm:self-auto shrink-0 disabled:opacity-50"
                                >
                                  <LogOut className="h-3 w-3" />
                                  <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Other Logged In Devices Section */}
                        {(() => {
                          const otherSessions = sessionsList.filter((s) => !s.isCurrent);
                          if (otherSessions.length === 0) {
                            return (
                              <div className="pt-2">
                                <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] text-center">
                                  <p className="text-xs text-neutral-400">
                                    No other active devices found. Your account is only signed in on this current device.
                                  </p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[11px] font-medium text-neutral-400">
                                  Other authenticated devices ({otherSessions.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={handleRevokeAllOthers}
                                  disabled={revokingAll}
                                  className="text-[11px] font-semibold text-[#e8364b] hover:text-[#ff6b7d] transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {revokingAll ? 'Signing out all...' : 'Log out of all other devices'}
                                </button>
                              </div>

                              <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl overflow-hidden bg-white/[0.02]">
                                {otherSessions.map((session) => {
                                  const parsed = parseDeviceDetails(session.userAgent);
                                  const DeviceIcon = parsed.isMobile ? Smartphone : Laptop;
                                  const isRevoking = revokingId === session.id;

                                  return (
                                    <div
                                      key={session.id}
                                      className="flex items-center justify-between gap-3 p-3.5"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-400">
                                          <DeviceIcon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-white truncate">
                                            {parsed.name}
                                          </p>
                                          <p className="text-[11px] text-neutral-400 truncate">
                                            {session.ipAddress} • {new Date(session.createdAt).toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleRevokeSession(session.id, false)}
                                        disabled={isRevoking}
                                        className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs text-neutral-300 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                      >
                                        {isRevoking ? (
                                          <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                                        ) : (
                                          <Trash2 className="h-3 w-3 text-neutral-400" />
                                        )}
                                        <span>Log out</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
