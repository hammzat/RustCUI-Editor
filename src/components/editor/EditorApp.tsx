"use client";

import { useEffect } from "react";
import { layoutProject, screenBox } from "@/lib/cui/geometry";
import { designScale, useEditor } from "@/store/editor";
import { useUi } from "@/store/ui";
import { Canvas } from "./Canvas";
import { Dialogs } from "./dialogs/Dialogs";
import { Inspector } from "./inspector/Inspector";
import { LayersPanel } from "./LayersPanel";
import { StatusBar } from "./StatusBar";
import { download, PROJECT_FORMAT, slug, TopBar } from "./TopBar";

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const ui = useUi.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Global shortcuts that work even while typing.
      if (mod && key === "s") {
        e.preventDefault();
        download(`${slug(s.project.name)}.rcui.json`, JSON.stringify({ format: PROJECT_FORMAT, version: 1, project: s.project }, null, 2));
        ui.notify("Project file saved");
        return;
      }
      if (mod && key === "e") {
        e.preventDefault();
        ui.open("export");
        return;
      }
      if (mod && key === "o") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("[data-open-file]")?.click();
        return;
      }
      if (isTyping(e) || ui.dialog) return;

      if (key === "f" && !mod) {
        e.preventDefault();
        ui.setFullscreen(!ui.fullscreen);
        return;
      }
      if (key === "escape" && ui.fullscreen && !s.selectedId) {
        ui.setFullscreen(false);
        return;
      }

      const sel = s.selectedId && s.project.nodes[s.selectedId] ? s.selectedId : null;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        s.redo();
      } else if (mod && key === "d" && sel) {
        e.preventDefault();
        s.duplicate(sel);
      } else if (mod && key === "c" && sel) {
        s.copy(sel);
        ui.notify("Copied");
      } else if (mod && key === "v") {
        s.paste();
      } else if (mod && key === "n") {
        e.preventDefault();
        ui.open("new");
      } else if (mod && (key === "=" || key === "+")) {
        e.preventDefault();
        s.setView({ zoom: Math.min(4, ui.zoom * 1.2) });
      } else if (mod && key === "-") {
        e.preventDefault();
        s.setView({ zoom: Math.max(0.1, ui.zoom / 1.2) });
      } else if (mod && key === "0") {
        e.preventDefault();
        s.setView({ zoom: null });
      } else if ((key === "delete" || key === "backspace") && sel) {
        e.preventDefault();
        s.removeNode(sel);
      } else if (key === "escape") {
        s.select(sel ? s.project.nodes[sel].parentId : null);
      } else if (key === "?") {
        ui.open("shortcuts");
      } else if (sel && key.startsWith("arrow")) {
        e.preventDefault();
        // 1 / 10 design pixels (e.g. 1080p), converted to the 720p model.
        const step = (e.shiftKey ? 10 : 1) / designScale(s.view);
        const box = layoutProject(s.project, screenBox(s.view.aspect)).get(sel)!;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? step : key === "arrowdown" ? -step : 0;
        s.setBox(sel, { ...box, x: box.x + dx, y: box.y + dy }, `nudge:${sel}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function useFullscreenSync() {
  useEffect(() => {
    // Leaving browser fullscreen (Esc, F11…) also leaves workspace fullscreen.
    const onChange = () => {
      if (!document.fullscreenElement && useUi.getState().fullscreen) useUi.setState({ fullscreen: false });
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
}

function Toaster() {
  const toast = useUi((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      className="pointer-events-none fixed bottom-12 left-1/2 z-200 -translate-x-1/2 animate-pop rounded-full border border-line-strong bg-panel-3/95 px-4 py-2 text-[13px] shadow-xl shadow-black/50 backdrop-blur"
    >
      {toast.text}
    </div>
  );
}

export function EditorApp() {
  useShortcuts();
  useFullscreenSync();
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LayersPanel />
        <main className="flex min-w-0 flex-1 flex-col">
          <Canvas />
          <StatusBar />
        </main>
        <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-panel">
          <Inspector />
        </aside>
      </div>
      <Dialogs />
      <Toaster />
    </div>
  );
}
