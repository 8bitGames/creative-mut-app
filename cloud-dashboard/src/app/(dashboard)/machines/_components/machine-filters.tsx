'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import { parseAsString, useQueryState } from 'nuqs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function MachineFilters() {
  const [status, setStatus] = useQueryState('status', parseAsString);
  const [search, setSearch] = useQueryState('q', parseAsString);

  return (
    <div className="flex flex-wrap gap-4">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <Input
          placeholder="기기 검색..."
          value={search || ''}
          onChange={(e) => setSearch(e.target.value || null)}
          className="pl-9"
        />
      </div>

      {/* Status filter */}
      <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? null : v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="전체 상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          <SelectItem value="online">온라인</SelectItem>
          <SelectItem value="offline">오프라인</SelectItem>
          <SelectItem value="busy">사용중</SelectItem>
          <SelectItem value="error">오류</SelectItem>
          <SelectItem value="maintenance">점검중</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
