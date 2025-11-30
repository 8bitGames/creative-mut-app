import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertFilters } from './_components/alert-filters';
import { AlertList } from './_components/alert-list';
import { AlertStats } from './_components/alert-stats';

interface PageProps {
  searchParams: Promise<{
    severity?: string;
    status?: string;
    machine?: string;
  }>;
}

export default async function AlertsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black">알림</h1>
      </div>

      {/* Stats */}
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        }
      >
        <AlertStats />
      </Suspense>

      {/* Filters */}
      <AlertFilters />

      {/* Alert list */}
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        }
      >
        <AlertList filters={params} />
      </Suspense>
    </div>
  );
}
