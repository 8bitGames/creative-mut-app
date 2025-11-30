'use client';

import { Bell, Camera, Desktop, Gear, House, List } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navigation = [
  { name: '대시보드', href: '/overview', icon: House },
  { name: '기기 관리', href: '/machines', icon: Desktop },
  { name: '세션', href: '/sessions', icon: Camera },
  { name: '알림', href: '/alerts', icon: Bell },
  { name: '설정', href: '/settings', icon: Gear },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <List size={24} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b border-gray-200 px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            MUT Cloud
          </SheetTitle>
        </SheetHeader>

        <nav className="space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}
