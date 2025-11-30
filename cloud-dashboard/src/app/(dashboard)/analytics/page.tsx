import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { OverviewCharts } from './_components/overview-charts';
import { OverviewStats } from './_components/overview-stats';

interface PageProps {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-black">분석</h1>
      </div>

      {/* Stats */}
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        }
      >
        <OverviewStats dateRange={params} />
      </Suspense>

      {/* Charts */}
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[400px] rounded-lg" />
            <Skeleton className="h-[400px] rounded-lg" />
          </div>
        }
      >
        <OverviewCharts dateRange={params} />
      </Suspense>
    </div>
  );
}
