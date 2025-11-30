import { Suspense } from 'react';
import { getLocations, getOrganizationSettings, getTeamMembers } from '@/actions/settings';
import { GeneralSettings } from '@/components/settings/general-settings';
import { LocationSettings } from '@/components/settings/location-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { TeamSettings } from '@/components/settings/team-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default async function SettingsPage() {
  const [organization, members, locations] = await Promise.all([
    getOrganizationSettings(),
    getTeamMembers(),
    getLocations(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black">설정</h1>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="general">일반</TabsTrigger>
          <TabsTrigger value="team">팀</TabsTrigger>
          <TabsTrigger value="locations">위치</TabsTrigger>
          <TabsTrigger value="notifications">알림</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Suspense fallback={<SettingsSkeleton />}>
            <GeneralSettings organization={organization} />
          </Suspense>
        </TabsContent>

        <TabsContent value="team">
          <Suspense fallback={<SettingsSkeleton />}>
            <TeamSettings members={members} />
          </Suspense>
        </TabsContent>

        <TabsContent value="locations">
          <Suspense fallback={<SettingsSkeleton />}>
            <LocationSettings locations={locations} />
          </Suspense>
        </TabsContent>

        <TabsContent value="notifications">
          <Suspense fallback={<SettingsSkeleton />}>
            <NotificationSettings />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}
