import { CaretLeft } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLogStats, getLogs } from '@/actions/logs';
import { getMachine } from '@/actions/machines';
import { LogStats } from '@/components/logs/log-stats';
import { LogViewer } from '@/components/logs/log-viewer';
import { Button } from '@/components/ui/button';

interface PageProps {
  params: Promise<{ machineId: string }>;
}

export default async function MachineLogsPage({ params }: PageProps) {
  const { machineId } = await params;

  const [machine, { logs }, stats] = await Promise.all([
    getMachine(machineId),
    getLogs(machineId, { limit: 100 }),
    getLogStats(machineId, 1),
  ]);

  if (!machine) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/machines/${machineId}/settings`}>
            <CaretLeft size={20} />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-black">
            로그: {machine.name || '이름 없는 기기'}
          </h1>
          <p className="text-sm text-gray-500">최근 24시간</p>
        </div>
      </div>

      {/* Stats */}
      <LogStats stats={stats} />

      {/* Log viewer */}
      <LogViewer machineId={machineId} initialLogs={logs} />
    </div>
  );
}
