'use client';

import { ArrowCounterClockwise, Eye } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { rollbackConfig } from '@/actions/config';
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
import type { MachineConfig } from '@/lib/db/types';

interface ConfigHistoryProps {
  machineId: string;
  versions: MachineConfig[];
}

export function ConfigHistory({ machineId, versions }: ConfigHistoryProps) {
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);

  const handleRollback = async (version: string) => {
    setIsRollingBack(version);
    try {
      await rollbackConfig(machineId, version);
    } finally {
      setIsRollingBack(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">설정 이력</CardTitle>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">아직 설정 이력이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {versions.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{config.version}</span>
                      {config.isActive && (
                        <Badge className="bg-green-100 text-green-700 text-xs">활성</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {config.createdAt &&
                        formatDistanceToNow(new Date(config.createdAt), {
                          addSuffix: true,
                        })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Eye size={14} className="mr-1" />
                        보기
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>설정 버전 {config.version}</DialogTitle>
                      </DialogHeader>
                      <pre className="max-h-[400px] overflow-auto rounded-lg bg-gray-100 p-4 text-xs">
                        {JSON.stringify(config.config, null, 2)}
                      </pre>
                    </DialogContent>
                  </Dialog>

                  {!config.isActive && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isRollingBack === config.version}
                      onClick={() => handleRollback(config.version)}
                    >
                      <ArrowCounterClockwise size={14} className="mr-1" />
                      {isRollingBack === config.version ? '롤백 중...' : '롤백'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
