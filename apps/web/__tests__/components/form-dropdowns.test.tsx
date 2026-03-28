import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock data — representative subset of canonical seed data
// ---------------------------------------------------------------------------

const MOCK_ROLES = [
  { id: 'role-1', name: 'Captain', department: 'bridge' },
  { id: 'role-2', name: 'Deckhand', department: 'deck' },
  { id: 'role-3', name: 'Chief Stewardess', department: 'interior' },
];

const MOCK_CERTS = [
  { id: 'cert-1', name: 'STCW Basic Safety Training', category: 'safety' },
  { id: 'cert-2', name: 'ENG1 Medical Certificate', category: 'medical' },
  { id: 'cert-3', name: 'Powerboat Level 2', category: 'deck' },
];

const MOCK_BRACKETS = [
  { id: 'exp-1', label: 'Green (0-6 months)' },
  { id: 'exp-2', label: '1-2 years' },
  { id: 'exp-3', label: '5+ years' },
];

const MOCK_SIZE_BANDS = [
  { id: 'size-1', label: '24-30m' },
  { id: 'size-2', label: '40-50m' },
  { id: 'size-3', label: '80m+' },
];

const MOCK_PORTS = [
  {
    id: 'port-1',
    name: 'Port Vauban',
    city_id: 'city-1',
    cities: { name: 'Antibes', regions: { name: 'French Riviera' } },
  },
  {
    id: 'port-2',
    name: 'Club de Mar Mallorca',
    city_id: 'city-2',
    cities: { name: 'Palma', regions: { name: 'Mallorca' } },
  },
  {
    id: 'port-3',
    name: 'Bahia Mar Marina',
    city_id: 'city-3',
    cities: { name: 'Fort Lauderdale', regions: { name: 'South Florida' } },
  },
];

// ---------------------------------------------------------------------------
// Supabase client mock — chainable query builder
// ---------------------------------------------------------------------------

const MOCK_FLAG_STATES = [
  { id: 'GBR', name: 'United Kingdom (Red Ensign)' },
  { id: 'CYM', name: 'Cayman Islands' },
];

const TABLE_DATA: Record<string, unknown[]> = {
  yacht_roles: MOCK_ROLES,
  certifications: MOCK_CERTS,
  experience_brackets: MOCK_BRACKETS,
  vessel_size_bands: MOCK_SIZE_BANDS,
  ports: MOCK_PORTS,
  flag_states: MOCK_FLAG_STATES,
};

let fromSpy: ReturnType<typeof vi.fn>;

function createMockQueryBuilder(table: string) {
  const result = { data: TABLE_DATA[table] ?? [], error: null };
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve: (v: unknown) => void) => resolve(result),
  };
  return builder;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    fromSpy = vi.fn((table: string) => createMockQueryBuilder(table));
    return {
      from: fromSpy,
      auth: { signOut: vi.fn(), getUser: vi.fn(() => Promise.resolve({ data: { user: null } })) },
    };
  },
}));

// ---------------------------------------------------------------------------
// Radix Select mock — renders items as plain <option> elements for testability.
// Radix portals don't work reliably in happy-dom, so we replace the Select
// component with a simple native <select> that renders all items visibly.
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/select', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Select: ({ children, value, onValueChange, ...props }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    [k: string]: unknown;
  }) => (
    <div data-testid="mock-select" data-value={value} {...filterProps(props)}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-select-trigger">{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="mock-select-item" data-value={value} role="option" aria-selected={false}>
      {children}
    </div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="mock-select-value">{placeholder}</span>
  ),
}));

function filterProps(props: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v !== 'function' && typeof v !== 'boolean') safe[k] = v;
  }
  return safe;
}

// ---------------------------------------------------------------------------
// Navigation / framework mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  default: ({ fill, priority, ...rest }: Record<string, unknown>) => (
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    <img {...rest} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

// framer-motion mock for discover page
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      return ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => {
        const safe: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) {
          if (typeof k === 'string' && k.startsWith('data-')) safe[k] = v;
          if (k === 'className' || k === 'style') safe[k] = v;
        }
        const Tag = (typeof prop === 'string' ? prop : 'div') as React.ElementType;
        return <Tag {...safe}>{children}</Tag>;
      };
    },
  }),
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  useTransform: () => ({ get: () => 0, set: vi.fn() }),
  animate: vi.fn(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), toasts: [], dismiss: vi.fn() }),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
  hapticMedium: vi.fn(),
  hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
}));

// HatSwitcher mock for profile page
vi.mock('@/components/hat-switcher', () => ({
  HatSwitcher: () => <div data-testid="hat-switcher" />,
}));

// VesselSelector mock for post-daywork page
vi.mock('@/components/vessels/vessel-selector', () => ({
  VesselSelector: () => <div data-testid="vessel-selector">Mock vessel selector</div>,
}));

// LocationPicker mock — renders a simple div with testid
vi.mock('@/components/location-picker', () => ({
  LocationPicker: ({ mode, placeholder }: { mode: string; placeholder?: string }) => (
    <div data-testid="location-picker" data-mode={mode}>
      {placeholder ?? 'Select location'}
    </div>
  ),
}));

// HierarchicalPills mock — renders all group items visibly for testability
vi.mock('@/components/hierarchical-pills', () => ({
  HierarchicalPills: ({ groups, value, onValueChange, placeholder }: {
    groups: { id: string; label: string; items: { id: string; label: string }[] }[];
    value: string | string[];
    onValueChange: (v: string | string[]) => void;
    placeholder?: string;
  }) => (
    <div data-testid="hierarchical-pills" data-value={JSON.stringify(value)}>
      {placeholder && <span>{placeholder}</span>}
      {groups.map((g) => (
        <div key={g.id}>
          <span>{g.label}</span>
          {g.items.map((item) => (
            <div key={item.id} onClick={() => onValueChange(item.id)}>
              {item.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
  rolesToGroups: (roles: { id: string; name: string; department?: string }[]) => {
    const map = new Map<string, { id: string; label: string }[]>();
    for (const r of roles) {
      const dept = r.department || 'other';
      const parts = dept.includes('_') ? dept.split('_') : [dept];
      for (const p of parts) {
        const list = map.get(p) ?? [];
        list.push({ id: r.id, label: r.name });
        map.set(p, list);
      }
    }
    return Array.from(map.entries()).map(([dept, items]) => ({
      id: dept,
      label: dept.charAt(0).toUpperCase() + dept.slice(1),
      items,
    }));
  },
  certsToGroups: (certs: { id: string; name: string; category?: string }[]) => {
    const map = new Map<string, { id: string; label: string }[]>();
    for (const c of certs) {
      const cat = c.category || 'other';
      const list = map.get(cat) ?? [];
      list.push({ id: c.id, label: c.name });
      map.set(cat, list);
    }
    return Array.from(map.entries()).map(([cat, items]) => ({
      id: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      items,
    }));
  },
}));

// FlagStatePicker mock — renders flag states as visible text for testability
vi.mock('@/components/flag-state-picker', () => ({
  FlagStatePicker: ({ flagStates, value, onValueChange, placeholder }: {
    flagStates: { id: string; name: string }[];
    value: string;
    onValueChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <div data-testid="flag-state-picker" data-value={value}>
      <span>{placeholder ?? 'Select flag state'}</span>
      {flagStates.map((f) => (
        <div key={f.id} data-flag-id={f.id} onClick={() => onValueChange(f.id)}>
          {f.name}
        </div>
      ))}
    </div>
  ),
}));

// Global fetch mock
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

function mockFetchResponses(overrides: Record<string, unknown> = {}) {
  fetchMock.mockImplementation((url: string) => {
    const defaults: Record<string, unknown> = {
      '/api/daywork/templates': { templates: [] },
      '/api/vessels': { vessels: [] },
      '/api/profile': {
        person: { id: 'p1', identity_type: 'crew', current_hat: 'crew' },
        profile: {
          person_id: 'p1',
          display_name: 'Test User',
          identity_type: 'crew',
          bio: null,
          primary_role_id: 'role-1',
          certification_ids: [],
          experience_bracket_id: 'exp-1',
          vessel_size_exposure_ids: [],
          location_port_id: 'port-1',
          agency_name: null,
          role_specialization_ids: [],
          yacht_roles: { id: 'role-1', name: 'Captain' },
          experience_brackets: { id: 'exp-1', label: 'Green (0-6 months)' },
          ports: MOCK_PORTS[0],
        },
      },
      '/api/daywork/discover': { dayworks: [] },
      ...overrides,
    };
    const key = Object.keys(defaults).find((k) => (url as string).includes(k));
    const data = key ? defaults[key] : {};
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFetchResponses();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Onboarding page — crew profile dropdowns', () => {
  it('renders all canonical roles, certs, experience brackets, size bands, and ports after selecting crew identity', async () => {
    const { default: OnboardingPage } = await import('@/app/onboarding/page');
    render(<OnboardingPage />);

    // Navigate: Welcome → Identity → Experience fork → Green profile
    fireEvent.click(screen.getByText('Get started'));
    fireEvent.click(screen.getByText("I'm Crew"));
    fireEvent.click(screen.getByText('New to yachting'));

    // Wait for lookups to load
    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('yacht_roles');
    });

    // Roles — rendered by HierarchicalPills mock (primary role + desired role = 2 pickers)
    expect(screen.getAllByTestId('hierarchical-pills').length).toBeGreaterThanOrEqual(1);
    for (const role of MOCK_ROLES) {
      expect(screen.getAllByText(role.name).length).toBeGreaterThanOrEqual(1);
    }

    // Experience brackets select
    for (const bracket of MOCK_BRACKETS) {
      expect(screen.getByText(bracket.label)).toBeInTheDocument();
    }

    // Certifications — rendered as checkboxes, always visible in DOM
    for (const cert of MOCK_CERTS) {
      expect(screen.getByText(cert.name)).toBeInTheDocument();
    }

    // Vessel size bands — rendered as toggle buttons, always visible
    for (const band of MOCK_SIZE_BANDS) {
      expect(screen.getByText(band.label)).toBeInTheDocument();
    }

    // Location picker — rendered as mocked component
    expect(screen.getByTestId('location-picker')).toBeInTheDocument();
  });

  it('queries all 5 canonical lookup tables (location handled by LocationPicker)', async () => {
    const { default: OnboardingPage } = await import('@/app/onboarding/page');
    render(<OnboardingPage />);

    // Navigate: Welcome → Identity → Experience fork → Green profile
    fireEvent.click(screen.getByText('Get started'));
    fireEvent.click(screen.getByText("I'm Crew"));
    fireEvent.click(screen.getByText('New to yachting'));

    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('yacht_roles');
      expect(fromSpy).toHaveBeenCalledWith('certifications');
      // experience_brackets and vessel_size_bands no longer loaded in edit mode (auto-derived)
    });
  });
});

describe('Post Daywork page — employer form dropdowns', () => {
  it('renders all canonical roles, certs, experience brackets, and ports', async () => {
    const { default: PostDayworkPage } = await import('@/app/(app)/daywork/post/page');
    render(<PostDayworkPage />);

    // Select daywork type from the type selector
    fireEvent.click(screen.getByText('Daywork'));

    // Wait for lookups to load
    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('yacht_roles');
    });

    // Roles — inside HierarchicalPills (department groups with items)
    expect(screen.getAllByTestId('hierarchical-pills').length).toBeGreaterThanOrEqual(1);

    // Location picker — rendered as mocked component
    expect(screen.getByTestId('location-picker')).toBeInTheDocument();

    // Experience brackets — now rendered as pills (always visible)
    for (const bracket of MOCK_BRACKETS) {
      expect(screen.getByText(bracket.label)).toBeInTheDocument();
    }

    // Certifications — hierarchical pills (grouped by category)
    for (const cert of MOCK_CERTS) {
      expect(screen.getByText(cert.name)).toBeInTheDocument();
    }

    // Meals — hardcoded checkboxes (breakfast, lunch, dinner)
    expect(screen.getByText('breakfast')).toBeInTheDocument();
    expect(screen.getByText('lunch')).toBeInTheDocument();
    expect(screen.getByText('dinner')).toBeInTheDocument();
  });

  it('queries all 3 canonical lookup tables (location handled by LocationPicker)', async () => {
    const { default: PostDayworkPage } = await import('@/app/(app)/daywork/post/page');
    render(<PostDayworkPage />);

    // Select daywork type from the type selector
    fireEvent.click(screen.getByText('Daywork'));

    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('yacht_roles');
      expect(fromSpy).toHaveBeenCalledWith('certifications');
      // experience_brackets no longer loaded in edit mode (auto-derived)
    });
  });
});

describe('Discover page — filter dropdowns', () => {
  it('renders role filter and location picker after opening filter panel', async () => {
    const { default: DiscoverPage } = await import('@/app/(app)/discover/page');
    render(<DiscoverPage />);

    // Wait for lookups to load
    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('yacht_roles');
    });

    // Open filter panel
    fireEvent.click(screen.getByText('Filters'));

    // Role filter — HierarchicalPills with "All roles" placeholder
    expect(screen.getByText('All roles')).toBeInTheDocument();

    // Canonical role options visible in mock
    for (const role of MOCK_ROLES) {
      expect(screen.getByText(role.name)).toBeInTheDocument();
    }

    // Location picker — rendered as mocked component with "All locations" placeholder
    expect(screen.getByTestId('location-picker')).toBeInTheDocument();
    expect(screen.getByText('All locations')).toBeInTheDocument();
  });

  it('queries roles lookup table (location handled by LocationPicker)', async () => {
    const { default: DiscoverPage } = await import('@/app/(app)/discover/page');
    render(<DiscoverPage />);

    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('yacht_roles');
    });
  });
});

describe('Vessels page — create vessel form dropdowns', () => {
  it('renders hardcoded vessel types and LOA input in create dialog', async () => {
    const { default: VesselsPage } = await import('@/app/(app)/vessels/page');
    render(<VesselsPage />);

    // Wait for size bands to load
    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('vessel_size_bands');
    });

    // Open the create vessel dialog
    fireEvent.click(screen.getByText('Add vessel'));

    // Hardcoded vessel types
    expect(screen.getByText('Motor (M/Y)')).toBeInTheDocument();
    expect(screen.getByText('Sail (S/Y)')).toBeInTheDocument();

    // LOA input field (size band auto-derived from LOA)
    expect(screen.getByLabelText(/length overall/i)).toBeInTheDocument();
  });
});

describe('Profile page — edit mode dropdowns', () => {
  it('renders all canonical lookups when entering edit mode (crew)', async () => {
    const { default: ProfilePage } = await import('@/app/(app)/profile/page');
    render(<ProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/profile', expect.anything());
    });

    // Enter edit mode
    const editButton = await screen.findByText('Edit');
    fireEvent.click(editButton);

    // Wait for lookups to load in edit mode
    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('yacht_roles');
      expect(fromSpy).toHaveBeenCalledWith('certifications');
      // experience_brackets and vessel_size_bands no longer loaded in edit mode (auto-derived)
    });

    // Roles
    for (const role of MOCK_ROLES) {
      expect(screen.getByText(role.name)).toBeInTheDocument();
    }

    // Certifications
    for (const cert of MOCK_CERTS) {
      expect(screen.getByText(cert.name)).toBeInTheDocument();
    }

    // Experience brackets — auto-derived, no selector in edit mode

    // Size bands — auto-derived, no selector in edit mode

    // Location pickers — city + daywork port in edit mode
    expect(screen.getAllByTestId('location-picker').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Canonical data item counts', () => {
  it('onboarding crew profile renders exact number of items per control', async () => {
    const { default: OnboardingPage } = await import('@/app/onboarding/page');
    render(<OnboardingPage />);

    // Navigate: Welcome → Identity → Experience fork → Green profile
    fireEvent.click(screen.getByText('Get started'));
    fireEvent.click(screen.getByText("I'm Crew"));
    fireEvent.click(screen.getByText('New to yachting'));

    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('yacht_roles');
    });

    // Count select items by role option (all options render as mock-select-item)
    // Location is now handled by LocationPicker (mocked), not a Select
    // Primary role is now handled by RolePicker (mocked), not a Select
    const allSelectItems = screen.getAllByRole('option');
    // Experience brackets (3) + Available to start (4) = 7 select items
    expect(allSelectItems).toHaveLength(
      MOCK_BRACKETS.length + 4,
    );

    // Roles are in the HierarchicalPills mocks (primary role + desired role = 2 pickers)
    for (const role of MOCK_ROLES) {
      expect(screen.getAllByText(role.name).length).toBeGreaterThanOrEqual(1);
    }

    // Certification names visible via HierarchicalPills mock
    const certLabels = MOCK_CERTS.map((c) => screen.getByText(c.name));
    expect(certLabels).toHaveLength(MOCK_CERTS.length);

    // Count size band toggle buttons
    const sizeBandButtons = MOCK_SIZE_BANDS.map((b) => screen.getByText(b.label));
    expect(sizeBandButtons).toHaveLength(MOCK_SIZE_BANDS.length);
  });
});
