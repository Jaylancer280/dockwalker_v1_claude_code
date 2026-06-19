'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, CreditCard, FileText, LogOut, Check, Users } from 'lucide-react';
import type { UserIdentity } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';
import { hasPasswordIdentity } from '@/lib/auth/has-password-identity';

export interface AccountSectionProps {
  email: string;
  identities?: UserIdentity[];
}

export function AccountSection({ email, identities }: AccountSectionProps) {
  const canChangePassword = hasPasswordIdentity({ identities });
  const router = useRouter();
  const supabase = createClient();

  // Password form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Email form
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Account
      </h2>
      <div className="flex flex-col gap-1 rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
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
        {canChangePassword ? (
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
        ) : (
          <div className="px-4 py-3">
            <p className="text-sm font-medium">Password</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your account uses Google Sign-In. Manage your password at{' '}
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-foreground"
              >
                Google Account Security
              </a>
              .
            </p>
          </div>
        )}

        {canChangePassword && showPasswordForm && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Current password</Label>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>New password</Label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Confirm new password</Label>
                <PasswordInput
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

        {/* References */}
        <button
          onClick={() => router.push('/settings/references')}
          className="flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent"
        >
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">References</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        <Separator />

        {/* CV Builder — visible to all hats; the page itself hat-gates to crew. */}
        <button
          onClick={() => router.push('/settings/cv')}
          className="flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">CV Builder</p>
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
  );
}
