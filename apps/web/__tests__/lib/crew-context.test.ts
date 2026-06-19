import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCrewContext } from '@/lib/advisor/crew-context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockChain(data: unknown, error: unknown = null): any {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: Array.isArray(data) ? data : [], error }).then(resolve);
  return chain;
}

function multiTableFrom(tableMap: Record<string, ReturnType<typeof mockChain>>) {
  return vi.fn().mockImplementation((table: string) => tableMap[table] ?? mockChain(null));
}

const MOCK_PROFILE = {
  display_name: 'Jack',
  bio: 'Keen deckhand',
  shore_experience: null,
  motivation: 'Love the sea',
  languages: 'English, French',
  available_to_start: 'Immediate',
  primary_role_id: 'role-1',
  yacht_roles: { name: 'Deckhand' },
  certification_ids: ['cert-1', 'cert-2'],
  experience_bracket_id: 'eb-1',
  experience_brackets: { label: '6-12 months' },
  vessel_size_exposure_ids: ['sb-1', 'sb-2'],
  location_port_id: 'port-1',
  ports: {
    name: 'Port Vauban',
    cities: { name: 'Antibes', regions: { name: 'Western Mediterranean' } },
  },
};

const MOCK_EXPERIENCES = [
  {
    start_date: '2025-01-15',
    end_date: '2025-03-15',
    is_current: false,
    vessel_operation: 'charter',
    flag_state: 'Cayman Islands',
    contract_type: 'seasonal',
    description: 'Great season',
    vessels: {
      name: 'Example',
      vessel_type: 'motor',
      loa_meters: 45,
      vessel_size_bands: { label: '40-50m' },
    },
    yacht_roles: { name: 'Deckhand' },
  },
  {
    start_date: '2024-06-01',
    end_date: '2024-09-30',
    is_current: false,
    vessel_operation: 'private',
    flag_state: 'Marshall Islands',
    contract_type: 'rotational',
    description: null,
    vessels: {
      name: 'Sunrise',
      vessel_type: 'sail',
      loa_meters: 32,
      vessel_size_bands: { label: '30-40m' },
    },
    yacht_roles: { name: 'Junior Deckhand' },
  },
];

const MOCK_CERTS = [
  { id: 'cert-1', name: 'STCW Basic Safety', category: 'safety' },
  { id: 'cert-2', name: 'ENG1', category: 'medical' },
];

const MOCK_SIZE_BANDS = [
  { id: 'sb-1', label: '30-40m' },
  { id: 'sb-2', label: '40-50m' },
];

describe('buildCrewContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('builds correct markdown from profile with 2 experiences', async () => {
    const fromFn = multiTableFrom({
      profiles: mockChain(MOCK_PROFILE),
      crew_experiences: mockChain(MOCK_EXPERIENCES),
      certifications: mockChain(MOCK_CERTS),
      vessel_size_bands: mockChain(MOCK_SIZE_BANDS),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildCrewContext('u1', { from: fromFn } as any);

    expect(result.roleName).toBe('Deckhand');
    expect(result.certNames).toEqual(['STCW Basic Safety', 'ENG1']);
    expect(result.markdown).toContain('**Role:** Deckhand');
    expect(result.markdown).toContain('**Experience:** 6-12 months');
    expect(result.markdown).toContain('Antibes');
    expect(result.markdown).toContain('STCW Basic Safety, ENG1');
    expect(result.markdown).toContain('30-40m, 40-50m');
    expect(result.markdown).toContain('M/Y Example');
    expect(result.markdown).toContain('S/Y Sunrise');
    expect(result.markdown).toContain('Cayman Islands');
    expect(result.markdown).toContain('## Work History');
  });

  it('handles zero experiences (green crew)', async () => {
    const greenProfile = {
      ...MOCK_PROFILE,
      shore_experience: '2 years as bartender',
      certification_ids: [],
      vessel_size_exposure_ids: [],
    };

    const fromFn = multiTableFrom({
      profiles: mockChain(greenProfile),
      crew_experiences: mockChain([]),
      certifications: mockChain([]),
      vessel_size_bands: mockChain([]),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildCrewContext('u1', { from: fromFn } as any);

    expect(result.markdown).toContain('**Shore Experience:** 2 years as bartender');
    expect(result.markdown).toContain('No work history recorded');
    expect(result.markdown).not.toContain('## Work History');
  });

  it('handles missing optional fields', async () => {
    const minimalProfile = {
      ...MOCK_PROFILE,
      bio: null,
      motivation: null,
      languages: null,
      shore_experience: null,
      available_to_start: null,
    };

    const fromFn = multiTableFrom({
      profiles: mockChain(minimalProfile),
      crew_experiences: mockChain([]),
      certifications: mockChain(MOCK_CERTS),
      vessel_size_bands: mockChain(MOCK_SIZE_BANDS),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildCrewContext('u1', { from: fromFn } as any);

    expect(result.markdown).not.toContain('**Bio:**');
    expect(result.markdown).not.toContain('**Languages:**');
    expect(result.markdown).not.toContain('**Motivation:**');
    expect(result.markdown).not.toContain('**Available:**');
    expect(result.roleName).toBe('Deckhand');
  });

  it('never includes salary data', async () => {
    const expWithSalary = [
      {
        ...MOCK_EXPERIENCES[0],
        salary_amount: 3000,
        salary_currency: 'EUR',
        salary_period: 'monthly',
      },
    ];

    const fromFn = multiTableFrom({
      profiles: mockChain(MOCK_PROFILE),
      crew_experiences: mockChain(expWithSalary),
      certifications: mockChain(MOCK_CERTS),
      vessel_size_bands: mockChain(MOCK_SIZE_BANDS),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await buildCrewContext('u1', { from: fromFn } as any);

    const lower = result.markdown.toLowerCase();
    expect(lower).not.toContain('salary');
    expect(lower).not.toContain('3000');
  });
});
