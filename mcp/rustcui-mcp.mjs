#!/usr/bin/env node
/**
 * RustCUI Editor MCP server.
 *
 * Speaks MCP over stdio to an MCP client (Claude Code, Claude Desktop, …) and
 * forwards every tool call over a local WebSocket to the editor open in the
 * browser (AI panel → "MCP bridge" → Connect). The editor executes the call
 * against the live document, so changes appear instantly and are undoable.
 *
 * Env:
 *   RUSTCUI_BRIDGE_PORT       WebSocket port (default 7331)
 *   RUSTCUI_ALLOWED_ORIGINS   Extra comma-separated browser origins allowed to connect,
 *                             or "*" to allow any (localhost is always allowed).
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from "ws";

const defs = JSON.parse(readFileSync(new URL("../src/lib/ai/tools.json", import.meta.url), "utf8"));
const PORT = Number(process.env.RUSTCUI_BRIDGE_PORT) || 7331;
const CALL_TIMEOUT_MS = 30_000;
const extraOrigins = (process.env.RUSTCUI_ALLOWED_ORIGINS ?? "https://hammzat.github.io")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// stdout belongs to the MCP protocol — log to stderr only.
const log = (...args) => console.error("[rustcui-mcp]", ...args);

function originAllowed(origin) {
  if (!origin) return true; // non-browser local client
  if (extraOrigins.includes("*") || extraOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ bridge

let editor = null;
const pending = new Map();

const wss = new WebSocketServer({
  host: "127.0.0.1",
  port: PORT,
  verifyClient: ({ origin }) => {
    const ok = originAllowed(origin);
    if (!ok) log(`rejected connection from origin ${origin}`);
    return ok;
  },
});

wss.on("listening", () => log(`waiting for the editor on ws://127.0.0.1:${PORT}`));
wss.on("error", (err) => log(`bridge error: ${err.message}`));
wss.on("connection", (ws) => {
  // Latest editor tab wins.
  if (editor && editor !== ws) editor.close(1000, "replaced by a newer editor tab");
  editor = ws;
  log("editor connected");
  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (msg.type !== "result") return;
    const call = pending.get(msg.id);
    if (!call) return;
    pending.delete(msg.id);
    clearTimeout(call.timer);
    call.resolve({ ok: !!msg.ok, content: String(msg.content ?? "") });
  });
  ws.on("close", () => {
    if (editor !== ws) return;
    editor = null;
    log("editor disconnected");
    for (const [id, call] of pending) {
      clearTimeout(call.timer);
      call.resolve({ ok: false, content: "The editor disconnected before answering." });
      pending.delete(id);
    }
  });
});

function callEditor(name, input) {
  if (!editor || editor.readyState !== editor.OPEN) {
    return Promise.resolve({
      ok: false,
      content:
        "RustCUI Editor is not connected. Ask the user to open the editor, go to the AI tab and enable " +
        `"MCP bridge" (port ${PORT}).`,
    });
  }
  const id = randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, content: "Timed out waiting for the editor." });
    }, CALL_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    editor.send(JSON.stringify({ type: "call", id, name, input }));
  });
}

// ------------------------------------------------------------------ MCP

const server = new Server(
  { name: "rustcui-editor", version: "1.0.0" },
  { capabilities: { tools: {} }, instructions: defs.instructions },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: defs.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (!defs.tools.some((t) => t.name === name)) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool "${name}"` }] };
  }
  const res = await callEditor(name, args ?? {});
  return { isError: !res.ok, content: [{ type: "text", text: res.content }] };
});

await server.connect(new StdioServerTransport());
log("MCP server ready");

const shutdown = () => {
  wss.close();
  process.exit(0);
};
process.stdin.on("close", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
