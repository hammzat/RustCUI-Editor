#!/usr/bin/env node
/**
 * RustCUI Editor relay — remote MCP endpoint for claude.ai connectors.
 *
 *   claude.ai  ──(Streamable HTTP)──▶  /mcp/<token>
 *                                         │ forwards tool calls
 *   editor tab ◀──────(WebSocket)─────  /bridge/<token>
 *
 * The editor generates a random pairing token (AI tab → MCP bridge → Remote) and
 * connects to /bridge/<token>. The same token in the connector URL routes calls to
 * that tab. The token is the only credential, so keep the connector URL private
 * and serve this over HTTPS.
 *
 * Env: PORT (default 8787), HOST (default 0.0.0.0).
 */
import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { WebSocketServer } from "ws";
import { createMcpServer, EditorLink } from "./core.mjs";

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY = 2 * 1024 * 1024;
const MAX_LINKS = 5000;
const TOKEN_RE = /^[a-f0-9]{32,128}$/;

const log = (...args) => console.log(new Date().toISOString(), ...args);
/** Never log full tokens. */
const redact = (t) => `${t.slice(0, 6)}…`;

const links = new Map(); // token -> EditorLink

function linkFor(token) {
  let link = links.get(token);
  if (!link) {
    if (links.size >= MAX_LINKS) {
      // Drop idle links first.
      for (const [t, l] of links) if (!l.connected && l.pending.size === 0) links.delete(t);
    }
    link = new EditorLink(
      "RustCUI Editor is not connected to this relay. Ask the user to open the editor, go to the AI tab → MCP bridge, " +
        "choose Remote and enable it (the connector URL shown there must match this one).",
    );
    links.set(token, link);
  }
  return link;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

function cors(res) {
  // Lets browser-based MCP tools (e.g. MCP Inspector) talk to the endpoint too.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, accept, authorization, mcp-session-id, mcp-protocol-version");
  res.setHeader("access-control-expose-headers", "mcp-session-id");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://relay");
  cors(res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  if (url.pathname === "/" || url.pathname === "/healthz") {
    return json(res, 200, { ok: true, service: "rustcui-relay", editors: [...links.values()].filter((l) => l.connected).length });
  }

  const m = url.pathname.match(/^\/mcp\/([^/]+)\/?$/);
  if (!m) return json(res, 404, { error: "Not found" });
  const token = m[1];
  if (!TOKEN_RE.test(token)) return json(res, 404, { error: "Not found" });

  if (req.method !== "POST") {
    // Stateless server: no standalone SSE stream or sessions to delete.
    return json(res, 405, { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return json(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: `Parse error: ${e.message}` }, id: null });
  }

  // Stateless Streamable HTTP: a fresh server + transport per request.
  const mcp = createMcpServer(linkFor(token));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close();
    mcp.close();
  });
  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (e) {
    log("mcp error", e.message);
    if (!res.headersSent) json(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
  }
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://relay");
  const m = url.pathname.match(/^\/bridge\/([^/]+)\/?$/);
  if (!m || !TOKEN_RE.test(m[1])) {
    socket.destroy();
    return;
  }
  const token = m[1];
  wss.handleUpgrade(req, socket, head, (ws) => {
    linkFor(token).attach(ws);
    log(`editor connected ${redact(token)}`);
    // Keep the connection alive through proxies that close idle sockets.
    const ping = setInterval(() => ws.readyState === ws.OPEN && ws.ping(), 25_000);
    ws.on("close", () => {
      clearInterval(ping);
      log(`editor disconnected ${redact(token)}`);
    });
  });
});

server.listen(PORT, HOST, () => log(`rustcui relay listening on http://${HOST}:${PORT}`));

const shutdown = () => {
  wss.close();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
