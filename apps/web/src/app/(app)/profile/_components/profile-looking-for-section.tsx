'use client';

import { Pencil, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  identity_type: string;
  desired_roles: { id: string; name: string } | null;
  ports: {
    id: string;
    name: string;
    cities: { name: string; regions: { name: string } };
  } | null;
}

interface AvailSummary {
  dateRange: string;
  count: number;
  expiryText: string;
  cityName: string | null;
}

interface ProfileLookingForSectionProps {
  profile: Profile;
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  availStatus: 'available' | 'not_available' | null;
  availSummary: AvailSummary | null;
  permAvail: string | null;
  setPermAvail: (v: string | null) => void;
  noticeDays: number | null;
  setNoticeDays: (v: number | null) => void;
  employed: boolean;
  setEmployed: (v: boolean) => void;
  editingCareer: boolean;
  setEditingCareer: (v: boolean) => void;
  savingCareer: boolean;
  setSavingCareer: (v: boolean) => void;
  isCrewHat: boolean;
  setShowAvailOverlay: (v: boolean) => void;
  onEnterEdit: () => void;
}

export function ProfileLookingForSection({
  profile,
  expandedSections,
  toggleSection,
  availStatus,
  availSummary,
  permAvail,
  setPermAvail,
  noticeDays,
  setNoticeDays,
  employed,
  setEmployed,
  editingCareer,
  setEditingCareer,
  savingCareer,
  setSavingCareer,
  isCrewHat,
  setShowAvailOverlay,
  onEnterEdit,
}: ProfileLookingForSectionProps) {
  const { showSuccess, showError } = useToast();

  return (
    <>
      <button
        onClick={() => toggleSection('looking')}
        className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]">
            Looking for
          </p>
          {!expandedSections.looking && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[
                profile.desired_roles?.name,
                profile.ports ? `${profile.ports.cities?.name}` : null,
                permAvail === 'immediate'
                  ? 'Available now'
                  : permAvail === 'after_notice'
                    ? 'After notice'
                    : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Not set'}
            </p>
          )}
        </div>
        {expandedSections.looking ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expandedSections.looking && (
        <div className="flex flex-col gap-3 px-4 pb-2">
          <div>
            <p className="text-xs text-muted-foreground">Desired Role</p>
            {profile.desired_roles?.name ? (
              <p className="text-sm font-medium">{profile.desired_roles.name}</p>
            ) : (
              <button
                onClick={onEnterEdit}
                className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
              >
                Set the role you&apos;re looking for — shown to employers on your profile
              </button>
            )}
          </div>
          {profile.ports?.name ? (
            <div>
              <p className="text-xs text-muted-foreground">Daywork port</p>
              <p className="text-sm font-medium">
                {profile.ports.name}, {profile.ports.cities?.name}
              </p>
            </div>
          ) : (
            <button
              onClick={onEnterEdit}
              className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
            >
              Set your daywork port — helps employers find local crew
            </button>
          )}
          {/* Career status — visible for crew and employer hats */}
          {profile.identity_type === 'crew' && (
            <div>
              <p className="text-xs text-muted-foreground">Career status</p>
              {!editingCareer ? (
                <div className="flex items-center gap-1.5">
                  {permAvail === 'immediate' ? (
                    <p className="text-sm font-medium text-[var(--success)]">
                      Available immediately
                    </p>
                  ) : permAvail === 'after_notice' ? (
                    <p className="text-sm font-medium">
                      Available after {noticeDays ?? 30} days notice
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not open to permanent roles</p>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setEditingCareer(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="mt-1 space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={permAvail !== null}
                      onChange={async (e) => {
                        const val = e.target.checked ? 'immediate' : null;
                        setPermAvail(val);
                        setSavingCareer(true);
                        const result = await safeFetch('/api/profile', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            permanentAvailability: val,
                            noticePeriodDays: val === null ? null : noticeDays,
                            currentlyEmployed: val === null ? false : employed,
                          }),
                        });
                        if (result.ok) showSuccess('Career status updated');
                        else showError('Failed to update');
                        setSavingCareer(false);
                      }}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm">Open to permanent opportunities</span>
                  </label>
                  {permAvail !== null && (
                    <div className="ml-6 space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="permAvail"
                          checked={permAvail === 'immediate'}
                          onChange={async () => {
                            setPermAvail('immediate');
                            setSavingCareer(true);
                            const result = await safeFetch('/api/profile', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ permanentAvailability: 'immediate' }),
                            });
                            if (result.ok) showSuccess('Updated');
                            else showError('Failed');
                            setSavingCareer(false);
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">Available immediately</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="permAvail"
                          checked={permAvail === 'after_notice'}
                          onChange={async () => {
                            setPermAvail('after_notice');
                            setSavingCareer(true);
                            const result = await safeFetch('/api/profile', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                permanentAvailability: 'after_notice',
                                noticePeriodDays: noticeDays || 30,
                              }),
                            });
                            if (result.ok) {
                              showSuccess('Updated');
                              if (!noticeDays) setNoticeDays(30);
                            } else showError('Failed');
                            setSavingCareer(false);
                          }}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">After notice period</span>
                      </label>
                      {permAvail === 'after_notice' && (
                        <div className="ml-6 flex items-center gap-2">
                          <input
                            type="number"
                            value={noticeDays ?? ''}
                            onChange={(e) => setNoticeDays(parseInt(e.target.value, 10) || null)}
                            onBlur={async () => {
                              if (noticeDays && noticeDays > 0) {
                                const result = await safeFetch('/api/profile', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ noticePeriodDays: noticeDays }),
                                });
                                if (result.ok) showSuccess('Updated');
                              }
                            }}
                            className="w-20 rounded border bg-background px-2 py-1 text-sm"
                            min={1}
                          />
                          <span className="text-xs text-muted-foreground">days</span>
                        </div>
                      )}
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={employed}
                          onChange={async (e) => {
                            setEmployed(e.target.checked);
                            const result = await safeFetch('/api/profile', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ currentlyEmployed: e.target.checked }),
                            });
                            if (result.ok) showSuccess('Updated');
                          }}
                          className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-sm">Currently employed</span>
                      </label>
                    </div>
                  )}
                  {savingCareer && <p className="text-xs text-muted-foreground">Saving...</p>}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={() => setEditingCareer(false)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Done
                  </Button>
                </div>
              )}
            </div>
          )}
          {/* Daywork availability */}
          {isCrewHat && (
            <div>
              <p className="text-xs text-muted-foreground">Daywork availability</p>
              <button
                onClick={() => setShowAvailOverlay(true)}
                className="flex items-center gap-1.5 text-sm"
              >
                {availStatus === 'available' && availSummary ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-[var(--success)] flex-shrink-0" />
                    <span className="font-medium text-[var(--success)]">Available</span>
                    <span className="text-muted-foreground">&middot; {availSummary.dateRange}</span>
                    {availSummary.cityName && (
                      <span className="text-muted-foreground">
                        &middot; {availSummary.cityName}
                      </span>
                    )}
                  </>
                ) : availStatus === 'not_available' ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
                    <span className="font-medium text-destructive">Not available</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                    <span className="text-muted-foreground">Not set — tap to set</span>
                  </>
                )}
                <Pencil className="ml-1 h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
