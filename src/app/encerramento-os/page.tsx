import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardHeader } from '@/components/DashboardHeader';
import { ClosurePanel } from '@/components/ClosurePanel';
import { requireSessionUser } from '@/lib/session';
import { getMonthlyClosureCounts } from '@/app/actions/closure';
import { getTodayDateKey } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export default async function ClosurePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = requireSessionUser(session);
  const { counts, monthLabel } = await getMonthlyClosureCounts();
  const todayDateKey = getTodayDateKey();

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <DashboardHeader
        userName={user.name ?? 'Usuário'}
        role={user.role}
        regional={user.regional}
        isSupervisor={user.role === 'SUPERVISOR'}
      />
      <main className="flex-1">
        <ClosurePanel
          initialCounts={counts}
          monthLabel={monthLabel}
          todayDateKey={todayDateKey}
          defaultRegional={user.regional}
        />
      </main>
    </div>
  );
}
