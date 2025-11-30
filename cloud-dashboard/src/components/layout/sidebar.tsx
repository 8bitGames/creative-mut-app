'use client';

import { Bell, Camera, Desktop, Gear, House } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navigation = [
  { name: '대시보드', href: '/overview', icon: House },
  { name: '기기 관리', href: '/machines', icon: Desktop },
  { name: '세션', href: '/sessions', icon: Camera },
  { name: '알림', href: '/alerts', icon: Bell },
];

const bottomNavigation = [{ name: '설정', href: '/settings', icon: Gear }];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <Link href="/overview" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black">
            <span className="text-sm font-bold text-white">M</span>
          </div>
          <span className="text-lg font-semibold text-black">MUT Cloud</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 text-black'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-black'
              )}
            >
              <Icon
                size={20}
                weight={isActive ? 'duotone' : 'regular'}
                className={isActive ? 'text-black' : 'text-gray-400'}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="border-t border-gray-200 px-3 py-4">
        {bottomNavigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 text-black'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-black'
              )}
            >
              <Icon
                size={20}
                weight={isActive ? 'duotone' : 'regular'}
                className={isActive ? 'text-black' : 'text-gray-400'}
              />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
