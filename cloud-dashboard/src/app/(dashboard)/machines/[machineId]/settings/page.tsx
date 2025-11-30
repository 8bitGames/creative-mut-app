import { CaretLeft, Terminal } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCommandHistory } from '@/actions/commands';
import { getConfig, getConfigHistory } from '@/actions/config';
import { getMachine } from '@/actions/machines';
import { CommandHistory } from '@/components/commands/command-history';
import { CommandPanel } from '@/components/commands/command-panel';
import { ConfigEditor } from '@/components/config/config-editor';
import { ConfigHistory } from '@/components/config/config-history';
import { Button } from '@/components/ui/button';
import { machineConfigSchema } from '@/lib/config/schema';

interface PageProps {
  params: Promise<{ machineId: string }>;
}

export default async function MachineSettingsPage({ params }: PageProps) {
  const { machineId } = await params;

  const [machine, config, configHistory, commandHistory] = await Promise.all([
    getMachine(machineId),
    getConfig(machineId),
    getConfigHistory(machineId),
    getCommandHistory(machineId),
  ]);

  if (!machine) {
    notFound();
  }

  const currentConfig = config?.config
    ? machineConfigSchema.parse(config.config)
    : machineConfigSchema.parse({});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/machines/${machineId}`}>
              <CaretLeft size={20} />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-black">
              설정: {machine.name || '이름 없는 기기'}
            </h1>
            <p className="text-sm text-gray-500">기기 설정을 구성하고 원격 명령을 전송합니다</p>
          </div>
        </div>
        <Button variant="secondary" asChild>
          <Link href={`/machines/${machineId}/logs`}>
            <Terminal size={16} className="mr-2" />
            로그 보기
          </Link>
        </Button>
      </div>

      {/* Remote Commands */}
      <CommandPanel machineId={machineId} machineStatus={machine.status || 'offline'} />

      {/* Command History */}
      <CommandHistory commands={commandHistory} />

      {/* Config Editor */}
      <ConfigEditor
        machineId={machineId}
        currentConfig={currentConfig}
        currentVersion={config?.version || 'v0'}
      />

      {/* Config History */}
      <ConfigHistory machineId={machineId} versions={configHistory} />
    </div>
  );
}
