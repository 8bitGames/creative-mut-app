'use client';

import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { parseAsString, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SessionFilters() {
  const [status, setStatus] = useQueryState('status', parseAsString);
  const [search, setSearch] = useQueryState('q', parseAsString);

  const clearFilters = () => {
    setStatus(null);
    setSearch(null);
  };

  const hasFilters = status || search;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="세션 코드 검색..."
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
            <SelectItem value="completed">완료</SelectItem>
            <SelectItem value="processing">처리중</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
            <SelectItem value="cancelled">취소됨</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X size={16} className="mr-1" />
            초기화
          </Button>
        )}
      </div>
    </div>
  );
}
