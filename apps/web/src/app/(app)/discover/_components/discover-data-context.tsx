'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import type { MyApplication } from './applied-tab';
import type { Invitation } from './invitations-tab';

/**
 * Shared discover data — applications + invitations.
 *
 * Owns the eager-load on mount that powers the sub-tab badge counts
 * (Browse · Invitations · Applied) without forcing the user to open
 * each tab first. Both the page header (badge counts) and the tab
 * container components (DiscoverApplied / DiscoverInvitations) read
 * from this single source of truth, so a single fetch services both
 * surfaces and `loadApplications` / `loadInvitations` triggered from
 * the tab UIs (e.g. on retry, or after a withdraw) update the badge
 * counts atomically.
 *
 * The mutation handlers (handleWithdraw, handleAcceptInvitation, etc.)
 * also live here because they touch the shared lists. Keeping them in
 * the provider means the tab containers stay focused on layout +
 * local UI state (confirm dialogs, error display).
 */

interface DiscoverDataContextValue {
  // Applications (daywork + permanent)
  applications: MyApplication[];
  loadingApps: boolean;
  appsError: string | null;
  withdrawingId: string | null;
  loadApplications: () => Promise<void>;
  handleWithdraw: (dayworkId: string) => Promise<void>;
  handlePermanentWithdraw: (postingId: string) => Promise<void>;

  // Invitations (daywork-only)
  invitations: Invitation[];
  loadingInvitations: boolean;
  invitationError: string | null;
  respondingId: string | null;
  loadInvitations: () => Promise<void>;
  handleAcceptInvitation: (inv: Invitation) => Promise<void>;
  handleDeclineInvitation: (inv: Invitation) => Promise<void>;

  // Confirm-dialog state (consumed by DiscoverInvitations to render
  // the dialogs and by the InvitationsTab to surface the confirm
  // prompts when accept/decline is clicked).
  confirmAcceptInv: Invitation | null;
  confirmDeclineInv: Invitation | null;
  setConfirmAcceptInv: (inv: Invitation | null) => void;
  setConfirmDeclineInv: (inv: Invitation | null) => void;
}

const DiscoverDataContext = createContext<DiscoverDataContextValue | null>(null);

export function DiscoverDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [confirmAcceptInv, setConfirmAcceptInv] = useState<Invitation | null>(null);
  const [confirmDeclineInv, setConfirmDeclineInv] = useState<Invitation | null>(null);

  const loadApplications = useCallback(async () => {
    setLoadingApps(true);
    setAppsError(null);
    const [dwResult, pmResult] = await Promise.all([
      safeFetch<{ applications?: MyApplication[] }>('/api/daywork/applications'),
      safeFetch<{ applications?: MyApplication[] }>('/api/permanent/applications'),
    ]);
    if (!dwResult.ok && !pmResult.ok) {
      setAppsError('Failed to load applications. Tap Retry to try again.');
      setLoadingApps(false);
      return;
    }
    const dwApps = dwResult.ok
      ? (dwResult.data.applications ?? []).map((a: MyApplication) => ({
          ...a,
          type: 'daywork' as const,
        }))
      : [];
    const pmApps = pmResult.ok ? (pmResult.data.applications ?? []) : [];
    const merged = [...dwApps, ...pmApps].sort(
      (a: MyApplication, b: MyApplication) =>
        new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime(),
    );
    setApplications(merged);
    setLoadingApps(false);
  }, []);

  const handleWithdraw = useCallback(
    async (dayworkId: string) => {
      setWithdrawingId(dayworkId);
      const result = await safeFetch<{ error?: string }>(`/api/daywork/${dayworkId}/withdraw`, {
        method: 'POST',
      });
      if (result.ok) {
        setApplications((prev) => prev.filter((a) => a.daywork_id !== dayworkId));
        showSuccess('Application withdrawn');
      } else {
        showError(result.error);
      }
      setWithdrawingId(null);
    },
    [showError, showSuccess],
  );

  const handlePermanentWithdraw = useCallback(
    async (postingId: string) => {
      setWithdrawingId(postingId);
      const result = await safeFetch<{ error?: string }>(`/api/permanent/${postingId}/withdraw`, {
        method: 'POST',
      });
      if (result.ok) {
        setApplications((prev) => prev.filter((a) => a.permanent_posting_id !== postingId));
        showSuccess('Application withdrawn');
      } else {
        showError(result.error);
      }
      setWithdrawingId(null);
    },
    [showError, showSuccess],
  );

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    const result = await safeFetch<{ invitations?: Invitation[] }>('/api/daywork/invitations');
    if (result.ok) {
      setInvitations(result.data.invitations ?? []);
    }
    setLoadingInvitations(false);
  }, []);

  const handleAcceptInvitation = useCallback(
    async (inv: Invitation) => {
      setRespondingId(inv.id);
      setInvitationError(null);
      const result = await safeFetch<{
        success?: boolean;
        engagementId?: string;
        error?: string;
      }>(`/api/daywork/invitations/${inv.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (result.ok && result.data.engagementId) {
        router.push(`/messages/${result.data.engagementId}`);
        return;
      }
      if (result.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
        showSuccess('Invitation accepted — engagement created');
      } else {
        setInvitationError(result.error);
      }
      setRespondingId(null);
      setConfirmAcceptInv(null);
    },
    [router, showSuccess],
  );

  const handleDeclineInvitation = useCallback(
    async (inv: Invitation) => {
      setRespondingId(inv.id);
      setInvitationError(null);
      const result = await safeFetch<{ error?: string }>(
        `/api/daywork/invitations/${inv.id}/respond`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'decline' }),
        },
      );
      if (result.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
        showSuccess('Invitation declined');
      } else {
        setInvitationError(result.error);
      }
      setRespondingId(null);
      setConfirmDeclineInv(null);
    },
    [showSuccess],
  );

  // Eager-load on mount so sub-tab badges show counts without
  // requiring the user to open each tab first. setTimeout-0 wrapper
  // defers the synchronous setState calls inside the loaders to the
  // next tick — required by React 19's set-state-in-effect lint
  // (see project memory + tasks/lessons.md).
  useEffect(() => {
    const t = setTimeout(() => {
      loadApplications();
      loadInvitations();
    }, 0);
    return () => clearTimeout(t);
  }, [loadApplications, loadInvitations]);

  const value = useMemo<DiscoverDataContextValue>(
    () => ({
      applications,
      loadingApps,
      appsError,
      withdrawingId,
      loadApplications,
      handleWithdraw,
      handlePermanentWithdraw,
      invitations,
      loadingInvitations,
      invitationError,
      respondingId,
      loadInvitations,
      handleAcceptInvitation,
      handleDeclineInvitation,
      confirmAcceptInv,
      confirmDeclineInv,
      setConfirmAcceptInv,
      setConfirmDeclineInv,
    }),
    [
      applications,
      loadingApps,
      appsError,
      withdrawingId,
      loadApplications,
      handleWithdraw,
      handlePermanentWithdraw,
      invitations,
      loadingInvitations,
      invitationError,
      respondingId,
      loadInvitations,
      handleAcceptInvitation,
      handleDeclineInvitation,
      confirmAcceptInv,
      confirmDeclineInv,
    ],
  );

  return <DiscoverDataContext.Provider value={value}>{children}</DiscoverDataContext.Provider>;
}

export function useDiscoverData(): DiscoverDataContextValue {
  const ctx = useContext(DiscoverDataContext);
  if (!ctx) {
    throw new Error('useDiscoverData must be used inside <DiscoverDataProvider>');
  }
  return ctx;
}
