"use client";

import clsx from "clsx";
import { Cable, Check, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import { useBridge } from "@/lib/ai/bridge";
import { Switch } from "@/components/ui/primitives";

const STATUS: Record<string, { label: string; dot: string }> = {
  off: { label: "Off", dot: "bg-faint" },
  connecting: { label: "Connecting…", dot: "bg-amber animate-pulse" },
  connected: { label: "Connected", dot: "bg-good" },
  error: { label: "Waiting for server…", dot: "bg-amber animate-pulse" },
};

export function BridgeSection() {
  const { enabled, port, status, calls, lastCall, setEnabled, setPort } = useBridge();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const st = STATUS[status];
  const command = "claude mcp add rustcui-editor -- node /path/to/RustCUI-Editor/mcp/rustcui-mcp.mjs";

  return (
    <div className="border-t border-line">
      <div className="flex h-10 items-center gap-2 px-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight className={clsx("size-3.5 text-faint transition", open && "rotate-90")} />
          <Cable className="size-3.5 text-muted" />
          <span className="text-[12px] font-semibold">MCP bridge</span>
          <span className="flex items-center gap-1.5 truncate text-[11px] text-faint">
            <span className={clsx("size-1.5 rounded-full", st.dot)} />
            {st.label}
            {status === "connected" && calls > 0 && <span>· {calls} calls</span>}
          </span>
        </button>
        <Switch checked={enabled} onChange={setEnabled} label="Enable MCP bridge" />
      </div>
      {open && (
        <div className="space-y-2 px-3 pb-3 text-[11.5px] leading-relaxed text-muted">
          <p>
            Let Claude Code, Claude Desktop or any MCP client edit this canvas. Start the MCP server from the repo, then
            enable the bridge.
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-2 pr-8 font-mono text-[10.5px] text-fg/80">{command}</pre>
            <button
              type="button"
              title="Copy"
              onClick={async () => {
                await navigator.clipboard.writeText(command);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded text-faint hover:text-fg"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </button>
          </div>
          <p className="text-faint">
            In this repo Claude Code picks it up automatically from <code className="text-muted">.mcp.json</code>.
          </p>
          <label className="flex items-center justify-between gap-2">
            Port
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value) || 7331)}
              className="h-6 w-20 rounded-md border border-line bg-black/30 px-1.5 text-right font-mono text-[11px] outline-none focus:border-rust/60"
            />
          </label>
          {lastCall && (
            <p className="font-mono text-[10.5px] text-faint">
              last: {lastCall.name} {lastCall.ok ? "✓" : "✗"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
