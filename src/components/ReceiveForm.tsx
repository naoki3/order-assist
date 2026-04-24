'use client';

import { useActionState } from 'react';
import { receiveIncoming } from '@/lib/actions';

interface Props {
  id: number;
}

export default function ReceiveForm({ id }: Props) {
  const [state, action] = useActionState(receiveIncoming, null);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
        >
          Mark Received
        </button>
      </form>
      {state?.error && (
        <p className="text-red-600 text-xs text-right">{state.error}</p>
      )}
    </div>
  );
}
