import { Plus } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MachineFilters } from './_components/machine-filters';
import { MachineGrid } from './_components/machine-grid';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    location?: string;
    q?: string;
  }>;
}

export default async function MachinesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black">기기 관리</h1>
        <Button asChild>
          <Link href="/machines/new">
            <Plus size={16} className="mr-2" />
            기기 추가
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <MachineFilters />

      {/* Machine grid */}
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        }
      >
        <MachineGrid filters={params} />
      </Suspense>
    </div>
  );
}
