'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
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
import { VesselSelector } from '@/components/vessels/vessel-selector';
import { LocationPicker } from '@/components/location-picker';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { useToast } from '@/hooks/use-toast';
import { usePreferences } from '@/hooks/use-preferences';
import { currencySymbol, type CurrencyCode } from '@/lib/units';
import { createClient } from '@/lib/supabase/client';

interface LookupItem {
  id: string;
  name: string;
  department?: string;
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
  experience_bracket_id: string | null;
  shortlist_cap: number | null;
  notes: string | null;
}

interface PermanentPostFormProps {
  onBack: () => void;
}

export function PermanentPostForm({ onBack }: PermanentPostFormProps) {
  const router = useRouter();
  const { showSuccess, showError: showErrorToast } = useToast();
  const { currency: preferredCurrency } = usePreferences();
  const submittingRef = useRef(false);

  // Form state
  const [vesselId, setVesselId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [locationPortId, setLocationPortId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState(preferredCurrency);
  const [salaryPeriod, setSalaryPeriod] = useState('monthly');
  const [liveAboard, setLiveAboard] = useState(false);
  const [certificationIds, setCertificationIds] = useState<string[]>([]);
  const [experienceBracketId, setExperienceBracketId] = useState('');
  const [shortlistCap, setShortlistCap] = useState('5');
  const [notes, setNotes] = useState('');

  // Template state
  const [templates, setTemplates] = useState<PermanentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

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
      supabase.from('certifications').select('id, name').order('name'),
      supabase.from('experience_brackets').select('id, name').order('id'),
    ]).then(([rolesRes, certsRes, bracketsRes]) => {
      setRoles((rolesRes.data ?? []) as LookupItem[]);
      setCertifications((certsRes.data ?? []) as LookupItem[]);
      setExperienceBrackets((bracketsRes.data ?? []) as LookupItem[]);
    });

    fetch('/api/permanent/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

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
    if (t.experience_bracket_id) setExperienceBracketId(t.experience_bracket_id);
    if (t.shortlist_cap) setShortlistCap(String(t.shortlist_cap));
    setNotes(t.notes ?? '');
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

  async function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/permanent', {
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
          experienceBracketId: experienceBracketId || null,
          shortlistCap: parseInt(shortlistCap, 10) || 5,
          notes: notes || null,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        const msg = data.error || 'Failed to create posting';
        setError(msg);
        showErrorToast(msg);
        return;
      }

      // Save template alongside if checked
      if (saveAsTemplate && templateName.trim()) {
        await fetch('/api/permanent/templates', {
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
            experienceBracketId: experienceBracketId || null,
            shortlistCap: parseInt(shortlistCap, 10) || 5,
            notes: notes || null,
          }),
        }).catch(() => {});
      }

      showSuccess('Permanent posting created');
      router.push('/daywork/mine');
    } catch {
      const msg = 'Network error — please try again';
      setError(msg);
      showErrorToast(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={onBack} className="rounded-full p-2 hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Post Permanent Position</h1>
      </div>

      {/* Load template */}
      {templates.length > 0 && (
        <div className="mb-6">
          <Label>Load from template</Label>
          <Select value={selectedTemplateId} onValueChange={loadTemplate}>
            <SelectTrigger>
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
        </div>
      )}

      <div className="space-y-6">
        {/* Vessel */}
        <div>
          <Label>Vessel</Label>
          <VesselSelector value={vesselId} onValueChange={setVesselId} />
        </div>

        {/* Role */}
        <div>
          <Label className="flex items-center gap-2">
            Role
            {roleId && roles.find((r) => r.id === roleId)?.name && (
              <EpauletteBadge roleName={roles.find((r) => r.id === roleId)!.name} size="sm" />
            )}
          </Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select role..." />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <div>
          <Label>Location (port/marina)</Label>
          <LocationPicker
            mode="port-required"
            value={locationPortId ? { portId: locationPortId } : null}
            onValueChange={(v) => setLocationPortId(v.portId ?? '')}
          />
        </div>

        {/* Start date */}
        <div>
          <Label>Start date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            Past dates are allowed — they display as &quot;ASAP&quot; on cards.
          </p>
        </div>

        {/* Salary */}
        <div>
          <Label>Salary range</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              className="w-28"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              className="w-28"
            />
            <Select
              value={salaryCurrency}
              onValueChange={(v) => setSalaryCurrency(v as CurrencyCode)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="AED">AED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-sm ${salaryPeriod === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              onClick={() => setSalaryPeriod('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-sm ${salaryPeriod === 'annual' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              onClick={() => setSalaryPeriod('annual')}
            >
              Annual
            </button>
          </div>
          {salaryPreview && (
            <p className="mt-1 text-sm font-medium text-primary">{salaryPreview}</p>
          )}
        </div>

        {/* Live aboard */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="liveAboard"
            checked={liveAboard}
            onCheckedChange={(v) => setLiveAboard(v === true)}
          />
          <Label htmlFor="liveAboard" className="cursor-pointer">
            Live aboard included
          </Label>
        </div>

        {/* Certifications */}
        <div>
          <Label>Required certifications</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {certifications.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs ${
                  certificationIds.includes(c.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
                onClick={() =>
                  setCertificationIds((prev) =>
                    prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                  )
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Experience bracket */}
        <div>
          <Label>Minimum experience (optional)</Label>
          <Select value={experienceBracketId} onValueChange={setExperienceBracketId}>
            <SelectTrigger>
              <SelectValue placeholder="Any experience level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any</SelectItem>
              {experienceBrackets.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Shortlist cap */}
        <div>
          <Label>Shortlist cap</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={shortlistCap}
            onChange={(e) => setShortlistCap(e.target.value)}
            className="w-24"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Maximum candidates on your shortlist (1-20).
          </p>
        </div>

        {/* Notes */}
        <div>
          <Label>Notes (optional)</Label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Job description, requirements, benefits..."
          />
          <p className="text-right text-xs text-muted-foreground">{notes.length}/500</p>
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
          onClick={handleSubmit}
        >
          {loading ? 'Posting...' : 'Post Permanent Position'}
        </Button>
      </div>
    </div>
  );
}
