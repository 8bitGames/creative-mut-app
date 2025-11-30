import { CheckCircle, Warning, WarningCircle, XCircle } from '@phosphor-icons/react/dist/ssr';
import { getAlertStats } from '@/actions/alerts';
import { Card, CardContent } from '@/components/ui/card';

export async function AlertStats() {
  const stats = await getAlertStats();

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-red-100 p-2">
            <XCircle size={20} className="text-red-600" weight="duotone" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{stats.critical}</p>
            <p className="text-sm text-gray-500">심각</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-red-50 p-2">
            <WarningCircle size={20} className="text-red-500" weight="duotone" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{stats.error}</p>
            <p className="text-sm text-gray-500">오류</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-yellow-50 p-2">
            <Warning size={20} className="text-yellow-500" weight="duotone" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{stats.warning}</p>
            <p className="text-sm text-gray-500">경고</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-green-50 p-2">
            <CheckCircle size={20} className="text-green-500" weight="duotone" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{stats.resolved}</p>
            <p className="text-sm text-gray-500">오늘 해결됨</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
