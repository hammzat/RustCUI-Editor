"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useUi } from "@/store/ui";
import { runTool, type ToolOutput } from "./executor";
import { storeHost } from "./host";

/**
 * Browser side of the MCP bridge. The editor connects out over WebSocket to either
 *  - the local stdio MCP server (`mcp/rustcui-mcp.mjs`, for Claude Code / Desktop), or
 *  - the relay (`mcp/relay.mjs`), which exposes a remote MCP endpoint for claude.ai connectors.
 * Tool calls arriving on the socket run against the live editor.
 */

export const DEFAULT_BRIDGE_PORT = 7331;

export type BridgeMode = "local" | "remote";
type Status = "off" | "connecting" | "connected" | "error";

interface BridgeState {
  enabled: boolean;
  mode: BridgeMode;
  port: number;
  relayUrl: string;
  token: string;
  status: Status;
  lastCall: { name: string; ok: boolean; at: number } | null;
  calls: number;
  setEnabled(on: boolean): void;
  configure(patch: Partial<Pick<BridgeState, "mode" | "port" | "relayUrl">>): void;
  rotateToken(): void;
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const trimSlash = (u: string) => u.trim().replace(/\/+$/, "");

/** URL to paste into claude.ai → Settings → Connectors → Add custom connector. */
export function connectorUrl(s: Pick<BridgeState, "relayUrl" | "token">): string {
  return s.relayUrl ? `${trimSlash(s.relayUrl)}/mcp/${s.token}` : "";
}

function socketUrl(s: BridgeState): string | null {
  if (s.mode === "local") return `ws://127.0.0.1:${s.port}`;
  if (!s.relayUrl) return null;
  try {
    const u = new URL(trimSlash(s.relayUrl));
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = `${u.pathname.replace(/\/$/, "")}/bridge/${s.token}`;
    return u.toString();
  } catch {
    return null;
  }
}

let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
// MCP clients may fire calls in parallel; edits must apply in order.
let queue: Promise<unknown> = Promise.resolve();

function connect() {
  const state = useBridge.getState();
  clearTimeout(retry);
  const old = socket;
  socket = null;
  old?.close();
  if (!state.enabled) {
    useBridge.setState({ status: "off" });
    return;
  }
  const url = socketUrl(state);
  if (!url) {
    useBridge.setState({ status: "error" });
    return;
  }
  useBridge.setState({ status: "connecting" });
  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch {
    useBridge.setState({ status: "error" });
    return;
  }
  socket = ws;

  ws.onopen = () => {
    useBridge.setState({ status: "connected" });
    ws.send(JSON.stringify({ type: "hello", app: "rustcui-editor", version: 2 }));
    useUi.getState().notify(state.mode === "remote" ? "Connected to relay" : "MCP bridge connected");
  };
  ws.onmessage = (ev) => {
    let msg: { type?: string; id?: string; name?: string; input?: unknown };
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type !== "call" || !msg.id || !msg.name) return;
    const { id, name } = msg;
    queue = queue.then(async () => {
      let ok = true;
      let out: ToolOutput;
      try {
        out = await runTool(storeHost, name, msg.input ?? {});
      } catch (e) {
        ok = false;
        out = { text: (e as Error).message };
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "result", id, ok, content: out.text, image: out.image }));
      }
      useBridge.setState((s) => ({ lastCall: { name, ok, at: Date.now() }, calls: s.calls + 1 }));
    });
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    if (!useBridge.getState().enabled) return;
    useBridge.setState({ status: "error" });
    // The server may start later (MCP clients launch it on demand), so keep retrying quietly.
    retry = setTimeout(connect, 3000);
  };
}

export const useBridge = create<BridgeState>()(
  persist(
    (set) => ({
      enabled: false,
      mode: "local",
      port: DEFAULT_BRIDGE_PORT,
      relayUrl: "",
      token: newToken(),
      status: "off",
      lastCall: null,
      calls: 0,
      setEnabled: (enabled) => {
        set({ enabled });
        connect();
      },
      configure: (patch) => {
        set(patch);
        connect();
      },
      rotateToken: () => {
        set({ token: newToken() });
        connect();
      },
    }),
    {
      name: "rustcui-bridge",
      partialize: (s) => ({ enabled: s.enabled, mode: s.mode, port: s.port, relayUrl: s.relayUrl, token: s.token }),
      onRehydrateStorage: () => (state) => {
        // Persist the generated pairing token right away so the connector URL stays stable.
        setTimeout(() => useBridge.setState({}), 0);
        if (state?.enabled) setTimeout(connect, 0);
      },
    },
  ),
);
