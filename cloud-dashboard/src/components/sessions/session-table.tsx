'use client';

import { DotsThree, Eye, Image, Link as LinkIcon } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Session } from '@/lib/db/types';
import { cn } from '@/lib/utils';

interface SessionTableProps {
  sessions: Session[];
  showMachine?: boolean;
}

const statusStyles = {
  started: { badge: 'bg-gray-100 text-gray-700', label: '시작됨' },
  capturing: { badge: 'bg-blue-100 text-blue-700', label: '촬영중' },
  processing: { badge: 'bg-yellow-100 text-yellow-700', label: '처리중' },
  completed: { badge: 'bg-green-100 text-green-700', label: '완료' },
  failed: { badge: 'bg-red-100 text-red-700', label: '실패' },
  cancelled: { badge: 'bg-gray-100 text-gray-500', label: '취소됨' },
};

export function SessionTable({ sessions, showMachine = true }: SessionTableProps) {
  const copyToClipboard = async (url: string) => {
    await navigator.clipboard.writeText(url);
  };

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-gray-500">
        세션이 없습니다
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>세션 코드</TableHead>
            {showMachine && <TableHead>기기</TableHead>}
            <TableHead>상태</TableHead>
            <TableHead>프레임</TableHead>
            <TableHead>처리시간</TableHead>
            <TableHead>시작시간</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => {
            const status = session.status as keyof typeof statusStyles;
            const styles = statusStyles[status] || statusStyles.started;

            return (
              <TableRow key={session.id}>
                <TableCell className="font-mono text-sm">{session.sessionCode}</TableCell>
                {showMachine && (
                  <TableCell>
                    <Link
                      href={`/machines/${session.machineId}`}
                      className="text-sm hover:underline"
                    >
                      {session.machineId.slice(0, 8)}...
                    </Link>
                  </TableCell>
                )}
                <TableCell>
                  <Badge className={cn('rounded-full', styles.badge)}>{styles.label}</Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500">{session.frameId || '-'}</TableCell>
                <TableCell className="text-sm">
                  {session.processingTimeMs
                    ? `${(session.processingTimeMs / 1000).toFixed(1)}s`
                    : '-'}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {session.startedAt
                    ? formatDistanceToNow(new Date(session.startedAt), {
                        addSuffix: true,
                      })
                    : '-'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <DotsThree size={16} weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/sessions/${session.id}`} className="flex items-center gap-2">
                          <Eye size={16} />
                          상세 보기
                        </Link>
                      </DropdownMenuItem>
                      {session.processedVideoUrl && (
                        <>
                          <DropdownMenuItem
                            onClick={() => copyToClipboard(session.processedVideoUrl!)}
                          >
                            <LinkIcon size={16} className="mr-2" />
                            영상 URL 복사
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={session.processedVideoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              <Image size={16} />
                              영상 보기
                            </a>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
