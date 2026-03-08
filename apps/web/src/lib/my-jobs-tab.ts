export const MY_JOBS_TAB_STORAGE_KEY = 'dockwalker:my-jobs-tab';

export type MyJobsTab = 'active' | 'in_progress' | 'completed' | 'templates';

export function isMyJobsTab(value: string | null | undefined): value is MyJobsTab {
  return (
    value === 'active' || value === 'in_progress' || value === 'completed' || value === 'templates'
  );
}
