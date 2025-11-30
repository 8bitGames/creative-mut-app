'use client';

import { Camera, CreditCard, Gear, Printer, Thermometer } from '@phosphor-icons/react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import type { Machine } from '@/lib/db/types';
import { cn } from '@/lib/utils';

interface MachineCardProps {
  machine: Machine;
}

const statusStyles = {
  online: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  offline: { badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  busy: { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  error: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  maintenance: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
};

const statusLabels: Record<string, string> = {
  online: '온라인',
  offline: '오프라인',
  busy: '사용중',
  error: '오류',
  maintenance: '점검중',
};

export function MachineCard({ machine }: MachineCardProps) {
  const status = machine.status as keyof typeof statusStyles;
  const styles = statusStyles[status] || statusStyles.offline;
  const peripherals = machine.peripheralStatus as Record<string, { status: string }> | null;
  const hardware = machine.hardwareInfo as Record<string, unknown> | null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-black">{machine.name || '이름 없는 기기'}</h3>
            <p className="text-sm text-gray-500">
              {machine.locationId ? '위치 설정됨' : '위치 없음'}
            </p>
          </div>
          <Badge className={cn('rounded-full', styles.badge)}>
            <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', styles.dot)} />
            {statusLabels[status] || status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Peripheral status */}
        <div className="flex items-center gap-4 text-sm">
          <PeripheralIcon
            icon={Camera}
            status={peripherals?.camera?.status ?? 'offline'}
            label="카메라"
          />
          <PeripheralIcon
            icon={Printer}
            status={peripherals?.printer?.status ?? 'offline'}
            label="프린터"
          />
          <PeripheralIcon
            icon={CreditCard}
            status={peripherals?.payment?.status ?? 'offline'}
            label="결제"
          />
          {hardware?.temperature != null && (
            <div className="flex items-center gap-1 text-gray-500">
              <Thermometer size={16} />
              <span>{String(hardware.temperature)}C</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">오늘: </span>
            <span className="font-medium">0 세션</span>
          </div>
          <div>
            <span className="text-gray-500">매출: </span>
            <span className="font-medium">0원</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button variant="secondary" size="sm" asChild className="flex-1">
          <Link href={`/machines/${machine.id}`}>상세 정보</Link>
        </Button>
        <Button variant="secondary" size="icon" asChild>
          <Link href={`/machines/${machine.id}/settings`}>
            <Gear size={16} />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function PeripheralIcon({
  icon: Icon,
  status,
  label,
}: {
  icon: React.ElementType;
  status?: string;
  label: string;
}) {
  const colorMap = {
    ok: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    offline: 'text-gray-400',
  };
  const color = colorMap[status as keyof typeof colorMap] || colorMap.offline;

  return (
    <div className="flex items-center gap-1" title={label}>
      <Icon size={16} className={color} weight="duotone" />
    </div>
  );
}
