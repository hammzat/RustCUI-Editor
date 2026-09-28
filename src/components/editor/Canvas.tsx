"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { layoutProject, screenBox, toCss, walkOrder, type Box } from "@/lib/cui/geometry";
import type { Project } from "@/lib/cui/types";
import { designScale, useEditor } from "@/store/editor";
import { useUi } from "@/store/ui";
import { uid } from "@/lib/uid";
import { NodeView } from "./render/NodeView";
import { HudMock } from "./HudMock";
import { FullscreenBar } from "./FullscreenBar";
import { Maximize } from "lucide-react";

export const BACKGROUNDS: Record<string, { label: string; css?: string; className?: string }> = {
  dusk: {
    label: "Dusk",
    css: [
      "radial-gradient(ellipse 40% 30% at 72% 44%, rgba(255,196,120,.55), transparent 70%)",
      "linear-gradient(180deg, #1f2c3b 0%, #4d5a63 30%, #9b8a6c 49%, #4a4131 50.5%, #2c281f 70%, #1a1813 100%)",
    ].join(","),
  },
  night: {
    label: "Night",
    css: "radial-gradient(ellipse at 70% 15%, #2d3a57 0%, #121724 55%, #07090d 100%)",
  },
  concrete: { label: "Concrete", css: "linear-gradient(160deg, #54585d, #36393d)" },
  checker: { label: "Checker", className: "checker" },
};

const PAD = 48;
const HANDLES = ["tl", "t", "tr", "r", "br", "b", "bl", "l"] as const;
type Handle = (typeof HANDLES)[number];

interface Guide {
  axis: "x" | "y";
  pos: number;
}

interface Gesture {
  id: string;
  handle: Handle | null;
  startX: number;
  startY: number;
  startBox: Box;
  key: string;
  moved: boolean;
  xs: number[];
  ys: number[];
}

/** Hidden subtrees are not painted and locked ones don't take pointer input. */
function visibleOrder(project: Project) {
  const out: { id: string; locked: boolean }[] = [];
  const walk = (id: string, locked: boolean) => {
    const n = project.nodes[id];
    if (!n || n.hidden) return;
    const l = locked || !!n.locked;
    out.push({ id, locked: l });
    n.children.forEach((c) => walk(c, l));
  };
  project.rootIds.forEach((id) => walk(id, false));
  return out;
}

function snapTargets(project: Project, layout: Map<string, Box>, screen: Box, id: string) {
  const exclude = new Set<string>();
  const walk = (nid: string) => {
    exclude.add(nid);
    project.nodes[nid]?.children.forEach(walk);
  };
  walk(id);
  const node = project.nodes[id];
  const parent = node.parentId ? layout.get(node.parentId)! : screen;
  const xs = [screen.x, screen.w / 2, screen.w, parent.x, parent.x + parent.w / 2, parent.x + parent.w];
  const ys = [screen.y, screen.h / 2, screen.h, parent.y, parent.y + parent.h / 2, parent.y + parent.h];
  for (const oid of walkOrder(project)) {
    if (exclude.has(oid) || project.nodes[oid].hidden) continue;
    const b = layout.get(oid)!;
    xs.push(b.x, b.x + b.w / 2, b.x + b.w);
    ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { xs, ys };
}

function nearest(values: number[], targets: number[], threshold: number) {
  let best: { delta: number; pos: number } | null = null;
  for (const v of values) {
    for (const t of targets) {
      const d = t - v;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, pos: t };
    }
  }
  return best;
}

export function Canvas() {
  const project = useEditor((s) => s.project);
  const view = useEditor((s) => s.view);
  const selectedId = useEditor((s) => s.selectedId);
  const hoveredId = useEditor((s) => s.hoveredId);
  const select = useEditor((s) => s.select);
  const setBox = useEditor((s) => s.setBox);
  const setView = useEditor((s) => s.setView);
  const setCursor = useUi((s) => s.setCursor);
  const fullscreen = useUi((s) => s.fullscreen);
  const k = designScale(view);
  const pad = fullscreen ? 0 : PAD;

  const screen = useMemo(() => screenBox(view.aspect), [view.aspect]);
  const layout = useMemo(() => layoutProject(project, screen), [project, screen]);
  const order = useMemo(() => visibleOrder(project), [project]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setVp({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitZoom = vp.w ? Math.max(0.1, Math.min((vp.w - pad * 2) / screen.w, (vp.h - pad * 2) / screen.h)) : 1;
  // Fullscreen always fits the monitor so the layout is seen exactly as in game.
  const zoom = fullscreen ? fitZoom : (view.zoom ?? fitZoom);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
    useUi.setState({ zoom });
  }, [zoom]);

  // Ctrl/⌘ + wheel zoom (non-passive so we can prevent the browser zoom).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const next = Math.min(4, Math.max(0.1, zoomRef.current * Math.exp(-e.deltaY * 0.002)));
      setView({ zoom: next });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setView]);

  const toRust = useCallback(
    (clientX: number, clientY: number) => {
      const r = contentRef.current!.getBoundingClientRect();
      return { x: (clientX - r.left) / zoom, y: screen.h - (clientY - r.top) / zoom };
    },
    [zoom, screen.h],
  );

  const beginGesture = (e: React.PointerEvent, id: string, handle: Handle | null) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const box = layout.get(id);
    if (!box) return;
    select(id);
    const { xs, ys } = snapTargets(project, layout, screen, id);
    gesture.current = {
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startBox: box,
      key: `g:${uid()}`,
      moved: false,
      xs,
      ys,
    };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const sx = e.clientX - g.startX;
      const sy = e.clientY - g.startY;
      if (!g.moved && Math.hypot(sx, sy) < 3) return;
      if (!g.moved) {
        g.moved = true;
        setDragging(true);
      }
      const z = zoomRef.current;
      const dx = sx / z;
      const dy = -sy / z;
      const v = useEditor.getState().view;
      const { snap, grid } = v;
      // Grid size is set in design pixels; snapping happens in 720p model space.
      const gridSize = v.gridSize / designScale(v);
      const doSnap = snap && !e.altKey;
      const threshold = 6 / z;
      const snapGrid = (v: number) => (grid ? Math.round(v / gridSize) * gridSize : v);
      const b = g.startBox;
      const newGuides: Guide[] = [];

      let left = b.x;
      let right = b.x + b.w;
      let bottom = b.y;
      let top = b.y + b.h;

      if (!g.handle) {
        left += dx;
        right += dx;
        bottom += dy;
        top += dy;
        if (e.shiftKey) {
          // Constrain to the dominant axis.
          if (Math.abs(dx) > Math.abs(dy)) {
            bottom = b.y;
            top = b.y + b.h;
          } else {
            left = b.x;
            right = b.x + b.w;
          }
        }
        if (doSnap) {
          const sxr = nearest([left, (left + right) / 2, right], g.xs, threshold);
          if (sxr) {
            left += sxr.delta;
            right += sxr.delta;
            newGuides.push({ axis: "x", pos: sxr.pos });
          } else if (grid) {
            const nl = snapGrid(left);
            right += nl - left;
            left = nl;
          }
          const syr = nearest([bottom, (bottom + top) / 2, top], g.ys, threshold);
          if (syr) {
            bottom += syr.delta;
            top += syr.delta;
            newGuides.push({ axis: "y", pos: syr.pos });
          } else if (grid) {
            const nb = snapGrid(bottom);
            top += nb - bottom;
            bottom = nb;
          }
        }
      } else {
        const h = g.handle;
        const edge = (value: number, targets: number[], axis: "x" | "y") => {
          if (!doSnap) return value;
          const s = nearest([value], targets, threshold);
          if (s) {
            newGuides.push({ axis, pos: s.pos });
            return s.pos;
          }
          return grid ? snapGrid(value) : value;
        };
        if (h.includes("l")) left = Math.min(edge(left + dx, g.xs, "x"), right - 1);
        if (h.includes("r")) right = Math.max(edge(right + dx, g.xs, "x"), left + 1);
        if (h.includes("b")) bottom = Math.min(edge(bottom + dy, g.ys, "y"), top - 1);
        if (h === "t" || h === "tl" || h === "tr") top = Math.max(edge(top + dy, g.ys, "y"), bottom + 1);
      }

      setGuides(newGuides);
      setBox(g.id, { x: left, y: bottom, w: right - left, h: top - bottom }, g.key);
    };
    const onUp = () => {
      gesture.current = null;
      setGuides([]);
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setBox]);

  const bg = view.backgroundImage ? null : (BACKGROUNDS[view.background] ?? BACKGROUNDS.dusk);
  const stageStyle: CSSProperties = view.backgroundImage
    ? { backgroundImage: `url(${view.backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: bg?.css };

  const lockedIds = useMemo(() => new Set(order.filter((o) => o.locked).map((o) => o.id)), [order]);
  const cssOf = (id: string) => toCss(layout.get(id)!, screen.h);
  const scaled = (b: Box) => {
    const c = toCss(b, screen.h);
    return { left: c.left * zoom, top: c.top * zoom, width: c.width * zoom, height: c.height * zoom };
  };

  const selected = selectedId ? project.nodes[selectedId] : null;
  const selBox = selected && !selected.hidden ? layout.get(selected.id) : undefined;
  const selParentBox = selected ? (selected.parentId ? layout.get(selected.parentId) : screen) : undefined;
  const hoverBox = hoveredId && hoveredId !== selectedId ? layout.get(hoveredId) : undefined;

  const gridStep = view.gridSize / k;

  return (
    <div
      id="workspace"
      className={clsx(
        "group/ws relative flex min-h-0 min-w-0 flex-1 flex-col",
        fullscreen && "fixed inset-0 z-90 bg-black",
      )}
    >
    <div
      ref={viewportRef}
      className={clsx("relative min-h-0 min-w-0 flex-1", fullscreen ? "overflow-hidden bg-black" : "dots overflow-auto")}
      onPointerDown={(e) => e.button === 0 && select(null)}
    >
      <div
        className="grid min-h-full min-w-full place-items-center"
        style={{ width: screen.w * zoom + pad * 2, height: screen.h * zoom + pad * 2 }}
      >
        <div
          className={clsx("relative", !fullscreen && "shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] ring-1 ring-white/10")}
          style={{ width: screen.w * zoom, height: screen.h * zoom }}
        >
          <div
            ref={contentRef}
            className={clsx("absolute top-0 left-0 overflow-hidden", bg?.className)}
            style={{
              ...stageStyle,
              width: screen.w,
              height: screen.h,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              cursor: dragging ? "grabbing" : undefined,
            }}
            onPointerMove={(e) => {
              const p = toRust(e.clientX, e.clientY);
              setCursor({ x: p.x, y: p.y });
            }}
            onPointerLeave={() => {
              setCursor(null);
              useEditor.getState().hover(null);
            }}
            onPointerDown={(e) => {
              const el = (e.target as HTMLElement).closest<HTMLElement>("[data-node]");
              const id = el?.dataset.node;
              if (id && !lockedIds.has(id)) beginGesture(e, id, null);
            }}
            onPointerOver={(e) => {
              const id = (e.target as HTMLElement).closest<HTMLElement>("[data-node]")?.dataset.node ?? null;
              useEditor.getState().hover(id && !lockedIds.has(id) ? id : null);
            }}
          >
            {view.hud && <HudMock screen={screen} />}
            {order.map(({ id, locked }) => (
              <NodeView
                key={id}
                node={project.nodes[id]}
                css={{ ...cssOf(id), pointerEvents: locked ? "none" : undefined }}
              />
            ))}
            {view.grid && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
                  backgroundSize: `${gridStep}px ${gridStep}px`,
                  backgroundPosition: `0 ${screen.h % gridStep}px`,
                }}
              />
            )}
          </div>

          {/* Overlay: drawn unscaled so handles keep a constant size. */}
          <div className="pointer-events-none absolute inset-0">
            {hoverBox && !dragging && (
              <div className="absolute outline-1 outline-sky/70" style={scaled(hoverBox)} />
            )}

            {selected && selBox && selParentBox && (
              <>
                <AnchorMarkers parent={selParentBox} rect={selected.rect} scaled={scaled} />
                <div className="absolute outline-[1.5px] outline-rust-hi" style={scaled(selBox)}>
                  <div className="absolute -top-6 left-0 flex items-center gap-1.5 whitespace-nowrap">
                    <span className="rounded-md bg-rust px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                      {selected.name}
                    </span>
                    <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
                      {Math.round(selBox.w * k)}×{Math.round(selBox.h * k)}
                    </span>
                  </div>
                  {!selected.locked &&
                    HANDLES.map((h) => (
                      <div
                        key={h}
                        onPointerDown={(e) => beginGesture(e, selected.id, h)}
                        className="pointer-events-auto absolute size-2.5 rounded-[3px] border-[1.5px] border-rust-hi bg-white shadow"
                        style={{
                          left: h.includes("l") ? -5 : h.includes("r") ? "calc(100% - 5px)" : "calc(50% - 5px)",
                          top: h.startsWith("t") ? -5 : h.startsWith("b") ? "calc(100% - 5px)" : "calc(50% - 5px)",
                          cursor:
                            h === "t" || h === "b"
                              ? "ns-resize"
                              : h === "l" || h === "r"
                                ? "ew-resize"
                                : h === "tl" || h === "br"
                                  ? "nwse-resize"
                                  : "nesw-resize",
                        }}
                      />
                    ))}
                </div>
              </>
            )}

            {guides.map((g, i) =>
              g.axis === "x" ? (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-fuchsia-400"
                  style={{ left: g.pos * zoom }}
                />
              ) : (
                <div
                  key={i}
                  className="absolute right-0 left-0 h-px bg-fuchsia-400"
                  style={{ top: (screen.h - g.pos) * zoom }}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
    {fullscreen ? (
      <FullscreenBar selBox={selBox} selName={selected?.name} screen={screen} scale={k} />
    ) : (
      <button
        type="button"
        onClick={() => useUi.getState().setFullscreen(true)}
        title="Fullscreen workspace (F)"
        className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg border border-line-strong bg-panel-2/90 px-2.5 py-1.5 text-[12px] text-muted opacity-70 shadow-lg backdrop-blur transition hover:text-fg hover:opacity-100"
      >
        <Maximize className="size-3.5" /> Fullscreen
      </button>
    )}
    </div>
  );
}

function AnchorMarkers({
  parent,
  rect,
  scaled,
}: {
  parent: Box;
  rect: { anchorMin: [number, number]; anchorMax: [number, number] };
  scaled: (b: Box) => { left: number; top: number; width: number; height: number };
}) {
  const ax0 = parent.x + rect.anchorMin[0] * parent.w;
  const ay0 = parent.y + rect.anchorMin[1] * parent.h;
  const ax1 = parent.x + rect.anchorMax[0] * parent.w;
  const ay1 = parent.y + rect.anchorMax[1] * parent.h;
  const area = scaled({ x: ax0, y: ay0, w: ax1 - ax0, h: ay1 - ay0 });
  const p = scaled(parent);
  const corners: [number, number, number][] = [
    [area.left, area.top + area.height, 45],
    [area.left + area.width, area.top + area.height, 135],
    [area.left + area.width, area.top, 225],
    [area.left, area.top, 315],
  ];
  return (
    <>
      <div className="absolute outline-1 outline-dashed outline-white/25" style={p} />
      {(area.width > 0 || area.height > 0) && (
        <div className="absolute bg-amber/6 outline-1 outline-dashed outline-amber/50" style={area} />
      )}
      {corners.map(([x, y, rot], i) => (
        <svg
          key={i}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className="absolute drop-shadow"
          style={{ left: x - 6, top: y - 6, transform: `rotate(${rot}deg)` }}
        >
          <path d="M6 6 L6 0 L0 6 Z" fill="#ffc861" stroke="#000" strokeOpacity=".4" strokeWidth=".75" />
        </svg>
      ))}
    </>
  );
}
