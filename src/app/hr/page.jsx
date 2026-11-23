import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import HrManagement from '@/components/HrManagement';
import HrAdminMobileBar from '@/components/HrAdminMobileBar';
import HrMemberPortal from '@/components/HrMemberPortal';
import HrMemberNavScroll from '@/components/HrMemberNavScroll';
import '@/components/hr-member-mobile-nav.css';
import '@/components/hr-admin-mobile-nav.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '克雷迅人力仲介管理系統' };

export default async function HrPage() {
  const session = await auth();
  if (!session?.user) redirect('/hr/login');

  const email = session.user.email || 'LINE 帳號';
  const principal = await getHrPrincipal(session);
  if (principal?.role !== 'admin') {
    return (
      <>
        <HrMemberPortal actor={{ name: session.user.name || email, email }} />
        <HrMemberNavScroll />
      </>
    );
  }
  return (
    <>
      <HrManagement actor={{ name: session.user.name || email, email }} />
      <HrAdminMobileBar />
    </>
  );
}
