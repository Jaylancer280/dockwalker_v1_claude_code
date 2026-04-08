'use client';

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Save, Trash2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LocationPicker } from '@/components/location-picker';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { currencySymbol } from '@dockwalker/shared';
import { HierarchicalPills, rolesToGroups, certsToGroups } from '@/components/hierarchical-pills';
import { ExperienceBracketPills } from '@/components/experience-bracket-pills';
import { usePreferences } from '@/hooks/use-preferences';
import { useToast } from '@/hooks/use-toast';
import { useLookups } from '@/hooks/use-lookups';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { LANGUAGES } from '@dockwalker/shared';
import { PostingTypeSelector } from './_components/posting-type-selector';
import { PermanentPostForm } from './_components/permanent-post-form';

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
  const [postingType, setPostingType] = useState<'daywork' | 'permanent' | null>(
    permanentTemplateId ? 'permanent' : null,
  );

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
  const [workingDays, setWorkingDays] = useState((draft?.workingDays as string) ?? '');
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

  // Max working days = min(14, calendarSpan). Clamp when dates change.
  const maxWorkingDays = useMemo(() => {
    if (!startDate || !endDate) return 14;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const span = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return Math.max(1, Math.min(14, span));
  }, [startDate, endDate]);

  useEffect(() => {
    if (workingDays && parseInt(workingDays, 10) > maxWorkingDays) {
      setWorkingDays(String(maxWorkingDays));
    }
  }, [maxWorkingDays, workingDays]);

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
        workingDays,
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
    workingDays,
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
        workingDays,
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
      workingDays,
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

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  function applyTemplate(t: Template) {
    // Reset all fields to defaults first so switching from a fuller template
    // to a sparser one does not leave stale values in the form.
    setRoleId(t.role_id ?? '');
    setLocationPortId(t.location_port_id ?? '');
    setWorkingDays(t.working_days ? String(t.working_days) : '');
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
      const templatesResult = await safeFetch<{ templates?: Template[] }>('/api/daywork/templates');
      if (templatesResult.ok && templatesResult.data.templates)
        setTemplates(templatesResult.data.templates);

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
          if (dw.working_days) setWorkingDays(String(dw.working_days));
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

  function handleLoadTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const t = templates.find((x) => x.id === templateId);
    if (t) applyTemplate(t);
  }

  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(false);

  async function handleDeleteTemplate() {
    setConfirmDeleteTemplate(false);
    if (!selectedTemplateId) return;
    const result = await safeFetch(`/api/daywork/templates/${selectedTemplateId}`, {
      method: 'DELETE',
    });
    if (result.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== selectedTemplateId));
      setSelectedTemplateId('');
      showSuccess('Template deleted');
    } else {
      showErrorToast('Failed to delete template');
    }
  }

  function toggleMeal(meal: MealOption) {
    setMeals((prev) => (prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]));
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;

    const result = await safeFetch<{ error?: string }>('/api/daywork/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateName.trim(),
        vesselId: vesselId || null,
        roleId: roleId || null,
        locationPortId: locationPortId || null,
        workingDays: workingDays ? parseInt(workingDays, 10) : null,
        requiredCertificationIds: requiredCertIds,
        requiredLanguages: requiredLangs,
        experienceBracketId: experienceBracketId || null,
        dayRate: dayRate || null,
        currency,
        meals,
        notes: notes || null,
        positionsAvailable: parseInt(positionsAvailable, 10) || 1,
        permanentOpportunity: permanentOpportunity || undefined,
      }),
    });

    if (result.ok) {
      showSuccess('Template saved');
      setSaveAsTemplate(false);
      setTemplateName('');
      const templatesResult = await safeFetch<{ templates?: Template[] }>('/api/daywork/templates');
      if (templatesResult.ok && templatesResult.data.templates)
        setTemplates(templatesResult.data.templates);
    } else {
      if (result.error === 'template_limit_reached') {
        showErrorToast('Template limit reached — upgrade to Pro for more templates');
      } else {
        showErrorToast(result.error);
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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

    const result = await safeFetch<{ error?: string }>('/api/daywork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId,
        roleId,
        locationPortId,
        startDate,
        endDate,
        workingDays: parseInt(workingDays, 10),
        requiredCertificationIds: requiredCertIds,
        requiredLanguages: requiredLangs,
        experienceBracketId: experienceBracketId || undefined,
        dayRate,
        currency,
        meals,
        notes: notes || undefined,
        positionsAvailable: parseInt(positionsAvailable, 10) || 1,
        permanentOpportunity: permanentOpportunity || undefined,
      }),
    });

    if (result.ok) {
      // Save template alongside if checkbox is checked
      if (saveAsTemplate && templateName.trim()) {
        await handleSaveTemplate();
      }
      sessionStorage.removeItem('dockwalker:daywork-post-draft');
      showSuccess('Daywork posted');
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
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">Post daywork</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="page-width flex w-full flex-col gap-4 px-4 py-6">
        {/* Load template */}
        {templates.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Load template</Label>
            <div className="flex gap-2">
              <Select value={selectedTemplateId} onValueChange={handleLoadTemplate}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive"
                  onClick={() => setConfirmDeleteTemplate(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Vessel */}
        <div className="flex flex-col gap-1.5">
          <Label>
            Vessel <span className="text-destructive">*</span>
          </Label>
          <VesselSelector
            value={vesselId}
            onValueChange={(v) => {
              setVesselId(v);
              clearFieldError('vessel');
            }}
            onNdaChange={setVesselNda}
            onNameChange={setVesselDisplayName}
            onRequestCreate={saveFormAndCreateVessel}
          />
          {fieldErrors.vessel && <p className="text-xs text-destructive">{fieldErrors.vessel}</p>}
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1.5">
          <Label>
            Role needed <span className="text-destructive">*</span>
          </Label>
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
          />
          {fieldErrors.role && <p className="text-xs text-destructive">{fieldErrors.role}</p>}
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <Label>
            Location <span className="text-destructive">*</span>
          </Label>
          <LocationPicker
            mode="port-required"
            value={locationPortId ? { portId: locationPortId } : null}
            onValueChange={(v) => {
              setLocationPortId(v.portId ?? '');
              clearFieldError('location');
            }}
          />
          {fieldErrors.location && (
            <p className="text-xs text-destructive">{fieldErrors.location}</p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">
              Start date <span className="text-destructive">*</span>
            </Label>
            <DateInput
              value={startDate}
              onChange={(v) => {
                setStartDate(v);
                clearFieldError('startDate');
              }}
              onBlur={() => validateRequired('startDate', startDate)}
              required
            />
            {fieldErrors.startDate && (
              <p className="text-xs text-destructive">{fieldErrors.startDate}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">
              End date <span className="text-destructive">*</span>
            </Label>
            <DateInput
              value={endDate}
              onChange={(v) => {
                setEndDate(v);
                clearFieldError('endDate');
              }}
              onBlur={() => validateRequired('endDate', endDate)}
              required
            />
            {fieldErrors.endDate && (
              <p className="text-xs text-destructive">{fieldErrors.endDate}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Working days */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workingDays">Working days</Label>
            <Input
              id="workingDays"
              type="number"
              min="1"
              max={maxWorkingDays}
              placeholder={`1-${maxWorkingDays}`}
              value={workingDays}
              onChange={(e) => setWorkingDays(e.target.value)}
              required
            />
            {startDate && endDate && (
              <p className="text-xs text-muted-foreground">
                Up to {maxWorkingDays} days for this date range
              </p>
            )}
          </div>

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
          <HierarchicalPills
            groups={certsToGroups(certs)}
            value={requiredCertIds}
            onValueChange={(v) => setRequiredCertIds(v as string[])}
            mode="multi"
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
            Day rate <span className="text-destructive">*</span>
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

        {/* Save as template */}
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="saveTemplate"
              checked={saveAsTemplate}
              onCheckedChange={(v) => setSaveAsTemplate(v === true)}
            />
            <Label htmlFor="saveTemplate" className="cursor-pointer">
              <Save className="mr-1 inline h-4 w-4" />
              Save as template
            </Label>
          </div>
          {saveAsTemplate && (
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Posting...' : 'Post daywork'}
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
              {workingDays ? ` (${workingDays} days)` : ''}
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
      <Dialog open={confirmDeleteTemplate} onOpenChange={setConfirmDeleteTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDeleteTemplate(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
