import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  VesselExperienceStep,
  type VesselExperienceEntry,
} from '@/app/onboarding/_components/vessel-experience-step';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-preferences', () => ({
  usePreferences: () => ({ distanceUnit: 'km', lengthUnit: 'm', currency: 'EUR' }),
}));

vi.mock('@/lib/safe-fetch', () => ({
  safeFetch: vi.fn().mockResolvedValue({ ok: true, data: { results: [] }, status: 200 }),
}));

function makeEntry(overrides?: Partial<VesselExperienceEntry['experience']>): VesselExperienceEntry {
  return {
    key: 'test-1',
    vessel: {
      imoNumber: '1234567',
      name: 'Test Yacht',
      vesselType: 'motor',
      loaMeters: '45',
      useExisting: false,
    },
    experience: {
      roleId: 'role-1',
      startDate: '2024-01-01',
      endDate: '2024-06-01',
      isCurrent: false,
      vesselOperation: 'charter',
      flagState: '',
      salaryAmount: '',
      salaryCurrency: '',
      salaryPeriod: '',
      contractType: '',
      contractDetails: '',
      description: '',
      seaTimeDays: '',
      seaTimeNauticalMiles: '',
      ...overrides,
    },
  };
}

const baseProps = {
  experienceEntries: [makeEntry()],
  setExperienceEntries: vi.fn(),
  error: null,
  roles: [{ id: 'role-1', name: 'Deckhand', department: 'deck' }],
  flagStates: [{ id: 'flag-1', name: 'United Kingdom' }],
  sizeBands: [{ id: 'sb-1', label: '24-30m', min_meters: 24, max_meters: 30 }],
  updateEntry: vi.fn(),
  removeEntry: vi.fn(),
  addEntry: vi.fn(),
  onBack: vi.fn(),
  onNext: vi.fn(),
  setError: vi.fn(),
};

describe('VesselExperienceStep — onboarding alignment', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders salary section with Salary label', () => {
    render(<VesselExperienceStep {...baseProps} />);

    expect(screen.getByText('Salary')).toBeInTheDocument();
  });

  it('renders sea time fields (days at sea + nautical miles)', () => {
    render(<VesselExperienceStep {...baseProps} />);

    expect(screen.getByText('Verified sea time')).toBeInTheDocument();
    expect(screen.getByText('Days at sea')).toBeInTheDocument();
    expect(screen.getByText('Nautical miles')).toBeInTheDocument();
  });

  it('renders private intelligence section header', () => {
    render(<VesselExperienceStep {...baseProps} />);

    expect(screen.getByText('Private intelligence (optional)')).toBeInTheDocument();
  });

  it('renders vessel operation label as "Vessel operation (during your time)"', () => {
    render(<VesselExperienceStep {...baseProps} />);

    expect(screen.getByText('Vessel operation (during your time)')).toBeInTheDocument();
  });

  it('renders "Currently onboard" checkbox', () => {
    render(<VesselExperienceStep {...baseProps} />);

    expect(screen.getByText('Currently onboard')).toBeInTheDocument();
  });

  it('uses shared ImoLookupSection (renders IMO input with 4-7 digits placeholder)', () => {
    render(<VesselExperienceStep {...baseProps} />);

    expect(screen.getByPlaceholderText('4-7 digits')).toBeInTheDocument();
  });

  it('renders description textarea with matching label', () => {
    render(<VesselExperienceStep {...baseProps} />);

    expect(screen.getByText('Description (optional)')).toBeInTheDocument();
  });
});
