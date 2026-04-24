'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { setSession, clearSession } from '@/lib/session';
import type { ActionResult } from '@/lib/actions';

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { error: 'ユーザー名とパスワードを入力してください' };
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, username, password_hash, is_admin')
    .eq('username', username)
    .single();

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return { error: 'ユーザー名またはパスワードが正しくありません' };
  }

  await setSession({ userId: user.id, username: user.username, isAdmin: user.is_admin });
  redirect('/');
}

export async function logout() {
  await clearSession();
  redirect('/login');
}
