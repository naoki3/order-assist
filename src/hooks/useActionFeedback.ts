'use client';

import { useState, useEffect } from 'react';
import type { ActionResult } from '@/lib/actions';

export function useActionFeedback(state: ActionResult, successMessage: string) {
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (state && 'success' in state) {
      const showTimer = setTimeout(() => setSuccessMsg(successMessage), 0);
      const hideTimer = setTimeout(() => setSuccessMsg(''), 3000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [state, successMessage]);

  const errorMsg = state && 'error' in state ? state.error : '';

  return { successMsg, errorMsg };
}
