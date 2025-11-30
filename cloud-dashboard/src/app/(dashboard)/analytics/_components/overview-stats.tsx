import { Camera, CheckCircle, CurrencyKrw, Desktop } from '@phosphor-icons/react/dist/ssr';
import { getAnalyticsSummary } from '@/actions/analytics';
import { StatCard } from '@/components/analytics/stat-card';

interface OverviewStatsProps {
  dateRange: {
    period?: string;
    from?: string;
    to?: string;
  };
}

export async function OverviewStats({ dateRange }: OverviewStatsProps) {
  const stats = await getAnalyticsSummary(dateRange);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="총 세션"
        value={stats.totalSessions.toLocaleString()}
        change={stats.sessionsChange}
        icon={Camera}
      />
      <StatCard
        title="활성 기기"
        value={stats.activeMachines}
        change={stats.machinesChange}
        icon={Desktop}
      />
      <StatCard
        title="성공률"
        value={`${stats.successRate}%`}
        change={stats.successRateChange}
        icon={CheckCircle}
      />
      <StatCard
        title="매출"
        value={`${stats.revenue.toLocaleString()}원`}
        change={stats.revenueChange}
        icon={CurrencyKrw}
      />
    </div>
  );
}
