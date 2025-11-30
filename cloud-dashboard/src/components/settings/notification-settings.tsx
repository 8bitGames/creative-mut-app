'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const defaultSettings: NotificationSetting[] = [
  {
    id: 'machine_offline',
    label: '기기 오프라인',
    description: '기기가 오프라인 상태가 되면 알림을 받습니다',
    enabled: true,
  },
  {
    id: 'critical_alerts',
    label: '심각한 알림',
    description: '심각한 문제에 대한 알림을 받습니다',
    enabled: true,
  },
  {
    id: 'daily_summary',
    label: '일일 요약',
    description: '세션 및 매출에 대한 일일 요약을 받습니다',
    enabled: false,
  },
  {
    id: 'weekly_report',
    label: '주간 리포트',
    description: '주간 분석 리포트를 받습니다',
    enabled: true,
  },
  {
    id: 'session_failures',
    label: '세션 실패',
    description: '세션이 실패하면 알림을 받습니다',
    enabled: true,
  },
  {
    id: 'printer_issues',
    label: '프린터 문제',
    description: '프린터 오류 또는 용지 부족 알림을 받습니다',
    enabled: true,
  },
];

export function NotificationSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);

  function handleToggle(id: string) {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    // In a real app, this would save to the database
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>이메일 알림</CardTitle>
          <CardDescription>이메일로 받을 알림을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.map((setting) => (
            <div key={setting.id} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={setting.id} className="font-medium">
                  {setting.label}
                </Label>
                <p className="text-sm text-gray-500">{setting.description}</p>
              </div>
              <Switch
                id={setting.id}
                checked={setting.enabled}
                onCheckedChange={() => handleToggle(setting.id)}
              />
            </div>
          ))}
          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '설정 저장'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>푸시 알림</CardTitle>
          <CardDescription>브라우저 푸시 알림을 설정합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">푸시 알림 활성화</p>
              <p className="text-sm text-gray-500">브라우저에서 실시간 알림을 받습니다</p>
            </div>
            <Button variant="secondary">활성화</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slack 연동</CardTitle>
          <CardDescription>Slack 워크스페이스로 알림을 보냅니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Slack 연결</p>
              <p className="text-sm text-gray-500">Slack 채널에서 알림과 리포트를 받습니다</p>
            </div>
            <Button variant="secondary">연결</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
