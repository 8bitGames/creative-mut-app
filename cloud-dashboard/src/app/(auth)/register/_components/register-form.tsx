'use client';

import { CircleNotch } from '@phosphor-icons/react';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { register } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
          계정 생성 중...
        </>
      ) : (
        '회원가입'
      )}
    </Button>
  );
}

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await register(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-2">
        <Label htmlFor="name">이름</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="홍길동"
          required
          autoComplete="name"
          minLength={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="example@email.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="8자 이상 입력하세요"
          required
          autoComplete="new-password"
          minLength={8}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="organizationName">조직명</Label>
        <Input
          id="organizationName"
          name="organizationName"
          type="text"
          placeholder="회사명을 입력하세요"
          required
          minLength={2}
        />
      </div>

      <SubmitButton />
    </form>
  );
}
