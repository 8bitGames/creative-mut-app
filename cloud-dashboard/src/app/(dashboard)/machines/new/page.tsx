'use client';

import { CaretLeft, Desktop, SpinnerGap } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { registerMachine } from '@/actions/machines';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewMachinePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const hardwareId = formData.get('hardwareId') as string;
    const name = formData.get('name') as string;

    try {
      const trimmedName = name.trim();
      const machine = await registerMachine({
        hardwareId: hardwareId.trim(),
        ...(trimmedName ? { name: trimmedName } : {}),
      });

      if (!machine) {
        throw new Error('Failed to register machine');
      }

      router.push(`/machines/${machine.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '기기 등록에 실패했습니다');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/machines">
            <CaretLeft size={20} />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-black">기기 추가</h1>
          <p className="text-sm text-gray-500">조직에 새 기기를 등록합니다</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Desktop size={24} />
              기기 등록
            </CardTitle>
            <CardDescription>
              기기의 하드웨어 ID를 입력하여 조직에 등록하세요. 하드웨어 ID는 기기 설정 또는 장치
              라벨에서 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="hardwareId">하드웨어 ID *</Label>
                <Input
                  id="hardwareId"
                  name="hardwareId"
                  placeholder="예: MUT-2024-001"
                  required
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">포토부스 기기의 고유 식별자</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">표시 이름</Label>
                <Input id="name" name="name" placeholder="예: 강남점 1호기" />
                <p className="text-xs text-gray-500">기기를 식별하기 위한 이름 (선택사항)</p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <SpinnerGap size={16} className="mr-2 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    '기기 등록'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
