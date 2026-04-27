'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLookups } from '@/hooks/use-lookups';
import { PushPrompt } from '@/components/push-prompt';
import { DiscoverDataProvider, useDiscoverData } from './_components/discover-data-context';
import { DiscoverApplied } from './_components/discover-applied';
import { DiscoverInvitations } from './_components/discover-invitations';
import { DiscoverBrowse, type DiscoverBrowseHandle } from './_components/discover-browse';
import { DiscoverHeader } from './_components/discover-header';
import { useDiscoverCrewProfile } from './_components/use-discover-crew-profile';

// Lazy-load heavy overlays not needed on initial render
const AvailabilityOverlay = dynamic(
  () => import('@/components/availability-overlay').then((m) => m.AvailabilityOverlay),
  { ssr: false },
);
const ProfileOverlay = dynamic(
  () => import('@/components/profile-overlay').then((m) => m.ProfileOverlay),
  { ssr: false },
);

interface LookupItem {
  id: string;
  name: string;
  category?: string;
}

const AVAIL_RECHECK_MS = 5 * 60 * 1000;

export default function DiscoverPage() {
  return (
    <DiscoverDataProvider>
      <DiscoverPageInner />
    </DiscoverDataProvider>
  );
}

function DiscoverPageInner() {
  const { showSuccess } = useToast();
  const { applications, invitations } = useDiscoverData();
  const {
    crewCertIds,
    crewLangs,
    redirecting,
    hasAvailability,
    setHasAvailability,
    checkAvailability,
    lastAvailCheckRef,
  } = useDiscoverCrewProfile();

  // Tab routing — sticky across page reloads in the same session.
  const [activeTab, setActiveTab] = useState<'browse' | 'invitations' | 'applied'>(() => {
    if (typeof window === 'undefined') return 'browse';
    const stored = sessionStorage.getItem('dockwalker:discover-tab');
    if (stored === 'browse' || stored === 'invitations' || stored === 'applied') return stored;
    return 'browse';
  });
  const [browseMode, setBrowseMode] = useState<'daywork' | 'permanent'>(() => {
    if (typeof window === 'undefined') return 'daywork';
    return (localStorage.getItem('dw-browse-mode') as 'daywork' | 'permanent') || 'daywork';
  });

  const [showFilters, setShowFilters] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const browseRef = useRef<DiscoverBrowseHandle | null>(null);

  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [showAvailDialog, setShowAvailDialog] = useState(false);
  const [showAvailOverlay, setShowAvailOverlay] = useState(false);

  const lookups = useLookups();
  const roles = lookups.roles as LookupItem[];
  const certifications = lookups.certifications as LookupItem[];

  useEffect(() => {
    sessionStorage.setItem('dockwalker:discover-tab', activeTab);
  }, [activeTab]);

  /** Gate apply actions behind availability check — exposed to
   *  DiscoverBrowse so the apply / compose-message buttons can
   *  short-circuit through the availability dialog. */
  const requireAvailability = useCallback((): boolean => {
    const elapsed = Date.now() - lastAvailCheckRef.current;
    if (elapsed > AVAIL_RECHECK_MS) {
      checkAvailability();
    }
    if (hasAvailability) return true;
    setShowAvailDialog(true);
    return false;
  }, [hasAvailability, checkAvailability, lastAvailCheckRef]);

  // Sub-tab badge counts — read from the shared provider so the
  // header reflects fresh data without each tab having to mount.
  const filteredAppCount = applications.filter((a) =>
    browseMode === 'daywork' ? a.type === 'daywork' : a.type === 'permanent',
  ).length;

  const subTabOptions =
    browseMode === 'daywork'
      ? [
          { value: 'browse', label: 'Browse' },
          { value: 'invitations', label: 'Invitations', count: invitations.length },
          { value: 'applied', label: 'Applied', count: filteredAppCount },
        ]
      : [
          { value: 'browse', label: 'Browse' },
          { value: 'applied', label: 'Applied', count: filteredAppCount },
        ];

  if (redirecting) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <DiscoverHeader
        browseMode={browseMode}
        onBrowseModeChange={(next) => {
          setBrowseMode(next);
          localStorage.setItem('dw-browse-mode', next);
          // Invitations is daywork-only — bounce the user back to Browse
          // if they were on Invitations and switched to Permanent.
          if (next === 'permanent' && activeTab === 'invitations') {
            setActiveTab('browse');
          }
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        activeTab={activeTab}
        onActiveTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        subTabOptions={subTabOptions}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => browseRef.current?.clear()}
      />

      <PushPrompt />

      {activeTab === 'invitations' && (
        <DiscoverInvitations
          onSwitchToBrowse={() => setActiveTab('browse')}
          onViewProfile={setViewProfileId}
        />
      )}

      {activeTab === 'applied' && (
        <DiscoverApplied
          browseMode={browseMode}
          onSwitchToBrowse={() => setActiveTab('browse')}
          onViewProfile={setViewProfileId}
        />
      )}

      {activeTab === 'browse' && (
        <DiscoverBrowse
          ref={browseRef}
          browseMode={browseMode}
          showFilters={showFilters}
          hasAvailability={hasAvailability}
          requireAvailability={requireAvailability}
          onAvailabilityGate={() => setShowAvailDialog(true)}
          onViewProfile={setViewProfileId}
          onActiveFiltersChange={setHasActiveFilters}
          crewCertIds={crewCertIds}
          crewLangs={crewLangs}
          roles={roles}
          certifications={certifications}
          experienceBrackets={lookups.experienceBrackets}
          sizeBands={lookups.sizeBands}
        />
      )}

      <Dialog open={showAvailDialog} onOpenChange={setShowAvailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set your availability</DialogTitle>
            <DialogDescription>
              Before applying to daywork, you need to set your availability dates and location so
              employers know when and where you&apos;re free.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAvailDialog(false)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                setShowAvailDialog(false);
                setShowAvailOverlay(true);
              }}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Set availability
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAvailOverlay && (
        <AvailabilityOverlay
          onConfirm={() => {
            setShowAvailOverlay(false);
            showSuccess('Availability updated');
            // Optimistic — ungate immediately, validate after projection commits.
            setHasAvailability(true);
            setTimeout(() => checkAvailability(), 1000);
          }}
          onCancel={() => setShowAvailOverlay(false)}
        />
      )}

      {viewProfileId && (
        <ProfileOverlay
          personId={viewProfileId}
          isOpen={true}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </main>
  );
}
