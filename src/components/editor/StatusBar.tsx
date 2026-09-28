"use client";

import { Cloud, MousePointer2 } from "lucide-react";
import { screenBox } from "@/lib/cui/geometry";
import { designScale, useEditor } from "@/store/editor";
import { useUi } from "@/store/ui";

export function StatusBar() {
  const cursor = useUi((s) => s.cursor);
  const aspect = useEditor((s) => s.view.aspect);
  const dragMode = useEditor((s) => s.view.dragMode);
  const count = useEditor((s) => Object.keys(s.project.nodes).length);
  const layer = useEditor((s) => s.project.layer);
  const screen = screenBox(aspect);
  const k = useEditor((s) => designScale(s.view));

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 font-mono text-[10.5px] text-faint">
      <span className="flex items-center gap-1.5">
        <MousePointer2 className="size-3" />
        {cursor ? (
          <>
            <span className="text-muted tabular-nums">
              {Math.round(cursor.x * k)}, {Math.round(cursor.y * k)}
            </span>
            <span className="tabular-nums">
              ({(cursor.x / screen.w).toFixed(3)} {(cursor.y / screen.h).toFixed(3)})
            </span>
          </>
        ) : (
          "—"
        )}
      </span>
      <span>
        design <span className="text-muted">{Math.round(screen.w * k)}×{Math.round(screen.h * k)}</span> → export{" "}
        {screen.w}×{screen.h}
      </span>
      <span>layer {layer}</span>
      <span>{count} elements</span>
      <span className="text-muted">drag → {dragMode}</span>
      <span className="flex-1" />
      <span className="flex items-center gap-1.5">
        <Cloud className="size-3" /> autosaved locally
      </span>
    </footer>
  );
}
