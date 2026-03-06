'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { VesselSelector } from '@/components/vessels/vessel-selector';
import { createClient } from '@/lib/supabase/client';

interface LookupItem {
  id: string;
  name: string;
  label?: string;
  department?: string;
  category?: string;
}

interface PortItem {
  id: string;
  name: string;
  cities: { name: string; regions: { name: string } };
}

interface Template {
  id: string;
  name: string;
  vessel_id: string | null;
  role_id: string | null;
  location_port_id: string | null;
  working_days: number | null;
  required_certification_ids: string[];
  experience_bracket_id: string | null;
  day_rate: number | null;
  meals: string[];
  notes: string | null;
}

type MealOption = 'breakfast' | 'lunch' | 'dinner';

export default function PostDayworkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [vesselId, setVesselId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [locationPortId, setLocationPortId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workingDays, setWorkingDays] = useState('');
  const [requiredCertIds, setRequiredCertIds] = useState<string[]>([]);
  const [experienceBracketId, setExperienceBracketId] = useState('');
  const [dayRate, setDayRate] = useState('');
  const [meals, setMeals] = useState<MealOption[]>([]);
  const [notes, setNotes] = useState('');

  // Lookups
  const [roles, setRoles] = useState<LookupItem[]>([]);
  const [certs, setCerts] = useState<LookupItem[]>([]);
  const [brackets, setBrackets] = useState<LookupItem[]>([]);
  const [ports, setPorts] = useState<PortItem[]>([]);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  function applyTemplate(t: Template) {
    if (t.vessel_id) setVesselId(t.vessel_id);
    if (t.role_id) setRoleId(t.role_id);
    if (t.location_port_id) setLocationPortId(t.location_port_id);
    if (t.working_days) setWorkingDays(String(t.working_days));
    if (t.required_certification_ids?.length) setRequiredCertIds(t.required_certification_ids);
    if (t.experience_bracket_id) setExperienceBracketId(t.experience_bracket_id);
    if (t.day_rate) setDayRate(String(t.day_rate));
    if (t.meals?.length) setMeals(t.meals as MealOption[]);
    if (t.notes) setNotes(t.notes);
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [rolesRes, certsRes, bracketsRes, portsRes, templatesRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase.from('certifications').select('id, name, category').order('sort_order'),
        supabase.from('experience_brackets').select('id, label').order('sort_order'),
        supabase.from('ports').select('id, name, cities(name, regions(name))').order('name'),
        fetch('/api/daywork/templates').then((r) => r.json()),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data);
      if (certsRes.data) setCerts(certsRes.data);
      if (bracketsRes.data) setBrackets(bracketsRes.data.map((b) => ({ ...b, name: b.label })));
      if (portsRes.data) setPorts(portsRes.data as unknown as PortItem[]);
      if (templatesRes.templates) setTemplates(templatesRes.templates);

      // Load template from search param
      const templateId = searchParams.get('templateId');
      if (templateId) {
        const res = await fetch(`/api/daywork/templates/${templateId}`);
        const data = await res.json();
        if (data.template) applyTemplate(data.template);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLoadTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (t) applyTemplate(t);
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

    const res = await fetch('/api/daywork/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateName.trim(),
        vesselId: vesselId || null,
        roleId: roleId || null,
        locationPortId: locationPortId || null,
        workingDays: workingDays ? parseInt(workingDays, 10) : null,
        requiredCertificationIds: requiredCertIds,
        experienceBracketId: experienceBracketId || null,
        dayRate: dayRate || null,
        meals,
        notes: notes || null,
      }),
    });

    if (res.ok) {
      setSaveDialogOpen(false);
      setTemplateName('');
      const templatesRes = await fetch('/api/daywork/templates').then((r) => r.json());
      if (templatesRes.templates) setTemplates(templatesRes.templates);
    }
    setSavingTemplate(false);
  }

  function openSaveDialog() {
    const roleName = roles.find((r) => r.id === roleId)?.name;
    const portName = ports.find((p) => p.id === locationPortId)?.name;
    setTemplateName([roleName, portName].filter(Boolean).join(' — ') || '');
    setSaveDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!vesselId) {
      setError('Please select a vessel');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/daywork', {
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
        experienceBracketId: experienceBracketId || undefined,
        dayRate: dayRate || undefined,
        meals,
        notes: notes || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push('/daywork/mine');
  }

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/daywork/mine" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight">Post daywork</h1>
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
            <Select onValueChange={handleLoadTemplate}>
              <SelectTrigger>
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
          </div>
        )}

        {/* Vessel */}
        <div className="flex flex-col gap-1.5">
          <Label>Vessel</Label>
          <VesselSelector
            value={vesselId}
            onValueChange={setVesselId}
            onRequestCreate={() => router.push('/vessels')}
          />
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1.5">
          <Label>Role needed</Label>
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
          <Select value={locationPortId} onValueChange={setLocationPortId} required>
            <SelectTrigger>
              <SelectValue placeholder="Select port/marina" />
            </SelectTrigger>
            <SelectContent>
              {ports.map((port) => (
                <SelectItem key={port.id} value={port.id}>
                  {port.name} — {port.cities?.name}, {port.cities?.regions?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
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
            max="14"
            placeholder="1-14"
            value={workingDays}
            onChange={(e) => setWorkingDays(e.target.value)}
            required
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

        {/* Day rate */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dayRate">Day rate (optional)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              &euro;
            </span>
            <Input
              id="dayRate"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 250"
              className="pl-7"
              value={dayRate}
              onChange={(e) => setDayRate(e.target.value)}
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
