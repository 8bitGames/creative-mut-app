'use client';

import { CaretRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const routeNames: Record<string, string> = {
  overview: '대시보드',
  machines: '기기 관리',
  sessions: '세션',
  analytics: '분석',
  alerts: '알림',
  settings: '설정',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Remove locale segment if present
  const filteredSegments = segments.filter((s) => !['en', 'ko', 'ja'].includes(s));

  if (filteredSegments.length === 0) return null;

  return (
    <nav className="hidden items-center gap-1 text-sm md:flex">
      {filteredSegments.map((segment, index) => {
        const href = `/${filteredSegments.slice(0, index + 1).join('/')}`;
        const isLast = index === filteredSegments.length - 1;
        const name = routeNames[segment] || segment;

        return (
          <div key={segment} className="flex items-center gap-1">
            {index > 0 && <CaretRight size={12} className="text-gray-400" />}
            {isLast ? (
              <span className="font-medium text-black">{name}</span>
            ) : (
              <Link href={href} className="text-gray-500 hover:text-black">
                {name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
