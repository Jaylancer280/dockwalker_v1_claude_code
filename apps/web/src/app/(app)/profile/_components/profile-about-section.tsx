import { ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { languageLabel } from '@/lib/languages';

interface Profile {
  deck_name: string | null;
  bio: string | null;
  certification_ids: string[];
  visa_ids: string[];
  languages: string[];
}

interface VisaType {
  id: string;
  name: string;
}

interface ProfileAboutSectionProps {
  profile: Profile;
  certNames: Record<string, string>;
  visaIds: string[];
  visaTypes: VisaType[];
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  onEnterEdit: () => void;
}

export function ProfileAboutSection({
  profile,
  certNames,
  visaIds,
  visaTypes,
  expandedSections,
  toggleSection,
  onEnterEdit,
}: ProfileAboutSectionProps) {
  return (
    <>
      <button
        onClick={() => toggleSection('about')}
        className="flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tertiary)]">
            About
          </p>
          {!expandedSections.about &&
            (() => {
              const parts = [
                profile.deck_name ? `"${profile.deck_name}"` : null,
                profile.certification_ids?.length > 0
                  ? `${profile.certification_ids.length} certs`
                  : null,
                visaIds.length > 0 ? `${visaIds.length} visas` : null,
                profile.languages?.length > 0 ? `${profile.languages.length} languages` : null,
              ].filter(Boolean);
              const missing = [
                !(profile.certification_ids?.length > 0) && 'certifications',
                !profile.bio && 'bio',
                !(profile.languages?.length > 0) && 'languages',
              ].filter(Boolean);
              return (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {parts.join(' · ') || 'Add your details'}
                  {missing.length > 0 && (
                    <span className="text-xs text-[var(--tertiary)]">
                      {' '}
                      · {missing.length} field{missing.length > 1 ? 's' : ''} not set
                    </span>
                  )}
                </p>
              );
            })()}
        </div>
        {expandedSections.about ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expandedSections.about && (
        <div className="flex flex-col gap-3 px-4 pb-2">
          <div>
            <p className="text-xs text-muted-foreground">Deck Name</p>
            {profile.deck_name ? (
              <p className="text-sm font-medium">&ldquo;{profile.deck_name}&rdquo;</p>
            ) : (
              <button
                onClick={onEnterEdit}
                className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
              >
                What does your crew call you? Shown alongside your name on the app
              </button>
            )}
          </div>
          {profile.bio ? (
            <div>
              <p className="text-xs text-muted-foreground">Bio</p>
              <p className="text-sm">{profile.bio}</p>
            </div>
          ) : (
            <button
              onClick={onEnterEdit}
              className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
            >
              Add a short bio — it&apos;s the first thing employers read when reviewing applicants
            </button>
          )}
          {profile.certification_ids?.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Certifications</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile.certification_ids.map((certId) => {
                  const cn = certNames[certId];
                  return (
                    <span
                      key={certId}
                      className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs"
                    >
                      {cn ?? certId.slice(0, 8)}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <button
              onClick={onEnterEdit}
              className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
            >
              Add your certifications — employers check these against job requirements
            </button>
          )}
          {visaIds.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Visas</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {visaTypes
                  .filter((v) => visaIds.includes(v.id))
                  .map((v) => (
                    <Badge key={v.id} variant="outline">
                      {v.name}
                    </Badge>
                  ))}
              </div>
            </div>
          ) : (
            <button
              onClick={onEnterEdit}
              className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
            >
              Add visa info — helps employers in regulated ports find qualified crew faster
            </button>
          )}
          {profile.languages?.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Languages</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {profile.languages.map((code) => (
                  <Badge key={code} variant="outline">
                    {languageLabel(code)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={onEnterEdit}
              className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
            >
              Add your languages — helps employers find crew who speak their guests&apos; languages
            </button>
          )}
        </div>
      )}
    </>
  );
}
