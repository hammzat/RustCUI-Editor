"use client";

import { create } from "zustand";

export type DialogKind = "export" | "import" | "new" | "shortcuts" | null;

interface UiState {
  cursor: { x: number; y: number } | null;
  /** Effective canvas zoom (resolved "fit" value included). */
  zoom: number;
  toast: { id: number; text: string } | null;
  dialog: DialogKind;
  /** Workspace-only fullscreen: canvas fills the monitor 1:1 like in game. */
  fullscreen: boolean;
  rightTab: "inspector" | "ai";
  setRightTab(tab: "inspector" | "ai"): void;
  setFullscreen(on: boolean): void;
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
  fullscreen: false,
  rightTab: "inspector",
  setRightTab: (rightTab) => set({ rightTab }),
  setFullscreen: (on) => {
    set({ fullscreen: on });
    // Real browser fullscreen when allowed; the CSS overlay covers the rest (e.g. inside iframes).
    try {
      if (on && !document.fullscreenElement) {
        document.getElementById("workspace")?.requestFullscreen?.().catch(() => {});
      } else if (!on && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  },
  setCursor: (cursor) => set({ cursor }),
  notify: (text) => {
    clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), text } });
    toastTimer = setTimeout(() => set({ toast: null }), 2000);
  },
  open: (dialog) => set({ dialog }),
}));
