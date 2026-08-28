import { create } from 'zustand';

/** Lightweight app-wide toast. Rendered once in AppShell; any component or store action can
 *  trigger a message via `useToastStore.getState().show(...)`. Not persisted. */
interface ToastState {
  toast: { kind: 'ok' | 'info' | 'err'; text: string } | null;
  show: (kind: 'ok' | 'info' | 'err', text: string) => void;
  clear: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (kind, text) => {
    set({ toast: { kind, text } });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set({ toast: null }), 4000);
  },
  clear: () => {
    if (timer) clearTimeout(timer);
    set({ toast: null });
  },
}));
