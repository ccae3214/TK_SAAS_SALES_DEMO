import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import HrManagement from '@/components/HrManagement';
import HrAdminMobileBar from '@/components/HrAdminMobileBar';
import HrCallProvider from '@/components/HrCallProvider';
import HrMemberPortal from '@/components/HrMemberPortal';
import HrMemberNavScroll from '@/components/HrMemberNavScroll';
import '@/components/hr-member-mobile-nav.css';
import '@/components/hr-member-side-nav.css';
import '@/components/hr-admin-mobile-nav.css';
import '@/components/hr-call.css';
import '@/components/hr-scrollbars.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '克雷迅人力仲介管理系統' };

// 雇主、仲介、訓練中心的功能選單，桌機和系統管理員頁面一樣放在左側（樣式在 hr-member-side-nav.css）。
const SIDE_NAV_ROLES = new Set(['employer', 'agency', 'training_center']);

export default async function HrPage() {
  const session = await auth();
  if (!session?.user) redirect('/hr/login');

  const email = session.user.email || 'LINE 帳號';
  const principal = await getHrPrincipal(session);
  // 工人活動紀錄已放進會員頁面的「活動紀錄」選單（HrMemberPortal）；後端另外驗證權限。
  if (principal?.role !== 'admin') {
    return (
      <>
        <div className={SIDE_NAV_ROLES.has(principal?.role) ? 'hr-side-nav' : undefined}>
          <HrMemberPortal actor={{ name: session.user.name || email, email }} />
        </div>
        <HrMemberNavScroll />
        <HrCallProvider />
      </>
    );
  }
  return (
    <>
      <HrManagement actor={{ name: session.user.name || email, email }} />
      <HrAdminMobileBar />
      <HrCallProvider />
    </>
  );
}
