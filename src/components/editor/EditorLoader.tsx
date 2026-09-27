"use client";

import dynamic from "next/dynamic";
import { Logo } from "./Logo";

// The editor lives entirely in the browser (localStorage, pointer math),
// so skip prerendering it and show a splash instead.
const EditorApp = dynamic(() => import("./EditorApp").then((m) => m.EditorApp), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-bg">
      <div className="flex animate-pulse items-center gap-3 text-muted">
        <Logo className="size-8" />
        <span className="text-sm tracking-wide">Loading editor…</span>
      </div>
    </div>
  ),
});

export function EditorLoader() {
  return <EditorApp />;
}
