"use client";

import clsx from "clsx";
import {
  Braces,
  Check,
  CircleAlert,
  Copy,
  Download,
  FilePlus2,
  FileUp,
  Keyboard,
  LayoutTemplate,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { exportCSharp } from "@/lib/cui/csharp";
import { TEMPLATES } from "@/lib/cui/factory";
import { exportJson, importJson, validate } from "@/lib/cui/serialize";
import { useEditor } from "@/store/editor";
import { useUi } from "@/store/ui";
import { Button, Dialog, Kbd, Segmented, Switch } from "@/components/ui/primitives";
import { download, slug } from "../TopBar";
import { CodeBlock } from "./CodeBlock";

export function Dialogs() {
  const dialog = useUi((s) => s.dialog);
  const close = () => useUi.getState().open(null);
  return (
    <>
      <ExportDialog open={dialog === "export"} onClose={close} />
      <ImportDialog open={dialog === "import"} onClose={close} />
      <NewDialog open={dialog === "new"} onClose={close} />
      <ShortcutsDialog open={dialog === "shortcuts"} onClose={close} />
    </>
  );
}

function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const [tab, setTab] = useState<"json" | "csharp">("json");
  const [pretty, setPretty] = useState(true);
  const [minimal, setMinimal] = useState(true);
  const [plugin, setPlugin] = useState(false);
  const [copied, setCopied] = useState(false);

  const problems = useMemo(() => (open ? validate(project) : []), [open, project]);
  const code = useMemo(() => {
    if (!open) return "";
    if (tab === "csharp") return exportCSharp(project, { plugin });
    const json = exportJson(project, { minimal });
    return pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json);
  }, [open, tab, project, pretty, minimal, plugin]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const errors = problems.filter((p) => p.level === "error");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      icon={<Braces />}
      title="Export"
      subtitle={`${Object.keys(project.nodes).length} elements • ${(new Blob([code]).size / 1024).toFixed(1)} KB`}
      footer={
        <>
          {tab === "json" ? (
            <>
              <label className="flex items-center gap-2 text-[12px] text-muted">
                <Switch checked={pretty} onChange={setPretty} /> Pretty
              </label>
              <label className="ml-3 flex items-center gap-2 text-[12px] text-muted" title="Omit fields equal to Rust defaults">
                <Switch checked={minimal} onChange={setMinimal} /> Skip defaults
              </label>
            </>
          ) : (
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <Switch checked={plugin} onChange={setPlugin} /> Full plugin skeleton
            </label>
          )}
          <div className="flex-1" />
          <Button
            onClick={() =>
              tab === "json"
                ? download(`${slug(project.name)}.json`, code)
                : download(`${plugin ? slug(project.name).replace(/[^\w]/g, "") || "MyUi" : slug(project.name)}.cs`, code, "text/plain")
            }
          >
            <Download className="size-3.5" /> Download
          </Button>
          <Button variant="primary" onClick={copy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
          </Button>
        </>
      }
    >
      <div className="flex h-[60dvh] flex-col">
        <div className="flex items-center gap-3 border-b border-line px-5 py-2.5">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "json", label: "JSON · CuiHelper.AddUi" },
              { value: "csharp", label: "C# · Oxide / Carbon" },
            ]}
          />
          {problems.length > 0 && (
            <span
              className={clsx(
                "flex items-center gap-1.5 text-[12px]",
                errors.length ? "text-red-300" : "text-amber",
              )}
            >
              {errors.length ? <CircleAlert className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
              {problems.length} issue{problems.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {problems.length > 0 && (
          <ul className="max-h-28 space-y-0.5 overflow-auto border-b border-line bg-black/20 px-5 py-2 text-[11.5px]">
            {problems.map((p, i) => (
              <li key={i} className={p.level === "error" ? "text-red-300" : "text-amber/90"}>
                • {p.message}
              </li>
            ))}
          </ul>
        )}
        <div className="min-h-0 flex-1">
          <CodeBlock code={code} lang={tab} />
        </div>
      </div>
    </Dialog>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const loadProject = useEditor((s) => s.loadProject);
  const notify = useUi((s) => s.notify);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { ok: true as const, ...importJson(text) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [text]);

  const apply = () => {
    if (!parsed?.ok) return;
    if (mode === "replace") {
      loadProject({ ...parsed.project, name: useEditor.getState().project.name });
    } else {
      const cur = useEditor.getState().project;
      loadProject({
        ...cur,
        nodes: { ...cur.nodes, ...parsed.project.nodes },
        rootIds: [...cur.rootIds, ...parsed.project.rootIds],
      });
    }
    notify(`Imported ${Object.keys(parsed.project.nodes).length} elements`);
    setText("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      icon={<FileUp />}
      title="Import CUI JSON"
      subtitle="Paste the JSON you pass to CuiHelper.AddUi (or CuiElementContainer.ToJson())."
      footer={
        <>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "replace", label: "Replace canvas" },
              { value: "append", label: "Add to canvas" },
            ]}
          />
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!parsed?.ok} onClick={apply}>
            Import
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) setText(await f.text());
          }}
          placeholder={'[\n  { "name": "MyPanel", "parent": "Overlay", "components": [ … ] }\n]\n\nPaste here or drop a .json file'}
          className="h-72 w-full resize-none rounded-xl border border-line bg-black/35 p-3 font-mono text-[11.5px] leading-relaxed outline-none placeholder:text-faint focus:border-rust/60"
          spellCheck={false}
        />
        {parsed && !parsed.ok && (
          <p className="flex items-center gap-2 text-[12px] text-red-300">
            <CircleAlert className="size-3.5" /> {parsed.error}
          </p>
        )}
        {parsed?.ok && (
          <div className="space-y-1 text-[12px]">
            <p className="flex items-center gap-2 text-good">
              <Check className="size-3.5" /> {Object.keys(parsed.project.nodes).length} elements on layer “
              {parsed.project.layer}”
            </p>
            {parsed.warnings.map((w, i) => (
              <p key={i} className="flex items-center gap-2 text-amber/90">
                <TriangleAlert className="size-3.5 shrink-0" /> {w}
              </p>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function NewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loadProject = useEditor((s) => s.loadProject);
  return (
    <Dialog open={open} onClose={onClose} icon={<FilePlus2 />} title="New project" subtitle="Your current canvas stays in undo history.">
      <div className="grid gap-2 p-5">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              loadProject(t.create());
              onClose();
            }}
            className="group flex items-center gap-3 rounded-xl border border-line bg-white/3 p-3 text-left transition hover:border-rust/50 hover:bg-rust/8"
          >
            <div className="grid size-10 place-items-center rounded-lg bg-black/30 text-muted transition group-hover:text-rust-hi">
              <LayoutTemplate className="size-5" />
            </div>
            <div>
              <div className="text-[13.5px] font-medium">{t.label}</div>
              <div className="text-[12px] text-muted">{t.description}</div>
            </div>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

const SHORTCUTS: [string, string[]][] = [
  ["Undo / Redo", ["Ctrl Z", "Ctrl Shift Z"]],
  ["Duplicate", ["Ctrl D"]],
  ["Copy / Paste", ["Ctrl C", "Ctrl V"]],
  ["Delete", ["Del"]],
  ["Nudge 1px / 10px", ["←↑→↓", "Shift ←↑→↓"]],
  ["Select parent / deselect", ["Esc"]],
  ["Export", ["Ctrl E"]],
  ["Save project file", ["Ctrl S"]],
  ["Open file", ["Ctrl O"]],
  ["Zoom", ["Ctrl Wheel", "Ctrl +", "Ctrl −"]],
  ["Fit to screen", ["Ctrl 0"]],
  ["Disable snapping while dragging", ["Alt"]],
  ["Lock axis while dragging", ["Shift"]],
];

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} icon={<Keyboard />} title="Keyboard shortcuts">
      <ul className="divide-y divide-line px-5 py-2">
        {SHORTCUTS.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-fg/85">{label}</span>
            <span className="flex gap-1.5">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
