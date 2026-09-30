"use client";

import { Crosshair, Grid3x3, Magnet, Minimize2, Redo2, Undo2 } from "lucide-react";
import type { Box } from "@/lib/cui/geometry";
import { useEditor } from "@/store/editor";
import { useUi } from "@/store/ui";
import { Button, Kbd } from "@/components/ui/primitives";

/** Floating controls shown while the workspace is fullscreen. */
export function FullscreenBar({
  selBox,
  selName,
  screen,
  scale,
}: {
  selBox?: Box;
  selName?: string;
  screen: Box;
  scale: number;
}) {
  const view = useEditor((s) => s.view);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const cursor = useUi((s) => s.cursor);
  const s = useEditor.getState();
  const px = (n: number) => Math.round(n * scale);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-line-strong bg-panel-2/85 p-1 pl-3 font-mono text-[11px] text-muted opacity-35 shadow-2xl shadow-black/60 backdrop-blur-xl transition-opacity duration-200 hover:opacity-100">
        <span className="text-fg/80">
          {px(screen.w)}×{px(screen.h)}
        </span>
        <span className="text-faint">→ export {screen.w}×{screen.h}</span>
        <span className="mx-2 h-4 w-px bg-line-strong" />
        {selBox ? (
          <span className="max-w-72 truncate">
            <span className="text-rust-hi">{selName}</span> x {px(selBox.x)} y {px(selBox.y)} ·{" "}
            {px(selBox.w)}×{px(selBox.h)}
          </span>
        ) : cursor ? (
          <span className="tabular-nums">
            {px(cursor.x)}, {px(cursor.y)}
          </span>
        ) : (
          <span>—</span>
        )}
        <span className="mx-2 h-4 w-px bg-line-strong" />
        <Button variant="ghost" size="icon" className="size-7" title="Undo" disabled={!canUndo} onClick={s.undo}>
          <Undo2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" title="Redo" disabled={!canRedo} onClick={s.redo}>
          <Redo2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" active={view.snap} title="Snapping" onClick={() => s.setView({ snap: !view.snap })}>
          <Magnet className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" active={view.grid} title="Grid" onClick={() => s.setView({ grid: !view.grid })}>
          <Grid3x3 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" active={view.hud} title="Vanilla HUD" onClick={() => s.setView({ hud: !view.hud })}>
          <Crosshair className="size-3.5" />
        </Button>
        <Button variant="subtle" size="sm" className="ml-1 font-sans" onClick={() => useUi.getState().setFullscreen(false)}>
          <Minimize2 className="size-3.5" /> Exit <Kbd>Esc</Kbd>
        </Button>
      </div>
    </div>
  );
}
