'use client';

import { useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TriOption = 'yes' | 'no' | 'partial';
type DaysOption = 'fewer' | 'as_listed' | 'more';
type CertOption = 'yes' | 'no' | 'not_checked';

const YES_NO_PARTIAL = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'partial', label: 'Partial' },
];

export function RatingFormOverlay({
  isCrew,
  isCancelled,
  hasPermanentOpportunity,
  submitting,
  onSubmit,
  onCancel,
}: {
  isCrew: boolean;
  isCancelled: boolean;
  hasPermanentOpportunity?: boolean;
  submitting: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  // Cancelled-context fields (crew only)
  const [noticeGiven, setNoticeGiven] = useState<TriOption | null>(null);

  // Completed-context crew fields
  const [payAccuracy, setPayAccuracy] = useState<TriOption | null>(null);
  const [mealsAccuracy, setMealsAccuracy] = useState<TriOption | null>(null);
  const [roleAccuracy, setRoleAccuracy] = useState<TriOption | null>(null);
  const [workingDaysAccuracy, setWorkingDaysAccuracy] = useState<DaysOption | null>(null);
  const [vesselCondition, setVesselCondition] = useState(0);
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);

  // Completed-context employer fields
  const [skillsAsAdvertised, setSkillsAsAdvertised] = useState<TriOption | null>(null);
  const [certsVerified, setCertsVerified] = useState<CertOption | null>(null);
  const [punctuality, setPunctuality] = useState<TriOption | null>(null);
  const [wouldRehire, setWouldRehire] = useState<boolean | null>(null);

  // Permanent opportunity accuracy (crew completed-context only, when daywork had the flag)
  const [permOpAccuracy, setPermOpAccuracy] = useState<string | null>(null);

  // Symmetric fields
  const [commAccuracy, setCommAccuracy] = useState<boolean | null>(null);
  const [overallMatch, setOverallMatch] = useState(0);

  let isValid = commAccuracy !== null && overallMatch > 0;
  if (isCancelled) {
    if (isCrew) isValid = isValid && noticeGiven !== null;
  } else if (isCrew) {
    isValid =
      isValid &&
      payAccuracy !== null &&
      mealsAccuracy !== null &&
      roleAccuracy !== null &&
      workingDaysAccuracy !== null &&
      vesselCondition > 0 &&
      wouldWorkAgain !== null &&
      (!hasPermanentOpportunity || permOpAccuracy !== null);
  } else {
    isValid =
      isValid &&
      skillsAsAdvertised !== null &&
      certsVerified !== null &&
      punctuality !== null &&
      wouldRehire !== null;
  }

  function handleSubmit() {
    if (!isValid) return;
    if (isCancelled) {
      if (isCrew) {
        onSubmit({
          notice_given: noticeGiven,
          communication_accuracy: commAccuracy,
          overall_match: overallMatch,
        });
      } else {
        onSubmit({
          communication_accuracy: commAccuracy,
          overall_match: overallMatch,
        });
      }
    } else if (isCrew) {
      onSubmit({
        pay_accuracy: payAccuracy,
        meals_accuracy: mealsAccuracy,
        role_accuracy: roleAccuracy,
        working_days_accuracy: workingDaysAccuracy,
        vessel_condition: vesselCondition,
        would_work_on_vessel_again: wouldWorkAgain,
        communication_accuracy: commAccuracy,
        overall_match: overallMatch,
        ...(hasPermanentOpportunity && permOpAccuracy
          ? { permanent_opportunity_accuracy: permOpAccuracy }
          : {}),
      });
    } else {
      onSubmit({
        skills_as_advertised: skillsAsAdvertised,
        certifications_verified: certsVerified,
        punctuality,
        would_rehire: wouldRehire,
        communication_accuracy: commAccuracy,
        overall_match: overallMatch,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom))' }}
    >
      <div className="flex w-full max-w-lg animate-in slide-in-from-bottom flex-col rounded-t-2xl bg-background">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-sm font-bold">
            {isCancelled ? 'Rate this experience' : 'Rate this engagement'}
          </h2>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>

        <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto px-4 pb-2">
          {isCancelled ? (
            <>
              {isCrew && (
                <OptionGroup
                  label="Was reasonable notice given?"
                  options={YES_NO_PARTIAL}
                  value={noticeGiven}
                  onChange={(v) => setNoticeGiven(v as TriOption)}
                />
              )}
            </>
          ) : isCrew ? (
            <>
              <OptionGroup
                label="Was the agreed day rate honoured?"
                options={YES_NO_PARTIAL}
                value={payAccuracy}
                onChange={(v) => setPayAccuracy(v as TriOption)}
              />
              <OptionGroup
                label="Were the listed meals provided?"
                options={YES_NO_PARTIAL}
                value={mealsAccuracy}
                onChange={(v) => setMealsAccuracy(v as TriOption)}
              />
              <OptionGroup
                label="Did the work match the advertised role?"
                options={YES_NO_PARTIAL}
                value={roleAccuracy}
                onChange={(v) => setRoleAccuracy(v as TriOption)}
              />
              <OptionGroup
                label="Did the actual days match the listing?"
                options={[
                  { value: 'fewer', label: 'Fewer' },
                  { value: 'as_listed', label: 'As listed' },
                  { value: 'more', label: 'More' },
                ]}
                value={workingDaysAccuracy}
                onChange={(v) => setWorkingDaysAccuracy(v as DaysOption)}
              />
              <StarRating
                label="Vessel condition"
                value={vesselCondition}
                onChange={setVesselCondition}
              />
              <BooleanToggle
                label="Would you work on this vessel again?"
                value={wouldWorkAgain}
                onChange={setWouldWorkAgain}
              />
              {hasPermanentOpportunity && (
                <OptionGroup
                  label="Did the engagement lead to a permanent opportunity?"
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                    { value: 'not_applicable', label: 'N/A' },
                  ]}
                  value={permOpAccuracy}
                  onChange={setPermOpAccuracy}
                />
              )}
            </>
          ) : (
            <>
              <OptionGroup
                label="Did the crew's abilities match their profile?"
                options={YES_NO_PARTIAL}
                value={skillsAsAdvertised}
                onChange={(v) => setSkillsAsAdvertised(v as TriOption)}
              />
              <OptionGroup
                label="Were claimed certifications valid?"
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                  { value: 'not_checked', label: 'Not checked' },
                ]}
                value={certsVerified}
                onChange={(v) => setCertsVerified(v as CertOption)}
              />
              <OptionGroup
                label="Was the crew member punctual?"
                options={YES_NO_PARTIAL}
                value={punctuality}
                onChange={(v) => setPunctuality(v as TriOption)}
              />
              <BooleanToggle
                label="Would you rehire for a similar daywork?"
                value={wouldRehire}
                onChange={setWouldRehire}
              />
            </>
          )}

          <div className="border-t border-border pt-3">
            <BooleanToggle
              label="Was communication clear and honest?"
              value={commAccuracy}
              onChange={setCommAccuracy}
            />
          </div>
          <StarRating
            label={
              isCancelled
                ? 'Overall experience'
                : 'Overall, how well did reality match the listing?'
            }
            value={overallMatch}
            onChange={setOverallMatch}
          />
        </div>

        <div className="border-t border-border px-4 py-3">
          <Button className="w-full" disabled={!isValid || submitting} onClick={handleSubmit}>
            {submitting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Star className="mr-1.5 h-4 w-4" />
            )}
            Submit rating
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
              value === opt.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-accent hover:bg-accent/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5">
            <Star
              className={`h-6 w-6 ${
                n <= value ? 'fill-primary text-primary' : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function BooleanToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <OptionGroup
      label={label}
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]}
      value={value === null ? null : value ? 'yes' : 'no'}
      onChange={(v) => onChange(v === 'yes')}
    />
  );
}
