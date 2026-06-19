'use client';

import { useSafeFetch } from '@/hooks/use-safe-fetch';

interface Metrics {
  totalUsers: number;
  activeUsers7d: number;
  newSignups7d: number;
  blockedUsers: number;
  activeDaywork: number;
  activePermanent: number;
  activeEngagements: number;
  completedWeek: number;
  cancelledWeek: number;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function AdminOverview() {
  const { data: metrics, error, isLoading } = useSafeFetch<Metrics>('/api/admin/metrics');

  if (error) return <p className="text-destructive">{error}</p>;
  if (isLoading || !metrics) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="Total Users" value={metrics.totalUsers} />
        <MetricCard label="Active (7d)" value={metrics.activeUsers7d} />
        <MetricCard label="New Signups (7d)" value={metrics.newSignups7d} />
        <MetricCard label="Blocked" value={metrics.blockedUsers} />
        <MetricCard label="Active Daywork" value={metrics.activeDaywork} />
        <MetricCard label="Active Permanent" value={metrics.activePermanent} />
        <MetricCard label="In-Progress Engagements" value={metrics.activeEngagements} />
        <MetricCard label="Completed (7d)" value={metrics.completedWeek} />
        <MetricCard label="Cancelled (7d)" value={metrics.cancelledWeek} />
      </div>
    </div>
  );
}
