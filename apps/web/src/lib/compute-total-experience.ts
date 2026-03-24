interface ExperienceEntry {
  start_date: string;
  end_date: string | null;
  is_current: boolean;
}

/**
 * Compute total experience duration from an array of experience entries.
 * Returns a human-readable string like "2y 3m", "11m", or "45d".
 */
export function computeTotalExperience(experiences: ExperienceEntry[]): string {
  if (experiences.length === 0) return '0d';

  const now = new Date();
  let totalMonths = 0;
  let remainDays = 0;

  for (const exp of experiences) {
    const start = new Date(exp.start_date + 'T00:00:00');
    const end = exp.is_current ? now : exp.end_date ? new Date(exp.end_date + 'T00:00:00') : start;
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const dayDiff = end.getDate() - start.getDate();
    totalMonths += months;
    remainDays += dayDiff;
  }

  totalMonths += Math.floor(remainDays / 30);
  remainDays = remainDays % 30;
  if (remainDays >= 15) totalMonths += 1;
  if (totalMonths < 0) totalMonths = 0;

  if (totalMonths >= 12) {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return months > 0 ? `${years}y ${months}m` : `${years}y`;
  }
  if (totalMonths >= 1) {
    return `${totalMonths}m`;
  }

  // Fallback to total days
  const totalDays = experiences.reduce((sum, exp) => {
    const s = new Date(exp.start_date + 'T00:00:00');
    const e = exp.is_current ? now : exp.end_date ? new Date(exp.end_date + 'T00:00:00') : s;
    return sum + Math.max(0, Math.round((e.getTime() - s.getTime()) / 86_400_000));
  }, 0);

  return `${totalDays}d`;
}
