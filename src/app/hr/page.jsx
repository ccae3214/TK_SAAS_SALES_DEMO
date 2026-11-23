import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import HrManagement from '@/components/HrManagement';
import HrMemberPortal from '@/components/HrMemberPortal';
import HrMemberNavScroll from '@/components/HrMemberNavScroll';
import HrWorkerActivityLog from '@/components/HrWorkerActivityLog';
import '@/components/hr-member-mobile-nav.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '克雷迅人力仲介管理系統' };

export default async function HrPage() {
  const session = await auth();
  if (!session?.user) redirect('/hr/login');

  const email = session.user.email || 'LINE 帳號';
  const principal = await getHrPrincipal(session);
  // 工人活動紀錄：工人看自己的，系統管理者看全部（仲介看不到；後端另外驗證權限）。
  const isWorker = principal?.role === 'worker' && !!principal.worker_id;
  if (principal?.role !== 'admin') {
    return (
      <>
        <HrMemberPortal actor={{ name: session.user.name || email, email }} />
        {isWorker && <HrWorkerActivityLog self />}
        <HrMemberNavScroll />
      </>
    );
  }
  return (
    <>
      <HrManagement actor={{ name: session.user.name || email, email }} />
      <HrWorkerActivityLog />
    </>
  );
}
