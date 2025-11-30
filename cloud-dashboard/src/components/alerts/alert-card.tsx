'use client';

import { Check, CheckCircle, Info, Warning, WarningCircle, XCircle } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { acknowledgeAlert, resolveAlert } from '@/actions/alerts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Alert } from '@/lib/db/types';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  alert: Alert;
}

const severityConfig = {
  info: {
    icon: Info,
    badge: 'bg-blue-100 text-blue-700',
    border: 'border-l-blue-500',
    label: '정보',
  },
  warning: {
    icon: Warning,
    badge: 'bg-yellow-100 text-yellow-700',
    border: 'border-l-yellow-500',
    label: '경고',
  },
  error: {
    icon: WarningCircle,
    badge: 'bg-red-100 text-red-700',
    border: 'border-l-red-500',
    label: '오류',
  },
  critical: {
    icon: XCircle,
    badge: 'bg-red-100 text-red-800',
    border: 'border-l-red-600',
    label: '심각',
  },
};

export function AlertCard({ alert }: AlertCardProps) {
  const severity = alert.severity as keyof typeof severityConfig;
  const config = severityConfig[severity] || severityConfig.info;
  const Icon = config.icon;

  const handleAcknowledge = async () => {
    await acknowledgeAlert(alert.id);
  };

  const handleResolve = async () => {
    await resolveAlert(alert.id);
  };

  return (
    <Card
      className={cn(
        'border-l-4 transition-shadow hover:shadow-md',
        config.border,
        alert.resolved && 'opacity-60'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Icon
              size={20}
              weight="duotone"
              className={cn(
                severity === 'info' && 'text-blue-500',
                severity === 'warning' && 'text-yellow-500',
                severity === 'error' && 'text-red-500',
                severity === 'critical' && 'text-red-600'
              )}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-black">{alert.title}</h4>
                <Badge className={cn('rounded-full text-xs', config.badge)}>{config.label}</Badge>
                {alert.resolved && (
                  <Badge className="rounded-full bg-green-100 text-green-700 text-xs">해결됨</Badge>
                )}
              </div>
              {alert.message && <p className="text-sm text-gray-600">{alert.message}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>
                  {alert.createdAt &&
                    formatDistanceToNow(new Date(alert.createdAt), {
                      addSuffix: true,
                    })}
                </span>
                <span>유형: {alert.type}</span>
              </div>
            </div>
          </div>

          {!alert.resolved && (
            <div className="flex items-center gap-2">
              {!alert.acknowledged && (
                <Button variant="secondary" size="sm" onClick={handleAcknowledge}>
                  <Check size={14} className="mr-1" />
                  확인
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={handleResolve}>
                <CheckCircle size={14} className="mr-1" />
                해결
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
