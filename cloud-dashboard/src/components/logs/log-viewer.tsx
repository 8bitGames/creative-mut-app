'use client';

import { ArrowDown, Download, MagnifyingGlass, Pause, Play, Trash } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MachineLog } from '@/lib/db/types';
import type { LogCategory, LogLevel } from '@/lib/logs/types';
import { cn } from '@/lib/utils';

interface LogViewerProps {
  machineId: string;
  initialLogs: MachineLog[];
}

const levelColors: Record<LogLevel, string> = {
  debug: 'text-gray-500',
  info: 'text-blue-600',
  warn: 'text-yellow-600',
  error: 'text-red-600',
};

export function LogViewer({ machineId, initialLogs }: LogViewerProps) {
  const [logs, setLogs] = useState<MachineLog[]>(initialLogs);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'all'>('all');
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleExport = () => {
    const content = filteredLogs
      .map(
        (log) =>
          `[${format(new Date(log.timestamp!), 'yyyy-MM-dd HH:mm:ss')}] [${log.level.toUpperCase()}] ${log.category ? `[${log.category}] ` : ''}${log.message}`
      )
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${machineId}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">실시간 로그</CardTitle>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsPaused(!isPaused)}>
              {isPaused ? (
                <>
                  <Play size={14} className="mr-1" />
                  재개
                </>
              ) : (
                <>
                  <Pause size={14} className="mr-1" />
                  일시정지
                </>
              )}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download size={14} className="mr-1" />
              내보내기
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setLogs([])}>
              <Trash size={14} className="mr-1" />
              지우기
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <Input
              placeholder="로그 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LogLevel | 'all')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="레벨" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 레벨</SelectItem>
              <SelectItem value="debug">디버그</SelectItem>
              <SelectItem value="info">정보</SelectItem>
              <SelectItem value="warn">경고</SelectItem>
              <SelectItem value="error">오류</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as LogCategory | 'all')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 카테고리</SelectItem>
              <SelectItem value="system">시스템</SelectItem>
              <SelectItem value="camera">카메라</SelectItem>
              <SelectItem value="processing">처리</SelectItem>
              <SelectItem value="payment">결제</SelectItem>
              <SelectItem value="printer">프린터</SelectItem>
              <SelectItem value="network">네트워크</SelectItem>
              <SelectItem value="session">세션</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Log output */}
        <div
          ref={logContainerRef}
          className="h-[400px] overflow-auto rounded-lg bg-gray-900 p-4 font-mono text-sm"
          onScroll={(e) => {
            const element = e.currentTarget;
            const isAtBottom =
              element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
            setAutoScroll(isAtBottom);
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              표시할 로그가 없습니다
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => (
                <LogLine key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>

        {/* Auto-scroll indicator */}
        {!autoScroll && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => {
              setAutoScroll(true);
              if (logContainerRef.current) {
                logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
              }
            }}
          >
            <ArrowDown size={14} className="mr-1" />맨 아래로 스크롤
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function LogLine({ log }: { log: MachineLog }) {
  const [expanded, setExpanded] = useState(false);
  const metadata = log.metadata as Record<string, unknown> | null;
  const hasMetadata = metadata && Object.keys(metadata).length > 0;

  return (
    <div
      className={cn('group rounded px-2 py-1 hover:bg-gray-800', hasMetadata && 'cursor-pointer')}
      onClick={() => hasMetadata && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <span className="text-gray-500 whitespace-nowrap">
          {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss.SSS') : '--:--:--'}
        </span>
        <span className={cn('w-14 uppercase', levelColors[log.level as LogLevel])}>
          [{log.level}]
        </span>
        {log.category && <span className="text-gray-400">[{log.category}]</span>}
        <span className="text-gray-200 flex-1 break-all">{log.message}</span>
      </div>

      {expanded && hasMetadata && (
        <pre className="mt-2 ml-20 rounded bg-gray-800 p-2 text-xs text-gray-400">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}
