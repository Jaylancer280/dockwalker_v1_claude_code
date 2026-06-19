import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CertificationPicker } from '@/components/certification-picker';

afterEach(() => cleanup());

const MOCK_CERTS = [
  { id: 'b1', name: 'STCW 95 (STCW 2010)', category: 'basic', subcategory: null, sort_order: 1 },
  { id: 'b2', name: 'ENG1 Medical Certificate', category: 'basic', subcategory: null, sort_order: 2 },
  {
    id: 'd1',
    name: 'RYA Day Skipper',
    category: 'deck_bridge',
    subcategory: 'master_skipper',
    sort_order: 4,
  },
  {
    id: 'd2',
    name: 'RYA Powerboat Level 2',
    category: 'deck_bridge',
    subcategory: 'rya_powerboat_nav',
    sort_order: 3,
  },
  {
    id: 'i1',
    name: 'G.U.E.S.T I Introduction',
    category: 'interior',
    subcategory: 'guest_core',
    sort_order: 1,
  },
  { id: 'g1', name: 'Ship Cook Certificate', category: 'galley', subcategory: null, sort_order: 16 },
];

vi.mock('@/hooks/use-lookups', () => ({
  useLookups: () => ({
    roles: [],
    certifications: MOCK_CERTS,
    experienceBrackets: [],
    sizeBands: [],
    nationalities: [],
    visaTypes: [],
    ports: [],
    cities: [],
    languages: [],
    loading: false,
  }),
}));

describe('CertificationPicker', () => {
  it('renders Basic category expanded by default with flat pill grid', () => {
    render(<CertificationPicker selectedIds={[]} onChange={vi.fn()} />);

    // Basic is expanded — its pills are visible
    expect(screen.getByRole('button', { name: 'STCW 95 (STCW 2010)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ENG1 Medical Certificate' })).toBeInTheDocument();
  });

  it('does not render items for collapsed drill-down categories', () => {
    render(<CertificationPicker selectedIds={[]} onChange={vi.fn()} />);
    // deck_bridge is collapsed by default — its subcategory pills should not be in the DOM
    expect(screen.queryByRole('button', { name: 'RYA Day Skipper' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'RYA Powerboat Level 2' }),
    ).not.toBeInTheDocument();
  });

  it('expands a category when its header is clicked, revealing subcategory headers', () => {
    render(<CertificationPicker selectedIds={[]} onChange={vi.fn()} />);
    const deckHeader = screen.getByRole('button', { name: /Deck \/ Bridge/ });
    fireEvent.click(deckHeader);
    // Subcategory headers appear
    expect(screen.getByRole('button', { name: /Master \/ Skipper CoCs/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /RYA Powerboat & Nav/ })).toBeInTheDocument();
    // Items still hidden until subcategory is expanded
    expect(screen.queryByRole('button', { name: 'RYA Day Skipper' })).not.toBeInTheDocument();
  });

  it('expands a subcategory to reveal its pills', () => {
    render(<CertificationPicker selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Deck \/ Bridge/ }));
    fireEvent.click(screen.getByRole('button', { name: /Master \/ Skipper CoCs/ }));
    expect(screen.getByRole('button', { name: 'RYA Day Skipper' })).toBeInTheDocument();
  });

  it('filters across all categories when query is 2+ characters', () => {
    render(<CertificationPicker selectedIds={[]} onChange={vi.fn()} />);
    const search = screen.getByLabelText('Search certifications');
    fireEvent.change(search, { target: { value: 'rya' } });

    // Both RYA certs should be visible even though neither is in the default Basic view
    expect(screen.getByRole('button', { name: 'RYA Day Skipper' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RYA Powerboat Level 2' })).toBeInTheDocument();

    // Category accordion is hidden during search
    expect(screen.queryByRole('button', { name: /Deck \/ Bridge/ })).not.toBeInTheDocument();
  });

  it('search is case and punctuation insensitive', () => {
    render(<CertificationPicker selectedIds={[]} onChange={vi.fn()} />);
    const search = screen.getByLabelText('Search certifications');
    // "guest" with no dots should match "G.U.E.S.T I Introduction"
    fireEvent.change(search, { target: { value: 'guest' } });
    expect(screen.getByRole('button', { name: 'G.U.E.S.T I Introduction' })).toBeInTheDocument();
  });

  it('fires onChange with updated array when a pill is toggled', () => {
    const onChange = vi.fn();
    render(<CertificationPicker selectedIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'STCW 95 (STCW 2010)' }));
    expect(onChange).toHaveBeenCalledWith(['b1']);
  });

  it('fires onChange removing the id when an already-selected pill is toggled', () => {
    const onChange = vi.fn();
    render(<CertificationPicker selectedIds={['b1', 'b2']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'ENG1 Medical Certificate' }));
    expect(onChange).toHaveBeenCalledWith(['b1']);
  });

  it('renders selected pills above the picker with a remove button', () => {
    const onChange = vi.fn();
    render(<CertificationPicker selectedIds={['b1']} onChange={onChange} />);
    const removeBtn = screen.getByLabelText('Remove STCW 95 (STCW 2010)');
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows no-results message when query matches nothing', () => {
    render(<CertificationPicker selectedIds={[]} onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search certifications'), {
      target: { value: 'xyzabc' },
    });
    expect(screen.getByText(/No matching certifications/)).toBeInTheDocument();
  });
});
