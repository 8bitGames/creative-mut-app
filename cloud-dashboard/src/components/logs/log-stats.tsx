import { Bug, Info, Warning, XCircle } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent } from '@/components/ui/card';

interface LogStatsProps {
  stats: {
    debug: number;
    info: number;
    warn: number;
    error: number;
  };
}

export function LogStats({ stats }: LogStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-gray-100 p-2">
            <Bug size={20} className="text-gray-500" weight="duotone" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{stats.debug}</p>
            <p className="text-sm text-gray-500">디버그</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-blue-50 p-2">
            <Info size={20} className="text-blue-500" weight="duotone" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{stats.info}</p>
            <p className="text-sm text-gray-500">정보</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-yellow-50 p-2">
            <Warning size={20} className="text-yellow-500" weight="duotone" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{stats.warn}</p>
            <p className="text-sm text-gray-500">경고</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-red-50 p-2">
            <XCircle size={20} className="text-red-500" weight="duotone" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{stats.error}</p>
            <p className="text-sm text-gray-500">오류</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
