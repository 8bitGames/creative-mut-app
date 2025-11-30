import { getAlerts } from '@/actions/alerts';
import { AlertCard } from '@/components/alerts/alert-card';

interface AlertListProps {
  filters: {
    severity?: string;
    status?: string;
    machine?: string;
  };
}

export async function AlertList({ filters }: AlertListProps) {
  const alerts = await getAlerts({
    ...filters,
    status: filters.status || 'active',
  });

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">알림이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
