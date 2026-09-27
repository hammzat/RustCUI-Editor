"use client";

import clsx from "clsx";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Maximize,
  Plus,
  Scaling,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  bakeToAnchors,
  fitWithOffsets,
  layoutProject,
  matchPreset,
  presetAnchors,
  reanchor,
  screenBox,
  type AnchorPresetH,
  type AnchorPresetV,
} from "@/lib/cui/geometry";
import { COMPONENT_ORDER, COMPONENT_SPECS, type FieldSpec } from "@/lib/cui/specs";
import { LAYERS, type Color, type CuiNode, type FieldValue, type Vec2 } from "@/lib/cui/types";
import { useEditor } from "@/store/editor";
import { Button, MenuItem, Popover, Switch } from "@/components/ui/primitives";
import { ColorInput, NumberInput, Row, Select, TextInput, Vec2Input } from "./fields";
import { componentIcon } from "../icons";
import { ProjectPanel } from "./ProjectPanel";

export function Inspector() {
  const selectedId = useEditor((s) => s.selectedId);
  const node = useEditor((s) => (s.selectedId ? s.project.nodes[s.selectedId] : undefined));
  if (!selectedId || !node) return <ProjectPanel />;
  return <NodeInspector key={node.id} node={node} />;
}

function Section({
  title,
  icon,
  actions,
  children,
  defaultOpen = true,
}: {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <header className="group flex h-9 items-center gap-2 px-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-[12px] font-semibold tracking-wide text-fg/90"
        >
          <ChevronDown className={clsx("size-3.5 shrink-0 text-faint transition", !open && "-rotate-90")} />
          {icon && <span className="text-muted [&>svg]:size-3.5">{icon}</span>}
          <span className="truncate">{title}</span>
        </button>
        {actions && <div className="flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100">{actions}</div>}
      </header>
      {open && <div className="space-y-2 px-3 pb-3">{children}</div>}
    </section>
  );
}

function NodeInspector({ node }: { node: CuiNode }) {
  const project = useEditor((s) => s.project);
  const aspect = useEditor((s) => s.view.aspect);
  const s = useEditor.getState();
  const nameTaken = Object.values(project.nodes).some((n) => n.id !== node.id && n.name === node.name);

  const screen = screenBox(aspect);
  const layout = layoutProject(project, screen);
  const box = layout.get(node.id)!;
  const parentBox = node.parentId ? layout.get(node.parentId)! : screen;
  const rect = node.rect;
  const preset = matchPreset(rect);

  const setPreset = (h: AnchorPresetH, v: AnchorPresetV, snapPosition: boolean) => {
    const a = presetAnchors(h, v);
    if (!snapPosition) {
      s.setRect(node.id, reanchor(rect, a.min, a.max, parentBox));
      return;
    }
    // Alt/Shift: also move the element to the preset position (Unity behaviour).
    const w = h === "stretch" ? parentBox.w : box.w;
    const hh = v === "stretch" ? parentBox.h : box.h;
    const x = parentBox.x + (h === "right" ? parentBox.w - w : h === "center" ? (parentBox.w - w) / 2 : 0);
    const y = parentBox.y + (v === "top" ? parentBox.h - hh : v === "middle" ? (parentBox.h - hh) / 2 : 0);
    s.setRect(node.id, fitWithOffsets({ ...rect, anchorMin: a.min, anchorMax: a.max }, { x, y, w, h: hh }, parentBox));
  };

  const graphicCount = node.components.filter((c) => COMPONENT_SPECS[c.type].graphic).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-line p-3">
        <input
          value={node.name}
          onChange={(e) => s.updateNode(node.id, { name: e.target.value })}
          className={clsx(
            "h-8 min-w-0 flex-1 rounded-lg border bg-black/30 px-2.5 font-mono text-[12.5px] outline-none focus:border-rust/70",
            nameTaken || !node.name ? "border-red-500/70 text-red-200" : "border-line",
          )}
          spellCheck={false}
          title={nameTaken ? "Name is already used — Rust needs unique element names" : "Element name"}
        />
        <Button variant="ghost" size="icon" title={node.hidden ? "Show" : "Hide"} onClick={() => s.toggleFlag(node.id, "hidden")}>
          {node.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon" title={node.locked ? "Unlock" : "Lock"} onClick={() => s.toggleFlag(node.id, "locked")}>
          {node.locked ? <Lock className="size-4 text-amber" /> : <LockOpen className="size-4" />}
        </Button>
      </div>
      {nameTaken && (
        <p className="border-b border-line bg-red-500/10 px-3 py-1.5 text-[11px] text-red-200">
          Duplicate name — children would attach to the wrong parent.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Rect Transform" icon={<Scaling />}>
          <div className="flex gap-3">
            <AnchorPresets h={preset.h} v={preset.v} onPick={setPreset} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <NumberInput
                  prefix="X"
                  title="Left, px from parent's left edge"
                  value={box.x - parentBox.x}
                  precision={1}
                  onChange={(x) => s.setBox(node.id, { ...box, x: parentBox.x + x })}
                />
                <NumberInput
                  prefix="Y"
                  title="Bottom, px from parent's bottom edge"
                  value={box.y - parentBox.y}
                  precision={1}
                  onChange={(y) => s.setBox(node.id, { ...box, y: parentBox.y + y })}
                />
                <NumberInput
                  prefix="W"
                  value={box.w}
                  precision={1}
                  min={0}
                  onChange={(w) => s.setBox(node.id, { ...box, w })}
                />
                <NumberInput
                  prefix="H"
                  value={box.h}
                  precision={1}
                  min={0}
                  onChange={(h) => s.setBox(node.id, { ...box, h })}
                />
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="flex-1"
                  title="Stretch to fill the parent"
                  onClick={() =>
                    s.setRect(node.id, { anchorMin: [0, 0], anchorMax: [1, 1], offsetMin: [0, 0], offsetMax: [0, 0] })
                  }
                >
                  <Maximize className="size-3" /> Fill
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  title="Convert offsets into relative anchors — scales with every resolution"
                  onClick={() => s.setRect(node.id, bakeToAnchors(rect, parentBox))}
                >
                  <Scaling className="size-3" /> To anchors
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            <Row label="Anchor min">
              <Vec2Input value={rect.anchorMin} step={0.01} precision={4} onChange={(v) => s.setRect(node.id, { ...rect, anchorMin: v })} />
            </Row>
            <Row label="Anchor max">
              <Vec2Input value={rect.anchorMax} step={0.01} precision={4} onChange={(v) => s.setRect(node.id, { ...rect, anchorMax: v })} />
            </Row>
            <Row label="Offset min">
              <Vec2Input value={rect.offsetMin} precision={2} onChange={(v) => s.setRect(node.id, { ...rect, offsetMin: v })} />
            </Row>
            <Row label="Offset max">
              <Vec2Input value={rect.offsetMax} precision={2} onChange={(v) => s.setRect(node.id, { ...rect, offsetMax: v })} />
            </Row>
          </div>
        </Section>

        {node.components.map((c, i) => {
          const spec = COMPONENT_SPECS[c.type];
          const Icon = componentIcon(c.type);
          const conflict = spec.graphic && graphicCount > 1;
          return (
            <Section
              key={`${c.type}-${i}`}
              title={
                <span className="flex items-center gap-2">
                  {spec.label}
                  {conflict && <span className="rounded bg-red-500/20 px-1 text-[10px] font-medium text-red-300">conflict</span>}
                </span>
              }
              icon={<Icon />}
              actions={
                <>
                  <Button variant="ghost" size="sm" className="px-1" title="Move up" disabled={i === 0} onClick={() => s.moveComponent(node.id, i, -1)}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-1"
                    title="Move down"
                    disabled={i === node.components.length - 1}
                    onClick={() => s.moveComponent(node.id, i, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button variant="danger" size="sm" className="px-1" title="Remove component" onClick={() => s.removeComponent(node.id, i)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              }
            >
              {spec.fields.length === 0 && <p className="text-[11.5px] leading-relaxed text-muted">{spec.description}</p>}
              {spec.fields.map((f) => (
                <FieldEditor
                  key={f.key}
                  field={f}
                  value={c.props[f.key] ?? f.default}
                  onChange={(v) => s.setField(node.id, i, f.key, v)}
                />
              ))}
            </Section>
          );
        })}

        <Section title="Element" defaultOpen={false}>
          {node.parentId ? (
            <Row label="Parent">
              <button
                type="button"
                className="truncate font-mono text-[11.5px] text-sky hover:underline"
                onClick={() => s.select(node.parentId)}
              >
                {project.nodes[node.parentId]?.name}
              </button>
            </Row>
          ) : (
            <Row label="Layer" hint="Parent for top-level elements (shared by the project)">
              <Select value={project.layer} options={LAYERS} onChange={(v) => s.setProjectMeta({ layer: v as typeof project.layer })} />
            </Row>
          )}
          <Row label="Fade out" hint="Seconds to fade when destroyed">
            <NumberInput value={node.fadeOut} min={0} step={0.1} onChange={(v) => s.updateNode(node.id, { fadeOut: v })} />
          </Row>
          <Row label="Destroy UI" hint="Destroys this element name before creating">
            <TextInput value={node.destroyUi} placeholder="element name" onChange={(v) => s.updateNode(node.id, { destroyUi: v })} mono />
          </Row>
          <Row label="Update" hint="Update an existing element instead of creating it">
            <Switch checked={node.update} onChange={(v) => s.updateNode(node.id, { update: v })} />
          </Row>
        </Section>

        <div className="flex gap-1.5 p-3">
          <Popover
            className="w-64"
            trigger={({ toggle }) => (
              <Button className="w-full" onClick={toggle}>
                <Plus className="size-3.5" /> Add component
              </Button>
            )}
          >
            {(close) =>
              COMPONENT_ORDER.map((t) => {
                const spec = COMPONENT_SPECS[t];
                const Icon = componentIcon(t);
                const exists = node.components.some((c) => c.type === t);
                return (
                  <MenuItem
                    key={t}
                    icon={<Icon />}
                    hint={exists ? "added" : spec.graphic && graphicCount ? "graphic" : undefined}
                    onClick={() => {
                      s.addComponent(node.id, t);
                      close();
                    }}
                  >
                    <div>{spec.label}</div>
                    <div className="text-[11px] leading-tight text-faint">{spec.description}</div>
                  </MenuItem>
                );
              })
            }
          </Popover>
        </div>

        <div className="flex gap-1.5 px-3 pb-4">
          <Button size="sm" className="flex-1" onClick={() => s.duplicate(node.id)}>
            <Copy className="size-3" /> Duplicate
          </Button>
          <Button size="sm" variant="danger" className="flex-1 border border-red-500/20" onClick={() => s.removeNode(node.id)}>
            <Trash2 className="size-3" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldEditor({ field: f, value, onChange }: { field: FieldSpec; value: FieldValue; onChange: (v: FieldValue) => void }) {
  let input: ReactNode;
  switch (f.kind) {
    case "text":
      input = (
        <TextInput
          value={String(value)}
          onChange={onChange}
          placeholder={f.placeholder}
          suggestions={f.suggestions}
          multiline={f.multiline}
          mono={!f.multiline}
        />
      );
      break;
    case "int":
      input = <NumberInput value={Number(value)} min={f.min} max={f.max} precision={0} onChange={onChange} />;
      break;
    case "float":
      input = <NumberInput value={Number(value)} min={f.min} max={f.max} step={f.step ?? 0.1} onChange={onChange} />;
      break;
    case "bool":
      input = <Switch checked={Boolean(value)} onChange={onChange} />;
      break;
    case "color":
      input = <ColorInput value={value as Color} onChange={onChange} />;
      break;
    case "vec2":
      input = <Vec2Input value={value as Vec2} onChange={onChange} />;
      break;
    case "enum":
      input = f.key === "align" ? <AlignPicker value={String(value)} onChange={onChange} /> : <Select value={String(value)} options={f.options} onChange={onChange} />;
      break;
  }
  return (
    <Row label={f.label} hint={f.hint} top={f.kind === "color" || (f.kind === "text" && f.multiline)}>
      {input}
    </Row>
  );
}

function AlignPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const rows = ["Upper", "Middle", "Lower"];
  const cols = ["Left", "Center", "Right"];
  return (
    <div className="flex items-center gap-2">
      <div className="grid grid-cols-3 gap-0.5 rounded-md border border-line bg-black/25 p-0.5">
        {rows.flatMap((r) =>
          cols.map((c) => {
            const v = `${r}${c}`;
            return (
              <button
                key={v}
                type="button"
                title={v}
                onClick={() => onChange(v)}
                className={clsx(
                  "grid size-5 place-items-center rounded transition",
                  value === v ? "bg-rust text-white" : "text-faint hover:bg-white/8 hover:text-fg",
                )}
              >
                <span className="h-0.5 w-2 rounded-full bg-current" />
              </button>
            );
          }),
        )}
      </div>
      <span className="truncate font-mono text-[11px] text-muted">{value}</span>
    </div>
  );
}

function AnchorPresets({
  h,
  v,
  onPick,
}: {
  h: AnchorPresetH | null;
  v: AnchorPresetV | null;
  onPick: (h: AnchorPresetH, v: AnchorPresetV, snapPosition: boolean) => void;
}) {
  const hs: AnchorPresetH[] = ["left", "center", "right", "stretch"];
  const vs: AnchorPresetV[] = ["top", "middle", "bottom", "stretch"];
  return (
    <div className="shrink-0" title="Anchor presets — Shift/Alt-click to also move the element">
      <div className="grid grid-cols-4 gap-0.5 rounded-lg border border-line bg-black/25 p-1">
        {vs.flatMap((pv) =>
          hs.map((ph) => {
            const active = ph === h && pv === v;
            const a = presetAnchors(ph, pv);
            return (
              <button
                key={`${ph}-${pv}`}
                type="button"
                onClick={(e) => onPick(ph, pv, e.shiftKey || e.altKey)}
                className={clsx(
                  "relative size-[22px] rounded border transition",
                  active ? "border-rust bg-rust/20" : "border-white/8 hover:border-white/25 hover:bg-white/5",
                )}
                title={`${pv} / ${ph}`}
              >
                <span className="absolute inset-[3px] rounded-[2px] border border-white/15" />
                <span
                  className={clsx("absolute rounded-[1px]", active ? "bg-rust-hi" : "bg-amber/80")}
                  style={{
                    left: `calc(3px + ${a.min[0]} * (100% - 6px) - ${a.min[0] === a.max[0] ? 2 : 0}px)`,
                    width: a.min[0] === a.max[0] ? 4 : `calc(${a.max[0] - a.min[0]} * (100% - 6px))`,
                    bottom: `calc(3px + ${a.min[1]} * (100% - 6px) - ${a.min[1] === a.max[1] ? 2 : 0}px)`,
                    height: a.min[1] === a.max[1] ? 4 : `calc(${a.max[1] - a.min[1]} * (100% - 6px))`,
                    opacity: ph === "stretch" || pv === "stretch" ? 0.55 : 1,
                  }}
                />
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
