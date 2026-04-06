import type { Metadata } from 'next';
import Image from 'next/image';
import { getDepartmentImageSrc } from '@/lib/department-image';
import { EpauletteBadge } from '@/components/epaulette-badge';
import { ShareJobButton } from '@/components/share-job-button';
import { currencySymbol } from '@dockwalker/shared';
interface JobData {
  job_number: string;
  type: 'daywork' | 'permanent';
  role_name: string;
  department: string;
  vessel_name: string;
  vessel_type: string;
  size_band: string | null;
  loa_meters: number | null;
  region: string | null;
  city: string | null;
  port: string | null;
  start_date?: string;
  end_date?: string;
  working_days?: number;
  day_rate?: number;
  currency?: string;
  meals?: string[];
  positions_available?: number;
  permanent_opportunity?: boolean;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  contract_type?: string;
  live_aboard?: boolean;
  required_certs: string[];
  required_languages: string[];
  experience_bracket: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
}

async function fetchJob(jobNumber: string): Promise<JobData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dockwalker.io';
    const res = await fetch(`${baseUrl}/api/jobs/${jobNumber}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatRate(job: JobData): string {
  if (job.type === 'daywork' && job.day_rate && job.currency) {
    return `${currencySymbol(job.currency)}${job.day_rate}/day`;
  }
  if (job.type === 'permanent' && job.salary_min && job.salary_currency) {
    const sym = currencySymbol(job.salary_currency);
    const period = job.salary_period === 'annual' ? '/year' : '/month';
    if (job.salary_max && job.salary_max !== job.salary_min) {
      return `${sym}${job.salary_min.toLocaleString()}-${job.salary_max.toLocaleString()}${period}`;
    }
    return `${sym}${job.salary_min.toLocaleString()}${period}`;
  }
  return '';
}

function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobNumber: string }>;
}): Promise<Metadata> {
  const { jobNumber } = await params;
  const job = await fetchJob(jobNumber);
  if (!job) {
    return { title: 'Job Not Found — DockWalker', robots: 'noindex' };
  }

  const rate = formatRate(job);
  const location = job.city ?? job.region ?? 'Location TBC';
  const isNda = job.vessel_name === 'NDA Vessel';

  let title: string;
  if (job.type === 'daywork') {
    title = `${job.role_name} — ${location}${job.working_days ? `, ${job.working_days} days` : ''}${rate ? `, ${rate}` : ''} — DockWalker`;
  } else {
    title = `${job.role_name} — ${location}${rate ? `, ${rate}` : ''} — DockWalker`;
  }

  let description: string;
  if (isNda) {
    const vesselDesc = [job.size_band, job.vessel_type === 'sail' ? 'sailing' : 'motor', 'yacht']
      .filter(Boolean)
      .join(' ');
    description = `A ${vesselDesc} is looking for a ${job.role_name.toLowerCase()} in ${location}. Apply on DockWalker.`;
  } else {
    description =
      job.type === 'daywork'
        ? `${job.vessel_name} is looking for a ${job.role_name.toLowerCase()} in ${job.port ?? location}. ${job.start_date && job.end_date ? `${new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–${new Date(job.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Dates TBC'}${rate ? `, ${rate}` : ''}. Apply on DockWalker.`
        : `Permanent position on ${job.vessel_name} in ${location}.${job.contract_type ? ` ${job.contract_type} contract.` : ''}${job.live_aboard ? ' Live aboard.' : ''} Apply on DockWalker.`;
  }

  return {
    title,
    description,
    robots: 'noindex',
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'DockWalker',
      images: [{ url: '/images/brand/og-image.png', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `https://www.dockwalker.io/jobs/${jobNumber}` },
  };
}

export default async function JobPage({ params }: { params: Promise<{ jobNumber: string }> }) {
  const { jobNumber } = await params;
  const job = await fetchJob(jobNumber);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="mb-2 text-2xl font-bold">This job is no longer available</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Browse active daywork and permanent positions on DockWalker.
        </p>
        <a
          href="/auth/signup"
          className="rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white"
        >
          Browse jobs
        </a>
      </div>
    );
  }

  const rate = formatRate(job);
  const location = [job.port, job.city, job.region].filter(Boolean).join(', ');
  const vesselDisplay = [
    job.vessel_name,
    job.loa_meters ? `${job.loa_meters}m` : job.size_band,
    job.vessel_type === 'sail' ? 'Sailing Yacht' : 'Motor Yacht',
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <div className="mx-auto max-w-2xl">
      {/* Department hero image */}
      <div className="relative h-[180px] w-full overflow-hidden">
        <Image
          src={getDepartmentImageSrc(job.department, job.job_number)}
          alt=""
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="flex items-center gap-2">
            <EpauletteBadge department={job.department} roleName={job.role_name} size="md" />
            <h1 className="text-xl font-bold text-white">{job.role_name}</h1>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Vessel + Location */}
        <div>
          <p className="text-sm font-medium">{vesselDisplay}</p>
          <p className="text-sm text-muted-foreground">{location || 'Location TBC'}</p>
        </div>

        {/* Key details grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {job.type === 'daywork' ? (
            <>
              {job.start_date && job.end_date && (
                <Detail
                  label="Dates"
                  value={`${new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${new Date(job.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}${job.working_days ? ` (${job.working_days} days)` : ''}`}
                />
              )}
              {rate && <Detail label="Rate" value={rate} />}
              {job.positions_available && job.positions_available > 1 && (
                <Detail label="Positions" value={String(job.positions_available)} />
              )}
              {job.experience_bracket && (
                <Detail label="Experience" value={job.experience_bracket} />
              )}
              {job.meals && job.meals.length > 0 && (
                <Detail label="Meals" value={job.meals.join(', ')} />
              )}
              {job.permanent_opportunity && <Detail label="Permanent opportunity" value="Yes" />}
            </>
          ) : (
            <>
              {rate && <Detail label="Salary" value={rate} />}
              {job.start_date && (
                <Detail
                  label="Start"
                  value={
                    new Date(job.start_date) <= new Date()
                      ? 'ASAP'
                      : new Date(job.start_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                  }
                />
              )}
              {job.contract_type && <Detail label="Contract" value={job.contract_type} />}
              {job.live_aboard != null && (
                <Detail label="Live aboard" value={job.live_aboard ? 'Yes' : 'No'} />
              )}
              {job.experience_bracket && (
                <Detail label="Experience" value={job.experience_bracket} />
              )}
            </>
          )}
        </div>

        {/* Certs */}
        {job.required_certs.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Required Certifications
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.required_certs.map((c) => (
                <span key={c} className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {job.required_languages.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Required Languages</p>
            <div className="flex flex-wrap gap-1.5">
              {job.required_languages.map((l) => (
                <span key={l} className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes/Description */}
        {(job.notes || job.description) && (
          <p className="text-sm text-muted-foreground">{job.description ?? job.notes}</p>
        )}

        {/* Posted date + reference */}
        <p className="text-xs text-muted-foreground">
          Posted {daysAgo(job.created_at)} — {job.job_number}
        </p>

        {/* Share */}
        <ShareJobButton
          jobNumber={job.job_number}
          roleName={job.role_name}
          location={job.city ?? job.region ?? ''}
          rate={rate}
        />
      </div>

      {/* CTA */}
      <div className="sticky bottom-0 border-t border-border bg-background px-4 py-4">
        <a
          href="/auth/signup?returnTo=/discover"
          className="block w-full rounded-lg bg-[var(--accent)] py-3 text-center text-sm font-medium text-white"
        >
          Sign up to apply on DockWalker
        </a>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <a href="/auth/login?returnTo=/discover" className="underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
