'use client';

import { MapPin, Pencil, Plus, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { createLocation, deleteLocation, updateLocation } from '@/actions/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Location {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  isActive: boolean | null;
  metadata: unknown;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface LocationSettingsProps {
  locations: Location[];
}

export function LocationSettings({ locations }: LocationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    timezone: 'Asia/Seoul',
  });
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setFormData({
      name: '',
      address: '',
      city: '',
      country: '',
      timezone: 'Asia/Seoul',
    });
    setEditingLocation(null);
  }

  function openEdit(location: Location) {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      address: location.address || '',
      city: location.city || '',
      country: location.country || '',
      timezone: location.timezone || 'Asia/Seoul',
    });
    setIsOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, formData);
      } else {
        await createLocation(formData);
      }
      setIsOpen(false);
      resetForm();
    } catch (_error) {
      alert('위치 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(locationId: string) {
    if (!confirm('이 위치를 삭제하시겠습니까?')) return;

    try {
      await deleteLocation(locationId);
    } catch (_error) {
      alert('위치 삭제에 실패했습니다');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>위치</CardTitle>
            <CardDescription>포토부스 위치를 관리합니다</CardDescription>
          </div>
          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus size={16} className="mr-2" />
                위치 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLocation ? '위치 수정' : '위치 추가'}</DialogTitle>
                <DialogDescription>
                  {editingLocation
                    ? '위치 정보를 수정합니다'
                    : '포토부스를 위한 새 위치를 추가합니다'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">위치 이름 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="강남점"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">주소</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="서울시 강남구 테헤란로 123"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">도시</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="서울"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">국가</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="대한민국"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">시간대</Label>
                  <Input
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    placeholder="Asia/Seoul"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                    취소
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? '저장 중...' : editingLocation ? '수정' : '생성'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {locations.map((location) => (
              <div
                key={location.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <MapPin size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{location.name}</p>
                      {location.isActive ? (
                        <Badge className="bg-green-100 text-green-700">활성</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">비활성</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {[location.address, location.city, location.country]
                        .filter(Boolean)
                        .join(', ') || '주소 없음'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(location)}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(location.id)}>
                    <Trash size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            {locations.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                <MapPin size={32} className="mx-auto mb-2 text-gray-300" />
                <p>아직 위치가 없습니다</p>
                <p className="text-sm">첫 번째 위치를 추가해 시작하세요</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
