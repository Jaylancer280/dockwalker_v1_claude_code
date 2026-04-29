'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Briefcase, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

interface Posting {
  id: string;
  status: string;
  start_date: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  live_aboard: boolean;
  contract_type: string | null;
  description: string | null;
  notes: string | null;
  required_certification_ids: string[];
  yacht_roles: { id: string; name: string; department: string } | null;
  vessels: { id: string; name: string; vessel_type: string; nda_flag: boolean } | null;
  ports: { id: string; name: string; cities?: { name: string } } | null;
}

interface Invitation {
  id: string;
  message: string | null;
  captain_name: string | null;
}

type Resp = { posting: Posting; invitation: Invitation | null };

export default function PermanentApplyPage() {
  const params = useParams<{ id: string }>();
  const postingId = params.id;
  const search = useSearchParams();
  const fromInvitationId = search.get('from_invitation');
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const url = fromInvitationId
        ? `/api/permanent/${postingId}?from_invitation=${encodeURIComponent(fromInvitationId)}`
        : `/api/permanent/${postingId}`;
      const res = await safeFetch<Resp>(url);
      if (res.ok) setData(res.data);
      setLoading(false);
    })();
  }, [postingId, fromInvitationId]);

  async function handleApply() {
    setSubmitting(true);
    const body: Record<string, unknown> = {};
    if (message.trim()) body.message = message.trim();
    // Pass through the invitation id so the route can validate +
    // thread it as `invited_from_id` on PERMANENT.APPLIED. The route
    // itself drops the link silently if validation fails — we just
    // forward what we have.
    if (fromInvitationId) body.fromInvitationId = fromInvitationId;

    const res = await safeFetch<{ success?: boolean; error?: string; missing_certs?: unknown[] }>(
      `/api/permanent/${postingId}/apply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) {
      showSuccess('Application submitted');
      router.push('/discover?mode=permanent&tab=applied');
    } else {
      showError(res.error);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
        <div className="page-width-narrow flex max-w-md flex-col items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-6 text-center">
          <h1 className="text-lg font-semibold">Posting not available</h1>
          <p className="text-sm text-muted-foreground">
            The posting may have been filled, cancelled, or the link is invalid.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/discover">Back to Discover</Link>
          </Button>
        </div>
      </main>
    );
  }

  const { posting, invitation } = data;
  const vesselName = posting.vessels?.nda_flag ? 'NDA Vessel' : (posting.vessels?.name ?? '—');
  const role = posting.yacht_roles?.name ?? 'Permanent role';
  const cityName = posting.ports?.cities?.name ?? null;
  const portName = posting.ports?.name ?? null;
  const salaryRange =
    posting.salary_min && posting.salary_max
      ? `${posting.salary_currency ?? ''} ${posting.salary_min.toLocaleString()}–${posting.salary_max.toLocaleString()} / ${posting.salary_period ?? ''}`
      : null;

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-[20px] font-bold tracking-[-0.5px]">Apply for {role}</h1>
        </div>
      </header>

      <div className="page-width flex w-full flex-col gap-5 px-4 py-6">
        {/* Apply-after-invite banner (v2.1) — only renders when the
            invitation passed server-side validation in the GET. We never
            pre-fill the message field per spec: "we don't pre-fill (avoids
            putting words in their mouth)". */}
        {invitation ? (
          <section className="flex items-start gap-3 rounded-[14px] border border-[var(--accent)] bg-[var(--accent-lo)] p-4">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-semibold">
                {invitation.captain_name
                  ? `${invitation.captain_name} invited you to apply for ${role}`
                  : `You've been invited to apply for ${role}`}
                {posting.vessels ? ` on ${vesselName}` : ''}.
              </p>
              <p className="text-xs text-muted-foreground">
                Their invitation is what brought you here.
              </p>
              {invitation.message ? (
                <p className="mt-1 rounded-md bg-[var(--card)] p-2 text-xs italic text-muted-foreground">
                  &ldquo;{invitation.message}&rdquo;
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Posting summary */}
        <section className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{role}</h2>
            {posting.contract_type ? (
              <Badge variant="secondary" className="text-xs">
                {posting.contract_type}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm">{vesselName}</p>
          {cityName || portName ? (
            <p className="text-xs text-muted-foreground">
              {[portName, cityName].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {salaryRange ? <p className="mt-1 text-xs text-muted-foreground">{salaryRange}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Starts {new Date(posting.start_date).toLocaleDateString()}
            {posting.live_aboard ? ' · Live aboard' : ''}
          </p>
          {posting.description ? (
            <>
              <Separator className="my-3" />
              <p className="text-sm text-muted-foreground">{posting.description}</p>
            </>
          ) : null}
        </section>

        {/* Message */}
        <section>
          <label
            htmlFor="apply-message"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Your message (optional)
          </label>
          <textarea
            id="apply-message"
            className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            rows={5}
            maxLength={250}
            placeholder="Tell the captain why you're a good fit (max 250 chars)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">{message.length}/250</p>
        </section>

        <Button onClick={handleApply} disabled={submitting} className="w-full" size="lg">
          {submitting ? 'Submitting…' : 'Submit application'}
        </Button>
      </div>
    </main>
  );
}
