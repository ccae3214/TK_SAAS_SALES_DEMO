import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import HrMemberPortal from '@/components/HrMemberPortal';
import HrMemberNavScroll from '@/components/HrMemberNavScroll';
import HrCallProvider from '@/components/HrCallProvider';
import '@/components/hr-member-mobile-nav.css';
import '@/components/hr-member-side-nav.css';
import '@/components/hr-call.css';
import '@/components/hr-scrollbars.css';

export const dynamic = 'force-dynamic';

export default async function EmployerMatchingPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect('/hr/login');

  const principal = await getHrPrincipal(session);
  if (principal?.role !== 'employer') redirect('/hr');

  const { view = [] } = await params;
  const isCreateView = view.length === 1 && view[0] === 'new';
  const isPickView = view.length === 2 && view[0] === 'pick' && /^\d+$/.test(view[1]);
  if (view.length > 0 && !isCreateView && !isPickView) notFound();

  const email = session.user.email || 'LINE 帳號';
  return <>
    <div className="hr-side-nav">
      <HrMemberPortal actor={{ name: session.user.name || email, email }} />
    </div>
    <HrMemberNavScroll />
    <HrCallProvider />
  </>;
}
