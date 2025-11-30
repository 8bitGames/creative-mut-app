import Link from 'next/link';
import { LoginForm } from './_components/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-black">로그인</h2>

      {params.message === 'check_email' && (
        <div className="mb-4 rounded-md bg-gray-100 p-3 text-sm text-gray-700">
          이메일에서 확인 링크를 확인해 주세요.
        </div>
      )}

      {params.error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          인증에 실패했습니다. 다시 시도해 주세요.
        </div>
      )}

      <LoginForm />

      <p className="mt-6 text-center text-sm text-gray-500">
        계정이 없으신가요?{' '}
        <Link href="/register" className="font-medium text-black hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}
