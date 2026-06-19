import { useState, useEffect } from 'react';
import { safeFetch } from '@/lib/safe-fetch';

interface DockyReadiness {
  ready: boolean;
  missing: string[];
  loaded: boolean;
}

export function useDockyReadiness(): DockyReadiness {
  const [state, setState] = useState<DockyReadiness>({
    ready: true,
    missing: [],
    loaded: false,
  });

  useEffect(() => {
    safeFetch<{
      profile?: {
        primary_role_id: string | null;
        certification_ids: string[];
      };
    }>('/api/profile').then((result) => {
      if (!result.ok) {
        setState({ ready: true, missing: [], loaded: true });
        return;
      }
      const p = result.data.profile;
      if (!p) {
        setState({ ready: false, missing: ['role', 'certifications'], loaded: true });
        return;
      }
      const missing: string[] = [];
      if (!p.primary_role_id) missing.push('role');
      if (!p.certification_ids || p.certification_ids.length === 0) missing.push('certifications');
      setState({ ready: missing.length === 0, missing, loaded: true });
    });
  }, []);

  return state;
}
