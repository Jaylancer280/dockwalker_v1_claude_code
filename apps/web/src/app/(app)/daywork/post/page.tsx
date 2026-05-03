'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VesselSelector } from '@/components/vessels/vessel-selector';
import { LocationPicker } from '@/components/location-picker';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { currencySymbol } from '@dockwalker/shared';
import { HierarchicalPills, rolesToGroups } from '@/components/hierarchical-pills';
import { CertificationPicker } from '@/components/certification-picker';
import { ExperienceBracketPills } from '@/components/experience-bracket-pills';
import { usePreferences } from '@/hooks/use-preferences';
import { useToast } from '@/hooks/use-toast';
import { useLookups } from '@/hooks/use-lookups';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { WorkingDayCalendar } from '@/components/working-day-calendar';
import { LANGUAGES } from '@dockwalker/shared';
import { PostingTypeSelector } from './_components/posting-type-selector';
import { PermanentPostForm } from './_components/permanent-post-form';
import { CV_BUILDER_ENABLED } from '@/lib/cv/feature-flag';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
  department?: string;
  category?: string;
}

interface Template {
  id: string;
  name: string;
  vessel_id: string | null;
  role_id: string | null;
  location_port_id: string | null;
  working_days: number | null;
  required_certification_ids: string[];
  required_languages: string[];
  experience_bracket_id: string | null;
  day_rate: number | null;
  currency: string | null;
  meals: string[];
  notes: string | null;
  positions_available: number | null;
  permanent_opportunity: boolean;
}

type MealOption = 'breakfast' | 'lunch' | 'dinner';

export default function PostDayworkPage() {
  return (
    <Suspense>
      <PostDayworkContent />
    </Suspense>
  );
}

function PostDayworkContent() {
  const pageSearchParams = useSearchParams();
  const permanentTemplateId = pageSearchParams.get('permanentTemplateId');
  // QR-hire (Phase 5b): /cv/[handle] action bar passes `?invite=<personId>`
  // for daywork and `?invite=...&type=permanent` for permanent. Skip the
  // type selector when the URL specifies a type or carries a permanent
  // template id.
  const typeParam = pageSearchParams.get('type');
  const initialType: 'daywork' | 'permanent' | null = permanentTemplateId
    ? 'permanent'
    : typeParam === 'permanent'
      ? 'permanent'
      : typeParam === 'daywork'
        ? 'daywork'
        : null;
  const [postingType, setPostingType] = useState<'daywork' | 'permanent' | null>(initialType);

  // CV Builder is hard-locked. Block the QR-hire entry point —
  // visitors who somehow reach `/daywork/post?invite=<personId>` get a
  // Coming-Soon screen and can navigate back. The route's QR-hire
  // branch also returns 503 as defence in depth.
  const inviteCrewPersonId = pageSearchParams.get('invite');
  if (inviteCrewPersonId && !CV_BUILDER_ENABLED) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
        <div className="page-width-narrow flex max-w-md flex-col items-center gap-4 rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <h1 className="text-xl font-semibold">DockWalker CV — Coming Soon</h1>
          <p className="text-sm text-muted-foreground">
            Hire-from-QR isn&apos;t live yet. You can still post a public daywork or permanent
            position from My Jobs.
          </p>
          <div className="mt-2 flex gap-2">
            <Link href="/daywork/mine" className="text-sm font-medium underline">
              Go to My Jobs
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (postingType === null) {
    return <PostingTypeSelector onSelect={setPostingType} />;
  }

  if (postingType === 'permanent') {
    return (
      <PermanentPostForm
        onBack={() => setPostingType(null)}
        initialTemplateId={permanentTemplateId ?? undefined}
      />
    );
  }

  return <DayworkPostForm />;
}

function DayworkPostForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError: showErrorToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = (field: string) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  const validateRequired = (field: string, value: string) => {
    if (!value) setFieldErrors((prev) => ({ ...prev, [field]: 'Required' }));
  };

  // Restore saved draft from sessionStorage (vessel creation round-trip or page revisit)
  const [draft] = useState(() => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem('dockwalker:daywork-post-draft');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  });

  // Form fields
  const [vesselId, setVesselId] = useState('');
  const [vesselNda, setVesselNda] = useState(false);
  const [vesselDisplayName, setVesselDisplayName] = useState('');
  const [roleId, setRoleId] = useState((draft?.roleId as string) ?? '');
  const [locationPortId, setLocationPortId] = useState((draft?.locationPortId as string) ?? '');
  const [startDate, setStartDate] = useState((draft?.startDate as string) ?? '');
  const [endDate, setEndDate] = useState((draft?.endDate as string) ?? '');
  // Local-time today — using toISOString() drops a day for east-of-UTC
  // users (Türkiye, UAE, etc.) and lets "yesterday" pass form validation
  // even though the server treats it as a past date.
  const todayISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const [workingDayDates, setWorkingDayDates] = useState<string[]>(
    (draft?.workingDayDates as string[]) ?? [],
  );
  const [requiredCertIds, setRequiredCertIds] = useState<string[]>(
    (draft?.requiredCertIds as string[]) ?? [],
  );
  const [requiredLangs, setRequiredLangs] = useState<string[]>(
    (draft?.requiredLangs as string[]) ?? [],
  );
  const [experienceBracketId, setExperienceBracketId] = useState(
    (draft?.experienceBracketId as string) ?? '',
  );
  const [dayRate, setDayRate] = useState((draft?.dayRate as string) ?? '');
  const prefs = usePreferences();
  const [currency, setCurrency] = useState(
    () => (draft?.currency as string) ?? prefs.currency ?? 'EUR',
  );
  const [meals, setMeals] = useState<MealOption[]>((draft?.meals as MealOption[]) ?? []);
  const [notes, setNotes] = useState((draft?.notes as string) ?? '');
  const [positionsAvailable, setPositionsAvailable] = useState(
    (draft?.positionsAvailable as string) ?? '1',
  );
  const [permanentOpportunity, setPermanentOpportunity] = useState(
    (draft?.permanentOpportunity as boolean) ?? false,
  );

  // Lookups from cached context
  const lookups = useLookups();
  const roles = lookups.roles as LookupItem[];
  const certs = lookups.certifications as LookupItem[];
  const brackets = lookups.experienceBrackets.map((b) => ({ ...b, name: b.label })) as LookupItem[];

  // When start/end dates change, re-initialise working day dates to all days in range
  useEffect(() => {
    if (!startDate || !endDate) return;
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    if (e < s) return;
    // Local-date format — toISOString() converts back through UTC and
    // drops a day for east-of-UTC users (matches the WorkingDayCalendar
    // fix). Without this, the auto-init wrote dates one day before the
    // user's selected range.
    const dates: string[] = [];
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${dd}`);
    }
    // Only re-initialise if the range changed (not on every render)
    setWorkingDayDates((prev) => {
      const prevInRange = prev.filter((p) => p >= startDate && p <= endDate);
      // If previous selection is empty or out of range, select all
      if (prevInRange.length === 0) return dates;
      return prevInRange;
    });
  }, [startDate, endDate]);

  const [showPostConfirm, setShowPostConfirm] = useState(false);

  // Auto-save draft to sessionStorage on any form change (500ms debounce)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const state = {
        vesselId,
        roleId,
        locationPortId,
        startDate,
        endDate,
        workingDayDates,
        requiredCertIds,
        requiredLangs,
        experienceBracketId,
        dayRate,
        currency,
        meals,
        notes,
        positionsAvailable,
        permanentOpportunity,
      };
      sessionStorage.setItem('dockwalker:daywork-post-draft', JSON.stringify(state));
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    vesselId,
    roleId,
    locationPortId,
    startDate,
    endDate,
    workingDayDates,
    requiredCertIds,
    requiredLangs,
    experienceBracketId,
    dayRate,
    currency,
    meals,
    notes,
    positionsAvailable,
    permanentOpportunity,
  ]);

  // Flush draft immediately on tab close (catches data within the 500ms debounce window)
  useEffect(() => {
    function flushDraft() {
      const state = {
        vesselId,
        roleId,
        locationPortId,
        startDate,
        endDate,
        workingDayDates,
        requiredCertIds,
        requiredLangs,
        experienceBracketId,
        dayRate,
        currency,
        meals,
        notes,
        positionsAvailable,
        permanentOpportunity,
      };
      sessionStorage.setItem('dockwalker:daywork-post-draft', JSON.stringify(state));
    }
    window.addEventListener('beforeunload', flushDraft);
    return () => window.removeEventListener('beforeunload', flushDraft);
  });

  // Save form state to sessionStorage before navigating to vessel creation
  function saveFormAndCreateVessel() {
    const state = {
      vesselId,
      roleId,
      locationPortId,
      startDate,
      endDate,
      workingDayDates,
      requiredCertIds,
      requiredLangs,
      experienceBracketId,
      dayRate,
      currency,
      meals,
      notes,
      positionsAvailable,
      permanentOpportunity,
    };
    sessionStorage.setItem('dockwalker:daywork-post-draft', JSON.stringify(state));
    router.push('/vessels?returnTo=daywork-post');
  }

  // B-005: template-mode is now a top-of-form toggle that reframes the
  // entire submit flow. `?mode=template` from the post-type chooser starts
  // in create mode; `?mode=edit&templateId=...` from My Jobs Edit button
  // starts in edit mode (PATCH on submit). When ON, required-field
  // validation drops, the submit button becomes "Create/Save template",
  // and the daywork POST is skipped — only the template API is called.
  const initialMode = searchParams.get('mode');
  const isEditingTemplate = initialMode === 'edit';
  const editingTemplateId = isEditingTemplate ? (searchParams.get('templateId') ?? null) : null;
  const [templateMode, setTemplateMode] = useState(initialMode === 'template' || isEditingTemplate);
  const [templateName, setTemplateName] = useState('');

  function applyTemplate(t: Template) {
    // Reset all fields to defaults first so switching from a fuller template
    // to a sparser one does not leave stale values in the form.
    // B-005: when in edit mode, also seed templateName from the template's
    // own name so the user can rename in place. For "Use template" (no
    // edit mode) we don't pre-fill templateName — the user is creating a
    // new posting, not editing the template's identity.
    if (isEditingTemplate) setTemplateName(t.name ?? '');
    setRoleId(t.role_id ?? '');
    setLocationPortId(t.location_port_id ?? '');
    // Templates store working_days count but no specific dates — useEffect will
    // re-initialise workingDayDates to all days when start/end dates are set
    setWorkingDayDates([]);
    setRequiredCertIds(t.required_certification_ids ?? []);
    setRequiredLangs(t.required_languages ?? []);
    setExperienceBracketId(t.experience_bracket_id ?? '');
    setDayRate(t.day_rate ? String(t.day_rate) : '');
    setCurrency(t.currency ?? 'EUR');
    setMeals((t.meals as MealOption[]) ?? []);
    setNotes(t.notes ?? '');
    setPositionsAvailable(t.positions_available ? String(t.positions_available) : '1');
    setPermanentOpportunity(t.permanent_opportunity ?? false);
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // B-005: list-of-templates fetch removed — the in-form dropdown is
      // gone, so we no longer need the full list at mount. Specific template
      // pre-fill via `?templateId=` still happens below.

      // Load template from search param
      const templateId = searchParams.get('templateId');
      if (templateId) {
        const tplResult = await safeFetch<{ template?: Template }>(
          `/api/daywork/templates/${templateId}`,
        );
        if (tplResult.ok && tplResult.data.template) applyTemplate(tplResult.data.template);
      }

      // Pre-fill from existing daywork (e.g. relist after crew cancellation with past dates)
      const fromDayworkId = searchParams.get('fromDaywork');
      if (fromDayworkId) {
        const { data: dw } = await supabase
          .from('dayworks')
          .select(
            'vessel_id, role_id, location_port_id, working_days, required_certification_ids, required_languages, experience_bracket_id, day_rate, currency, meals, notes, end_date',
          )
          .eq('id', fromDayworkId)
          .single();
        if (dw) {
          if (dw.vessel_id) setVesselId(dw.vessel_id);
          if (dw.role_id) setRoleId(dw.role_id);
          if (dw.location_port_id) setLocationPortId(dw.location_port_id);
          // working_day_dates will be re-initialised by useEffect when dates are set
          setWorkingDayDates([]);
          if (dw.required_certification_ids?.length)
            setRequiredCertIds(dw.required_certification_ids);
          if (dw.required_languages?.length) setRequiredLangs(dw.required_languages);
          if (dw.experience_bracket_id) setExperienceBracketId(dw.experience_bracket_id);
          if (dw.day_rate) setDayRate(String(dw.day_rate));
          if (dw.currency) setCurrency(dw.currency);
          if (dw.meals?.length) setMeals(dw.meals as MealOption[]);
          if (dw.notes) setNotes(dw.notes);
          // For replacement postings, set dates and force 1 position
          const isReplacement = searchParams.get('replacementDates') === 'true';
          if (isReplacement) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const startStr = tomorrow.toISOString().split('T')[0];
            setStartDate(startStr);
            if (dw.end_date) setEndDate(dw.end_date);
            setPositionsAvailable('1');
          }
          // Otherwise dates intentionally left blank — employer must pick new dates
        }
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // B-005: in-form template delete + handleDeleteTemplate removed. The
  // dedicated surface for managing templates is the My Jobs > Templates
  // tab, which has its own Delete button per template card.

  function toggleMeal(meal: MealOption) {
    setMeals((prev) => (prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]));
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;

    // B-005 partial-save: send ONLY fields the user actually filled. The
    // API now writes only supplied fields (no NULL coercion), matching
    // the relaxed `permanent_templates`/`daywork_templates` schema in
    // migration 00134.
    const payload: Record<string, unknown> = { name: templateName.trim() };
    if (roleId) payload.roleId = roleId;
    if (locationPortId) payload.locationPortId = locationPortId;
    if (workingDayDates.length) payload.workingDays = workingDayDates.length;
    if (requiredCertIds.length) payload.requiredCertificationIds = requiredCertIds;
    if (requiredLangs.length) payload.requiredLanguages = requiredLangs;
    if (experienceBracketId) payload.experienceBracketId = experienceBracketId;
    if (dayRate) payload.dayRate = parseFloat(dayRate);
    if (currency) payload.currency = currency;
    if (meals.length) payload.meals = meals;
    if (notes) payload.notes = notes;
    const positionsInt = parseInt(positionsAvailable, 10);
    if (Number.isFinite(positionsInt) && positionsInt > 1)
      payload.positionsAvailable = positionsInt;
    if (permanentOpportunity) payload.permanentOpportunity = true;

    const url = editingTemplateId
      ? `/api/daywork/templates/${editingTemplateId}`
      : '/api/daywork/templates';
    const method = editingTemplateId ? 'PATCH' : 'POST';

    const result = await safeFetch<{ error?: string }>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (result.ok) {
      showSuccess(editingTemplateId ? 'Template updated' : 'Template saved');
      // B-005: handleSaveTemplate is ONLY reached from template-mode now
      // (the dual "save AND post" path was removed). Route the user back to
      // the templates tab where they can see the result. type=daywork is
      // explicit so URL behaviour is symmetric with the permanent flow.
      sessionStorage.removeItem('dockwalker:daywork-post-draft');
      router.push('/daywork/mine?type=daywork&tab=templates');
      return;
    }
    if (result.error === 'template_limit_reached') {
      showErrorToast('Template limit reached — upgrade to Pro for more templates');
    } else {
      showErrorToast(result.error);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // B-005: template-mode short-circuit — validate name only, fire the
    // template POST/PATCH directly. No post-confirm dialog (the user is
    // saving a template, not posting a job).
    if (templateMode) {
      if (!templateName.trim()) {
        setError('Please name the template');
        return;
      }
      if (templateName.length > 100) {
        setError('Template name must be 100 characters or less');
        return;
      }
      handleSaveTemplate();
      return;
    }

    const errors: Record<string, string> = {};
    if (!vesselId) errors.vessel = 'Please select a vessel';
    if (!roleId) errors.role = 'Please select a role';
    if (!locationPortId) errors.location = 'Please select a location';
    if (!startDate) errors.startDate = 'Required';
    if (!endDate) errors.endDate = 'Required';
    if (!dayRate) errors.dayRate = 'Required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setShowPostConfirm(true);
  }

  const submittingRef = useRef(false);

  async function handleConfirmedSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setShowPostConfirm(false);
    setLoading(true);

    // QR-hire (Phase 5b): when arriving from /cv/[handle] we carry the
    // crew person id in the `?invite=` query param. The route fires
    // DAYWORK.POSTED + DAYWORK.INVITED atomically. Re-submitting after a
    // success would 409 (UNIQUE on daywork_invitations) — the spec'd
    // 409 message surfaces here as the form error.
    const inviteCrewPersonId = searchParams.get('invite') ?? undefined;

    const result = await safeFetch<{ error?: string }>('/api/daywork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId,
        roleId,
        locationPortId,
        startDate,
        endDate,
        workingDays: workingDayDates.length,
        workingDayDates,
        requiredCertificationIds: requiredCertIds,
        requiredLanguages: requiredLangs,
        experienceBracketId: experienceBracketId || undefined,
        dayRate,
        currency,
        meals,
        notes: notes || undefined,
        positionsAvailable: parseInt(positionsAvailable, 10) || 1,
        permanentOpportunity: permanentOpportunity || undefined,
        ...(inviteCrewPersonId ? { inviteCrewPersonId } : {}),
      }),
    });

    if (result.ok) {
      // Note: dual "save AND post" path was removed in B-005. Template
      // creation is now a separate gesture (top-of-form toggle), and the
      // posting form here is strictly for posting a job.
      sessionStorage.removeItem('dockwalker:daywork-post-draft');
      showSuccess(inviteCrewPersonId ? 'Daywork posted and crew invited' : 'Daywork posted');
      router.push('/daywork/mine');
    } else {
      setError(result.error);
    }
    setLoading(false);
    submittingRef.current = false;
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center gap-3">
          <Link href="/daywork/mine" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">
            {templateMode
              ? isEditingTemplate
                ? 'Edit template'
                : 'Create template'
              : 'Post daywork'}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="page-width flex w-full flex-col gap-4 px-4 py-6">
        {/* QR-hire banner (Phase 5b): visible when the captain arrived
            from /cv/[handle]. The crew person id is in the URL; we just
            surface the intent so the captain knows they're hiring this
            specific crew, not posting a public job. */}
        {searchParams.get('invite') ? (
          <div className="rounded-[14px] border border-[var(--accent)] bg-[var(--accent-lo)] px-4 py-3 text-xs">
            <p className="font-semibold">Hiring from QR</p>
            <p className="text-muted-foreground">
              Posting this daywork will both create the job and invite the scanned crew member
              directly. The job will also appear on the public Discover feed.
            </p>
          </div>
        ) : null}
        {/* B-005: template-mode toggle at the TOP of the form. Reframes the
            entire flow — required-field validation drops, submit button
            becomes "Create/Save template", daywork POST is skipped. The old
            in-form "Load template" dropdown was removed; the dedicated
            entry point is the templates tab in My Jobs (Use button). */}
        <div className="space-y-2 rounded-[14px] border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-4">
          <label htmlFor="templateMode" className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              id="templateMode"
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
              Toggle on to save a reusable configuration without posting a job. Required fields
              become optional; only the template name is required.
            </p>
          )}
          {templateMode && (
            <div className="pl-6">
              <Input
                placeholder="Template name (e.g. Deckhand €2500)"
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

        {/* Vessel */}
        <div className="flex flex-col gap-1.5">
          <Label>Vessel {!templateMode && <span className="text-destructive">*</span>}</Label>
          <VesselSelector
            value={vesselId}
            onValueChange={(v) => {
              setVesselId(v);
              clearFieldError('vessel');
            }}
            onNdaChange={setVesselNda}
            onNameChange={setVesselDisplayName}
            onRequestCreate={saveFormAndCreateVessel}
            required
          />
          {fieldErrors.vessel && <p className="text-xs text-destructive">{fieldErrors.vessel}</p>}
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1.5">
          <Label>Role needed {!templateMode && <span className="text-destructive">*</span>}</Label>
          <HierarchicalPills
            groups={rolesToGroups(
              roles.filter((r): r is typeof r & { department: string } => !!r.department),
            )}
            value={roleId}
            onValueChange={(v) => {
              setRoleId(v as string);
              clearFieldError('role');
            }}
            mode="single"
            required
          />
          {fieldErrors.role && <p className="text-xs text-destructive">{fieldErrors.role}</p>}
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <Label>Location {!templateMode && <span className="text-destructive">*</span>}</Label>
          <LocationPicker
            mode="port-required"
            value={locationPortId ? { portId: locationPortId } : null}
            onValueChange={(v) => {
              setLocationPortId(v.portId ?? '');
              clearFieldError('location');
            }}
            required
          />
          {fieldErrors.location && (
            <p className="text-xs text-destructive">{fieldErrors.location}</p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">
              Start date {!templateMode && <span className="text-destructive">*</span>}
            </Label>
            <DateInput
              value={startDate}
              onChange={(v) => {
                setStartDate(v);
                clearFieldError('startDate');
              }}
              onBlur={() => validateRequired('startDate', startDate)}
              min={todayISO}
              required
            />
            {fieldErrors.startDate && (
              <p className="text-xs text-destructive">{fieldErrors.startDate}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">
              End date {!templateMode && <span className="text-destructive">*</span>}
            </Label>
            <DateInput
              value={endDate}
              onChange={(v) => {
                setEndDate(v);
                clearFieldError('endDate');
              }}
              onBlur={() => validateRequired('endDate', endDate)}
              min={startDate || todayISO}
              required
            />
            {fieldErrors.endDate && (
              <p className="text-xs text-destructive">{fieldErrors.endDate}</p>
            )}
          </div>
        </div>

        {/* Working days calendar */}
        {startDate &&
          endDate &&
          new Date(endDate + 'T00:00:00') >= new Date(startDate + 'T00:00:00') && (
            <div className="flex flex-col gap-1.5">
              <Label>Working days</Label>
              <WorkingDayCalendar
                startDate={startDate}
                endDate={endDate}
                selectedDates={workingDayDates}
                onChange={setWorkingDayDates}
              />
            </div>
          )}
        {(!startDate || !endDate) && (
          <p className="text-xs text-muted-foreground">
            Set start and end dates to select working days
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Crew needed */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="positionsAvailable">Crew needed</Label>
            <Input
              id="positionsAvailable"
              type="number"
              min="1"
              max="20"
              placeholder="1"
              value={positionsAvailable}
              onChange={(e) => setPositionsAvailable(e.target.value)}
            />
          </div>
        </div>

        {/* Experience bracket */}
        <div className="flex flex-col gap-1.5">
          <Label>Minimum experience (optional)</Label>
          <ExperienceBracketPills
            brackets={brackets}
            value={experienceBracketId}
            onValueChange={setExperienceBracketId}
            optional
          />
        </div>

        {/* Required certs */}
        <div className="flex flex-col gap-1.5">
          <Label>Required certifications (optional)</Label>
          <CertificationPicker
            selectedIds={requiredCertIds}
            onChange={setRequiredCertIds}
            mode="required"
          />
        </div>

        {/* Required languages */}
        <div className="flex flex-col gap-1.5">
          <Label>Languages (optional)</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${
                  requiredLangs.includes(lang.code)
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]'
                }`}
                onClick={() =>
                  setRequiredLangs((prev) =>
                    prev.includes(lang.code)
                      ? prev.filter((c) => c !== lang.code)
                      : [...prev, lang.code],
                  )
                }
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Day rate + currency */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dayRate">
            Day rate {!templateMode && <span className="text-destructive">*</span>}
          </Label>
          <div className="flex gap-2">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">&euro; EUR</SelectItem>
                <SelectItem value="USD">$ USD</SelectItem>
                <SelectItem value="GBP">&pound; GBP</SelectItem>
                <SelectItem value="AED">د.إ AED</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="dayRate"
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 250"
              value={dayRate}
              onChange={(e) => {
                setDayRate(e.target.value);
                clearFieldError('dayRate');
              }}
              onBlur={() => validateRequired('dayRate', dayRate)}
              required
              aria-required="true"
            />
          </div>
          {fieldErrors.dayRate && <p className="text-xs text-destructive">{fieldErrors.dayRate}</p>}
        </div>

        {/* Meals */}
        <div className="flex flex-col gap-1.5">
          <Label>Meals provided (optional)</Label>
          <div className="flex gap-3">
            {(['breakfast', 'lunch', 'dinner'] as MealOption[]).map((meal) => (
              <label key={meal} className="flex items-center gap-1.5 text-sm capitalize">
                <Checkbox checked={meals.includes(meal)} onCheckedChange={() => toggleMeal(meal)} />
                {meal}
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={3}
            maxLength={500}
            placeholder="Job description, requirements, benefits..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground">{notes.length}/500</p>
        </div>

        {/* Permanent opportunity */}
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={permanentOpportunity}
              onCheckedChange={(checked) => setPermanentOpportunity(checked === true)}
            />
            Could lead to permanent role
          </label>
          <p className="text-xs text-muted-foreground pl-6">
            Signal to crew that this daywork could lead to a permanent position. No guarantees.
          </p>
        </div>

        {/* B-005: bottom save-as-template block removed; toggle now lives at
            the TOP of the form, reframing the entire flow when ON. */}

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
            if (!endDate) missing.push('End date');
            if (!dayRate) missing.push('Day rate');
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

        <Button type="submit" disabled={loading} className="w-full">
          {templateMode
            ? isEditingTemplate
              ? 'Save changes'
              : 'Review and create template'
            : loading
              ? 'Posting...'
              : 'Post daywork'}
        </Button>
      </form>

      {/* Post confirmation overlay */}
      <BottomSheet
        open={showPostConfirm}
        onClose={() => setShowPostConfirm(false)}
        title="Review your posting"
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vessel</span>
            <span className="font-medium">
              {vesselDisplayName || '—'}
              {vesselNda ? ' (NDA)' : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium">{roles.find((r) => r.id === roleId)?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dates</span>
            <span className="font-medium">
              {startDate} → {endDate}
              {workingDayDates.length > 0 ? ` (${workingDayDates.length} working days)` : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Day rate</span>
            <span className="font-medium">
              {currencySymbol(currency)}
              {dayRate}/day
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Positions</span>
            <span className="font-medium">{positionsAvailable}</span>
          </div>
          {requiredCertIds.length > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Certs required</span>
              <span className="font-medium text-right">
                {requiredCertIds.map((id) => certs.find((c) => c.id === id)?.name ?? id).join(', ')}
              </span>
            </div>
          )}
          {meals.length > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Meals</span>
              <span className="font-medium capitalize">{meals.join(', ')}</span>
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
            <Button variant="ghost" className="flex-1" onClick={() => setShowPostConfirm(false)}>
              Back to edit
            </Button>
            <Button className="flex-1" onClick={handleConfirmedSubmit} disabled={loading}>
              {loading ? 'Posting...' : 'Post job'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}
