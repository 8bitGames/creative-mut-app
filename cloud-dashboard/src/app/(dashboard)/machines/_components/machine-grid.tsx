import { getMachines } from '@/actions/machines';
import { MachineCard } from '@/components/machines/machine-card';

interface MachineGridProps {
  filters: {
    status?: string;
    location?: string;
    q?: string;
  };
}

export async function MachineGrid({ filters }: MachineGridProps) {
  const machines = await getMachines(filters);

  if (machines.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">등록된 기기가 없습니다</p>
        <p className="mt-1 text-sm text-gray-400">기기를 추가하여 시작하세요</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {machines.map((machine) => (
        <MachineCard key={machine.id} machine={machine} />
      ))}
    </div>
  );
}
