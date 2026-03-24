'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/db';
import { setSession, clearSession } from '@/lib/session';

export async function login(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) return { error: 'ユーザー名とパスワードを入力してください' };

  const { data: user } = await supabase
    .from('users')
    .select('id, username, password_hash, is_admin')
    .eq('username', username)
    .single();

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return { error: 'ユーザー名またはパスワードが正しくありません' };
  }

  await setSession({ userId: user.id, username: user.username, isAdmin: user.is_admin === 1 });
  redirect('/');
}

export async function register(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (username.length < 2) return { error: 'ユーザー名は2文字以上です' };
  if (password.length < 4) return { error: 'パスワードは4文字以上です' };

  const { data: exists } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();
  if (exists) return { error: 'そのユーザー名はすでに使われています' };

  const hash = bcrypt.hashSync(password, 10);
  const id = crypto.randomUUID();

  const { error } = await supabase.from('users').insert({
    id,
    username,
    password_hash: hash,
    balance: 50000,
    is_admin: 0,
    created_at: new Date().toISOString(),
  });

  if (error) return { error: 'ユーザー登録に失敗しました' };

  await setSession({ userId: id, username, isAdmin: false });
  redirect('/');
}

export async function logout() {
  await clearSession();
  redirect('/login');
}
