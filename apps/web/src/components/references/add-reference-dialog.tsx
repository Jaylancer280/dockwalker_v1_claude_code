'use client';

import { useState, useId } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { safeFetch } from '@/lib/safe-fetch';
import { ConfirmDialog } from './confirm-dialog';

const REFEREE_ROLES = [
  'Captain',
  'Chief Officer',
  'Second Officer',
  'Chief Engineer',
  'Second Engineer',
  'Chief Stewardess',
  'Second Stewardess',
  'Chef',
  'Bosun',
  'Other',
];

interface AddReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experienceId: string;
  /** Current count of pending+accepted references on this experience. */
  activeCount: number;
  /** Per-experience tier cap (1 for Free, 3 for Crew Pro). */
  cap: number;
}

interface AddReferenceCreatedLink {
  id: string;
  token: string;
  link: string;
  refereeName: string;
}

export function AddReferenceDialog({
  open,
  onOpenChange,
  experienceId,
  activeCount,
  cap,
}: AddReferenceDialogProps) {
  const { showError, showSuccess } = useToast();
  const nameId = useId();
  const roleId = useId();
  const emailId = useId();

  const [name, setName] = useState('');
  const [role, setRole] = useState('Captain');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState<AddReferenceCreatedLink | null>(null);
  const [copied, setCopied] = useState(false);

  const remaining = Math.max(0, cap - activeCount);
  const atCap = remaining <= 0;

  function reset() {
    setName('');
    setRole('Captain');
    setEmail('');
    setCreatedLink(null);
    setCopied(false);
  }

  async function handleConfirmedSubmit() {
    setSubmitting(true);
    const result = await safeFetch<{ id: string; token: string; link: string }>('/api/references', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceId,
        claimedRefereeRole: role,
        claimedRefereeName: name.trim(),
        claimedRefereeEmail: email.trim() || null,
      }),
    });
    setSubmitting(false);
    setConfirmOpen(false);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    setCreatedLink({
      id: result.data.id,
      token: result.data.token,
      link: result.data.link,
      refereeName: name.trim(),
    });
  }

  async function handleShareLink() {
    if (!createdLink) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Reference request from DockWalker`,
          text: `I worked with you and would like to add you as a reference on DockWalker. Tap the link to accept (or decline).`,
          url: createdLink.link,
        });
        return;
      } catch {
        // User cancelled — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(createdLink.link);
      setCopied(true);
      showSuccess('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Couldn't copy link");
    }
  }

  function handleAddAnother() {
    reset();
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
    }
    onOpenChange(nextOpen);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdLink ? 'Reference request created' : 'Add a reference'}
            </DialogTitle>
            <DialogDescription>
              {createdLink
                ? `Share the link with ${createdLink.refereeName} so they can confirm.`
                : `References on this experience: ${activeCount}/${cap}${
                    atCap ? ' — limit reached' : ''
                  }`}
            </DialogDescription>
          </DialogHeader>

          {createdLink ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-[var(--surface)] p-3 text-xs break-all">
                {createdLink.link}
              </div>
              <Button onClick={handleShareLink} className="w-full">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" /> Share link
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                We won&apos;t email it for you — share via WhatsApp, iMessage, or however you
                normally talk to {createdLink.refereeName}. They&apos;ll see a snapshot of the
                vessel + dates and can accept or decline.
              </p>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Done
                </Button>
                {activeCount + 1 < cap && <Button onClick={handleAddAnother}>Add another</Button>}
              </DialogFooter>
            </div>
          ) : atCap ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                <p className="font-medium">You&apos;ve used your reference for this experience</p>
                <p className="mt-1 text-xs">
                  Crew Pro · €4.99/mo · Adds up to 2 more references per experience + Docky AI
                  access
                </p>
              </div>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button asChild>
                  <a href="/billing?plan=crew_pro">Upgrade</a>
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor={nameId}>Their name</Label>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Captain Smith"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={roleId}>Their role on this vessel</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id={roleId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFEREE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={emailId}>Their email (optional but recommended)</Label>
                <Input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="captain@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Add their email so only they can accept — we won&apos;t email it for you.
                </p>
              </div>
              {/* H-1 — persistent hint above submit */}
              <p className="rounded-md border border-border bg-[var(--surface)] p-2 text-xs text-muted-foreground">
                Once your referee accepts, the vessel, dates, and role on this experience are locked
                until you revoke the reference.
              </p>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={name.trim().length < 2 || submitting}
                >
                  Continue
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* W-A — consent stakes confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send reference request?"
        description={
          <>
            <p>
              We&apos;ll generate a private link for you to share with {name.trim() || 'them'}. Once
              they accept:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Their name and role will appear on this experience on your profile.</li>
              <li>
                You won&apos;t be able to change the vessel, dates, or role on this experience until
                you revoke the reference.
              </li>
              <li>You can revoke the reference at any time, which removes it from your profile.</li>
            </ul>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Send invitation"
        loading={submitting}
        onConfirm={handleConfirmedSubmit}
      />
    </>
  );
}

/** Small helper used by the dialog when only the share-link is needed (e.g. resend flow). */
export function CopyLinkButton({ link }: { link: string }) {
  const { showSuccess, showError } = useToast();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          showSuccess('Link copied');
        } catch {
          showError("Couldn't copy link");
        }
      }}
    >
      <Copy className="mr-1 h-3 w-3" /> Copy link
    </Button>
  );
}
