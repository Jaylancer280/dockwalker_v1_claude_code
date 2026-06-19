'use client';

import type { Applicant } from './types';
import { ApplicantsTab } from './applicants-tab';

export function ShortlistTab({
  loading,
  error,
  applicants,
  shortlisted,
  acting,
  topCard,
  nextCard,
  requestAccept,
  handleReject,
  loadApplicants,
  setTab,
  setViewProfileId,
}: {
  loading: boolean;
  error: string | null;
  applicants: Applicant[];
  shortlisted: Applicant[];
  acting: boolean;
  topCard: Applicant | null;
  nextCard: Applicant | null;
  requestAccept: (crewId: string) => void;
  handleReject: (crewId: string) => void;
  loadApplicants: () => void;
  setTab: (tab: 'applicants' | 'shortlist' | 'available') => void;
  setViewProfileId: (id: string | null) => void;
}) {
  return (
    <ApplicantsTab
      tab="shortlist"
      loading={loading}
      error={error}
      applicants={applicants}
      shortlisted={shortlisted}
      acting={acting}
      topCard={topCard}
      nextCard={nextCard}
      handleShortlist={() => {
        /* no-op: shortlist not available from shortlist tab */
      }}
      requestAccept={requestAccept}
      handleReject={handleReject}
      loadApplicants={loadApplicants}
      setTab={setTab}
      setViewProfileId={setViewProfileId}
    />
  );
}
