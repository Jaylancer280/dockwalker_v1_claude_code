import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  ProfileShoreExperienceSection,
  type ShoreExperienceEntry,
} from '@/app/(app)/profile/_components/profile-shore-experience-section';

const makeEntry = (overrides: Partial<ShoreExperienceEntry> = {}): ShoreExperienceEntry => ({
  id: 'se1',
  category_id: 'cat1',
  employer_name: 'Blue Water Resort',
  job_title: 'Front of House Manager',
  start_date: '2023-03-01',
  end_date: '2024-06-01',
  is_current: false,
  description: 'Managed a 40-cover restaurant during peak season.',
  created_at: '2023-03-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
  shore_experience_categories: { id: 'cat1', name: 'Hospitality' },
  ...overrides,
});

function renderWith(
  experiences: ShoreExperienceEntry[],
  overrides: Partial<Parameters<typeof ProfileShoreExperienceSection>[0]> = {},
) {
  const props = {
    experiences,
    expandedSections: { shore_experience: true },
    toggleSection: vi.fn(),
    expandedId: null,
    setExpandedId: vi.fn(),
    deletingId: null,
    confirmDeleteId: null,
    setConfirmDeleteId: vi.fn(),
    handleDelete: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    ...overrides,
  };
  render(<ProfileShoreExperienceSection {...props} />);
  return props;
}

describe('ProfileShoreExperienceSection', () => {
  afterEach(cleanup);

  it('renders empty state with add button when experiences list is empty', () => {
    const props = renderWith([], { expandedSections: { shore_experience: false } });
    expect(screen.getByText('No shore experience added')).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: /add shore-based experience/i });
    fireEvent.click(addButton);
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders entry with employer, job title, and category badge', () => {
    renderWith([makeEntry()]);
    expect(screen.getByText('Blue Water Resort')).toBeInTheDocument();
    // Category pill appears in header; label appears in expanded details — use getAllByText
    expect(screen.getAllByText('Hospitality').length).toBeGreaterThan(0);
    // Collapsed header includes job title + date range separated by ·
    expect(
      screen.getByText((content) => content.includes('Front of House Manager')),
    ).toBeInTheDocument();
  });

  it('auto-expands first entry showing description and Edit/Remove actions', () => {
    renderWith([makeEntry()]);
    // Description is visible
    expect(
      screen.getByText('Managed a 40-cover restaurant during peak season.'),
    ).toBeInTheDocument();
    // Expanded block labels
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Period')).toBeInTheDocument();
    // Actions
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('calls onEdit with the entry id when Edit is clicked', () => {
    const props = renderWith([makeEntry({ id: 'entry-42' })]);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(props.onEdit).toHaveBeenCalledWith('entry-42');
  });

  it('calls setConfirmDeleteId with the entry id when Remove is clicked', () => {
    const props = renderWith([makeEntry({ id: 'entry-42' })]);
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(props.setConfirmDeleteId).toHaveBeenCalledWith('entry-42');
  });

  it('shows "Present" in the date range for a current role', () => {
    renderWith([makeEntry({ is_current: true, end_date: null })]);
    const period = screen.getAllByText(/Present/i);
    expect(period.length).toBeGreaterThan(0);
  });

  it('shows entry count in the collapsed section header when collapsed', () => {
    renderWith([makeEntry(), makeEntry({ id: 'se2' })], {
      expandedSections: { shore_experience: false },
    });
    expect(screen.getByText('2 entries')).toBeInTheDocument();
  });

  it('toggleSection fires when the section header is clicked', () => {
    const props = renderWith([makeEntry()]);
    const header = screen.getByText('Shore-Based Experience').closest('button');
    expect(header).not.toBeNull();
    fireEvent.click(header!);
    expect(props.toggleSection).toHaveBeenCalledWith('shore_experience');
  });

  it('renders fallback "Uncategorized" when category join is null', () => {
    renderWith([makeEntry({ shore_experience_categories: null })]);
    expect(screen.getAllByText('Uncategorized').length).toBeGreaterThan(0);
  });
});
