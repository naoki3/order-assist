'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { REGISTRATION_ENABLED } from '@/lib/registration';
import type { ActionResult, SignupResult } from '@/lib/actions';

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!identifier || !password) return { error: 'ログインIDとパスワードを入力してください' };

  const supabase = await createClient();
  let authUserId: string;

  if (identifier.includes('@')) {
    // Standard email login (tenant owner)
    const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
    if (error || !data.user) return { error: 'メールアドレスまたはパスワードが正しくありません' };
    authUserId = data.user.id;
  } else {
    // Login ID (sub-user)
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('auth_user_id')
      .eq('login_id', identifier.toLowerCase())
      .not('auth_user_id', 'is', null)
      .maybeSingle();

    if (!profile?.auth_user_id) return { error: 'ログインIDが見つかりません' };

    const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(profile.auth_user_id);
    if (!authUser?.email) return { error: 'アカウントが見つかりません' };

    const { data, error } = await supabase.auth.signInWithPassword({ email: authUser.email, password });
    if (error || !data.user) return { error: 'ログインIDまたはパスワードが正しくありません' };
    authUserId = data.user.id;
  }

  // Soft-delete / disable flag: a profile flagged is_active = false cannot log in.
  // Keyed by auth_user_id so it covers both sub-users and (self-profiled) owners.
  const adminClient = createAdminClient();
  const { data: flagged } = await adminClient
    .from('user_profiles')
    .select('is_active')
    .eq('auth_user_id', authUserId)
    .eq('is_active', false)
    .maybeSingle();

  if (flagged) {
    await supabase.auth.signOut();
    return { error: 'このアカウントは無効化されています。管理者にお問い合わせください。' };
  }

  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function signup(_prev: SignupResult, formData: FormData): Promise<SignupResult> {
  if (!REGISTRATION_ENABLED) return { error: '現在、新規登録は受け付けていません' };

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (!email || !password) return { error: 'Email and password are required' };
  if (password !== confirm) return { error: 'Passwords do not match' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };

  // Email confirmation disabled → session is available immediately
  if (data.session) redirect('/');

  // Email confirmation required → tell the user to check their inbox
  return { needsConfirmation: true };
}
