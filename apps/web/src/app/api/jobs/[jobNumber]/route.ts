import { NextResponse } from 'next/server';
import { getPublicJob } from '@/lib/jobs/get-public-job';

/**
 * GET /api/jobs/[jobNumber]
 * Public endpoint — no auth required. Returns job details for the public share page.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobNumber: string }> },
) {
  try {
    const { jobNumber } = await params;
    const job = await getPublicJob(jobNumber);
    if (!job) {
      return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
