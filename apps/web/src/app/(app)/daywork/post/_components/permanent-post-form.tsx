'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Trash2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { usePreferences } from '@/hooks/use-preferences';
import { currencySymbol, type CurrencyCode } from '@dockwalker/shared';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { safeFetch } from '@/lib/safe-fetch';
import { createClient } from '@/lib/supabase/client';
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
  const [shortlistCap, setShortlistCap] = useState((draft?.shortlistCap as string) ?? '5');
  const [notes, setNotes] = useState((draft?.notes as string) ?? '');
  const [contractType, setContractType] = useState((draft?.contractType as string) ?? 'permanent');
  const [description, setDescription] = useState((draft?.description as string) ?? '');
  const [meals, setMeals] = useState<string[]>((draft?.meals as string[]) ?? []);
  const [positionsAvailable, setPositionsAvailable] = useState(
    (draft?.positionsAvailable as string) ?? '1',
  );

  // Template state
  const [templates, setTemplates] = useState<PermanentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
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

  // Lookups
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certifications, setCertifications] = useState<LookupItem[]>([]);
  const [experienceBrackets, setExperienceBrackets] = useState<LookupItem[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch lookups and templates on mount
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('yacht_roles').select('id, name, department').order('name'),
      supabase.from('certifications').select('id, name, category').order('sort_order'),
      supabase.from('experience_brackets').select('id, label').order('sort_order'),
    ]).then(([rolesRes, certsRes, bracketsRes]) => {
      setRoles((rolesRes.data ?? []) as LookupItem[]);
      setCertifications((certsRes.data ?? []) as LookupItem[]);
      setExperienceBrackets(
        (bracketsRes.data ?? []).map((b: { id: string; label: string }) => ({
          ...b,
          name: b.label,
        })) as LookupItem[],
      );
    });

    safeFetch<{ templates?: PermanentTemplate[] }>('/api/permanent/templates').then((result) => {
      if (result.ok) {
        const loaded = result.data.templates ?? [];
        setTemplates(loaded);
        if (initialTemplateId) {
          const match = loaded.find((t) => t.id === initialTemplateId);
          if (match) {
            setSelectedTemplateId(match.id);
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
          }
        }
      }
    });
  }, [initialTemplateId]);

  // Load template into form
  function loadTemplate(templateId: string) {
    const t = templates.find((tpl) => tpl.id === templateId);
    if (!t) return;
    setSelectedTemplateId(templateId);
    if (t.vessel_id) setVesselId(t.vessel_id);
    if (t.role_id) setRoleId(t.role_id);
    if (t.port_id) setLocationPortId(t.port_id);
    if (t.start_date) setStartDate(t.start_date);
    if (t.salary_min) setSalaryMin(String(t.salary_min));
    if (t.salary_max) setSalaryMax(String(t.salary_max));
    if (t.salary_currency) setSalaryCurrency(t.salary_currency as CurrencyCode);
    if (t.salary_period) setSalaryPeriod(t.salary_period);
    setLiveAboard(t.live_aboard);
    setCertificationIds(t.required_certification_ids ?? []);
    setRequiredLangs(t.required_languages ?? []);
    if (t.experience_bracket_id) setExperienceBracketId(t.experience_bracket_id);
    if (t.shortlist_cap) setShortlistCap(String(t.shortlist_cap));
    setNotes(t.notes ?? '');
    setContractType(t.contract_type ?? 'permanent');
    setDescription(t.description ?? '');
    setMeals(t.meals ?? []);
    if (t.positions_available) setPositionsAvailable(String(t.positions_available));
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId) return;
    const result = await safeFetch(`/api/permanent/templates/${selectedTemplateId}`, {
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
        salaryMax: parseFloat(salaryMax),
        salaryCurrency,
        salaryPeriod,
        liveAboard,
        requiredCertificationIds: certificationIds,
        requiredLanguages: requiredLangs,
        experienceBracketId: experienceBracketId === 'any' ? null : experienceBracketId || null,
        shortlistCap: parseInt(shortlistCap, 10) || 5,
        notes: notes || null,
        contractType: contractType || null,
        contractDetails: null,
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

    // Save template alongside if checked
    if (saveAsTemplate && templateName.trim()) {
      await safeFetch('/api/permanent/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: templateName.trim(),
          vesselId,
          roleId,
          locationPortId,
          startDate,
          salaryMin: parseFloat(salaryMin),
          salaryMax: parseFloat(salaryMax),
          salaryCurrency,
          salaryPeriod,
          liveAboard,
          requiredCertificationIds: certificationIds,
          requiredLanguages: requiredLangs,
          experienceBracketId: experienceBracketId === 'any' ? null : experienceBracketId || null,
          shortlistCap: parseInt(shortlistCap, 10) || 5,
          notes: notes || null,
          contractType: contractType || null,
          contractDetails: null,
          description: description || null,
          meals,
          positionsAvailable: parseInt(positionsAvailable, 10) || 1,
        }),
      });
    }

    showSuccess('Permanent posting created');
    router.push('/daywork/mine');
    setLoading(false);
    submittingRef.current = false;
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={onBack} className="rounded-full p-2 hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[24px] font-bold tracking-[-0.5px]">Post Permanent Position</h1>
      </div>

      {/* Load template */}
      {templates.length > 0 && (
        <div className="mb-6">
          <Label>Load from template</Label>
          <div className="flex gap-2">
            <Select value={selectedTemplateId} onValueChange={loadTemplate}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.template_name}
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
        />

        <ContractTermsSection
          liveAboard={liveAboard}
          setLiveAboard={setLiveAboard}
          shortlistCap={shortlistCap}
          setShortlistCap={setShortlistCap}
          notes={notes}
          setNotes={setNotes}
          contractType={contractType}
          setContractType={setContractType}
          description={description}
          setDescription={setDescription}
          meals={meals}
          setMeals={setMeals}
          positionsAvailable={positionsAvailable}
          setPositionsAvailable={setPositionsAvailable}
        />

        <RequirementsSection
          certifications={certifications}
          certificationIds={certificationIds}
          setCertificationIds={setCertificationIds}
          requiredLangs={requiredLangs}
          setRequiredLangs={setRequiredLangs}
          experienceBrackets={experienceBrackets}
          experienceBracketId={experienceBracketId}
          setExperienceBracketId={setExperienceBracketId}
        />

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

        {/* Error */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Submit */}
        <Button
          className="w-full"
          disabled={
            loading ||
            !vesselId ||
            !roleId ||
            !locationPortId ||
            !startDate ||
            !salaryMin ||
            !salaryMax
          }
          onClick={() => setShowConfirm(true)}
        >
          Review & Post
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
              {salaryMin}–{salaryMax}/{salaryPeriod === 'annual' ? 'year' : 'month'}
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
