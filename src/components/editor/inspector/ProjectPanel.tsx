"use client";

import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { validate } from "@/lib/cui/serialize";
import { LAYERS, type Layer } from "@/lib/cui/types";
import { useEditor } from "@/store/editor";
import { Kbd } from "@/components/ui/primitives";
import { Row, Select, TextInput } from "./fields";

const LAYER_HINTS: Record<Layer, string> = {
  Overall: "Above everything, including the game menu",
  Overlay: "Above the HUD — menus and modals",
  "Hud.Menu": "Above HUD, below inventory",
  Hud: "Along with the vanilla HUD",
  Under: "Below the HUD",
};

export function ProjectPanel() {
  const project = useEditor((s) => s.project);
  const select = useEditor((s) => s.select);
  const setMeta = useEditor((s) => s.setProjectMeta);
  const problems = useMemo(() => validate(project), [project]);
  const count = Object.keys(project.nodes).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-2 border-b border-line p-3">
        <h3 className="text-[11px] font-semibold tracking-wider text-faint uppercase">Project</h3>
        <Row label="Name">
          <TextInput value={project.name} onChange={(name) => setMeta({ name })} />
        </Row>
        <Row label="Layer" hint="Parent for top-level elements">
          <Select
            value={project.layer}
            options={LAYERS.map((l) => ({ value: l, label: l }))}
            onChange={(v) => setMeta({ layer: v as Layer })}
          />
        </Row>
        <p className="pl-[92px] text-[11px] text-faint">{LAYER_HINTS[project.layer]}</p>
      </div>

      <div className="space-y-2 border-b border-line p-3">
        <h3 className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-faint uppercase">
          Checks
          <span className="font-normal normal-case">{count} elements</span>
        </h3>
        {problems.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-good/10 px-2.5 py-2 text-[12px] text-good">
            <CircleCheck className="size-4" /> Ready to export
          </div>
        ) : (
          <ul className="space-y-1">
            {problems.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={!p.nodeId}
                  onClick={() => p.nodeId && select(p.nodeId)}
                  className="flex w-full items-start gap-2 rounded-lg bg-white/3 px-2.5 py-2 text-left text-[11.5px] leading-snug text-fg/85 transition enabled:hover:bg-white/6"
                >
                  {p.level === "error" ? (
                    <CircleAlert className="mt-px size-3.5 shrink-0 text-red-400" />
                  ) : (
                    <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber" />
                  )}
                  {p.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 p-3 text-[11.5px] text-muted">
        <h3 className="text-[11px] font-semibold tracking-wider text-faint uppercase">Tips</h3>
        <ul className="space-y-1.5 leading-relaxed">
          <li>
            Drag on canvas to move, handles to resize. Hold <Kbd>Alt</Kbd> to disable snapping, <Kbd>Shift</Kbd> to lock
            an axis.
          </li>
          <li>
            <b className="text-fg/80">Offsets</b> mode keeps anchors fixed (pixel-perfect).{" "}
            <b className="text-fg/80">Anchors</b> mode scales with any screen.
          </li>
          <li>
            Drag the <span className="text-fg/80">X / Y / W / H</span> labels to scrub values; fields accept math like{" "}
            <code className="text-fg/80">640/2</code>.
          </li>
          <li>
            Press <Kbd>?</Kbd> for all shortcuts.
          </li>
        </ul>
      </div>
    </div>
  );
}
