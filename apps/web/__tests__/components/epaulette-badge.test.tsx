import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { getEpaulette, getDepartmentColor } from '@dockwalker/shared';

describe('getEpaulette utility', () => {
  it('returns correct mapping for all 23 roles', () => {
    const singleRoles = [
      { name: 'Captain', depts: ['bridge'], stripes: 4 },
      { name: 'First Officer', depts: ['bridge'], stripes: 3 },
      { name: 'Second Officer', depts: ['bridge'], stripes: 2 },
      { name: 'Bosun', depts: ['deck'], stripes: 2 },
      { name: 'Lead Deckhand', depts: ['deck'], stripes: 1 },
      { name: 'Deckhand', depts: ['deck'], stripes: 1 },
      { name: 'Mate', depts: ['deck'], stripes: 1 },
      { name: 'Day Worker (General)', depts: ['deck'], stripes: 1 },
      { name: 'Chief Engineer', depts: ['engineering'], stripes: 4 },
      { name: 'Second Engineer', depts: ['engineering'], stripes: 3 },
      { name: 'Third Engineer', depts: ['engineering'], stripes: 2 },
      { name: 'ETO', depts: ['engineering'], stripes: 3 },
      { name: 'Chief Stewardess', depts: ['interior'], stripes: 3 },
      { name: 'Second Stewardess', depts: ['interior'], stripes: 2 },
      { name: 'Third Stewardess', depts: ['interior'], stripes: 1 },
      { name: 'Stewardess', depts: ['interior'], stripes: 1 },
      { name: 'Purser', depts: ['interior'], stripes: 3 },
      { name: 'Head Chef', depts: ['galley'], stripes: 3 },
      { name: 'Sous Chef', depts: ['galley'], stripes: 2 },
      { name: 'Crew Chef', depts: ['galley'], stripes: 1 },
    ];

    for (const r of singleRoles) {
      const info = getEpaulette(r.name);
      expect(info, `${r.name} should map`).not.toBeNull();
      expect(info!.departments).toEqual(r.depts);
      expect(info!.stripes).toBe(r.stripes);
    }

    // Hybrid roles
    const hybrids = [
      { name: 'Deck/Engineer', depts: ['deck', 'engineering'], stripes: 1 },
      { name: 'Deck/Stew', depts: ['deck', 'interior'], stripes: 1 },
      { name: 'Cook/Stew', depts: ['galley', 'interior'], stripes: 1 },
    ];
    for (const r of hybrids) {
      const info = getEpaulette(r.name);
      expect(info, `${r.name} should map`).not.toBeNull();
      expect(info!.departments).toEqual(r.depts);
      expect(info!.stripes).toBe(r.stripes);
    }
  });

  it('returns null for unknown role without department', () => {
    expect(getEpaulette('Unknown Role')).toBeNull();
  });

  it('falls back using department string for unknown role', () => {
    const info = getEpaulette('Custom Role', 'deck');
    expect(info).toEqual({ departments: ['deck'], stripes: 1 });
  });

  it('parses compound department in fallback', () => {
    const info = getEpaulette('Custom Hybrid', 'deck_interior');
    expect(info).toEqual({ departments: ['deck', 'interior'], stripes: 1 });
  });
});

describe('getDepartmentColor', () => {
  it('returns gold for deck, bridge, engineering', () => {
    expect(getDepartmentColor('deck')).toBe('gold');
    expect(getDepartmentColor('bridge')).toBe('gold');
    expect(getDepartmentColor('engineering')).toBe('gold');
  });

  it('returns silver for interior, galley', () => {
    expect(getDepartmentColor('interior')).toBe('silver');
    expect(getDepartmentColor('galley')).toBe('silver');
  });
});

describe('EpauletteBadge component', () => {
  it('renders Captain with anchor icon and 4 stripes', () => {
    const { container } = render(<EpauletteBadge roleName="Captain" />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).not.toBeNull();
    // 1 SVG icon (anchor) + 4 stripes
    const svgs = badge!.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
    const stripes = badge!.querySelectorAll('span.rounded-full');
    expect(stripes.length).toBe(4);
  });

  it('renders Chief Engineer with propeller icon and 4 stripes', () => {
    const { container } = render(<EpauletteBadge roleName="Chief Engineer" />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).not.toBeNull();
    const svgs = badge!.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
    const stripes = badge!.querySelectorAll('span.rounded-full');
    expect(stripes.length).toBe(4);
  });

  it('renders Chief Stewardess with crescent icon and 3 stripes', () => {
    const { container } = render(<EpauletteBadge roleName="Chief Stewardess" />);
    const badge = container.querySelector('span.inline-flex');
    const stripes = badge!.querySelectorAll('span.rounded-full');
    expect(stripes.length).toBe(3);
  });

  it('renders Head Chef with knife icon and 3 stripes', () => {
    const { container } = render(<EpauletteBadge roleName="Head Chef" />);
    const badge = container.querySelector('span.inline-flex');
    const stripes = badge!.querySelectorAll('span.rounded-full');
    expect(stripes.length).toBe(3);
  });

  it('renders Deckhand with 1 stripe', () => {
    const { container } = render(<EpauletteBadge roleName="Deckhand" />);
    const badge = container.querySelector('span.inline-flex');
    const stripes = badge!.querySelectorAll('span.rounded-full');
    expect(stripes.length).toBe(1);
  });

  it('renders Deck/Engineer with 2 SVG icons (split symbol)', () => {
    const { container } = render(<EpauletteBadge roleName="Deck/Engineer" />);
    const badge = container.querySelector('span.inline-flex');
    const svgs = badge!.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
    const stripes = badge!.querySelectorAll('span.rounded-full');
    expect(stripes.length).toBe(1);
  });

  it('renders Deck/Stew with 2 SVG icons (anchor + crescent)', () => {
    const { container } = render(<EpauletteBadge roleName="Deck/Stew" />);
    const badge = container.querySelector('span.inline-flex');
    const svgs = badge!.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
  });

  it('renders Cook/Stew with 2 SVG icons (knife + crescent)', () => {
    const { container } = render(<EpauletteBadge roleName="Cook/Stew" />);
    const badge = container.querySelector('span.inline-flex');
    const svgs = badge!.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
  });

  it('returns null for unknown role', () => {
    const { container } = render(<EpauletteBadge roleName="Unknown Role" />);
    expect(container.innerHTML).toBe('');
  });
});
