'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
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
  const [roles, setRoles] = useState<RoleItem[]>([]);
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
      const [rolesRes, flagsRes, expResult, profileRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
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
            vessels: { name: string; vessel_type: string } | null;
          }[];
        }>('/api/experiences'),
        safeFetch<{ person?: { identity_type?: string } }>('/api/profile'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data as RoleItem[]);
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
          if (exp.vessels) {
            setVesselName(exp.vessels.name ?? '');
            setVesselType(exp.vessels.vessel_type ?? 'motor');
          }
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
        <div className="mx-auto flex max-w-lg items-center">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to profile
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {isAgent ? 'Edit Maritime Background' : 'Edit experience'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {vesselPrefix} {vesselName || 'Unknown vessel'}
          </p>
        </div>

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
