"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useUi } from "@/store/ui";
import { runTool } from "./executor";
import { storeHost } from "./host";

/**
 * Browser side of the MCP bridge: connects to the local `rustcui-mcp` server over
 * WebSocket and executes the tool calls it forwards from an MCP client
 * (Claude Code, Claude Desktop, …) against the live editor.
 */

export const DEFAULT_BRIDGE_PORT = 7331;

type Status = "off" | "connecting" | "connected" | "error";

interface BridgeState {
  enabled: boolean;
  port: number;
  status: Status;
  lastCall: { name: string; ok: boolean; at: number } | null;
  calls: number;
  setEnabled(on: boolean): void;
  setPort(port: number): void;
}

let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;

function connect() {
  const { enabled, port } = useBridge.getState();
  clearTimeout(retry);
  socket?.close();
  socket = null;
  if (!enabled) {
    useBridge.setState({ status: "off" });
    return;
  }
  useBridge.setState({ status: "connecting" });
  let ws: WebSocket;
  try {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
  } catch {
    useBridge.setState({ status: "error" });
    return;
  }
  socket = ws;

  ws.onopen = () => {
    useBridge.setState({ status: "connected" });
    ws.send(JSON.stringify({ type: "hello", app: "rustcui-editor", version: 1 }));
    useUi.getState().notify("MCP bridge connected");
  };
  ws.onmessage = (ev) => {
    let msg: { type?: string; id?: string; name?: string; input?: unknown };
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type !== "call" || !msg.id || !msg.name) return;
    let ok = true;
    let content: string;
    try {
      content = runTool(storeHost, msg.name, msg.input ?? {});
    } catch (e) {
      ok = false;
      content = (e as Error).message;
    }
    ws.send(JSON.stringify({ type: "result", id: msg.id, ok, content }));
    useBridge.setState((s) => ({ lastCall: { name: msg.name!, ok, at: Date.now() }, calls: s.calls + 1 }));
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    if (!useBridge.getState().enabled) return;
    useBridge.setState({ status: "error" });
    // The MCP server starts with the MCP client, so keep retrying quietly.
    retry = setTimeout(connect, 3000);
  };
}

export const useBridge = create<BridgeState>()(
  persist(
    (set) => ({
      enabled: false,
      port: DEFAULT_BRIDGE_PORT,
      status: "off",
      lastCall: null,
      calls: 0,
      setEnabled: (enabled) => {
        set({ enabled });
        connect();
      },
      setPort: (port) => {
        set({ port });
        connect();
      },
    }),
    {
      name: "rustcui-bridge",
      partialize: (s) => ({ enabled: s.enabled, port: s.port }),
      onRehydrateStorage: () => (state) => {
        if (state?.enabled) setTimeout(connect, 0);
      },
    },
  ),
);
