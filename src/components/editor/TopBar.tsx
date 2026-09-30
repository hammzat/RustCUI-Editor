"use client";

import {
  Anchor,
  Crosshair,
  Download,
  FilePlus2,
  FileUp,
  FolderOpen,
  Grid3x3,
  ImagePlus,
  Keyboard,
  Magnet,
  Maximize,
  Maximize2,
  Minus,
  MonitorSmartphone,
  Move,
  Plus,
  Redo2,
  Save,
  Undo2,
  Upload,
} from "lucide-react";
import { useRef } from "react";
import { exportJson, importJson } from "@/lib/cui/serialize";
import type { Project } from "@/lib/cui/types";
import { DESIGN_HEIGHTS, useEditor } from "@/store/editor";
import { useUi } from "@/store/ui";
import { Button, MenuItem, Popover, Segmented, Switch } from "@/components/ui/primitives";
import { Logo } from "./Logo";
import { BACKGROUNDS } from "./Canvas";

const ASPECTS = [
  { label: "16:9", value: 16 / 9, hint: "1920×1080, 2560×1440" },
  { label: "16:10", value: 16 / 10, hint: "1920×1200" },
  { label: "21:9", value: 21 / 9, hint: "Ultrawide" },
  { label: "4:3", value: 4 / 3, hint: "1024×768" },
];

export const PROJECT_FORMAT = "rustcui-editor/project";

export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(s: string) {
  return s.trim().replace(/[^\w.-]+/g, "_") || "ui";
}

export function TopBar() {
  const project = useEditor((s) => s.project);
  const view = useEditor((s) => s.view);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const s = useEditor.getState();
  const { open, notify } = useUi.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const openFile = async (file: File) => {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (data?.format === PROJECT_FORMAT && data.project) {
        s.loadProject(data.project as Project);
        notify(`Opened “${data.project.name}”`);
        return;
      }
      const { project: p, warnings } = importJson(text, file.name.replace(/\.json$/i, ""));
      s.loadProject(p);
      notify(warnings.length ? `Imported with ${warnings.length} warning(s)` : `Imported ${Object.keys(p.nodes).length} elements`);
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const zoomBy = (f: number) => {
    const current = useUi.getState().zoom;
    s.setView({ zoom: Math.min(4, Math.max(0.1, current * f)) });
  };

  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2.5">
      <div className="flex items-center gap-2 pr-1">
        <Logo className="size-7" />
        <div className="hidden leading-tight lg:block">
          <div className="text-[13px] font-semibold tracking-tight">
            Rust<span className="text-rust-hi">CUI</span>
          </div>
          <div className="text-[10px] text-faint">Editor</div>
        </div>
      </div>

      <Popover
        trigger={({ toggle }) => (
          <Button variant="ghost" size="sm" onClick={toggle}>
            File
          </Button>
        )}
      >
        {(close) => (
          <>
            <MenuItem icon={<FilePlus2 />} hint="Ctrl N" onClick={() => (open("new"), close())}>
              New…
            </MenuItem>
            <MenuItem icon={<FolderOpen />} hint="Ctrl O" onClick={() => (fileRef.current?.click(), close())}>
              Open file…
            </MenuItem>
            <MenuItem
              icon={<Save />}
              hint="Ctrl S"
              onClick={() => {
                download(`${slug(project.name)}.rcui.json`, JSON.stringify({ format: PROJECT_FORMAT, version: 1, project }, null, 2));
                close();
              }}
            >
              Save project file
            </MenuItem>
            <div className="my-1 h-px bg-line" />
            <MenuItem icon={<FileUp />} onClick={() => (open("import"), close())}>
              Import CUI JSON…
            </MenuItem>
            <MenuItem
              icon={<Download />}
              onClick={() => {
                download(`${slug(project.name)}.json`, JSON.stringify(exportJson(project), null, 2));
                close();
              }}
            >
              Download CUI JSON
            </MenuItem>
            <div className="my-1 h-px bg-line" />
            <MenuItem icon={<Keyboard />} hint="?" onClick={() => (open("shortcuts"), close())}>
              Keyboard shortcuts
            </MenuItem>
          </>
        )}
      </Popover>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) openFile(f);
          e.target.value = "";
        }}
        data-open-file
      />

      <input
        value={project.name}
        onChange={(e) => s.setProjectMeta({ name: e.target.value })}
        className="h-7 w-40 min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium outline-none hover:border-line focus:border-rust/60 focus:bg-black/30"
        spellCheck={false}
      />

      <div className="mx-1 h-5 w-px bg-line" />

      <Button variant="ghost" size="icon" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={s.undo}>
        <Undo2 className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={s.redo}>
        <Redo2 className="size-4" />
      </Button>

      <div className="flex-1" />

      <Segmented
        value={view.dragMode}
        onChange={(dragMode) => s.setView({ dragMode })}
        options={[
          {
            value: "offsets",
            label: (
              <>
                <Move className="size-3.5" /> Offsets
              </>
            ),
            title: "Dragging changes offsets (pixels); anchors stay put",
          },
          {
            value: "anchors",
            label: (
              <>
                <Anchor className="size-3.5" /> Anchors
              </>
            ),
            title: "Dragging changes anchors (relative); scales with screen size",
          },
        ]}
      />

      <Popover
        align="right"
        className="w-64 p-2"
        trigger={({ toggle, open: isOpen }) => (
          <Button variant="ghost" size="sm" onClick={toggle} active={isOpen} title="Viewport">
            <MonitorSmartphone className="size-4" />
            <span className="hidden font-mono text-xs md:inline">
              {view.designHeight}p · {ASPECTS.find((a) => Math.abs(a.value - view.aspect) < 0.01)?.label}
            </span>
          </Button>
        )}
      >
        {() => (
          <div className="space-y-3 p-1">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">Work resolution</p>
              <Segmented
                className="w-full [&>button]:flex-1 [&>button]:justify-center"
                value={String(view.designHeight)}
                onChange={(v) => s.setView({ designHeight: Number(v) as (typeof DESIGN_HEIGHTS)[number] })}
                options={DESIGN_HEIGHTS.map((h) => ({ value: String(h), label: `${h}p` }))}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-faint">
                Sizes, offsets and fonts are shown in {Math.round(view.designHeight * view.aspect)}×{view.designHeight} and
                exported in Rust&apos;s {Math.round(720 * view.aspect)}×720 space.
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">Aspect ratio</p>
              <div className="grid grid-cols-4 gap-1">
                {ASPECTS.map((a) => (
                  <Button
                    key={a.label}
                    size="sm"
                    title={a.hint}
                    active={Math.abs(a.value - view.aspect) < 0.01}
                    variant="ghost"
                    className="border border-line font-mono"
                    onClick={() => s.setView({ aspect: a.value })}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-faint uppercase">Background</p>
              <div className="grid grid-cols-5 gap-1">
                {Object.entries(BACKGROUNDS).map(([k, b]) => (
                  <button
                    key={k}
                    type="button"
                    title={b.label}
                    onClick={() => s.setView({ background: k, backgroundImage: null })}
                    className={`h-9 rounded-md ring-1 transition ${b.className ?? ""} ${
                      !view.backgroundImage && view.background === k ? "ring-2 ring-rust-hi" : "ring-line-strong hover:ring-white/30"
                    }`}
                    style={{ background: b.css }}
                  />
                ))}
                <button
                  type="button"
                  title="Upload a screenshot"
                  onClick={() => bgRef.current?.click()}
                  className={`grid h-9 place-items-center rounded-md bg-white/5 text-muted ring-1 transition hover:text-fg ${
                    view.backgroundImage ? "ring-2 ring-rust-hi" : "ring-line-strong"
                  }`}
                  style={view.backgroundImage ? { backgroundImage: `url(${view.backgroundImage})`, backgroundSize: "cover" } : undefined}
                >
                  {!view.backgroundImage && <ImagePlus className="size-4" />}
                </button>
              </div>
              <input
                ref={bgRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => s.setView({ backgroundImage: String(r.result) });
                  r.readAsDataURL(f);
                  e.target.value = "";
                }}
              />
            </div>
            <label className="flex items-center justify-between text-[12.5px]">
              <span className="flex items-center gap-2">
                <Crosshair className="size-3.5 text-muted" /> Vanilla HUD overlay
              </span>
              <Switch checked={view.hud} onChange={(hud) => s.setView({ hud })} />
            </label>
          </div>
        )}
      </Popover>

      <Button variant="ghost" size="icon" active={view.snap} title="Smart snapping (hold Alt to bypass)" onClick={() => s.setView({ snap: !view.snap })}>
        <Magnet className="size-4" />
      </Button>
      <Popover
        align="right"
        className="w-52 p-2"
        trigger={({ toggle }) => (
          <Button variant="ghost" size="icon" active={view.grid} title="Grid" onClick={toggle}>
            <Grid3x3 className="size-4" />
          </Button>
        )}
      >
        {() => (
          <div className="space-y-2.5 p-1 text-[12.5px]">
            <label className="flex items-center justify-between">
              Show & snap to grid
              <Switch checked={view.grid} onChange={(grid) => s.setView({ grid })} />
            </label>
            <div className="flex items-center justify-between gap-2">
              Size
              <Segmented
                value={String(view.gridSize)}
                onChange={(v) => s.setView({ gridSize: Number(v), grid: true })}
                options={[4, 8, 10, 16, 20].map((n) => ({ value: String(n), label: n }))}
              />
            </div>
          </div>
        )}
      </Popover>

      <div className="flex items-center rounded-lg border border-line bg-black/25">
        <Button variant="ghost" size="sm" className="px-1.5" onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
          <Minus className="size-3.5" />
        </Button>
        <ZoomLabel />
        <Button variant="ghost" size="sm" className="px-1.5" onClick={() => zoomBy(1.2)} title="Zoom in">
          <Plus className="size-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="px-1.5" active={view.zoom == null} onClick={() => s.setView({ zoom: null })} title="Fit (Ctrl+0)">
          <Maximize2 className="size-3.5" />
        </Button>
      </div>

      <Button variant="ghost" size="icon" title="Fullscreen workspace (F)" onClick={() => useUi.getState().setFullscreen(true)}>
        <Maximize className="size-4" />
      </Button>

      <div className="mx-1 h-5 w-px bg-line" />

      <Button variant="subtle" size="md" onClick={() => open("import")}>
        <Upload className="size-3.5" /> <span className="hidden xl:inline">Import</span>
      </Button>
      <Button variant="primary" size="md" onClick={() => open("export")}>
        <Download className="size-3.5" /> Export
      </Button>
    </header>
  );
}

function ZoomLabel() {
  const zoom = useUi((s) => s.zoom);
  return <span className="w-11 text-center font-mono text-[11px] text-muted tabular-nums">{Math.round(zoom * 100)}%</span>;
}
