'use client';

import { Bell, SignOut, User } from '@phosphor-icons/react';
import { logout } from '@/actions/auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Breadcrumbs } from './breadcrumbs';
import { MobileNav } from './mobile-nav';

export function Header() {
  const { user, organization } = useAuth();

  const initials =
    user?.user_metadata?.name
      ?.split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U';

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger */}
        <MobileNav />

        {/* Breadcrumbs */}
        <Breadcrumbs />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Organization name */}
        <span className="hidden text-sm text-gray-500 md:block">{organization?.name}</span>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={20} weight="regular" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-black text-white text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.user_metadata?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings" className="flex items-center gap-2">
                <User size={16} />
                계정 설정
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => logout()}>
              <SignOut size={16} className="mr-2" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
