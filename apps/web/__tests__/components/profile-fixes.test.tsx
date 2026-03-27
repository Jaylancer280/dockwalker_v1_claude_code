import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProfileExperienceSection } from '@/app/(app)/profile/_components/profile-experience-section';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProps = {
  expandedSections: {} as Record<string, boolean>,
  toggleSection: vi.fn(),
  expandedExpId: null,
  setExpandedExpId: vi.fn(),
  deletingExpId: null,
  confirmDeleteExpId: null,
  setConfirmDeleteExpId: vi.fn(),
  handleDeleteExperience: vi.fn(),
  onAddExperience: vi.fn(),
  onEditExperience: vi.fn(),
};

describe('ProfileExperienceSection — empty state CTA', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows add button when experiences are empty even when section is collapsed', () => {
    render(<ProfileExperienceSection {...baseProps} experiences={[]} />);

    const addButton = screen.getByRole('button', { name: /add your vessel experience/i });
    expect(addButton).toBeInTheDocument();
  });

  it('shows add button when experiences are empty and section is expanded', () => {
    render(
      <ProfileExperienceSection
        {...baseProps}
        experiences={[]}
        expandedSections={{ experience: true }}
      />,
    );

    const addButton = screen.getByRole('button', { name: /add your vessel experience/i });
    expect(addButton).toBeInTheDocument();
  });

  it('calls onAddExperience when add button is clicked', () => {
    const onAdd = vi.fn();
    render(
      <ProfileExperienceSection {...baseProps} experiences={[]} onAddExperience={onAdd} />,
    );

    screen.getByRole('button', { name: /add your vessel experience/i }).click();
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
