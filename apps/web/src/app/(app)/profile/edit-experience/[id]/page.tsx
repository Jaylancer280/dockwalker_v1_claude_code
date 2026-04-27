'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useLookups } from '@/hooks/use-lookups';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { ExperienceDetailsSection } from '../../_components/experience-details-section';
import { PrivateIntelligenceSection } from '../../_components/private-intelligence-section';

interface RoleItem {
  id: string;
  name: string;
  department: string;
}

interface FlagState {
  id: string;
  name: string;
}

export default function EditExperiencePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { showSuccess } = useToast();
  const roles = useLookups().roles as RoleItem[];
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vessel info (read-only)
  const [vesselName, setVesselName] = useState('');
  const [vesselType, setVesselType] = useState('motor');

  // Experience fields
  const [roleId, setRoleId] = useState('');
  const [expVesselOperation, setExpVesselOperation] = useState<'charter' | 'private'>('charter');
  const [flagState, setFlagState] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [contractType, setContractType] = useState('');
  const [contractDetails, setContractDetails] = useState('');
  const [description, setDescription] = useState('');

  const [referencesActiveCount, setReferencesActiveCount] = useState(0);

  // Private intelligence fields (write-only — GET never returns these)
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState<'daily' | 'monthly' | 'annually'>('monthly');
  const [salaryCurrency, setSalaryCurrency] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('dw-currency-pref')) || 'EUR',
  );
  const [seaTimeDays, setSeaTimeDays] = useState('');
  const [seaTimeNauticalMiles, setSeaTimeNauticalMiles] = useState('');

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const [flagsRes, expResult, profileRes] = await Promise.all([
        supabase.from('flag_states').select('id, name').order('sort_order'),
        safeFetch<{
          experiences?: {
            id: string;
            role_id: string;
            vessel_operation: string;
            flag_state: string;
            start_date: string;
            end_date: string;
            is_current: boolean;
            contract_type: string;
            contract_details: string;
            description: string;
            sea_time_days: number | null;
            sea_time_nautical_miles: number | null;
            salary_amount: number | null;
            salary_currency: string | null;
            salary_period: string | null;
            vessels: { name: string; vessel_type: string } | null;
            references_active_count?: number;
          }[];
        }>('/api/experiences'),
        safeFetch<{ person?: { identity_type?: string } }>('/api/profile'),
      ]);
      if (flagsRes.data) setFlagStates(flagsRes.data);
      if (profileRes.ok && profileRes.data.person?.identity_type === 'agent') {
        setIsAgent(true);
      }

      if (expResult.ok) {
        const exp = (expResult.data.experiences ?? []).find((e) => e.id === id);
        if (exp) {
          setRoleId(exp.role_id ?? '');
          setExpVesselOperation((exp.vessel_operation as 'charter' | 'private') ?? 'charter');
          setFlagState(exp.flag_state ?? '');
          setStartDate(exp.start_date ?? '');
          setEndDate(exp.end_date ?? '');
          setIsCurrent(exp.is_current ?? false);
          setContractType(exp.contract_type ?? '');
          setContractDetails(exp.contract_details ?? '');
          setDescription(exp.description ?? '');
          setSeaTimeDays(exp.sea_time_days != null ? String(exp.sea_time_days) : '');
          setSeaTimeNauticalMiles(
            exp.sea_time_nautical_miles != null ? String(exp.sea_time_nautical_miles) : '',
          );
          setSalaryAmount(exp.salary_amount != null ? String(exp.salary_amount) : '');
          if (exp.salary_currency) setSalaryCurrency(exp.salary_currency);
          if (exp.salary_period)
            setSalaryPeriod(exp.salary_period as 'daily' | 'monthly' | 'annually');
          if (exp.vessels) {
            setVesselName(exp.vessels.name ?? '');
            setVesselType(exp.vessels.vessel_type ?? 'motor');
          }
          setReferencesActiveCount(exp.references_active_count ?? 0);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit() {
    if (!roleId || !startDate) return;
    setSubmitting(true);
    setError(null);

    const result = await safeFetch<{ error?: string }>(`/api/experiences/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roleId,
        startDate,
        endDate: endDate || null,
        isCurrent,
        vesselOperation: expVesselOperation,
        flagState: flagState || null,
        salaryAmount: salaryAmount ? Number(salaryAmount) : null,
        salaryCurrency: salaryAmount ? salaryCurrency : null,
        salaryPeriod: salaryAmount ? salaryPeriod : null,
        seaTimeDays: seaTimeDays ? Number(seaTimeDays) : null,
        seaTimeNauticalMiles: seaTimeNauticalMiles ? Number(seaTimeNauticalMiles) : null,
        contractType: contractType || null,
        contractDetails: contractDetails || null,
        description: description || null,
      }),
    });

    if (result.ok) {
      showSuccess('Experience updated');
      router.push('/profile');
      router.refresh();
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const vesselPrefix = vesselType === 'sail' ? 'S/Y' : 'M/Y';

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="page-width flex items-center">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to profile
          </button>
        </div>
      </header>

      <div className="page-width flex w-full flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {isAgent ? 'Edit Maritime Background' : 'Edit experience'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {vesselPrefix} {vesselName || 'Unknown vessel'}
          </p>
        </div>

        {/* H-7 — edit-lock banner when active references exist */}
        {referencesActiveCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-medium">
              Some fields are locked because this experience has {referencesActiveCount} active
              reference{referencesActiveCount === 1 ? '' : 's'}.
            </p>
            <p className="mt-1 text-xs">
              Revoke references to change vessel, role, or dates.{' '}
              <a href="/settings/references" className="underline">
                Open Settings → References
              </a>
            </p>
          </div>
        )}

        <ExperienceDetailsSection
          roles={roles}
          roleId={roleId}
          setRoleId={setRoleId}
          expVesselOperation={expVesselOperation}
          setExpVesselOperation={setExpVesselOperation}
          flagStates={flagStates}
          flagState={flagState}
          setFlagState={setFlagState}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          isCurrent={isCurrent}
          setIsCurrent={setIsCurrent}
          isAgent={isAgent}
          contractType={contractType}
          setContractType={setContractType}
          contractDetails={contractDetails}
          setContractDetails={setContractDetails}
          description={description}
          setDescription={setDescription}
          snapshotLocked={referencesActiveCount > 0}
        />

        <PrivateIntelligenceSection
          salaryAmount={salaryAmount}
          setSalaryAmount={setSalaryAmount}
          salaryPeriod={salaryPeriod}
          setSalaryPeriod={setSalaryPeriod}
          salaryCurrency={salaryCurrency}
          setSalaryCurrency={setSalaryCurrency}
          seaTimeDays={seaTimeDays}
          setSeaTimeDays={setSeaTimeDays}
          seaTimeNauticalMiles={seaTimeNauticalMiles}
          setSeaTimeNauticalMiles={setSeaTimeNauticalMiles}
          extraNote="Previously entered data is stored securely and cannot be retrieved."
        />

        {/* Error */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !roleId || !startDate}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </main>
  );
}
