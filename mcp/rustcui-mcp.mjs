#!/usr/bin/env node
/**
 * RustCUI Editor MCP server (local, stdio).
 *
 * Speaks MCP over stdio to an MCP client (Claude Code, Claude Desktop, …) and
 * forwards every tool call over a local WebSocket to the editor open in the
 * browser (AI tab → MCP bridge → Local). The editor executes the call against
 * the live document, so changes appear instantly and are undoable.
 *
 * Env:
 *   RUSTCUI_BRIDGE_PORT       WebSocket port (default 7331)
 *   RUSTCUI_ALLOWED_ORIGINS   Extra comma-separated browser origins allowed to connect,
 *                             or "*" to allow any (localhost is always allowed).
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer } from "ws";
import { createMcpServer, EditorLink } from "./core.mjs";

const PORT = Number(process.env.RUSTCUI_BRIDGE_PORT) || 7331;
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

const link = new EditorLink(
  "RustCUI Editor is not connected. Ask the user to open the editor, go to the AI tab and enable " +
    `"MCP bridge" in Local mode (port ${PORT}).`,
);

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
wss.on("error", (err) => {
  log(`bridge error: ${err.message}`);
  if (err.code === "EADDRINUSE") {
    link.notConnectedHint =
      `Port ${PORT} is already used by another RustCUI MCP server (probably started by another MCP client). ` +
      "Close that client, or set RUSTCUI_BRIDGE_PORT to a free port here and in the editor's bridge settings.";
  }
});
wss.on("connection", (ws) => {
  link.attach(ws);
  log("editor connected");
  ws.on("close", () => log("editor disconnected"));
});

await createMcpServer(link).connect(new StdioServerTransport());
log("MCP server ready");

const shutdown = () => {
  wss.close();
  process.exit(0);
};
process.stdin.on("close", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
