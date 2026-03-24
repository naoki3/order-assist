'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(
    async (_: unknown, formData: FormData) => login(formData),
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-green-700 mb-6">⚽ SoccerBet</h1>
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー名</label>
            <input
              name="username"
              type="text"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              name="password"
              type="password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {state?.error && (
            <p className="text-red-500 text-sm">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {pending ? 'サインイン中...' : 'サインイン'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          アカウントがない方は{' '}
          <Link href="/register" className="text-green-600 hover:underline">新規登録</Link>
        </p>
      </div>
    </div>
  );
}
