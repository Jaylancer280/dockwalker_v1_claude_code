'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  LogOut,
  Download,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import type { DistanceUnit, CurrencyCode } from '@/lib/units';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  // User state
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');

  // Account forms
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Appearance (localStorage)
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [currencyPref, setCurrencyPref] = useState<CurrencyCode>('EUR');

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  const loadUser = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email ?? '');
    }
    setLoading(false);
  }, [supabase.auth]);

  useEffect(() => {
    loadUser();

    // Load localStorage preferences
    const savedUnit = localStorage.getItem('dw-distance-unit');
    if (savedUnit === 'km' || savedUnit === 'mi' || savedUnit === 'nm') setDistanceUnit(savedUnit);
    const savedCurrency = localStorage.getItem('dw-currency-pref');
    if (
      savedCurrency === 'EUR' ||
      savedCurrency === 'USD' ||
      savedCurrency === 'GBP' ||
      savedCurrency === 'AED'
    )
      setCurrencyPref(savedCurrency);
  }, [loadUser]);

  function handleDistanceUnit(value: DistanceUnit) {
    setDistanceUnit(value);
    localStorage.setItem('dw-distance-unit', value);
  }

  function handleCurrencyPref(value: CurrencyCode) {
    setCurrencyPref(value);
    localStorage.setItem('dw-currency-pref', value);
  }

  async function handleChangePassword() {
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);

    try {
      // Verify current password by re-signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Current password is incorrect');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordForm(false);
          setPasswordSuccess(false);
        }, 1500);
      }
    } catch {
      setPasswordError('Network error — please try again');
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleChangeEmail() {
    setEmailError('');
    setEmailSuccess(false);

    if (!newEmail || !newEmail.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });

      if (error) {
        setEmailError(error.message);
      } else {
        setEmailSuccess(true);
        setNewEmail('');
      }
    } catch {
      setEmailError('Network error — please try again');
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleExportData() {
    setExporting(true);
    const result = await safeFetch<Record<string, unknown>>('/api/account/export');
    if (result.ok) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dockwalker-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    const result = await safeFetch('/api/account/deactivate', { method: 'POST' });
    if (result.ok) {
      await supabase.auth.signOut();
      router.push('/auth/login');
    }
    setDeleting(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/profile')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">Settings</h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
        {/* ── Account ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Account
          </h2>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card">
            {/* Email display */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowEmailForm(!showEmailForm);
                  setShowPasswordForm(false);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {showEmailForm && (
              <div className="border-t border-border px-4 py-3">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>New email address</Label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new@example.com"
                    />
                  </div>
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                  {emailSuccess && (
                    <p className="flex items-center gap-1 text-xs text-success">
                      <Check className="h-3 w-3" />
                      Confirmation link sent to {newEmail}. Check your inbox.
                    </p>
                  )}
                  <Button size="sm" onClick={handleChangeEmail} disabled={emailSaving || !newEmail}>
                    {emailSaving ? 'Sending...' : 'Send confirmation link'}
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Change password */}
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium">Password</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPasswordForm(!showPasswordForm);
                  setShowEmailForm(false);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {showPasswordForm && (
              <div className="border-t border-border px-4 py-3">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Current password</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>New password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Confirm new password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                  {passwordSuccess && (
                    <p className="flex items-center gap-1 text-xs text-success">
                      <Check className="h-3 w-3" />
                      Password updated
                    </p>
                  )}
                  <Button
                    size="sm"
                    onClick={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || !newPassword}
                  >
                    {passwordSaving ? 'Updating...' : 'Update password'}
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Subscription */}
            <button
              onClick={() => router.push('/billing')}
              className="flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Subscription</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <Separator />

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </section>

        {/* ── Appearance ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance
          </h2>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card">
            {/* Distance units */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Distance &amp; size units</p>
                <p className="text-xs text-muted-foreground">
                  {distanceUnit === 'mi' ? 'Vessel sizes in feet' : 'Vessel sizes in metres'}
                </p>
              </div>
              <Select
                value={distanceUnit}
                onValueChange={(v) => handleDistanceUnit(v as DistanceUnit)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">Kilometres</SelectItem>
                  <SelectItem value="mi">Miles / feet</SelectItem>
                  <SelectItem value="nm">Nautical miles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Default posting currency */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">Default posting currency</p>
                <p className="text-xs text-muted-foreground">Pre-selected when creating a job</p>
              </div>
              <Select
                value={currencyPref}
                onValueChange={(v) => handleCurrencyPref(v as CurrencyCode)}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ── Privacy & Data ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Privacy & Data
          </h2>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card">
            {/* Export data */}
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent"
            >
              <Download className="h-4 w-4 text-muted-foreground" />
              {exporting ? 'Exporting...' : 'Export my data'}
            </button>

            <Separator />

            {/* Delete account */}
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-accent"
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </button>

            {showDeleteConfirm && (
              <div className="border-t border-border px-4 py-3">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="text-xs text-destructive">
                      <p className="font-semibold">This action cannot be undone.</p>
                      <p className="mt-1">
                        Your profile will be hidden immediately. After 30 days, your personal data
                        will be permanently erased. Event history is retained for audit integrity.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Type DELETE to confirm</Label>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmText !== 'DELETE'}
                  >
                    {deleting ? 'Deleting...' : 'Permanently delete account'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── About ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            About
          </h2>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium">App version</p>
              <Badge variant="secondary" className="font-mono text-xs">
                {process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'}
              </Badge>
            </div>

            <Separator />

            <a
              href="https://dockwalker.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              Terms of Service
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>

            <Separator />

            <a
              href="https://dockwalker.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              Privacy Policy
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>

            <Separator />

            <a
              href="mailto:support@dockwalker.com"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              Contact Support
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>

            <Separator />

            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Maritime guidance contains public sector information licensed under the Open
                Government Licence v3.0
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
