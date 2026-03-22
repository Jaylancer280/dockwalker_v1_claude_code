'use client';

import { useState, useEffect } from 'react';
import { safeFetch } from '@/lib/safe-fetch';

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
        const result = await safeFetch<{ profile: Record<string, unknown> }>('/api/profile');
        if (result.ok) {
          const p = result.data.profile;
          const roleName = (p?.yacht_roles as Record<string, unknown> | undefined)?.name as
            | string
            | undefined;
          const ports = p?.ports as Record<string, unknown> | undefined;
          const cityName = ((ports?.cities as Record<string, unknown> | undefined)?.name ??
            ports?.name) as string | undefined;
          setChips(buildDynamicChips(roleName, cityName));
        }
      } finally {
        // setState guard for react-hooks/set-state-in-effect
      }
    }
    load();
  }, []);

  return chips;
}
