import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const { id: rawId } = await params;
    if (!/^\d+$/.test(String(rawId)) || Number(rawId) < 1) return NextResponse.json({ error: 'Worker ID is invalid.' }, { status: 400 });
    const principal = await getHrPrincipal(session);
    if (!principal?.role) return NextResponse.json({ error: 'HR membership required' }, { status: 403 });
    const rows = await query(`SELECT w.resume_profile->>'photoDataUrl' AS photo_data_url
      FROM hr_workers w
      WHERE w.id=$1 AND (
        $2::text='admin'
        OR ($2::text='worker' AND w.id=$3)
        OR ($2::text='agency' AND (
          w.agency_id=$4 OR EXISTS(
            SELECT 1 FROM hr_cases c JOIN hr_employers e ON e.id=c.employer_id
            WHERE c.worker_id=w.id AND e.agency_id=$4
          ) OR EXISTS(
            SELECT 1 FROM hr_job_order_candidates jc
            JOIN hr_job_order_routes r ON r.id=jc.route_id
            JOIN hr_job_order_agencies oa ON oa.id=r.order_agency_id
            WHERE jc.worker_id=w.id AND jc.case_id IS NOT NULL AND oa.taiwan_agency_id=$4
          )
        ))
        OR ($2::text='employer' AND (
          NOT EXISTS(SELECT 1 FROM hr_cases active_case WHERE active_case.worker_id=w.id AND active_case.status<>'closed')
          OR EXISTS(SELECT 1 FROM hr_cases own_case WHERE own_case.worker_id=w.id AND own_case.employer_id=$5)
          OR EXISTS(SELECT 1 FROM hr_cases agency_case JOIN hr_employers ae ON ae.id=agency_case.employer_id
            WHERE agency_case.worker_id=w.id AND ae.agency_id=(SELECT employer.agency_id FROM hr_employers employer WHERE employer.id=$5))
        ))
      )`, [Number(rawId), principal.role, Number(principal.worker_id)||null, Number(principal.agency_id)||null, Number(principal.employer_id)||null]);
    if (!rows.length) return NextResponse.json({ error: 'Worker record not found.' }, { status: 404 });
    return NextResponse.json({ photoDataUrl: rows[0].photo_data_url || '' }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('hr_worker_resume_photo_failed', error?.name || 'Error');
    return NextResponse.json({ error: 'Could not load resume photo.' }, { status: 500 });
  }
}
