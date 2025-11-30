'use client';

import {
  ArrowClockwise,
  ArrowsClockwise,
  Camera,
  Power,
  Stethoscope,
  Trash,
  Wrench,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { sendCommand } from '@/actions/commands';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CommandDefinition, CommandType } from '@/lib/commands/types';
import { cn } from '@/lib/utils';

const commands: CommandDefinition[] = [
  {
    type: 'restart',
    label: '재시작',
    description: '애플리케이션을 재시작합니다',
    icon: ArrowClockwise,
    requiresConfirmation: true,
    timeout: 60000,
  },
  {
    type: 'shutdown',
    label: '종료',
    description: '기기를 종료합니다',
    icon: Power,
    requiresConfirmation: true,
    dangerous: true,
    timeout: 30000,
  },
  {
    type: 'sync-config',
    label: '설정 동기화',
    description: '최신 설정을 가져옵니다',
    icon: ArrowsClockwise,
    requiresConfirmation: false,
    timeout: 30000,
  },
  {
    type: 'clear-cache',
    label: '캐시 삭제',
    description: '임시 파일을 삭제합니다',
    icon: Trash,
    requiresConfirmation: true,
    timeout: 30000,
  },
  {
    type: 'run-diagnostics',
    label: '진단',
    description: '하드웨어 진단을 실행합니다',
    icon: Stethoscope,
    requiresConfirmation: false,
    timeout: 120000,
  },
  {
    type: 'capture-screenshot',
    label: '스크린샷',
    description: '현재 화면을 캡처합니다',
    icon: Camera,
    requiresConfirmation: false,
    timeout: 10000,
  },
  {
    type: 'toggle-maintenance',
    label: '점검 모드',
    description: '점검 모드를 전환합니다',
    icon: Wrench,
    requiresConfirmation: true,
    timeout: 10000,
  },
];

interface CommandPanelProps {
  machineId: string;
  machineStatus: string;
}

export function CommandPanel({ machineId, machineStatus }: CommandPanelProps) {
  const [pendingCommand, setPendingCommand] = useState<CommandDefinition | null>(null);
  const [isExecuting, setIsExecuting] = useState<CommandType | null>(null);

  const isOnline = machineStatus === 'online' || machineStatus === 'busy';

  const handleCommand = async (command: CommandDefinition) => {
    if (command.requiresConfirmation) {
      setPendingCommand(command);
      return;
    }

    await executeCommand(command.type);
  };

  const executeCommand = async (type: CommandType) => {
    setIsExecuting(type);
    setPendingCommand(null);

    try {
      await sendCommand(machineId, type);
    } finally {
      setIsExecuting(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">원격 명령</CardTitle>
        </CardHeader>
        <CardContent>
          {!isOnline && (
            <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-700">
              기기가 오프라인 상태입니다. 명령은 대기열에 추가되어 온라인 시 실행됩니다.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {commands.map((command) => {
              const Icon = command.icon;
              const isLoading = isExecuting === command.type;

              return (
                <Button
                  key={command.type}
                  variant="secondary"
                  className={cn(
                    'h-auto flex-col gap-2 p-4',
                    command.dangerous && 'border-red-200 hover:border-red-300 hover:bg-red-50'
                  )}
                  disabled={isLoading}
                  onClick={() => handleCommand(command)}
                >
                  <Icon
                    size={24}
                    weight="duotone"
                    className={cn(isLoading && 'animate-spin', command.dangerous && 'text-red-500')}
                  />
                  <div className="text-center">
                    <p className="font-medium">{command.label}</p>
                    <p className="text-xs text-gray-500">{command.description}</p>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!pendingCommand} onOpenChange={() => setPendingCommand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingCommand?.dangerous ? '경고' : '작업 확인'}</DialogTitle>
            <DialogDescription>
              {pendingCommand?.dangerous ? (
                <span className="text-red-600">
                  이것은 위험한 작업일 수 있습니다. {pendingCommand?.label} 작업을 실행하시겠습니까?
                </span>
              ) : (
                <>
                  {pendingCommand?.label} 작업을 실행하시겠습니까?
                  <br />
                  {pendingCommand?.description}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingCommand(null)}>
              취소
            </Button>
            <Button
              variant={pendingCommand?.dangerous ? 'destructive' : 'default'}
              onClick={() => pendingCommand && executeCommand(pendingCommand.type)}
            >
              {pendingCommand?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
