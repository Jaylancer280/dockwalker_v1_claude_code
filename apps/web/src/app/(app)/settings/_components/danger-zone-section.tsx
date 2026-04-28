'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

export function DangerZoneSection() {
  const router = useRouter();
  const supabase = createClient();
  const { showError } = useToast();

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

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
    } else {
      showError('Failed to export data. Please try again.');
    }
    setExporting(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    const result = await safeFetch('/api/account/deactivate', { method: 'POST' });
    if (result.ok) {
      await supabase.auth.signOut();
      router.push('/');
    } else {
      showError('Failed to delete account. Please try again.');
    }
    setDeleting(false);
  }

  return (
    <>
      {/* Privacy & Data */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Privacy & Data
        </h2>
        <div className="flex flex-col gap-1 rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
          {/* Export data */}
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
          >
            <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {exporting ? 'Exporting...' : 'Export my data'}
              </span>
              <span className="text-xs text-muted-foreground">
                GDPR data export — downloads instantly as a JSON file.
              </span>
            </div>
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
                <div className="flex items-start gap-2 rounded-lg bg-[var(--destructive-lo)] p-3">
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

      {/* About */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          About
        </h2>
        <div className="flex flex-col gap-1 rounded-[14px] border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium">App version</p>
            <Badge variant="secondary" className="font-mono text-xs">
              {process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'}
            </Badge>
          </div>

          <Separator />

          <Link
            href="/terms"
            className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            Terms of Service
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Separator />

          <Link
            href="/privacy"
            className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            Privacy Policy
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Separator />

          <Link
            href="/support"
            className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            Contact Support
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Separator />

          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Maritime guidance contains public sector information licensed under the Open
              Government Licence v3.0
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
