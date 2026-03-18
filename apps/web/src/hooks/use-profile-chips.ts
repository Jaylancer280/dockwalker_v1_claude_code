'use client';

import { useState, useEffect } from 'react';

const STATIC_CHIPS = [
  'What certs do I need to become a Bosun?',
  'How do I get my STCW?',
  'What is the ENG1 medical?',
  'Deck officer career path',
];

function buildDynamicChips(roleName?: string, cityName?: string): string[] {
  if (!roleName && !cityName) return STATIC_CHIPS;
  const chips = ['What should I work on next?', 'What certs am I missing?'];
  if (roleName) chips.push(`How do I progress from ${roleName}?`);
  if (cityName) chips.push(`Training centres near ${cityName}?`);
  return chips;
}

export function useProfileChips(): string[] {
  const [chips, setChips] = useState<string[]>(STATIC_CHIPS);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const data = await res.json();
        const p = data.profile;
        const roleName = p?.yacht_roles?.name;
        const cityName = p?.ports?.cities?.name ?? p?.ports?.name;
        setChips(buildDynamicChips(roleName, cityName));
      } catch {
        // Keep static chips on failure
      }
    }
    load();
  }, []);

  return chips;
}
