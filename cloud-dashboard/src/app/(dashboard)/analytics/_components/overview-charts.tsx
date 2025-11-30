import { getSessionVolumeData, getStatusBreakdown } from '@/actions/analytics';
import { SessionVolumeChart } from '@/components/analytics/session-volume-chart';
import { StatusBreakdownChart } from '@/components/analytics/status-breakdown-chart';

interface OverviewChartsProps {
  dateRange: {
    period?: string;
    from?: string;
    to?: string;
  };
}

export async function OverviewCharts({ dateRange }: OverviewChartsProps) {
  const [volumeData, statusData] = await Promise.all([
    getSessionVolumeData(dateRange),
    getStatusBreakdown(dateRange),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SessionVolumeChart data={volumeData} />
      <StatusBreakdownChart data={statusData} />
    </div>
  );
}
