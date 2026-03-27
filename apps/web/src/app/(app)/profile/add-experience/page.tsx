'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { safeFetch } from '@/lib/safe-fetch';
import { useToast } from '@/hooks/use-toast';
import { usePreferences } from '@/hooks/use-preferences';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { ImoLookupSection } from '@/components/vessels/imo-lookup-section';
import { VesselDetailsSection } from '../_components/vessel-details-section';
import { ExperienceDetailsSection } from '../_components/experience-details-section';
import { PrivateIntelligenceSection } from '../_components/private-intelligence-section';

interface RoleItem {
  id: string;
  name: string;
  department: string;
}

interface FlagState {
  id: string;
  name: string;
}

interface SizeBand {
  id: string;
  label: string;
  min_meters: number;
  max_meters: number | null;
}

export default function AddExperiencePage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const { lengthUnit } = usePreferences();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [flagStates, setFlagStates] = useState<FlagState[]>([]);
  const [sizeBands, setSizeBands] = useState<SizeBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // IMO lookup
  const [imoNumber, setImoNumber] = useState('');
  const [useExisting, setUseExisting] = useState(false);
  const [existingVesselId, setExistingVesselId] = useState('');

  // Vessel fields
  const [vesselName, setVesselName] = useState('');
  const [vesselType, setVesselType] = useState<'motor' | 'sail'>('motor');
  const [loaMeters, setLoaMeters] = useState('');

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

  // Private intelligence fields
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState<'daily' | 'monthly' | 'annually'>('monthly');
  const [salaryCurrency, setSalaryCurrency] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('dw-currency-pref')) || 'EUR',
  );
  const [seaTimeDays, setSeaTimeDays] = useState('');
  const [seaTimeNauticalMiles, setSeaTimeNauticalMiles] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const supabase = createClient();
      const [rolesRes, flagsRes, bandsRes, profileRes] = await Promise.all([
        supabase.from('yacht_roles').select('id, name, department').order('sort_order'),
        supabase.from('flag_states').select('id, name').order('sort_order'),
        supabase
          .from('vessel_size_bands')
          .select('id, label, min_meters, max_meters')
          .order('sort_order'),
        safeFetch<{ person?: { identity_type?: string } }>('/api/profile'),
      ]);
      if (rolesRes.data) setRoles(rolesRes.data as RoleItem[]);
      if (flagsRes.data) setFlagStates(flagsRes.data);
      if (bandsRes.data) setSizeBands(bandsRes.data);
      if (profileRes.ok && profileRes.data.person?.identity_type === 'agent') {
        setIsAgent(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  async function handleSubmit() {
    if (!roleId || !startDate || !expVesselOperation || !imoNumber) return;
    setSubmitting(true);

    let vesselId = existingVesselId;

    // Create vessel if not using existing
    if (!useExisting) {
      if (!vesselName || !loaMeters) {
        setSubmitting(false);
        return;
      }
      const vesselResult = await safeFetch<{ id: string }>('/api/vessels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imoNumber,
          name: vesselName,
          vesselType,
          loaMeters:
            Math.round(
              (lengthUnit === 'ft' ? Number(loaMeters) / 3.28084 : Number(loaMeters)) * 100,
            ) / 100,
          ndaFlag: false,
        }),
      });
      if (!vesselResult.ok) {
        showError(vesselResult.error);
        setSubmitting(false);
        return;
      }
      vesselId = vesselResult.data.id;
    }

    const result = await safeFetch('/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vesselId,
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
      showSuccess('Experience added');
      router.push('/profile');
      router.refresh();
    } else {
      showError(result.error);
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
            {isAgent ? 'Add Maritime Background' : 'Add experience'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Add a vessel experience entry to your profile
          </p>
        </div>

        <ImoLookupSection
          imoNumber={imoNumber}
          setImoNumber={setImoNumber}
          useExisting={useExisting}
          setUseExisting={setUseExisting}
          existingVesselId={existingVesselId}
          setExistingVesselId={setExistingVesselId}
          vesselName={vesselName}
          setVesselName={setVesselName}
          vesselType={vesselType}
          setVesselType={setVesselType}
          loaMeters={loaMeters}
          setLoaMeters={setLoaMeters}
        />

        {/* Vessel details — shown when not using existing vessel */}
        {!useExisting && (
          <VesselDetailsSection
            vesselType={vesselType}
            setVesselType={setVesselType}
            vesselName={vesselName}
            setVesselName={setVesselName}
            loaMeters={loaMeters}
            setLoaMeters={setLoaMeters}
            lengthUnit={lengthUnit as 'm' | 'ft'}
            sizeBands={sizeBands}
          />
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
        />

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !roleId || !startDate || !imoNumber}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Add experience'
          )}
        </Button>
      </div>
    </main>
  );
}
