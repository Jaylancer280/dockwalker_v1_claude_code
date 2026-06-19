import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { maskEmail } from '@/lib/references/helpers';
import { RefereeConsentClient } from './_consent-client';

/**
 * /ref/[token] — public consent landing for a reference invitation.
 *
 * Server-renders the snapshot summary so an unauthenticated visitor can
 * preview before signing in. The Accept/Decline interactivity is in the
 * client component below; this page just supplies the data.
 */
interface RefPageProps {
  params: Promise<{ token: string }>;
}

export default async function ReferenceLandingPage({ params }: RefPageProps) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  type RefRow = {
    id: string;
    requester_person_id: string;
    status: string;
    pending_expires_at: string;
    requester_role_at_time: string;
    claimed_referee_role: string;
    claimed_referee_email: string | null;
    snapshot_vessel_imo: string;
    snapshot_vessel_name: string;
    snapshot_start_date: string;
    snapshot_end_date: string | null;
  };
  let ref: RefRow | null = null;
  try {
    const sc = await createServiceClient();
    const result = await sc
      .from('references')
      .select(
        [
          'id',
          'requester_person_id',
          'status',
          'pending_expires_at',
          'requester_role_at_time',
          'claimed_referee_role',
          'claimed_referee_email',
          'snapshot_vessel_imo',
          'snapshot_vessel_name',
          'snapshot_start_date',
          'snapshot_end_date',
        ].join(','),
      )
      .eq('token', token)
      .maybeSingle<RefRow>();
    ref = result.data;
  } catch {
    // Fall through to the not-found UI rather than rendering the Next.js
    // error boundary. A misconfigured service-role key or transient network
    // failure shouldn't show "Something went wrong".
    ref = null;
  }

  if (!ref) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Reference not found</h1>
        <p className="text-sm text-muted-foreground">
          This link is invalid or has already been resolved.
        </p>
        <Link href="/" className="text-sm underline">
          Go home
        </Link>
      </main>
    );
  }

  const expired = new Date(ref.pending_expires_at) < new Date();
  if (ref.status !== 'pending' || expired) {
    const reason =
      ref.status === 'declined'
        ? 'This invitation was declined.'
        : ref.status === 'accepted'
          ? 'This invitation was already accepted.'
          : ref.status === 'revoked'
            ? 'The crew member has revoked this invitation.'
            : expired
              ? 'This invitation has expired.'
              : 'This invitation is no longer pending.';
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">No longer available</h1>
        <p className="text-sm text-muted-foreground">{reason}</p>
        <Link href="/" className="text-sm underline">
          Go to DockWalker
        </Link>
      </main>
    );
  }

  // Lookup requester display_name (re-creates service client because the
  // earlier one was inside a try-block that may have failed gracefully).
  let requesterDisplayName: string | null = null;
  try {
    const sc2 = await createServiceClient();
    const { data: requester } = await sc2
      .from('profiles')
      .select('display_name')
      .eq('person_id', ref.requester_person_id)
      .maybeSingle();
    requesterDisplayName = (requester?.display_name as string | undefined) ?? null;
  } catch {
    // Display fallback handles the null case.
  }

  // Check the current viewer's session to decide between auth-redirect vs
  // signup CTA. Wrapped in try/catch because the WhatsApp in-app browser
  // ships with no cookies, and partial-session states have caused
  // auth.getUser() to throw on some auth-server transient failures.
  let currentUser: { id: string; email?: string | null } | null = null;
  try {
    const userClient = await createClient();
    const result = await userClient.auth.getUser();
    currentUser = result.data.user;
  } catch {
    // Treat as logged-out.
  }

  const requesterName = requesterDisplayName ?? 'A crew member';
  const claimedEmailMasked = ref.claimed_referee_email
    ? maskEmail(ref.claimed_referee_email)
    : null;
  const emailMismatch =
    ref.claimed_referee_email && currentUser
      ? (currentUser.email ?? '').toLowerCase() !== ref.claimed_referee_email.toLowerCase()
      : false;

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col gap-6 p-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          DockWalker · Reference request
        </p>
        <h1 className="text-2xl font-semibold">{requesterName} wants you as a reference</h1>
      </header>

      <section className="space-y-4 rounded-xl border bg-[var(--surface)] p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Vessel</p>
          <p className="font-medium">{ref.snapshot_vessel_name}</p>
          <p className="text-xs text-muted-foreground">IMO {ref.snapshot_vessel_imo}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Period</p>
          <p className="font-medium">
            {ref.snapshot_start_date} — {ref.snapshot_end_date ?? 'present'}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {requesterName}&apos;s role
          </p>
          <p className="font-medium">{ref.requester_role_at_time}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Your role</p>
          <p className="font-medium">{ref.claimed_referee_role}</p>
        </div>
        {/* H-4 inline hint */}
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          These details are locked — neither party can change them after you accept.
        </p>
      </section>

      <RefereeConsentClient
        referenceId={ref.id}
        token={token}
        currentUserAuthed={!!currentUser}
        emailMismatch={emailMismatch}
        claimedEmailMasked={claimedEmailMasked}
        requesterName={requesterName}
      />
    </main>
  );
}
