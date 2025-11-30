import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { getSessions } from '@/actions/sessions';
import { SessionTable } from '@/components/sessions/session-table';
import { Button } from '@/components/ui/button';

interface SessionListProps {
  filters: {
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    machine?: string;
    cursor?: string;
  };
}

export async function SessionList({ filters }: SessionListProps) {
  const { sessions, nextCursor, prevCursor, total } = await getSessions({
    ...filters,
    limit: 20,
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="text-sm text-gray-500">
        전체 {total}개 중 {sessions.length}개 표시
      </div>

      {/* Table */}
      <SessionTable sessions={sessions} />

      {/* Pagination */}
      {(nextCursor || prevCursor) && (
        <div className="flex items-center justify-between">
          <Button variant="secondary" disabled={!prevCursor} asChild={!!prevCursor}>
            {prevCursor ? (
              <Link
                href={{
                  pathname: '/sessions',
                  query: { ...filters, cursor: prevCursor },
                }}
              >
                <CaretLeft size={16} className="mr-1" />
                이전
              </Link>
            ) : (
              <>
                <CaretLeft size={16} className="mr-1" />
                이전
              </>
            )}
          </Button>

          <Button variant="secondary" disabled={!nextCursor} asChild={!!nextCursor}>
            {nextCursor ? (
              <Link
                href={{
                  pathname: '/sessions',
                  query: { ...filters, cursor: nextCursor },
                }}
              >
                다음
                <CaretRight size={16} className="ml-1" />
              </Link>
            ) : (
              <>
                다음
                <CaretRight size={16} className="ml-1" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
