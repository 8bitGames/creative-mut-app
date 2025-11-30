'use client';

import { X } from '@phosphor-icons/react';
import { parseAsString, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const statuses = ['active', 'acknowledged', 'resolved', 'all'] as const;
const statusLabels: Record<string, string> = {
  active: '활성',
  acknowledged: '확인됨',
  resolved: '해결됨',
  all: '전체',
};

export function AlertFilters() {
  const [severity, setSeverity] = useQueryState('severity', parseAsString);
  const [status, setStatus] = useQueryState('status', parseAsString);

  const clearFilters = () => {
    setSeverity(null);
    setStatus(null);
  };

  const hasFilters = (severity && severity !== 'all') || (status && status !== 'active');

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Status tabs */}
      <div className="flex rounded-lg border border-gray-200 bg-white p-1">
        {statuses.map((s) => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm',
              (status || 'active') === s && 'bg-gray-100 text-black'
            )}
            onClick={() => setStatus(s === 'active' ? null : s)}
          >
            {statusLabels[s]}
          </Button>
        ))}
      </div>

      {/* Severity filter */}
      <Select value={severity || 'all'} onValueChange={(v) => setSeverity(v === 'all' ? null : v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="전체 심각도" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 심각도</SelectItem>
          <SelectItem value="critical">심각</SelectItem>
          <SelectItem value="error">오류</SelectItem>
          <SelectItem value="warning">경고</SelectItem>
          <SelectItem value="info">정보</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X size={14} className="mr-1" />
          초기화
        </Button>
      )}
    </div>
  );
}
