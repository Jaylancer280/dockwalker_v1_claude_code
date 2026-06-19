import { ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ExpandableText } from '@/components/expandable-text';
import { languageLabel } from '@dockwalker/shared';

interface Profile {
  deck_name: string | null;
  bio: string | null;
  certification_ids: string[];
  entry_right_ids: string[];
  languages: string[];
  smoker: boolean | null;
  visible_tattoos: boolean | null;
}

interface EntryRight {
  id: string;
  name: string;
  category: 'citizenship' | 'residence' | 'visa';
}

interface ProfileAboutSectionProps {
  profile: Profile;
  certNames: Record<string, string>;
  entryRightIds: string[];
  entryRights: EntryRight[];
  expandedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  onEnterEdit: () => void;
}

export function ProfileAboutSection({
  profile,
  certNames,
  entryRightIds,
  entryRights,
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
                entryRightIds.length > 0
                  ? `${entryRightIds.length} entry right${entryRightIds.length > 1 ? 's' : ''}`
                  : null,
                profile.languages?.length > 0 ? `${profile.languages.length} languages` : null,
                profile.smoker !== null ? `Smoker: ${profile.smoker ? 'Yes' : 'No'}` : null,
                profile.visible_tattoos !== null
                  ? `Tattoos: ${profile.visible_tattoos ? 'Yes' : 'No'}`
                  : null,
              ].filter(Boolean);
              const missing = [
                !(profile.certification_ids?.length > 0) && 'certifications',
                !profile.bio && 'bio',
                !(profile.languages?.length > 0) && 'languages',
                profile.smoker === null && 'smoker',
                profile.visible_tattoos === null && 'visible tattoos',
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
              <ExpandableText text={profile.bio} className="text-sm" />
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
          {entryRightIds.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">Entry rights</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {entryRights
                  .filter((e) => entryRightIds.includes(e.id))
                  .map((e) => (
                    <Badge key={e.id} variant="outline">
                      {e.name}
                    </Badge>
                  ))}
              </div>
            </div>
          ) : (
            <button
              onClick={onEnterEdit}
              className="flex items-center gap-2 text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
            >
              Add your entry rights — citizenship, residence, and visas you hold for yacht hubs
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
          <div>
            <p className="text-xs text-muted-foreground">Smoker</p>
            {profile.smoker !== null ? (
              <p className="text-sm font-medium">{profile.smoker ? 'Yes' : 'No'}</p>
            ) : (
              <button
                onClick={onEnterEdit}
                className="text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
              >
                Not set
              </button>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Visible tattoos</p>
            {profile.visible_tattoos !== null ? (
              <p className="text-sm font-medium">{profile.visible_tattoos ? 'Yes' : 'No'}</p>
            ) : (
              <button
                onClick={onEnterEdit}
                className="text-sm text-muted-foreground border-l-2 border-muted pl-3 py-1"
              >
                Not set
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
