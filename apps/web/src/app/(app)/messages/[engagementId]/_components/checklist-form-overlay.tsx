'use client';

import { useState } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';

interface ChecklistItem {
  id: string;
  label: string;
  value: string;
}

interface FormState {
  arrival_time: string;
  meeting_point: string;
  contact_person: string;
  access_instructions: string;
  parking_notes: string;
  documents_passport: boolean;
  documents_seafarer_book: boolean;
  documents_certificates: boolean;
  documents_work_permit: boolean;
  uniform_dress_code: string;
  bring_tools: boolean;
  tools_details: string;
  ppe_provided: boolean;
  drug_alcohol_testing: boolean;
  nda_required: boolean;
  no_phones_on_deck: boolean;
  safety_briefing_time: string;
  additional_notes: string;
}

const INITIAL_STATE: FormState = {
  arrival_time: '',
  meeting_point: '',
  contact_person: '',
  access_instructions: '',
  parking_notes: '',
  documents_passport: false,
  documents_seafarer_book: false,
  documents_certificates: false,
  documents_work_permit: false,
  uniform_dress_code: '',
  bring_tools: false,
  tools_details: '',
  ppe_provided: false,
  drug_alcohol_testing: false,
  nda_required: false,
  no_phones_on_deck: false,
  safety_briefing_time: '',
  additional_notes: '',
};

function formToItems(state: FormState): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  if (state.arrival_time) {
    items.push({ id: 'arrival_time', label: 'Arrival time', value: state.arrival_time });
  }
  if (state.meeting_point.trim()) {
    items.push({ id: 'meeting_point', label: 'Meeting point', value: state.meeting_point.trim() });
  }
  if (state.contact_person.trim()) {
    items.push({
      id: 'contact_person',
      label: 'Contact on arrival',
      value: state.contact_person.trim(),
    });
  }
  if (state.access_instructions.trim()) {
    items.push({
      id: 'access_instructions',
      label: 'Access / security instructions',
      value: state.access_instructions.trim(),
    });
  }
  if (state.parking_notes.trim()) {
    items.push({ id: 'parking_notes', label: 'Parking', value: state.parking_notes.trim() });
  }

  const docs: string[] = [];
  if (state.documents_passport) docs.push('Passport / ID');
  if (state.documents_seafarer_book) docs.push("Seafarer's book");
  if (state.documents_certificates) docs.push('Relevant certificates');
  if (state.documents_work_permit) docs.push('Work permit / visa');
  if (docs.length > 0) {
    items.push({ id: 'documents', label: 'Documents to bring', value: docs.join(', ') });
  }

  if (state.uniform_dress_code.trim()) {
    items.push({
      id: 'uniform_dress_code',
      label: 'Uniform / dress code',
      value: state.uniform_dress_code.trim(),
    });
  }
  if (state.bring_tools) {
    items.push({
      id: 'bring_tools',
      label: 'Bring own tools',
      value: state.tools_details.trim() || 'Yes',
    });
  }
  if (state.ppe_provided) {
    items.push({ id: 'ppe_provided', label: 'PPE provided on board', value: 'Yes' });
  }
  if (state.drug_alcohol_testing) {
    items.push({
      id: 'drug_alcohol_testing',
      label: 'Drug & alcohol testing on arrival',
      value: 'Yes',
    });
  }
  if (state.nda_required) {
    items.push({ id: 'nda_required', label: 'NDA signing required', value: 'Yes' });
  }
  if (state.no_phones_on_deck) {
    items.push({ id: 'no_phones_on_deck', label: 'No personal phones on deck', value: 'Yes' });
  }
  if (state.safety_briefing_time.trim()) {
    items.push({
      id: 'safety_briefing_time',
      label: 'Safety briefing time',
      value: state.safety_briefing_time.trim(),
    });
  }
  if (state.additional_notes.trim()) {
    items.push({
      id: 'additional_notes',
      label: 'Additional notes',
      value: state.additional_notes.trim(),
    });
  }

  return items;
}

function itemsToForm(items: ChecklistItem[]): FormState {
  const state = { ...INITIAL_STATE };
  const byId = new Map(items.map((i) => [i.id, i.value]));

  state.arrival_time = byId.get('arrival_time') ?? '';
  state.meeting_point = byId.get('meeting_point') ?? '';
  state.contact_person = byId.get('contact_person') ?? '';
  state.access_instructions = byId.get('access_instructions') ?? '';
  state.parking_notes = byId.get('parking_notes') ?? '';

  const docs = byId.get('documents') ?? '';
  state.documents_passport = docs.includes('Passport');
  state.documents_seafarer_book = docs.includes('Seafarer');
  state.documents_certificates = docs.includes('certificate');
  state.documents_work_permit = docs.includes('Work permit');

  state.uniform_dress_code = byId.get('uniform_dress_code') ?? '';

  if (byId.has('bring_tools')) {
    state.bring_tools = true;
    const v = byId.get('bring_tools') ?? '';
    state.tools_details = v === 'Yes' ? '' : v;
  }

  state.ppe_provided = byId.has('ppe_provided');
  state.drug_alcohol_testing = byId.has('drug_alcohol_testing');
  state.nda_required = byId.has('nda_required');
  state.no_phones_on_deck = byId.has('no_phones_on_deck');
  state.safety_briefing_time = byId.get('safety_briefing_time') ?? '';
  state.additional_notes = byId.get('additional_notes') ?? '';

  return state;
}

export function ChecklistFormOverlay({
  existingItems,
  onSubmit,
  onCancel,
}: {
  existingItems: ChecklistItem[] | null;
  onSubmit: (items: ChecklistItem[]) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    existingItems ? itemsToForm(existingItems) : INITIAL_STATE,
  );
  const [submitting, setSubmitting] = useState(false);

  const items = formToItems(form);
  const isValid = items.length > 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    await onSubmit(items);
    setSubmitting(false);
  }

  return (
    <BottomSheet open={true} onClose={onCancel} title="Pre-arrival checklist">
      <div className="flex flex-col gap-4">
        {/* Arrival logistics */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Arrival logistics
          </p>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              Arrival time
              <input
                type="time"
                value={form.arrival_time}
                onChange={(e) => update('arrival_time', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
            <label className="text-sm font-medium">
              Meeting point
              <input
                type="text"
                value={form.meeting_point}
                onChange={(e) => update('meeting_point', e.target.value)}
                placeholder="e.g. Starboard gangway, berth 14"
                className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                maxLength={200}
              />
            </label>
            <label className="text-sm font-medium">
              Contact on arrival
              <input
                type="text"
                value={form.contact_person}
                onChange={(e) => update('contact_person', e.target.value)}
                placeholder="Name + phone number"
                className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                maxLength={200}
              />
            </label>
            <label className="text-sm font-medium">
              Access / security instructions
              <textarea
                value={form.access_instructions}
                onChange={(e) => update('access_instructions', e.target.value)}
                placeholder="Gate codes, marina access, security check-in..."
                className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                rows={2}
                maxLength={500}
              />
            </label>
            <label className="text-sm font-medium">
              Parking notes
              <input
                type="text"
                value={form.parking_notes}
                onChange={(e) => update('parking_notes', e.target.value)}
                placeholder="Optional"
                className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                maxLength={200}
              />
            </label>
          </div>
        </section>

        {/* Documents */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Documents to bring
          </p>
          <div className="flex flex-col gap-1.5">
            {(
              [
                ['documents_passport', 'Passport / ID'],
                ['documents_seafarer_book', "Seafarer's book"],
                ['documents_certificates', 'Relevant certificates'],
                ['documents_work_permit', 'Work permit / visa'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => update(key, e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        {/* Requirements */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Requirements
          </p>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              Uniform / dress code
              <input
                type="text"
                value={form.uniform_dress_code}
                onChange={(e) => update('uniform_dress_code', e.target.value)}
                placeholder="e.g. Whites, steel-toe boots, smart casual"
                className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                maxLength={200}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.bring_tools}
                onChange={(e) => update('bring_tools', e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Crew should bring own tools
            </label>
            {form.bring_tools && (
              <input
                type="text"
                value={form.tools_details}
                onChange={(e) => update('tools_details', e.target.value)}
                placeholder="Specify which tools (optional)"
                className="ml-6 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                maxLength={300}
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ppe_provided}
                onChange={(e) => update('ppe_provided', e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              PPE provided on board
            </label>
          </div>
        </section>

        {/* Vessel policies */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vessel policies
          </p>
          <div className="flex flex-col gap-1.5">
            {(
              [
                ['drug_alcohol_testing', 'Drug & alcohol testing on arrival'],
                ['nda_required', 'NDA signing required'],
                ['no_phones_on_deck', 'No personal phones on deck'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => update(key, e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {label}
              </label>
            ))}
            <label className="mt-1 text-sm font-medium">
              Safety briefing time
              <input
                type="text"
                value={form.safety_briefing_time}
                onChange={(e) => update('safety_briefing_time', e.target.value)}
                placeholder="If different from arrival time"
                className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
                maxLength={100}
              />
            </label>
          </div>
        </section>

        {/* Additional notes */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Additional notes
          </p>
          <textarea
            value={form.additional_notes}
            onChange={(e) => update('additional_notes', e.target.value)}
            placeholder="Anything else the crew should know before arrival"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            rows={2}
            maxLength={500}
          />
        </section>
      </div>

      <div className="border-t border-border px-4 py-3">
        <Button className="w-full" disabled={!isValid || submitting} onClick={handleSubmit}>
          {submitting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ClipboardList className="mr-1.5 h-4 w-4" />
          )}
          {existingItems ? 'Update checklist' : 'Set checklist'}
        </Button>
      </div>
    </BottomSheet>
  );
}
