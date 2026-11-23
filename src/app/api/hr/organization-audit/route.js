import { auth } from '@/auth';
import { query } from '@/lib/db';
import { getHrPrincipal } from '@/lib/hr-access';
import { ensureAgencyAuditSchema } from '@/lib/hr-agency-audit';
import { ensureTrainingCenterAuditSchema } from '@/lib/hr-tc-audit';
import { createOrganizationAuditHandler } from '@/lib/hr-organization-audit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = createOrganizationAuditHandler({
  auth, getPrincipal: getHrPrincipal, query,
  ensure: kind => kind === 'agency' ? ensureAgencyAuditSchema() : ensureTrainingCenterAuditSchema(),
  onError: error => console.error('hr_organization_audit_read_failed', error?.name || 'Error'),
});
