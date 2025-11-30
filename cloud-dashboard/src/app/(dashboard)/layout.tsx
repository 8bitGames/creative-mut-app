import { redirect } from 'next/navigation';
import { getUser, getUserOrganization } from '@/actions/auth';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { AuthProvider } from '@/components/providers/auth-provider';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }

  const organization = await getUserOrganization();
  if (!organization) {
    redirect('/login');
  }

  return (
    <AuthProvider initialUser={user} initialOrganization={organization}>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar - Hidden on mobile */}
        <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-gray-200 bg-white lg:block">
          <Sidebar />
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col lg:pl-64">
          {/* Header */}
          <Header />

          {/* Page content */}
          <main className="flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
