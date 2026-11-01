import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isHrAdminSession } from '@/lib/security';
import HrManagement from '@/components/HrManagement';
import HrMemberPortal from '@/components/HrMemberPortal';

export const dynamic = 'force-dynamic';
export const metadata = { title: '克雷迅人力仲介管理系統' };

export default async function HrPage() {
  const session = await auth();
  if (!session?.user) redirect('/hr/login');
  const email = session.user.email || 'LINE 帳號';
  if (!isHrAdminSession(session)) return <HrMemberPortal actor={{ name: session.user.name || email, email }} />;
  return <HrManagement actor={{ name: session.user.name || email, email }} />;
}
