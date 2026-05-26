'use client';

import { useState, useEffect, useRef, useActionState } from 'react';
import { Plus } from 'lucide-react';
import type { ActionResult } from '@/lib/actions';
import { useActionFeedback } from '@/hooks/useActionFeedback';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

export type MasterRecord = { id: number } & Record<string, string | number | null | undefined>;

type MasterAction = (_prev: ActionResult, form: FormData) => Promise<ActionResult>;

interface ItemLabels {
  save: string;
  saving: string;
  cancel: string;
  delete: string;
  confirmDelete: string;
  edit: string;
}

function FieldInput({
  field,
  defaultValue,
}: {
  field: FieldDef;
  defaultValue?: string | null;
}) {
  const base = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
  if (field.type === 'textarea') {
    return (
      <textarea
        name={field.key}
        defaultValue={defaultValue ?? ''}
        placeholder={field.placeholder}
        required={field.required}
        rows={2}
        className={`${base} resize-none`}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select name={field.key} defaultValue={defaultValue ?? ''} required={field.required} className={base}>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type ?? 'text'}
      name={field.key}
      defaultValue={defaultValue ?? ''}
      placeholder={field.placeholder}
      required={field.required}
      className={base}
    />
  );
}

function MasterItem({
  item,
  fields,
  updateAction,
  deleteAction,
  labels,
}: {
  item: MasterRecord;
  fields: FieldDef[];
  updateAction: MasterAction;
  deleteAction: MasterAction;
  labels: ItemLabels;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [updateState, updateFormAction] = useActionState(updateAction, null);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, null);
  const { errorMsg: updateError } = useActionFeedback(updateState, '');
  const { errorMsg: deleteError } = useActionFeedback(deleteState, '');

  useEffect(() => {
    if (updateState && 'success' in updateState) setEditing(false);
  }, [updateState]);

  const noteField = fields.find((f) => f.type === 'textarea');
  const inlineFields = fields.filter((f) => f.type !== 'textarea' && f.key !== 'name');
  const secondaryParts = inlineFields
    .map((f) => {
      const v = item[f.key];
      if (!v) return null;
      if (f.type === 'select') {
        return f.options?.find((o) => o.value === v)?.label ?? String(v);
      }
      return String(v);
    })
    .filter(Boolean);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      {editing ? (
        <form action={updateFormAction} className="space-y-2">
          <input type="hidden" name="id" value={item.id} />
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-slate-500 block mb-0.5">
                {field.label}{field.required && ' *'}
              </label>
              <FieldInput field={field} defaultValue={item[field.key] as string | null} />
            </div>
          ))}
          {updateError && <p className="text-red-600 text-xs">{updateError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit"
              className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium">
              {labels.save}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100 transition-colors">
              {labels.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800">{String(item.name ?? '')}</p>
            {secondaryParts.length > 0 && (
              <p className="text-sm text-slate-500 mt-0.5">{secondaryParts.join(' · ')}</p>
            )}
            {noteField && item[noteField.key] && (
              <p className="text-xs text-slate-400 mt-0.5">{String(item[noteField.key])}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setEditing(true)}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors">
              {labels.edit}
            </button>
            {confirming ? (
              <>
                <span className="text-xs text-slate-400">{labels.confirmDelete}</span>
                <button type="button" onClick={() => setConfirming(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded">
                  {labels.cancel}
                </button>
                <form action={deleteFormAction} className="inline">
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit"
                    className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded">
                    {labels.delete}
                  </button>
                </form>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(true)}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                {labels.delete}
              </button>
            )}
          </div>
        </div>
      )}
      {deleteError && <p className="text-red-600 text-xs mt-1">{deleteError}</p>}
    </div>
  );
}

function AddItemForm({
  fields,
  addAction,
  labels,
  onClose,
}: {
  fields: FieldDef[];
  addAction: MasterAction;
  labels: { add: string; adding: string; cancel: string };
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(addAction, null);
  const { errorMsg } = useActionFeedback(state, '');

  useEffect(() => {
    if (state && 'success' in state) {
      formRef.current?.reset();
      onClose();
    }
  }, [state, onClose]);

  return (
    <form ref={formRef} action={formAction}
      className="bg-white rounded-xl border-2 border-dashed border-green-400 p-4 space-y-2">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="text-xs text-slate-500 block mb-0.5">
            {field.label}{field.required && ' *'}
          </label>
          <FieldInput field={field} defaultValue={null} />
        </div>
      ))}
      {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit"
          className="px-3 py-1.5 bg-green-700 text-white text-xs rounded-lg hover:bg-green-800 transition-colors font-medium">
          {labels.add}
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-1.5 text-slate-500 text-xs rounded-lg hover:bg-slate-100 transition-colors">
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

export default function MasterList({
  items,
  fields,
  addAction,
  updateAction,
  deleteAction,
  labels,
}: {
  items: MasterRecord[];
  fields: FieldDef[];
  addAction: MasterAction;
  updateAction: MasterAction;
  deleteAction: MasterAction;
  labels: {
    empty: string;
    addNew: string;
    add: string;
    adding: string;
    save: string;
    saving: string;
    cancel: string;
    delete: string;
    confirmDelete: string;
    edit: string;
  };
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="space-y-3">
      {showAddForm ? (
        <AddItemForm
          fields={fields}
          addAction={addAction}
          labels={labels}
          onClose={() => setShowAddForm(false)}
        />
      ) : (
        <button type="button" onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-green-400 hover:text-green-700 transition-colors">
          <Plus size={15} /> {labels.addNew}
        </button>
      )}

      {items.length === 0 && !showAddForm && (
        <p className="text-slate-400 text-sm">{labels.empty}</p>
      )}

      {items.map((item) => (
        <MasterItem
          key={item.id}
          item={item}
          fields={fields}
          updateAction={updateAction}
          deleteAction={deleteAction}
          labels={labels}
        />
      ))}
    </div>
  );
}
