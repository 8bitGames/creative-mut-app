'use client';

import { useState } from 'react';
import { updateOrganizationSettings } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GeneralSettingsProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string | null;
    settings: Record<string, unknown>;
  } | null;
}

export function GeneralSettings({ organization }: GeneralSettingsProps) {
  const [name, setName] = useState(organization?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!organization) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          조직을 찾을 수 없습니다. 로그인해 주세요.
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await updateOrganizationSettings({ name });
      setMessage('설정이 저장되었습니다');
    } catch (_error) {
      setMessage('설정 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>조직 설정</CardTitle>
          <CardDescription>조직의 기본 정보를 관리합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">조직 이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="내 조직"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">조직 슬러그</Label>
              <Input id="slug" value={organization.slug} disabled className="bg-gray-50" />
              <p className="text-sm text-gray-500">슬러그는 변경할 수 없습니다</p>
            </div>

            {message && (
              <p
                className={`text-sm ${
                  message.includes('저장') ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {message}
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? '저장 중...' : '변경사항 저장'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>요금제 및 결제</CardTitle>
          <CardDescription>현재 구독 중인 요금제</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium capitalize">{organization.plan || 'Starter'} 요금제</p>
              <p className="text-sm text-gray-500">현재 결제 주기는 매월 1일에 종료됩니다</p>
            </div>
            <Button variant="secondary">요금제 업그레이드</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">위험 영역</CardTitle>
          <CardDescription>되돌릴 수 없는 작업</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">조직 삭제</p>
              <p className="text-sm text-gray-500">이 조직과 모든 데이터를 영구적으로 삭제합니다</p>
            </div>
            <Button variant="destructive">조직 삭제</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
