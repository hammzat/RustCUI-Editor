"use client";

import clsx from "clsx";
import { Cable, Check, ChevronRight, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { connectorUrl, useBridge, type BridgeMode } from "@/lib/ai/bridge";
import { Button, Segmented, Switch } from "@/components/ui/primitives";

const STATUS: Record<string, { label: string; dot: string }> = {
  off: { label: "Off", dot: "bg-faint" },
  connecting: { label: "Connecting…", dot: "bg-amber animate-pulse" },
  connected: { label: "Connected", dot: "bg-good" },
  error: { label: "Waiting for server…", dot: "bg-amber animate-pulse" },
};

function CopyBox({ text, placeholder }: { text: string; placeholder?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-black/40 p-2 pr-8 font-mono text-[10.5px] break-all whitespace-pre-wrap text-fg/80">
        {text || <span className="text-faint">{placeholder}</span>}
      </pre>
      {text && (
        <button
          type="button"
          title="Copy"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded text-faint hover:text-fg"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      )}
    </div>
  );
}

export function BridgeSection() {
  const bridge = useBridge();
  const { enabled, mode, port, relayUrl, status, calls, lastCall, setEnabled, configure, rotateToken } = bridge;
  const [open, setOpen] = useState(false);
  const [relayDraft, setRelayDraft] = useState(relayUrl);
  const st = STATUS[status];
  const connector = connectorUrl(bridge);

  return (
    <div className="border-t border-line">
      <div className="flex h-10 items-center gap-2 px-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight className={clsx("size-3.5 text-faint transition", open && "rotate-90")} />
          <Cable className="size-3.5 text-muted" />
          <span className="text-[12px] font-semibold">MCP bridge</span>
          <span className="flex items-center gap-1.5 truncate text-[11px] text-faint">
            <span className={clsx("size-1.5 rounded-full", st.dot)} />
            {enabled ? (mode === "remote" ? "Remote · " : "Local · ") : ""}
            {st.label}
            {status === "connected" && calls > 0 && <span>· {calls} calls</span>}
          </span>
        </button>
        <Switch checked={enabled} onChange={setEnabled} label="Enable MCP bridge" />
      </div>
      {open && (
        <div className="max-h-[50dvh] space-y-2.5 overflow-y-auto px-3 pb-3 text-[11.5px] leading-relaxed text-muted">
          <Segmented
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
            value={mode}
            onChange={(m) => configure({ mode: m as BridgeMode })}
            options={[
              { value: "local", label: "Local", title: "Claude Code / Claude Desktop on this machine" },
              { value: "remote", label: "Remote · claude.ai", title: "claude.ai custom connector via the relay" },
            ]}
          />

          {mode === "local" ? (
            <>
              <p>Run the MCP server from the repo, then enable the bridge.</p>
              <CopyBox text="claude mcp add rustcui-editor -- node /path/to/RustCUI-Editor/mcp/rustcui-mcp.mjs" />
              <p className="text-faint">
                In this repo Claude Code picks it up automatically from <code className="text-muted">.mcp.json</code>.
              </p>
              <label className="flex items-center justify-between gap-2">
                Port
                <input
                  type="number"
                  value={port}
                  onChange={(e) => configure({ port: Number(e.target.value) || 7331 })}
                  className="h-6 w-20 rounded-md border border-line bg-black/30 px-1.5 text-right font-mono text-[11px] outline-none focus:border-rust/60"
                />
              </label>
            </>
          ) : (
            <>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  Run the relay (<code className="text-muted">npm run relay</code>) somewhere reachable over HTTPS — see
                  README.
                </li>
                <li>Paste its URL below and enable the bridge.</li>
                <li>
                  In claude.ai: <span className="text-fg/80">Settings → Connectors → Add custom connector</span>, paste
                  the connector URL.
                </li>
              </ol>
              <label className="block">
                <span className="mb-1 block text-[11px]">Relay URL</span>
                <input
                  value={relayDraft}
                  onChange={(e) => setRelayDraft(e.target.value)}
                  onBlur={() => relayDraft !== relayUrl && configure({ relayUrl: relayDraft.trim() })}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder="https://your-relay.example.com"
                  className="h-7 w-full rounded-md border border-line bg-black/30 px-2 font-mono text-[11px] outline-none focus:border-rust/60"
                  spellCheck={false}
                />
              </label>
              <div>
                <span className="mb-1 flex items-center justify-between text-[11px]">
                  Connector URL <span className="text-faint">keep it private</span>
                </span>
                <CopyBox text={connector} placeholder="Set the relay URL first" />
              </div>
              <Button size="sm" variant="ghost" className="border border-line" onClick={rotateToken} title="Invalidate the old connector URL">
                <RefreshCw className="size-3" /> New pairing token
              </Button>
            </>
          )}
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
