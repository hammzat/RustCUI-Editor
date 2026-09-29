"use client";

import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessageParam,
  BetaToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import clsx from "clsx";
import {
  ArrowUp,
  Brain,
  Check,
  ChevronRight,
  CircleAlert,
  KeyRound,
  Loader2,
  Paperclip,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MODELS, type Effort, type ModelId } from "@/lib/ai/agent";
import { CONTEXT_TAG, useAi, type ImageAttachment } from "@/store/ai";
import { Button, Segmented } from "@/components/ui/primitives";
import { BridgeSection } from "./BridgeSection";

const SUGGESTIONS = [
  "Сделай окно магазина на 6 товаров с кнопками «Купить» и закрытием",
  "Добавь HUD-плашку слева сверху: название сервера и онлайн",
  "Сделай всё окно адаптивным: переведи размеры в якоря",
  "Проверь проект и исправь все проблемы",
];

type Block = BetaContentBlock | BetaContentBlockParam;

export function AiPanel() {
  const apiKey = useAi((s) => s.apiKey);
  const [editingKey, setEditingKey] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!apiKey || editingKey ? <KeySetup onDone={() => setEditingKey(false)} /> : <Chat onEditKey={() => setEditingKey(true)} />}
      <BridgeSection />
    </div>
  );
}

function KeySetup({ onDone }: { onDone: () => void }) {
  const current = useAi((s) => s.apiKey);
  const setSettings = useAi((s) => s.setSettings);
  const [key, setKey] = useState(current);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="rounded-2xl border border-line bg-gradient-to-b from-rust/10 to-transparent p-4">
        <div className="mb-3 grid size-10 place-items-center rounded-xl bg-rust/15 text-rust-hi">
          <Sparkles className="size-5" />
        </div>
        <h3 className="text-[14px] font-semibold">Claude in the editor</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          Describe a UI or paste a mockup screenshot — Claude builds it right on the canvas, and every change is a
          normal undo step.
        </p>
        <label className="mt-4 block text-[11px] font-medium text-muted">Anthropic API key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-…"
          className="mt-1 h-8 w-full rounded-lg border border-line bg-black/30 px-2.5 font-mono text-[12px] outline-none focus:border-rust/60"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-1.5 text-[11px] leading-snug text-faint">
          Stored only in this browser and sent directly to api.anthropic.com. Get one at{" "}
          <a className="text-sky hover:underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            disabled={!key.trim().startsWith("sk-")}
            onClick={() => {
              setSettings({ apiKey: key.trim() });
              onDone();
            }}
          >
            <KeyRound className="size-3.5" /> Save key
          </Button>
          {current && (
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-faint">
        Prefer Claude Code or Claude Desktop? Use the MCP bridge below — no key needed here.
      </p>
    </div>
  );
}

async function toAttachment(file: File): Promise<ImageAttachment | null> {
  if (!file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    // Keep the long edge ≤ 1568px — larger images are downscaled by the API anyway.
    const scale = Math.min(1, 1568 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return { mediaType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Chat({ onEditKey }: { onEditKey: () => void }) {
  const { messages, streaming, running, error, model, effort, send, stop, clear, setSettings } = useAi();
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const modelInfo = MODELS.find((m) => m.id === model) ?? MODELS[0];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, error]);

  const addFiles = async (files: FileList | File[]) => {
    const out = (await Promise.all([...files].map(toAttachment))).filter(Boolean) as ImageAttachment[];
    if (out.length) setImages((cur) => [...cur, ...out].slice(0, 4));
  };

  const submit = (value = text) => {
    if (running) return;
    void send(value, images);
    setText("");
    setImages([]);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <select
          value={model}
          onChange={(e) => setSettings({ model: e.target.value as ModelId })}
          className="h-7 min-w-0 flex-1 cursor-pointer rounded-md border border-line bg-black/25 px-1.5 text-[12px] outline-none"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id} className="bg-panel-2">
              {m.label}
            </option>
          ))}
        </select>
        {modelInfo.thinking && (
          <Segmented
            value={effort}
            onChange={(v) => setSettings({ effort: v as Effort })}
            options={[
              { value: "low", label: "Low", title: "Fast, cheap" },
              { value: "medium", label: "Med", title: "Balanced (default)" },
              { value: "high", label: "High", title: "Most careful" },
            ]}
          />
        )}
        <Button variant="ghost" size="sm" className="px-1.5" title="API key" onClick={onEditKey}>
          <KeyRound className="size-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="px-1.5" title="New conversation" disabled={!messages.length} onClick={clear}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="space-y-2 pt-2">
            <p className="flex items-center gap-2 text-[12px] text-muted">
              <Sparkles className="size-3.5 text-rust-hi" /> Try asking:
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="block w-full rounded-xl border border-line bg-white/3 px-3 py-2 text-left text-[12px] leading-snug text-fg/85 transition hover:border-rust/40 hover:bg-rust/8"
              >
                {s}
              </button>
            ))}
            <p className="px-1 pt-1 text-[11px] leading-relaxed text-faint">
              Tip: paste (Ctrl+V) or drop a screenshot of a design and Claude will recreate it.
            </p>
          </div>
        )}
        <Transcript messages={messages} />
        {streaming && (streaming.thinking || streaming.text) && (
          <div className="space-y-2">
            {streaming.thinking && <Thinking text={streaming.thinking} live />}
            {streaming.text && <AssistantText text={streaming.text} />}
          </div>
        )}
        {running && !streaming?.text && (
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Working…
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
          </div>
        )}
      </div>

      <div
        className="border-t border-line p-2.5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFiles(e.dataTransfer.files);
        }}
      >
        {images.length > 0 && (
          <div className="mb-2 flex gap-1.5">
            {images.map((img, i) => (
              <div key={i} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt=""
                  className="size-12 rounded-lg object-cover ring-1 ring-line-strong"
                />
                <button
                  type="button"
                  onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-black text-white opacity-0 ring-1 ring-line-strong transition group-hover:opacity-100"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5 rounded-xl border border-line bg-black/30 p-1.5 transition focus-within:border-rust/60">
          <button
            type="button"
            title="Attach a mockup image"
            onClick={() => fileRef.current?.click()}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/8 hover:text-fg"
          >
            <Paperclip className="size-3.5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
              if (files.length) {
                e.preventDefault();
                void addFiles(files);
              }
            }}
            rows={1}
            placeholder="Describe what to build or change…"
            className="max-h-40 min-h-7 flex-1 resize-none bg-transparent py-1 text-[12.5px] leading-snug outline-none placeholder:text-faint"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          {running ? (
            <button
              type="button"
              title="Stop"
              onClick={stop}
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-fg transition hover:bg-white/15"
            >
              <Square className="size-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              title="Send (Enter)"
              disabled={!text.trim() && !images.length}
              onClick={() => submit()}
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-rust text-white transition hover:bg-rust-hi disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Transcript({ messages }: { messages: BetaMessageParam[] }) {
  const results = useMemo(() => {
    const map = new Map<string, BetaToolResultBlockParam>();
    for (const m of messages) {
      if (m.role !== "user" || typeof m.content === "string") continue;
      for (const b of m.content) if (b.type === "tool_result") map.set(b.tool_use_id, b);
    }
    return map;
  }, [messages]);

  const items: ReactNode[] = [];
  messages.forEach((m, mi) => {
    const blocks: Block[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content as Block[]);
    if (m.role === "user") {
      const texts = blocks.filter(
        (b): b is Extract<Block, { type: "text" }> => b.type === "text" && !b.text.startsWith(CONTEXT_TAG),
      );
      const imgs = blocks.filter((b) => b.type === "image");
      if (!texts.length && !imgs.length) return; // tool results only
      items.push(
        <div key={mi} className="flex flex-col items-end gap-1.5">
          {imgs.length > 0 && (
            <div className="flex gap-1">
              {imgs.map((b, i) => {
                const src = b.type === "image" && b.source.type === "base64" ? `data:${b.source.media_type};base64,${b.source.data}` : "";
                // eslint-disable-next-line @next/next/no-img-element
                return <img key={i} src={src} alt="" className="h-16 rounded-lg ring-1 ring-line-strong" />;
              })}
            </div>
          )}
          {texts.map((t, i) => (
            <div key={i} className="max-w-[90%] rounded-2xl rounded-br-md bg-rust/20 px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {t.text}
            </div>
          ))}
        </div>,
      );
      return;
    }
    blocks.forEach((b, bi) => {
      const key = `${mi}-${bi}`;
      if (b.type === "thinking" && b.thinking) items.push(<Thinking key={key} text={b.thinking} />);
      else if (b.type === "text" && b.text.trim()) items.push(<AssistantText key={key} text={b.text} />);
      else if (b.type === "tool_use") items.push(<ToolChip key={key} name={b.name} input={b.input} result={results.get(b.id)} />);
    });
  });
  return <>{items}</>;
}

function AssistantText({ text }: { text: string }) {
  // Minimal formatting: fenced code blocks and **bold**.
  const parts = text.split(/```[\w-]*\n?([\s\S]*?)```/g);
  return (
    <div className="space-y-2 text-[12.5px] leading-relaxed text-fg/90">
      {parts.map((p, i) =>
        i % 2 ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-black/40 p-2 font-mono text-[11px]">
            {p}
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {p.split(/\*\*(.+?)\*\*/g).map((s, j) => (j % 2 ? <b key={j}>{s}</b> : s))}
          </p>
        ),
      )}
    </div>
  );
}

function Thinking({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-[11.5px] text-faint">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 hover:text-muted">
        <Brain className={clsx("size-3.5", live && "animate-pulse")} />
        {live ? "Thinking…" : "Thought process"}
        <ChevronRight className={clsx("size-3 transition", open && "rotate-90")} />
      </button>
      {open && <p className="mt-1 border-l border-line-strong pl-2.5 leading-relaxed whitespace-pre-wrap">{text}</p>}
    </div>
  );
}

function summarize(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "add_elements": {
      const els = Array.isArray(i.elements) ? (i.elements as { name?: string }[]) : [];
      return `${els.length} element${els.length === 1 ? "" : "s"}${els[0]?.name ? ` · ${els[0].name}` : ""}`;
    }
    case "update_element":
    case "move_element":
      return String(i.name ?? "");
    case "delete_elements":
      return Array.isArray(i.names) ? i.names.join(", ") : "";
    case "replace_project":
      return Array.isArray(i.elements) ? `${i.elements.length} elements` : "";
    case "export_code":
      return String(i.format ?? "");
    case "select_element":
      return String(i.name ?? "none");
    default:
      return "";
  }
}

const TOOL_LABELS: Record<string, string> = {
  get_project: "Read project",
  get_screenshot: "Look at canvas",
  add_elements: "Add",
  update_element: "Update",
  delete_elements: "Delete",
  move_element: "Move",
  replace_project: "Replace project",
  select_element: "Select",
  export_code: "Export",
};

function ToolChip({ name, input, result }: { name: string; input: unknown; result?: BetaToolResultBlockParam }) {
  const [open, setOpen] = useState(false);
  const status = !result ? "pending" : result.is_error ? "error" : "ok";
  const shot =
    Array.isArray(result?.content) &&
    result.content.find((c): c is Extract<typeof c, { type: "image" }> => c.type === "image");
  const shotSrc = shot && shot.source.type === "base64" ? `data:${shot.source.media_type};base64,${shot.source.data}` : null;
  const resultText =
    typeof result?.content === "string"
      ? result.content
      : (result?.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
  return (
    <div className="rounded-lg border border-line bg-white/3 text-[11.5px]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
        {status === "pending" ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted" />
        ) : status === "ok" ? (
          <Check className="size-3.5 shrink-0 text-good" />
        ) : (
          <CircleAlert className="size-3.5 shrink-0 text-red-400" />
        )}
        <Wrench className="size-3 shrink-0 text-faint" />
        <span className="font-medium text-fg/85">{TOOL_LABELS[name] ?? name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-faint">{summarize(name, input)}</span>
        <ChevronRight className={clsx("size-3 shrink-0 text-faint transition", open && "rotate-90")} />
      </button>
      {shotSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shotSrc} alt="Canvas screenshot" className="mx-2.5 mb-2 w-[calc(100%-20px)] rounded-md ring-1 ring-line" />
      )}
      {open && (
        <div className="space-y-1.5 border-t border-line p-2">
          <pre className="max-h-48 overflow-auto rounded bg-black/40 p-2 font-mono text-[10.5px] text-fg/75">
            {JSON.stringify(input, null, 2)}
          </pre>
          {result && (
            <pre
              className={clsx(
                "max-h-40 overflow-auto rounded p-2 font-mono text-[10.5px]",
                result.is_error ? "bg-red-500/10 text-red-200" : "bg-black/40 text-fg/60",
              )}
            >
              {resultText.length > 4000 ? `${resultText.slice(0, 4000)}…` : resultText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
