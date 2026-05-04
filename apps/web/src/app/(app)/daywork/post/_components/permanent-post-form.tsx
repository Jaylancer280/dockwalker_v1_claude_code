'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { usePreferences } from '@/hooks/use-preferences';
import { currencySymbol, type CurrencyCode } from '@dockwalker/shared';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { safeFetch } from '@/lib/safe-fetch';
import { useLookups } from '@/hooks/use-lookups';
import {
  RoleLocationSection,
  SalarySection,
  RequirementsSection,
  ContractTermsSection,
} from './permanent-form-sections';

interface LookupItem {
  id: string;
  name: string;
  department?: string;
  category?: string;
}

interface PermanentTemplate {
  id: string;
  template_name: string;
  vessel_id: string | null;
  role_id: string | null;
  port_id: string | null;
  start_date: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  live_aboard: boolean;
  required_certification_ids: string[];
  required_languages: string[];
  experience_bracket_id: string | null;
  shortlist_cap: number | null;
  notes: string | null;
  contract_type: string | null;
  contract_details: string | null;
  description: string | null;
  meals: string[];
  positions_available: number | null;
}

interface PermanentPostFormProps {
  onBack: () => void;
  initialTemplateId?: string;
}

export function PermanentPostForm({ onBack, initialTemplateId }: PermanentPostFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCrewPersonId = searchParams.get('invite');
  const { showSuccess, showError: showErrorToast } = useToast();
  const { currency: preferredCurrency } = usePreferences();
  const submittingRef = useRef(false);

  // Restore saved draft from sessionStorage (vessel creation round-trip)
  const [draft] = useState(() => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem('dockwalker:permanent-post-draft');
    if (!raw) return null;
    sessionStorage.removeItem('dockwalker:permanent-post-draft');
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  });

  // Form state
  const [vesselId, setVesselId] = useState('');
  const [roleId, setRoleId] = useState((draft?.roleId as string) ?? '');
  const [locationPortId, setLocationPortId] = useState((draft?.locationPortId as string) ?? '');
  const [startDate, setStartDate] = useState((draft?.startDate as string) ?? '');
  const [salaryMin, setSalaryMin] = useState((draft?.salaryMin as string) ?? '');
  const [salaryMax, setSalaryMax] = useState((draft?.salaryMax as string) ?? '');
  const [salaryCurrency, setSalaryCurrency] = useState<CurrencyCode>(
    (draft?.salaryCurrency as CurrencyCode) ?? preferredCurrency,
  );
  const [salaryPeriod, setSalaryPeriod] = useState((draft?.salaryPeriod as string) ?? 'monthly');
  const [liveAboard, setLiveAboard] = useState((draft?.liveAboard as boolean) ?? false);
  const [certificationIds, setCertificationIds] = useState<string[]>(
    (draft?.certificationIds as string[]) ?? [],
  );
  const [requiredLangs, setRequiredLangs] = useState<string[]>(
    (draft?.requiredLangs as string[]) ?? [],
  );
  const [experienceBracketId, setExperienceBracketId] = useState(
    (draft?.experienceBracketId as string) ?? 'any',
  );
  const [shortlistCap, setShortlistCap] = useState((draft?.shortlistCap as string) ?? '3');
  // Tier-aware ceiling for the shortlistCap input. Free=3, Employer Pro=8 —
  // matches the server-side clamp in /api/permanent/[id]/applicants/[crewId]
  // /shortlist (Math.min(posting.shortlist_cap, tierMax)). Without this gate
  // the input let Free users type 20 while the server silently capped at 3,
  // making the crew-side "0/3 shortlisted" badge look broken. Default to
  // 3 so the form is conservative until the billing fetch resolves.
  const [shortlistMax, setShortlistMax] = useState(3);
  const [notes, setNotes] = useState((draft?.notes as string) ?? '');
  const [contractType, setContractType] = useState((draft?.contractType as string) ?? 'permanent');
  const [contractDetails, setContractDetails] = useState((draft?.contractDetails as string) ?? '');
  const [description, setDescription] = useState((draft?.description as string) ?? '');
  const [meals, setMeals] = useState<string[]>((draft?.meals as string[]) ?? []);
  const [positionsAvailable, setPositionsAvailable] = useState(
    (draft?.positionsAvailable as string) ?? '1',
  );

  // B-005: template-mode is now a top-of-form toggle that reframes the
  // entire submit flow. `?mode=template` from the post-type chooser starts
  // in create mode; `?mode=edit&templateId=...` from My Jobs Edit button
  // starts in edit mode (PATCH on submit). When ON, required-field
  // validation drops, the submit button becomes "Create/Save template",
  // and the permanent POST is skipped — only the template API is called.
  const initialMode = searchParams.get('mode');
  const isEditingTemplate = initialMode === 'edit';
  // Edit-target id rides on the `initialTemplateId` prop (parent page reads
  // ?permanentTemplateId= and forwards it). Reading `searchParams.get(
  // 'templateId')` here was a stale name from the daywork side and silently
  // resolved to null on the permanent edit URL — making the form fall back
  // to POST /api/permanent/templates which hit the Free-tier cap of 1 and
  // surfaced "Template limit reached" while trying to *edit* the only
  // existing template.
  const editingTemplateId = isEditingTemplate ? (initialTemplateId ?? null) : null;
  const [templateMode, setTemplateMode] = useState(initialMode === 'template' || isEditingTemplate);
  const [templateName, setTemplateName] = useState('');

  // Save form state before navigating to vessel creation
  function saveFormAndCreateVessel() {
    const state = {
      vesselId,
      roleId,
      locationPortId,
      startDate,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryPeriod,
      liveAboard,
      certificationIds,
      requiredLangs,
      experienceBracketId,
      shortlistCap,
      notes,
    };
    sessionStorage.setItem('dockwalker:permanent-post-draft', JSON.stringify(state));
    router.push('/vessels?returnTo=permanent-post');
  }

  // Lookups from cached context
  const lookups = useLookups();
  const roles = lookups.roles as LookupItem[];
  const certifications = lookups.certifications as LookupItem[];
  const experienceBrackets = lookups.experienceBrackets.map((b) => ({
    ...b,
    name: b.label,
  })) as LookupItem[];

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch billing status for shortlist cap. Once we know the tier, also
  // clamp any draft/template-restored shortlistCap that exceeds it — a
  // Free user resuming a draft they typed at 20 would otherwise submit 20
  // while the server silently reduces to 3, which makes the form lie.
  useEffect(() => {
    void (async () => {
      const res = await safeFetch<{ plan?: string; status?: string }>('/api/billing/status');
      if (!res.ok) return;
      const isProEmployer =
        (res.data.status === 'active' || res.data.status === 'trialing') &&
        res.data.plan === 'employer_pro';
      const max = isProEmployer ? 8 : 3;
      setShortlistMax(max);
      setShortlistCap((prev) => {
        const n = parseInt(prev, 10);
        return Number.isFinite(n) && n > max ? String(max) : prev;
      });
    })();
  }, []);

  // B-005: pre-fill from a specific template when ?templateId= is present.
  // The full templates-list fetch + in-form dropdown was removed; the
  // dedicated entry point is My Jobs > Templates tab (Use / Edit buttons).
  useEffect(() => {
    if (!initialTemplateId) return;
    safeFetch<{ template?: PermanentTemplate }>(
      `/api/permanent/templates/${initialTemplateId}`,
    ).then((result) => {
      if (!result.ok || !result.data.template) return;
      const match = result.data.template;
      // In edit mode, also seed templateName so the user can rename in
      // place. For "Use template" (no edit mode) we don't pre-fill the
      // name — they're creating a new posting, not editing the template.
      if (isEditingTemplate) setTemplateName(match.template_name ?? '');
      if (match.vessel_id) setVesselId(match.vessel_id);
      if (match.role_id) setRoleId(match.role_id);
      if (match.port_id) setLocationPortId(match.port_id);
      if (match.start_date) setStartDate(match.start_date);
      if (match.salary_min) setSalaryMin(String(match.salary_min));
      if (match.salary_max) setSalaryMax(String(match.salary_max));
      if (match.salary_currency) setSalaryCurrency(match.salary_currency as CurrencyCode);
      if (match.salary_period) setSalaryPeriod(match.salary_period);
      setLiveAboard(match.live_aboard);
      setCertificationIds(match.required_certification_ids ?? []);
      setRequiredLangs(match.required_languages ?? []);
      if (match.experience_bracket_id) setExperienceBracketId(match.experience_bracket_id);
      if (match.shortlist_cap) setShortlistCap(String(match.shortlist_cap));
      if (match.notes) setNotes(match.notes);
      if (match.contract_type) setContractType(match.contract_type);
      if (match.contract_details) setContractDetails(match.contract_details);
      if (match.description) setDescription(match.description);
      if (match.meals) setMeals(match.meals);
      if (match.positions_available) setPositionsAvailable(String(match.positions_available));
    });
  }, [initialTemplateId, isEditingTemplate]);

  // B-005: in-form template delete + load-template-from-dropdown removed.
  // Both are reachable from the My Jobs > Templates tab now.

  // Salary preview
  const salaryPreview = (() => {
    const min = parseFloat(salaryMin);
    const max = parseFloat(salaryMax);
    const sym = currencySymbol(salaryCurrency);
    const per = salaryPeriod === 'annual' ? '/year' : '/month';
    if (!isNaN(min) && !isNaN(max) && max > min) {
      return `${sym}${min.toLocaleString()} - ${sym}${max.toLocaleString()}${per}`;
    }
    if (!isNaN(min) && (isNaN(max) || max === min)) {
      return `${sym}${min.toLocaleString()}${per}`;
    }
    return null;
  })();

  const [showConfirm, setShowConfirm] = useState(false);
  const [vesselDisplayName, setVesselDisplayName] = useState('');

  // B-005: build the partial-friendly template payload — only fields the
  // user actually touched. Mirrors the API's accept-only-supplied-fields
  // behaviour so a "Chief Stew €4k" minimal template doesn't pollute the
  // saved row with zeros and "EUR" defaults the user never picked.
  function buildTemplatePayload(name: string): Record<string, unknown> {
    const payload: Record<string, unknown> = { templateName: name };
    if (vesselId) payload.vesselId = vesselId;
    if (roleId) payload.roleId = roleId;
    if (locationPortId) payload.locationPortId = locationPortId;
    if (startDate) payload.startDate = startDate;
    const minNum = parseFloat(salaryMin);
    if (Number.isFinite(minNum)) payload.salaryMin = minNum;
    const maxNum = parseFloat(salaryMax);
    if (Number.isFinite(maxNum)) payload.salaryMax = maxNum;
    if (salaryCurrency) payload.salaryCurrency = salaryCurrency;
    if (salaryPeriod) payload.salaryPeriod = salaryPeriod;
    payload.liveAboard = liveAboard;
    const realCerts = certificationIds.filter((id) => id !== '__none__');
    if (realCerts.length) payload.requiredCertificationIds = realCerts;
    if (requiredLangs.length) payload.requiredLanguages = requiredLangs;
    if (experienceBracketId && experienceBracketId !== 'any')
      payload.experienceBracketId = experienceBracketId;
    const capNum = parseInt(shortlistCap, 10);
    if (Number.isFinite(capNum)) payload.shortlistCap = capNum;
    if (notes) payload.notes = notes;
    if (contractType) payload.contractType = contractType;
    if (contractDetails) payload.contractDetails = contractDetails;
    if (description) payload.description = description;
    if (meals.length) payload.meals = meals;
    const positionsNum = parseInt(positionsAvailable, 10);
    if (Number.isFinite(positionsNum) && positionsNum > 1)
      payload.positionsAvailable = positionsNum;
    return payload;
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      setError('Please name the template');
      return;
    }
    if (templateName.length > 100) {
      setError('Template name must be 100 characters or less');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    const url = editingTemplateId
      ? `/api/permanent/templates/${editingTemplateId}`
      : '/api/permanent/templates';
    const method = editingTemplateId ? 'PATCH' : 'POST';

    const result = await safeFetch<{ error?: string }>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildTemplatePayload(templateName.trim())),
    });

    if (!result.ok) {
      if (result.error === 'template_limit_reached') {
        showErrorToast('Template limit reached — upgrade to Pro for more templates');
      } else {
        showErrorToast(result.error);
        setError(result.error);
      }
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    showSuccess(editingTemplateId ? 'Template updated' : 'Template saved');
    sessionStorage.removeItem('dockwalker:permanent-post-draft');
    // B-005: include type=permanent so the parent /daywork/mine page lands
    // on the Permanent sub-section (otherwise it defaults to Daywork via
    // localStorage and the redirect feels broken).
    router.push('/daywork/mine?type=permanent&tab=templates');
  }

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    const result = await safeFetch<Record<string, unknown>>('/api/permanent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId,
        roleId,
        locationPortId,
        startDate,
        salaryMin: parseFloat(salaryMin),
        salaryMax: salaryMax ? parseFloat(salaryMax) : parseFloat(salaryMin),
        salaryCurrency,
        salaryPeriod,
        liveAboard,
        requiredCertificationIds: certificationIds.filter((id) => id !== '__none__'),
        requiredLanguages: requiredLangs,
        experienceBracketId: experienceBracketId === 'any' ? null : experienceBracketId || null,
        shortlistCap: parseInt(shortlistCap, 10) || 5,
        notes: notes || null,
        contractType: contractType || null,
        contractDetails: contractDetails || null,
        description: description || null,
        meals,
        positionsAvailable: parseInt(positionsAvailable, 10) || 1,
      }),
    });

    if (!result.ok) {
      setError(result.error);
      showErrorToast(result.error);
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    // QR-hire (Phase 5b): if the captain arrived from /cv/[handle], the
    // crew person id is in the URL. Spec v2.1 deferred "select existing
    // posting" to v2 — the Stage-1 wizard always creates a fresh posting
    // first (just done), then fires PERMANENT.INVITED via the dedicated
    // route. Failures here surface as inline errors but don't roll back
    // the posting (it's a real public posting either way).
    if (inviteCrewPersonId) {
      const newPostingId = (result.data as { id?: string }).id;
      if (newPostingId) {
        const inviteResult = await safeFetch<{ invitation?: { id: string }; error?: string }>(
          `/api/permanent/${newPostingId}/invite`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crewPersonId: inviteCrewPersonId }),
          },
        );
        if (!inviteResult.ok) {
          showErrorToast(`Posting created but invite failed: ${inviteResult.error}`);
        } else {
          showSuccess('Permanent posting created and crew invited');
          router.push('/daywork/mine');
          setLoading(false);
          submittingRef.current = false;
          return;
        }
      }
    }

    // B-005: dual "save AND post" path removed. Template creation is now
    // a separate gesture (top-of-form toggle calling handleSaveTemplate).

    showSuccess('Permanent posting created');
    router.push('/daywork/mine');
    setLoading(false);
    submittingRef.current = false;
  }

  return (
    <div className="page-width px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={onBack} className="rounded-full p-2 hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[24px] font-bold tracking-[-0.5px]">
          {templateMode
            ? isEditingTemplate
              ? 'Edit template'
              : 'Create template'
            : 'Post Permanent Position'}
        </h1>
      </div>

      {/* QR-hire banner (Phase 5b) — visible when arriving from
          /cv/[handle] with ?invite=<personId>. Stage-1 wizard always
          creates a fresh posting then fires PERMANENT.INVITED. */}
      {inviteCrewPersonId ? (
        <div className="mb-4 rounded-[14px] border border-[var(--accent)] bg-[var(--accent-lo)] px-4 py-3 text-xs">
          <p className="font-semibold">Hiring from QR — invite-to-apply</p>
          <p className="text-muted-foreground">
            Posting this role will create the public posting and send a personal invitation to apply
            to the scanned crew member. They&apos;ll see your invitation in their notifications and
            can apply via the deep link.
          </p>
        </div>
      ) : null}

      {/* B-005: template-mode toggle at the TOP of the form. Reframes the
          flow when ON — required-field validation drops, the submit button
          becomes "Create/Save template", and the permanent POST is skipped.
          Old in-form "Load from template" dropdown was removed; the
          dedicated entry point is the templates tab in My Jobs. */}
      <div className="mb-6 space-y-2 rounded-[14px] border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-4">
        <label htmlFor="permTemplateMode" className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id="permTemplateMode"
            checked={templateMode}
            onCheckedChange={(v) => setTemplateMode(v === true)}
            disabled={isEditingTemplate}
          />
          <Save className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-sm font-medium">
            {isEditingTemplate ? 'Editing template' : 'Create a template instead'}
          </span>
        </label>
        {!templateMode && (
          <p className="pl-6 text-xs text-muted-foreground">
            Toggle on to save a reusable configuration without posting a job. Required fields become
            optional; only the template name is required.
          </p>
        )}
        {templateMode && (
          <div className="pl-6">
            <Input
              placeholder="Template name (e.g. Chief Stew €4500)"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value.slice(0, 100))}
              maxLength={100}
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {templateName.length}/100 characters
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <RoleLocationSection
          vesselId={vesselId}
          setVesselId={setVesselId}
          roleId={roleId}
          setRoleId={setRoleId}
          roles={roles}
          locationPortId={locationPortId}
          setLocationPortId={setLocationPortId}
          startDate={startDate}
          setStartDate={setStartDate}
          onRequestCreateVessel={saveFormAndCreateVessel}
          onVesselNameChange={setVesselDisplayName}
          isTemplateMode={templateMode}
        />

        <SalarySection
          salaryMin={salaryMin}
          setSalaryMin={setSalaryMin}
          salaryMax={salaryMax}
          setSalaryMax={setSalaryMax}
          salaryCurrency={salaryCurrency}
          setSalaryCurrency={setSalaryCurrency}
          salaryPeriod={salaryPeriod}
          setSalaryPeriod={setSalaryPeriod}
          salaryPreview={salaryPreview}
          isTemplateMode={templateMode}
        />

        <ContractTermsSection
          liveAboard={liveAboard}
          setLiveAboard={setLiveAboard}
          shortlistCap={shortlistCap}
          setShortlistCap={setShortlistCap}
          shortlistMax={shortlistMax}
          notes={notes}
          setNotes={setNotes}
          contractType={contractType}
          setContractType={setContractType}
          contractDetails={contractDetails}
          setContractDetails={setContractDetails}
          description={description}
          setDescription={setDescription}
          meals={meals}
          setMeals={setMeals}
          positionsAvailable={positionsAvailable}
          setPositionsAvailable={setPositionsAvailable}
        />

        <RequirementsSection
          certificationIds={certificationIds}
          setCertificationIds={setCertificationIds}
          requiredLangs={requiredLangs}
          setRequiredLangs={setRequiredLangs}
          experienceBrackets={experienceBrackets}
          experienceBracketId={experienceBracketId}
          setExperienceBracketId={setExperienceBracketId}
          isTemplateMode={templateMode}
        />

        {/* B-005: bottom save-as-template block removed; toggle now lives at
            the TOP of the form, reframing the entire flow when ON. */}

        {/* Error */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Live requirements checklist — only shown for posting, not template
            mode (templates are intentionally partial). */}
        {!templateMode &&
          (() => {
            const missing: string[] = [];
            if (!vesselId) missing.push('Vessel selection');
            if (!roleId) missing.push('Role selection');
            if (!locationPortId) missing.push('Location');
            if (!startDate) missing.push('Start date');
            if (!salaryMin) missing.push('Salary');
            if (certificationIds.length === 0)
              missing.push('Certifications (select certs or "None required")');
            if (missing.length > 0) {
              return (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="mb-1.5 text-xs font-semibold text-destructive">
                    Complete before posting:
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {missing.map((item) => (
                      <li key={item} className="text-xs text-destructive/80">
                        &bull; {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            return null;
          })()}

        {/* Submit — switches between posting and template-save based on the
            top-of-form toggle. Template mode skips the review-confirm
            BottomSheet (the user is saving a partial template, not a job). */}
        <Button
          className="w-full"
          disabled={
            templateMode
              ? loading || !templateName.trim()
              : loading ||
                !vesselId ||
                !roleId ||
                !locationPortId ||
                !startDate ||
                !salaryMin ||
                certificationIds.length === 0
          }
          onClick={() => {
            if (templateMode) {
              handleSaveTemplate();
            } else {
              setShowConfirm(true);
            }
          }}
        >
          {templateMode
            ? isEditingTemplate
              ? 'Save changes'
              : 'Review and create template'
            : 'Review & Post'}
        </Button>
      </div>

      {/* Post confirmation overlay */}
      <BottomSheet
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Review your posting"
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vessel</span>
            <span className="font-medium">{vesselDisplayName || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium">{roles.find((r) => r.id === roleId)?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Start date</span>
            <span className="font-medium">{startDate || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Salary</span>
            <span className="font-medium">
              {currencySymbol(salaryCurrency)}
              {salaryMax && salaryMax !== salaryMin ? `${salaryMin}–${salaryMax}` : salaryMin}/
              {salaryPeriod === 'annual' ? 'year' : 'month'}
            </span>
          </div>
          {liveAboard && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Live aboard</span>
              <span className="font-medium">Yes</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shortlist cap</span>
            <span className="font-medium">{shortlistCap}</span>
          </div>
          {certificationIds.length > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Certs required</span>
              <span className="font-medium text-right">
                {certificationIds
                  .map((id) => certifications.find((c) => c.id === id)?.name ?? id)
                  .join(', ')}
              </span>
            </div>
          )}
          {notes && (
            <div>
              <span className="text-muted-foreground">Notes</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {notes.length > 100 ? notes.slice(0, 100) + '...' : notes}
              </p>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setShowConfirm(false)}>
              Back to edit
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setShowConfirm(false);
                handleSubmit();
              }}
              disabled={loading}
            >
              {loading ? 'Posting...' : 'Post job'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
