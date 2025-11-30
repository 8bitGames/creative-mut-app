'use client';

import { CheckCircle, Clock, Eye, Spinner, XCircle } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { MachineCommand } from '@/lib/db/types';
import { cn } from '@/lib/utils';

interface CommandHistoryProps {
  commands: MachineCommand[];
}

type CommandStatus =
  | 'pending'
  | 'sent'
  | 'received'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'timeout';

const statusConfig: Record<
  CommandStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  pending: { icon: Clock, color: 'text-gray-400', label: '대기중' },
  sent: { icon: Spinner, color: 'text-blue-500', label: '전송됨' },
  received: { icon: Spinner, color: 'text-blue-500', label: '수신됨' },
  executing: { icon: Spinner, color: 'text-yellow-500', label: '실행중' },
  completed: { icon: CheckCircle, color: 'text-green-500', label: '완료' },
  failed: { icon: XCircle, color: 'text-red-500', label: '실패' },
  timeout: { icon: XCircle, color: 'text-orange-500', label: '시간초과' },
};

export function CommandHistory({ commands }: CommandHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">명령 기록</CardTitle>
      </CardHeader>
      <CardContent>
        {commands.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">아직 실행된 명령이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {commands.map((command) => {
              const status = (command.status as CommandStatus) || 'pending';
              const config = statusConfig[status];
              const Icon = config.icon;
              const isLoading = ['sent', 'received', 'executing'].includes(status);

              return (
                <div
                  key={command.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={20}
                      weight="duotone"
                      className={cn(config.color, isLoading && 'animate-spin')}
                    />
                    <div>
                      <p className="font-medium capitalize">{command.type.replace(/-/g, ' ')}</p>
                      <p className="text-xs text-gray-500">
                        {command.createdAt &&
                          formatDistanceToNow(new Date(command.createdAt), {
                            addSuffix: true,
                          })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'rounded-full text-xs',
                        status === 'completed' && 'bg-green-100 text-green-700',
                        status === 'failed' && 'bg-red-100 text-red-700',
                        status === 'timeout' && 'bg-orange-100 text-orange-700',
                        ['pending', 'sent', 'received', 'executing'].includes(status) &&
                          'bg-blue-100 text-blue-700'
                      )}
                    >
                      {config.label}
                    </Badge>

                    {(command.result || command.errorMessage) && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Eye size={14} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>명령 결과</DialogTitle>
                          </DialogHeader>
                          {command.errorMessage ? (
                            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                              {command.errorMessage}
                            </div>
                          ) : (
                            <pre className="max-h-[300px] overflow-auto rounded-lg bg-gray-100 p-4 text-xs">
                              {JSON.stringify(command.result, null, 2)}
                            </pre>
                          )}
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
