import Link from 'next/link';
import { RegisterForm } from './_components/register-form';

export default function RegisterPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-black">회원가입</h2>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-gray-500">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-medium text-black hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
