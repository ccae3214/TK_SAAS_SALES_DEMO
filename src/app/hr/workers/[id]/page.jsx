import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import HrWorkerProgress from '@/components/HrWorkerProgress';

export const dynamic = 'force-dynamic';
export const metadata = { title: '工作者文件與進度' };

// 菲律賓仲介（與系統管理者）管理底下工作者的文件審核與進度安排。
// 工作者是否屬於該仲介，由 /api/hr/agency-workers/[id] 再次驗證。
export default async function HrWorkerProgressPage({ params }) {
  const { id } = await params;
  const workerId = Number(id);
  if (!Number.isSafeInteger(workerId) || workerId <= 0) notFound();
  const session = await auth();
  if (!session?.user) redirect('/hr/login');
  const principal = await getHrPrincipal(session);
  const isPhilippinesAgency = principal?.role === 'agency' && principal.agency_type === 'philippines';
  if (principal?.role !== 'admin' && !isPhilippinesAgency) redirect('/hr');
  return <HrWorkerProgress workerId={workerId} />;
}
