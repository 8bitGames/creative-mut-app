import { Camera, CaretLeft, CreditCard, Gear, Printer } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMachine } from '@/actions/machines';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ machineId: string }>;
}

const statusStyles = {
  online: { badge: 'bg-green-100 text-green-700' },
  offline: { badge: 'bg-gray-100 text-gray-700' },
  busy: { badge: 'bg-blue-100 text-blue-700' },
  error: { badge: 'bg-red-100 text-red-700' },
  maintenance: { badge: 'bg-yellow-100 text-yellow-700' },
};

const statusLabels: Record<string, string> = {
  online: '온라인',
  offline: '오프라인',
  busy: '사용중',
  error: '오류',
  maintenance: '점검중',
};

const peripheralStatusLabels: Record<string, string> = {
  ok: '정상',
  warning: '경고',
  error: '오류',
  offline: '오프라인',
};

export default async function MachineDetailPage({ params }: PageProps) {
  const { machineId } = await params;
  const machine = await getMachine(machineId);

  if (!machine) {
    notFound();
  }

  const status = machine.status as keyof typeof statusStyles;
  const styles = statusStyles[status] || statusStyles.offline;
  const peripherals = machine.peripheralStatus as Record<string, { status: string }> | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/machines">
              <CaretLeft size={20} />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-black">{machine.name || '이름 없는 기기'}</h1>
              <Badge className={cn('rounded-full', styles.badge)}>
                {statusLabels[status] || status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              ID: {machine.hardwareId || machine.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <Button variant="secondary" asChild>
          <Link href={`/machines/${machine.id}/settings`}>
            <Gear size={16} className="mr-2" />
            설정
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">오늘 세션</p>
                <p className="mt-1 text-2xl font-semibold">0</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">성공률</p>
                <p className="mt-1 text-2xl font-semibold">--%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">오늘 매출</p>
                <p className="mt-1 text-2xl font-semibold">0원</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">최근 세션</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="py-8 text-center text-gray-500">아직 세션이 없습니다</div>
            </CardContent>
          </Card>
        </div>

        {/* Peripherals */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">주변장치</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PeripheralRow
                icon={Camera}
                name="카메라"
                status={peripherals?.camera?.status || 'offline'}
              />
              <PeripheralRow
                icon={Printer}
                name="프린터"
                status={peripherals?.printer?.status || 'offline'}
              />
              <PeripheralRow
                icon={CreditCard}
                name="결제"
                status={peripherals?.payment?.status || 'offline'}
              />
            </CardContent>
          </Card>

          {/* Machine Info */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">기기 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">하드웨어 ID</span>
                <span className="font-mono">{machine.hardwareId || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">설정 버전</span>
                <span>{machine.configVersion || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">마지막 연결</span>
                <span>
                  {machine.lastHeartbeat
                    ? new Date(machine.lastHeartbeat).toLocaleString('ko-KR')
                    : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PeripheralRow({
  icon: Icon,
  name,
  status,
}: {
  icon: React.ElementType;
  name: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-gray-400" />
        <span>{name}</span>
      </div>
      <Badge
        className={cn(
          'rounded-full',
          status === 'ok' && 'bg-green-100 text-green-700',
          status === 'warning' && 'bg-yellow-100 text-yellow-700',
          status === 'error' && 'bg-red-100 text-red-700',
          status === 'offline' && 'bg-gray-100 text-gray-500'
        )}
      >
        {peripheralStatusLabels[status] || status}
      </Badge>
    </div>
  );
}
