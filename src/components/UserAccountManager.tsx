'use client';

import { useState, useEffect, useActionState } from 'react';
import { KeyRound, Trash2, Plus, X } from 'lucide-react';
import type { ActionResult } from '@/lib/actions';
import { createSubUser, deleteSubUser } from '@/lib/actions';

interface Profile {
  id: number;
  name: string;
  auth_user_id: string | null;
}

interface Labels {
  loginAccount: string;
  hasAccount: string;
  noAccount: string;
  createAccount: string;
  deleteAccount: string;
  accountEmail: string;
  accountPassword: string;
  accountCreated: string;
  accountDeleted: string;
  confirmDeleteAccount: string;
  cancel: string;
}

function CreateAccountForm({ profileId, labels, onDone }: { profileId: number; labels: Labels; onDone: () => void }) {
  const [state, action, pending] = useActionState(createSubUser, null as ActionResult | null);
  useEffect(() => { if (state && 'success' in state) onDone(); }, [state, onDone]);

  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <input
        type="email"
        name="email"
        required
        placeholder={labels.accountEmail}
        className="block w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <input
        type="password"
        name="password"
        required
        minLength={8}
        placeholder={labels.accountPassword}
        className="block w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      {state && 'error' in state && <p className="text-xs text-red-500">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 disabled:opacity-50"
        >
          {pending ? '…' : labels.createAccount}
        </button>
        <button type="button" onClick={onDone} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">
          <X size={16} />
        </button>
      </div>
    </form>
  );
}

function AccountRow({ profile, labels }: { profile: Profile; labels: Labels }) {
  const [showCreate, setShowCreate] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSubUser, null as ActionResult | null);

  const hasAccount = !!profile.auth_user_id;

  return (
    <div className="flex items-start justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{profile.name}</p>
        <p className="text-xs mt-0.5">
          {hasAccount ? (
            <span className="text-emerald-600 flex items-center gap-1"><KeyRound size={11} />{labels.hasAccount}</span>
          ) : (
            <span className="text-slate-400">{labels.noAccount}</span>
          )}
        </p>
        {deleteState && 'error' in deleteState && <p className="text-xs text-red-500 mt-0.5">{deleteState.error}</p>}
        {showCreate && !hasAccount && (
          <CreateAccountForm profileId={profile.id} labels={labels} onDone={() => setShowCreate(false)} />
        )}
      </div>
      <div className="ml-3 flex-shrink-0">
        {!hasAccount && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg px-2 py-1"
          >
            <Plus size={12} />{labels.createAccount}
          </button>
        )}
        {hasAccount && (
          <form action={deleteAction}>
            <input type="hidden" name="profile_id" value={profile.id} />
            <button
              type="submit"
              disabled={deletePending}
              onClick={(e) => { if (!confirm(labels.confirmDeleteAccount)) e.preventDefault(); }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-2 py-1 disabled:opacity-50"
            >
              <Trash2 size={12} />{labels.deleteAccount}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function UserAccountManager({ profiles, labels }: { profiles: Profile[]; labels: Labels }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 mt-6">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <KeyRound size={15} className="text-indigo-500" />
          {labels.loginAccount}
        </h2>
      </div>
      <div className="px-4">
        {profiles.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">{labels.noAccount}</p>
        ) : (
          profiles.map((p) => <AccountRow key={p.id} profile={p} labels={labels} />)
        )}
      </div>
    </div>
  );
}
