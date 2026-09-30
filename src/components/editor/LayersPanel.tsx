"use client";

import clsx from "clsx";
import { ChevronRight, Eye, EyeOff, Layers, Lock, Plus } from "lucide-react";
import { createElement, useEffect, useRef, useState } from "react";
import { PRESET_LABELS, type PresetKind } from "@/lib/cui/factory";
import { useEditor } from "@/store/editor";
import { Button, MenuItem, Popover } from "@/components/ui/primitives";
import { nodeIcon, PRESET_ICONS } from "./icons";

type Zone = "before" | "inside" | "after";
const PRESETS = Object.keys(PRESET_LABELS) as PresetKind[];
const QUICK: PresetKind[] = ["panel", "text", "button", "image", "input"];

export function LayersPanel() {
  const project = useEditor((s) => s.project);
  const addPreset = useEditor((s) => s.addPreset);
  const moveNode = useEditor((s) => s.moveNode);
  const selectedId = useEditor((s) => s.selectedId);
  const [drop, setDrop] = useState<{ id: string; zone: Zone } | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const onDrop = () => {
    const src = dragIdRef.current;
    dragIdRef.current = null;
    if (!src || !drop) return setDrop(null);
    const target = project.nodes[drop.id];
    if (drop.zone === "inside") {
      moveNode(src, target.id, target.children.length);
    } else {
      const siblings = target.parentId ? project.nodes[target.parentId].children : project.rootIds;
      const idx = siblings.indexOf(target.id) + (drop.zone === "after" ? 1 : 0);
      moveNode(src, target.parentId, idx);
    }
    setDrop(null);
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-10 items-center justify-between border-b border-line pr-1.5 pl-3">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold tracking-wide">
          <Layers className="size-3.5 text-muted" /> Elements
        </h2>
        <Popover
          align="right"
          trigger={({ toggle }) => (
            <Button size="sm" variant="ghost" onClick={toggle} title="Add element">
              <Plus className="size-4" />
            </Button>
          )}
        >
          {(close) => (
            <>
              <p className="px-2.5 pt-1 pb-1.5 text-[11px] text-faint">
                {selectedId ? `Adds inside “${project.nodes[selectedId]?.name}”` : "Adds at the root"}
              </p>
              {PRESETS.map((k) => {
                const Icon = PRESET_ICONS[k];
                return (
                  <MenuItem
                    key={k}
                    icon={<Icon />}
                    onClick={() => {
                      addPreset(k);
                      close();
                    }}
                  >
                    {PRESET_LABELS[k]}
                  </MenuItem>
                );
              })}
            </>
          )}
        </Popover>
      </div>

      <div className="flex gap-1 border-b border-line px-2 py-1.5">
        {QUICK.map((k) => {
          const Icon = PRESET_ICONS[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => addPreset(k)}
              title={`Add ${PRESET_LABELS[k]}${selectedId ? " inside selection" : ""}`}
              className="flex h-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-muted transition hover:bg-white/6 hover:text-fg"
            >
              <Icon className="size-4" />
              <span className="text-[9.5px]">{PRESET_LABELS[k]}</span>
            </button>
          );
        })}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto py-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onPointerDown={(e) => e.target === e.currentTarget && useEditor.getState().select(null)}
      >
        {project.rootIds.length === 0 && (
          <div className="mx-3 mt-6 rounded-xl border border-dashed border-line-strong p-4 text-center text-[12px] leading-relaxed text-muted">
            Nothing here yet.
            <br />
            Add a <b className="text-fg">Panel</b> to get started.
          </div>
        )}
        {project.rootIds.map((id) => (
          <TreeRow key={id} id={id} depth={0} drop={drop} setDrop={setDrop} dragIdRef={dragIdRef} />
        ))}
        <div
          className={clsx(
            "mx-2 mt-1 h-8 rounded-lg border border-dashed text-center text-[11px] leading-8 transition",
            drop?.id === "__root" ? "border-rust/60 text-fg" : "border-transparent text-transparent",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDrop({ id: "__root", zone: "after" });
          }}
          onDrop={(e) => {
            e.stopPropagation();
            const src = dragIdRef.current;
            dragIdRef.current = null;
            setDrop(null);
            if (src) moveNode(src, null, project.rootIds.length);
          }}
        >
          Move to root
        </div>
      </div>
    </aside>
  );
}

function TreeRow({
  id,
  depth,
  drop,
  setDrop,
  dragIdRef,
}: {
  id: string;
  depth: number;
  drop: { id: string; zone: Zone } | null;
  setDrop: (d: { id: string; zone: Zone } | null) => void;
  dragIdRef: React.RefObject<string | null>;
}) {
  const node = useEditor((s) => s.project.nodes[id]);
  const selected = useEditor((s) => s.selectedId === id);
  const hovered = useEditor((s) => s.hoveredId === id);
  const [editing, setEditing] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const s = useEditor.getState();

  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!node) return null;
  const hasKids = node.children.length > 0;
  const zone = drop?.id === id ? drop.zone : null;
  const shortName =
    node.parentId && node.name.startsWith(s.project.nodes[node.parentId]?.name + ".")
      ? node.name.slice(s.project.nodes[node.parentId].name.length + 1)
      : node.name;

  return (
    <>
      <div
        ref={rowRef}
        draggable={!editing}
        onDragStart={(e) => {
          dragIdRef.current = id;
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setDrop(null)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragIdRef.current === id) return;
          const r = e.currentTarget.getBoundingClientRect();
          const t = (e.clientY - r.top) / r.height;
          setDrop({ id, zone: t < 0.28 ? "before" : t > 0.72 ? "after" : "inside" });
        }}
        onClick={() => s.select(id)}
        onDoubleClick={() => setEditing(true)}
        onPointerEnter={() => s.hover(id)}
        onPointerLeave={() => s.hover(null)}
        className={clsx(
          "group relative mx-1.5 flex h-7 cursor-default items-center gap-1 rounded-md pr-1 text-[12.5px] transition-colors",
          selected ? "bg-rust/18 text-fg" : hovered ? "bg-white/5" : "hover:bg-white/4",
          node.hidden && "opacity-45",
          zone === "inside" && "ring-1 ring-rust-hi ring-inset",
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {zone === "before" && <span className="absolute -top-px right-1 left-2 h-0.5 rounded bg-rust-hi" />}
        {zone === "after" && <span className="absolute right-1 -bottom-px left-2 h-0.5 rounded bg-rust-hi" />}
        {selected && <span className="absolute inset-y-1 left-0 w-0.5 rounded bg-rust-hi" />}
        <button
          type="button"
          className={clsx("grid size-4 place-items-center text-faint hover:text-fg", !hasKids && "invisible")}
          onClick={(e) => {
            e.stopPropagation();
            s.toggleFlag(id, "collapsed");
          }}
        >
          <ChevronRight className={clsx("size-3.5 transition-transform", !node.collapsed && "rotate-90")} />
        </button>
        {createElement(nodeIcon(node), {
          className: clsx("size-3.5 shrink-0", selected ? "text-rust-hi" : "text-muted"),
        })}
        {editing ? (
          <input
            autoFocus
            defaultValue={node.name}
            className="h-5.5 min-w-0 flex-1 rounded border border-rust/60 bg-black/50 px-1 font-mono text-[11.5px] outline-none"
            onBlur={(e) => {
              s.updateNode(id, { name: e.target.value.trim() || node.name });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate" title={node.name}>
            {shortName}
          </span>
        )}
        {node.locked && <Lock className="size-3 text-amber/80" />}
        <button
          type="button"
          title={node.hidden ? "Show" : "Hide"}
          onClick={(e) => {
            e.stopPropagation();
            s.toggleFlag(id, "hidden");
          }}
          className={clsx(
            "grid size-5 place-items-center rounded text-faint hover:text-fg",
            node.hidden ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {node.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
      {!node.collapsed &&
        node.children.map((c) => (
          <TreeRow key={c} id={c} depth={depth + 1} drop={drop} setDrop={setDrop} dragIdRef={dragIdRef} />
        ))}
    </>
  );
}
