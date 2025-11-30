'use client';

import type { User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Organization } from '@/lib/db/types';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  organization: null,
  loading: true,
});

export function AuthProvider({
  children,
  initialUser,
  initialOrganization,
}: {
  children: React.ReactNode;
  initialUser: User | null;
  initialOrganization: Organization | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [organization] = useState<Organization | null>(initialOrganization);
  const [loading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, organization, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
