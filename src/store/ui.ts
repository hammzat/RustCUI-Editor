"use client";

import { create } from "zustand";

export type DialogKind = "export" | "import" | "new" | "shortcuts" | null;

interface UiState {
  cursor: { x: number; y: number } | null;
  /** Effective canvas zoom (resolved "fit" value included). */
  zoom: number;
  toast: { id: number; text: string } | null;
  dialog: DialogKind;
  setCursor(c: { x: number; y: number } | null): void;
  notify(text: string): void;
  open(d: DialogKind): void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>()((set) => ({
  cursor: null,
  zoom: 1,
  toast: null,
  dialog: null,
  setCursor: (cursor) => set({ cursor }),
  notify: (text) => {
    clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), text } });
    toastTimer = setTimeout(() => set({ toast: null }), 2000);
  },
  open: (dialog) => set({ dialog }),
}));
