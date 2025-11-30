'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowCounterClockwise,
  Camera,
  CreditCard,
  FloppyDisk,
  Gear,
  Monitor,
  Printer,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { saveConfig } from '@/actions/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  defaultMachineConfig,
  type MachineConfigData,
  machineConfigSchema,
} from '@/lib/config/schema';

interface ConfigEditorProps {
  machineId: string;
  currentConfig: MachineConfigData;
  currentVersion: string;
}

export function ConfigEditor({ machineId, currentConfig, currentVersion }: ConfigEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const form = useForm({
    resolver: zodResolver(machineConfigSchema),
    defaultValues: currentConfig,
  });

  const onSubmit = form.handleSubmit(async (data) => {
    setIsSaving(true);
    try {
      await saveConfig(machineId, data as MachineConfigData);
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  });

  const handleChange = () => {
    setIsDirty(true);
  };

  return (
    <form onSubmit={onSubmit} onChange={handleChange}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              현재 버전: <span className="font-mono">{currentVersion}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!isDirty}
              onClick={() => {
                form.reset(currentConfig);
                setIsDirty(false);
              }}
            >
              <ArrowCounterClockwise size={16} className="mr-1" />
              초기화
            </Button>
            <Button type="submit" disabled={!isDirty || isSaving}>
              <FloppyDisk size={16} className="mr-1" />
              {isSaving ? '저장 중...' : '변경사항 저장'}
            </Button>
          </div>
        </div>

        {/* Config tabs */}
        <Tabs defaultValue="processing">
          <TabsList>
            <TabsTrigger value="processing" className="gap-1">
              <Gear size={16} />
              처리
            </TabsTrigger>
            <TabsTrigger value="camera" className="gap-1">
              <Camera size={16} />
              카메라
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-1">
              <Monitor size={16} />
              화면
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-1">
              <CreditCard size={16} />
              결제
            </TabsTrigger>
            <TabsTrigger value="printer" className="gap-1">
              <Printer size={16} />
              프린터
            </TabsTrigger>
          </TabsList>

          {/* Processing Config */}
          <TabsContent value="processing">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">처리 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>처리 모드</Label>
                    <Select
                      value={form.watch('processing.mode') ?? defaultMachineConfig.processing.mode}
                      onValueChange={(v) =>
                        form.setValue(
                          'processing.mode',
                          v as MachineConfigData['processing']['mode']
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cloud">클라우드 전용</SelectItem>
                        <SelectItem value="local">로컬 전용</SelectItem>
                        <SelectItem value="hybrid">하이브리드</SelectItem>
                        <SelectItem value="auto">자동</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">영상 처리가 수행될 위치</p>
                  </div>

                  <div className="space-y-2">
                    <Label>품질</Label>
                    <Select
                      value={
                        form.watch('processing.quality') ?? defaultMachineConfig.processing.quality
                      }
                      onValueChange={(v) =>
                        form.setValue(
                          'processing.quality',
                          v as MachineConfigData['processing']['quality']
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">낮음</SelectItem>
                        <SelectItem value="medium">중간</SelectItem>
                        <SelectItem value="high">높음</SelectItem>
                        <SelectItem value="ultra">최고</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>최대 처리 시간 (초)</Label>
                    <Input
                      type="number"
                      {...form.register('processing.maxProcessingTime', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>재시도 횟수</Label>
                    <Input
                      type="number"
                      {...form.register('processing.retryAttempts', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">얼굴 보정</p>
                    <p className="text-sm text-gray-500">AI 기반 얼굴 보정 적용</p>
                  </div>
                  <Switch
                    checked={
                      form.watch('processing.faceEnhancement') ??
                      defaultMachineConfig.processing.faceEnhancement
                    }
                    onCheckedChange={(v) => form.setValue('processing.faceEnhancement', v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Camera Config */}
          <TabsContent value="camera">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">카메라 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>카메라 유형</Label>
                    <Select
                      value={form.watch('camera.type') ?? defaultMachineConfig.camera.type}
                      onValueChange={(v) => form.setValue('camera.type', v as 'dslr' | 'webcam')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dslr">DSLR (gphoto2)</SelectItem>
                        <SelectItem value="webcam">웹캠</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>촬영 횟수</Label>
                    <Input
                      type="number"
                      {...form.register('camera.captureCount', {
                        valueAsNumber: true,
                      })}
                    />
                    <p className="text-xs text-gray-500">세션당 사진 수</p>
                  </div>

                  <div className="space-y-2">
                    <Label>촬영 간격 (ms)</Label>
                    <Input
                      type="number"
                      {...form.register('camera.captureInterval', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>카운트다운 (초)</Label>
                    <Input
                      type="number"
                      {...form.register('camera.countdown', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>해상도 너비</Label>
                    <Input
                      type="number"
                      {...form.register('camera.resolution.width', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>해상도 높이</Label>
                    <Input
                      type="number"
                      {...form.register('camera.resolution.height', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Display Config */}
          <TabsContent value="display">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">화면 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>언어</Label>
                    <Select
                      value={
                        form.watch('display.language') ?? defaultMachineConfig.display.language
                      }
                      onValueChange={(v) =>
                        form.setValue('display.language', v as 'en' | 'ko' | 'ja')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ko">한국어</SelectItem>
                        <SelectItem value="en">영어</SelectItem>
                        <SelectItem value="ja">일본어</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>대기 시간 초과 (초)</Label>
                    <Input
                      type="number"
                      {...form.register('display.idleTimeout', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">분할 화면 모드</p>
                      <p className="text-sm text-gray-500">
                        단일 모니터에서 분할 뷰 표시 (개발 모드)
                      </p>
                    </div>
                    <Switch
                      checked={
                        form.watch('display.splitScreenMode') ??
                        defaultMachineConfig.display.splitScreenMode
                      }
                      onCheckedChange={(v) => form.setValue('display.splitScreenMode', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">디버그 정보 표시</p>
                      <p className="text-sm text-gray-500">화면에 기술 정보 표시</p>
                    </div>
                    <Switch
                      checked={
                        form.watch('display.showDebugInfo') ??
                        defaultMachineConfig.display.showDebugInfo
                      }
                      onCheckedChange={(v) => form.setValue('display.showDebugInfo', v)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Config */}
          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">결제 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">결제 활성화</p>
                    <p className="text-sm text-gray-500">처리 전 결제 필수</p>
                  </div>
                  <Switch
                    checked={form.watch('payment.enabled') ?? defaultMachineConfig.payment.enabled}
                    onCheckedChange={(v) => form.setValue('payment.enabled', v)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">테스트 모드</p>
                    <p className="text-sm text-gray-500">결제 시뮬레이션 (테스트용)</p>
                  </div>
                  <Switch
                    checked={
                      form.watch('payment.mockMode') ?? defaultMachineConfig.payment.mockMode
                    }
                    onCheckedChange={(v) => form.setValue('payment.mockMode', v)}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>통화</Label>
                    <Select
                      value={
                        form.watch('payment.currency') ?? defaultMachineConfig.payment.currency
                      }
                      onValueChange={(v) =>
                        form.setValue('payment.currency', v as 'KRW' | 'USD' | 'JPY')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KRW">KRW (원)</SelectItem>
                        <SelectItem value="USD">USD (달러)</SelectItem>
                        <SelectItem value="JPY">JPY (엔)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>기본 가격</Label>
                    <Input
                      type="number"
                      {...form.register('payment.defaultPrice', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>결제 시간 초과 (초)</Label>
                    <Input
                      type="number"
                      {...form.register('payment.timeout', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Printer Config */}
          <TabsContent value="printer">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">프린터 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">인쇄 활성화</p>
                    <p className="text-sm text-gray-500">사진 인쇄 허용</p>
                  </div>
                  <Switch
                    checked={form.watch('printer.enabled') ?? defaultMachineConfig.printer.enabled}
                    onCheckedChange={(v) => form.setValue('printer.enabled', v)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">테스트 모드</p>
                    <p className="text-sm text-gray-500">인쇄 시뮬레이션 (테스트용)</p>
                  </div>
                  <Switch
                    checked={
                      form.watch('printer.mockMode') ?? defaultMachineConfig.printer.mockMode
                    }
                    onCheckedChange={(v) => form.setValue('printer.mockMode', v)}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>용지 크기</Label>
                    <Select
                      value={
                        form.watch('printer.paperSize') ?? defaultMachineConfig.printer.paperSize
                      }
                      onValueChange={(v) =>
                        form.setValue('printer.paperSize', v as '4x6' | '5x7' | '6x8')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4x6">4x6 인치</SelectItem>
                        <SelectItem value="5x7">5x7 인치</SelectItem>
                        <SelectItem value="6x8">6x8 인치</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>인쇄 매수</Label>
                    <Input
                      type="number"
                      {...form.register('printer.copies', {
                        valueAsNumber: true,
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </form>
  );
}
