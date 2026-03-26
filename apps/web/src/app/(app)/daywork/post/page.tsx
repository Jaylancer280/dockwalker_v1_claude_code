'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { VesselSelector } from '@/components/vessels/vessel-selector';
import { LocationPicker } from '@/components/location-picker';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { LANGUAGES } from '@/lib/languages';
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

  // Form fields
  const [vesselId, setVesselId] = useState('');
  const [vesselNda, setVesselNda] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [locationPortId, setLocationPortId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workingDays, setWorkingDays] = useState('');
  const [requiredCertIds, setRequiredCertIds] = useState<string[]>([]);
  const [requiredLangs, setRequiredLangs] = useState<string[]>([]);
  const [experienceBracketId, setExperienceBracketId] = useState('');
  const [dayRate, setDayRate] = useState('');
  const [currency, setCurrency] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('dw-currency-pref')) || 'EUR',
  );
  const [meals, setMeals] = useState<MealOption[]>([]);
  const [notes, setNotes] = useState('');
  const [positionsAvailable, setPositionsAvailable] = useState('1');
  const [permanentOpportunity, setPermanentOpportunity] = useState(false);

  // Lookups
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);
  const [brackets, setBrackets] = useState<LookupItem[]>([]);

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

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  function applyTemplate(t: Template) {
    // Reset all fields to defaults first so switching from a fuller template
    // to a sparser one does not leave stale values in the form.
    setVesselId(t.vessel_id ?? '');
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
      const [rolesRes, certsRes, bracketsRes, templatesResult] = await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase.from('certifications').select('id, name, category').order('sort_order'),
        supabase.from('experience_brackets').select('id, label').order('sort_order'),
        safeFetch<{ templates?: Template[] }>('/api/daywork/templates'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
      if (bracketsRes.data) setBrackets(bracketsRes.data.map((b) => ({ ...b, name: b.label })));
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

  async function handleDeleteTemplate() {
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

  function toggleCert(id: string) {
    setRequiredCertIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleMeal(meal: MealOption) {
    setMeals((prev) => (prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]));
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);

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
      setSaveDialogOpen(false);
      setTemplateName('');
      const templatesResult = await safeFetch<{ templates?: Template[] }>('/api/daywork/templates');
      if (templatesResult.ok && templatesResult.data.templates)
        setTemplates(templatesResult.data.templates);
    } else {
      showErrorToast(result.error);
    }
    setSavingTemplate(false);
  }

  function openSaveDialog() {
    const roleName = roles.find((r) => r.id === roleId)?.name;
    setTemplateName(roleName ?? '');
    setSaveDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!vesselId) {
      setError('Please select a vessel');
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
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/daywork/mine" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[24px] font-bold tracking-[-0.5px]">Post daywork</h1>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6"
      >
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
                  onClick={handleDeleteTemplate}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Vessel */}
        <div className="flex flex-col gap-1.5">
          <Label>Vessel</Label>
          <VesselSelector
            value={vesselId}
            onValueChange={setVesselId}
            onNdaChange={setVesselNda}
            onRequestCreate={() => router.push('/vessels')}
          />
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-2">
            Role needed
            {roleId && roles.find((r) => r.id === roleId)?.name && (
              <EpauletteBadge roleName={roles.find((r) => r.id === roleId)!.name} size="sm" />
            )}
          </Label>
          <Select value={roleId} onValueChange={setRoleId} required>
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <Label>Location</Label>
          <LocationPicker
            mode="port-required"
            value={locationPortId ? { portId: locationPortId } : null}
            onValueChange={(v) => setLocationPortId(v.portId ?? '')}
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

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

        {/* Experience bracket */}
        <div className="flex flex-col gap-1.5">
          <Label>Minimum experience (optional)</Label>
          <Select value={experienceBracketId} onValueChange={setExperienceBracketId}>
            <SelectTrigger>
              <SelectValue placeholder="Any experience level" />
            </SelectTrigger>
            <SelectContent>
              {brackets.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Required certs */}
        <div className="flex flex-col gap-1.5">
          <Label>Required certifications (optional)</Label>
          <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
            {certs.map((cert) => (
              <label key={cert.id} className="flex items-center gap-2 py-1.5 text-sm">
                <Checkbox
                  checked={requiredCertIds.includes(cert.id)}
                  onCheckedChange={() => toggleCert(cert.id)}
                />
                {cert.name}
              </label>
            ))}
          </div>
        </div>

        {/* Required languages */}
        <div className="flex flex-col gap-1.5">
          <Label>Languages (optional)</Label>
          <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
            {LANGUAGES.map((lang) => (
              <label key={lang.code} className="flex items-center gap-2 py-1.5 text-sm">
                <Checkbox
                  checked={requiredLangs.includes(lang.code)}
                  onCheckedChange={() =>
                    setRequiredLangs((prev) =>
                      prev.includes(lang.code)
                        ? prev.filter((c) => c !== lang.code)
                        : [...prev, lang.code],
                    )
                  }
                />
                {lang.label}
              </label>
            ))}
          </div>
        </div>

        {/* Day rate + currency */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dayRate">Day rate</Label>
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
              onChange={(e) => setDayRate(e.target.value)}
              required
            />
          </div>
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
          <Input
            id="notes"
            placeholder="Any additional details"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Posting...' : 'Post daywork'}
          </Button>
          <Button type="button" variant="outline" onClick={openSaveDialog}>
            <Save className="mr-1 h-4 w-4" />
            Save template
          </Button>
        </div>
      </form>

      {/* Post confirmation dialog */}
      <Dialog open={showPostConfirm} onOpenChange={setShowPostConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post daywork</DialogTitle>
            <DialogDescription>
              This will publish your daywork listing and make it visible to crew. You can cancel the
              posting later if needed.
              {vesselNda && (
                <>
                  <br />
                  <br />
                  This is an NDA vessel — details will be revealed to crew on acceptance.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPostConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmedSubmit} disabled={loading}>
              {loading ? 'Posting...' : 'Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save template dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="templateName">Template name</Label>
            <Input
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Deckhand — Port Vauban"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate || !templateName.trim()}>
              {savingTemplate ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
