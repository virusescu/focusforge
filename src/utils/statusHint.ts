import { useSyncExternalStore } from 'react';

let hint = '';
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function setStatusHint(text: string) {
  hint = text;
  notify();
}

export function clearStatusHint() {
  hint = '';
  notify();
}

export function useStatusHint(): string {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => hint,
  );
}
