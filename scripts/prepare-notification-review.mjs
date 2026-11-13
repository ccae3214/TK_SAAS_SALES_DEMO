import { reviewPool, fixtures } from '../tests/support/review-fixtures.mjs';
import { ensureNotificationSchema, submitMemberRequest, notificationAuthority } from '../src/lib/hr-notifications.js';

if (!process.argv.includes('--prepare')) throw new Error('Use --prepare to create fresh fictional review accounts');
const pool=reviewPool();
try {
  await ensureNotificationSchema(pool);
  const fixture=await fixtures(pool);
  const fresh=await fixture.member('manual-new');
  const pending=await fixture.member('manual-pending');
  const agency=(await pool.query("SELECT id FROM hr_agencies WHERE agency_type='philippines' AND active=TRUE ORDER BY id LIMIT 1")).rows[0];
  if (!agency) throw new Error('Start and initialize the review app before preparing fixtures');
  await submitMemberRequest(pool,{email:pending.email,lineUserId:null,displayName:pending.display_name,requestedRole:'worker',requestedAgencyId:agency.id},notificationAuthority());
  console.log(JSON.stringify({reviewUrl:'http://localhost:8088/hr/login',newApplicant:fresh.email,pendingApplicant:pending.email,pendingName:pending.display_name,passwordLocation:'.env.review.local (do not share)',realLineSent:false}));
  // Intentionally leave only these freshly created fictional members for manual review.
} finally {await pool.end();}
