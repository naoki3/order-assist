'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/lib/actions';

type PermAction = (_prev: ActionResult, form: FormData) => Promise<ActionResult>;

interface Props {
  role: string;
  roleLabel: string;
  sections: readonly string[];
  sectionLabels: Record<string, string>;
  currentSections: string[];
  action: PermAction;
  saveLabel: string;
  savingLabel: string;
}

export default function RolePermissionsEditor({
  role, roleLabel, sections, sectionLabels, currentSections, action, saveLabel, savingLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null as ActionResult | null);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{roleLabel}</h2>
      <form action={formAction}>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {sections.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                name={`section_${s}`}
                defaultChecked={currentSections.includes(s)}
                className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
              {sectionLabels[s] ?? s}
            </label>
          ))}
        </div>
        {state && 'error' in state && (
          <p className="text-xs text-red-500 mb-2">{state.error}</p>
        )}
        {state && 'success' in state && (
          <p className="text-xs text-green-600 mb-2">保存しました</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg px-4 py-1.5 disabled:opacity-50"
        >
          {pending ? savingLabel : saveLabel}
        </button>
      </form>
    </div>
  );
}
