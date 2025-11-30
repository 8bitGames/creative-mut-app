import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionFilters } from './_components/session-filters';
import { SessionList } from './_components/session-list';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    machine?: string;
    cursor?: string;
  }>;
}

export default async function SessionsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black">세션</h1>
      </div>

      {/* Filters */}
      <SessionFilters />

      {/* Session list */}
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        }
      >
        <SessionList filters={params} />
      </Suspense>
    </div>
  );
}
