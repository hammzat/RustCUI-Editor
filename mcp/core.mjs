/**
 * Shared pieces of the RustCUI MCP servers: tool definitions, the MCP server
 * factory and the link to a connected editor tab.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export const defs = JSON.parse(readFileSync(new URL("../src/lib/ai/tools.json", import.meta.url), "utf8"));

const CALL_TIMEOUT_MS = 30_000;

/** One editor tab connected over WebSocket; forwards tool calls and awaits results. */
export class EditorLink {
  constructor(notConnectedHint) {
    this.ws = null;
    this.pending = new Map();
    this.notConnectedHint = notConnectedHint;
  }

  get connected() {
    return !!this.ws && this.ws.readyState === this.ws.OPEN;
  }

  attach(ws) {
    // Latest editor tab wins.
    if (this.ws && this.ws !== ws) this.ws.close(1000, "replaced by a newer editor tab");
    this.ws = ws;
    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg.type !== "result") return;
      const call = this.pending.get(msg.id);
      if (!call) return;
      this.pending.delete(msg.id);
      clearTimeout(call.timer);
      call.resolve({ ok: !!msg.ok, text: String(msg.content ?? ""), image: msg.image });
    });
    ws.on("close", () => {
      if (this.ws !== ws) return;
      this.ws = null;
      for (const [id, call] of this.pending) {
        clearTimeout(call.timer);
        call.resolve({ ok: false, text: "The editor disconnected before answering." });
        this.pending.delete(id);
      }
    });
  }

  call(name, input) {
    if (!this.connected) return Promise.resolve({ ok: false, text: this.notConnectedHint });
    const id = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, text: "Timed out waiting for the editor." });
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      this.ws.send(JSON.stringify({ type: "call", id, name, input }));
    });
  }
}

/** MCP server whose tools are executed by `link`. */
export function createMcpServer(link) {
  const server = new Server(
    { name: "rustcui-editor", version: "1.1.0" },
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
    const res = await link.call(name, args ?? {});
    const content = [];
    const img = res.image;
    if (img && typeof img.data === "string" && /^image\/(png|jpeg)$/.test(img.mediaType)) {
      content.push({ type: "image", data: img.data, mimeType: img.mediaType });
    }
    content.push({ type: "text", text: res.text });
    return { isError: !res.ok, content };
  });
  return server;
}
