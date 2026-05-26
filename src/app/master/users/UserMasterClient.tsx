'use client';

import { useState, useActionState } from 'react';
import { Plus } from 'lucide-react';
import { inviteUser } from '@/lib/actions';
import { useActionFeedback } from '@/hooks/useActionFeedback';

interface AuthUser {
  id: string;
  email: string | undefined;
  created_at: string;
}

interface Labels {
  email: string;
  createdAt: string;
  empty: string;
  inviteTitle: string;
  inviteEmail: string;
  invite: string;
  inviting: string;
  invited: string;
  cancel: string;
}

function InviteForm({ labels, onClose }: { labels: Labels; onClose: () => void }) {
  const [state, formAction] = useActionState(inviteUser, null);
  const { successMsg, errorMsg } = useActionFeedback(state, labels.invited);

  return (
    <form action={formAction}
      className="bg-white rounded-xl border-2 border-dashed border-green-400 p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">{labels.inviteTitle}</p>
      <input
        type="email"
        name="email"
        required
        placeholder={labels.inviteEmail}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
      {successMsg && <p className="text-green-600 text-xs">{successMsg}</p>}
      <div className="flex gap-2">
        <button type="submit"
          className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium">
          {labels.invite}
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100 transition-colors">
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

export default function UserMasterClient({
  users,
  labels,
}: {
  users: AuthUser[];
  labels: Labels;
}) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="space-y-3">
      {showInvite ? (
        <InviteForm labels={labels} onClose={() => setShowInvite(false)} />
      ) : (
        <button type="button" onClick={() => setShowInvite(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-green-400 hover:text-green-700 transition-colors">
          <Plus size={15} /> {labels.invite}
        </button>
      )}

      {users.length === 0 && (
        <p className="text-slate-400 text-sm">{labels.empty}</p>
      )}

      {users.map((user) => (
        <div key={user.id} className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-800">{user.email ?? '(no email)'}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {labels.createdAt}: {user.created_at.slice(0, 10)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
