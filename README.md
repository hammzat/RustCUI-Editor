# RustCUI Editor

Visual editor for **Rust CUI** (Community UI): build plugin interfaces in the browser and export them as
`CuiHelper.AddUi` JSON or ready-to-paste C# for **Oxide / uMod** and **Carbon**.

## Features

- **WYSIWYG canvas.** Drag, resize, smart snapping guides, grid, zoom, and a 720p reference space that matches how Rust scales UI.
- **Real anchors and offsets.** A Unity-style anchor preset picker. You choose whether dragging changes *offsets* (pixel-perfect) or *anchors* (scales with any screen). Reparenting keeps the element in place.
- **All CUI components:** Image, RawImage, Text, Button, Outline, InputField, Countdown, NeedsCursor, NeedsKeyboard. That includes sprites, materials (the blur materials are previewed), item icons, fade-in/out, `destroyUi` and `update`.
- **Accurate preview.** Rust fonts (Roboto Condensed, Droid Sans Mono, Permanent Marker), rich text (`<b>`, `<i>`, `<color>`, `<size>`), text alignment, outlines, gradient sprites, and a vanilla HUD overlay for checking overlaps.
- **Element tree.** Drag & drop to reorder or reparent, rename, hide, lock, duplicate, copy/paste.
- **Export.** Minimal or full JSON, a C# `CuiElementContainer` snippet, or a complete plugin skeleton. Export runs validation first: duplicate names, conflicting graphic components, missing `NeedsCursor`, and more.
- **Import** of existing CUI JSON, so you can edit UIs from existing plugins.
- **Undo/redo, keyboard shortcuts** (press `?` in the editor), autosave to `localStorage`, and `.rcui.json` project files.

## AI mode

**In-app assistant (AI tab, `Ctrl+K`).** Chat with Claude, paste a mockup screenshot, and watch the UI get built on the
canvas. Paste your Anthropic API key once. It is stored only in your browser and requests go directly from the browser to
`api.anthropic.com`. Claude edits the document through the same tools as the MCP server, and every change is a normal
undo step. You can choose the model (Opus 5.5 by default, Sonnet 5.5 or Haiku 4.5) and the effort level.

**MCP server.** Claude Code, Claude Desktop, Cursor and other MCP clients can drive the editor that is open in your
browser:

```bash
# Claude Code: inside this repo it's picked up automatically from .mcp.json, otherwise:
claude mcp add rustcui-editor -- node /path/to/RustCUI-Editor/mcp/rustcui-mcp.mjs
```

Claude Desktop (`claude_desktop_config.json`):

```json
{ "mcpServers": { "rustcui-editor": { "command": "node", "args": ["/path/to/RustCUI-Editor/mcp/rustcui-mcp.mjs"] } } }
```

Then open the editor and turn on **AI → MCP bridge**. The server forwards tool calls over a local WebSocket
(`ws://127.0.0.1:7331`, which you can change with `RUSTCUI_BRIDGE_PORT`) to the editor tab. It only accepts connections
from localhost pages and from the origins listed in `RUSTCUI_ALLOWED_ORIGINS` (comma-separated; default
`https://hammzat.github.io`).

**claude.ai connector (remote MCP).** claude.ai connects to a public server, so the repo ships a small relay
(`mcp/relay.mjs`). claude.ai calls it over Streamable HTTP at `/mcp/<token>`, and the editor tab connects to
`/bridge/<token>` over WebSocket. The random pairing token is generated in the editor and is the only credential, so keep
the connector URL private and serve the relay over HTTPS.

```bash
npm run relay                                        # listens on :8787
npx cloudflared tunnel --url http://localhost:8787   # quick public HTTPS URL, or deploy it:
docker build -f mcp/Dockerfile -t rustcui-relay . && docker run -p 8787:8787 rustcui-relay
```

In the editor, go to **AI → MCP bridge → Remote**, paste the relay URL, enable the bridge and copy the **Connector URL**.
In claude.ai, go to **Settings → Connectors → Add custom connector** and paste it. **New pairing token** invalidates the
old URL.

Tools: `get_project`, `get_screenshot` (Claude sees the rendered canvas and can fix the layout itself), `add_elements`, `update_element`, `delete_elements`, `move_element`, `replace_project`,
`select_element`, `export_code`. They accept native `CuiHelper.AddUi` JSON. Tool definitions live in
`src/lib/ai/tools.json`, and the in-app assistant and the MCP server share them.

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS v4 · Zustand + Immer · Anthropic SDK · MCP SDK · Vitest.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests for geometry / import / export / codegen
npm run lint
npm run typecheck
npm run build      # static site in ./out
```

The build is a fully static site, so the `out/` folder can be hosted anywhere. To host under a sub-path
(GitHub Pages), set `NEXT_PUBLIC_BASE_PATH=/RustCUI-Editor` at build time. The included workflow does this
and deploys to Pages from the default branch.

## Project layout

```
app/                     Next.js entry (layout, page, global styles)
src/lib/cui/             Framework-free core
  types.ts               CUI data model
  specs.ts               Component registry (drives inspector, JSON and C#)
  geometry.ts            Anchor/offset math in Rust space (y-up, 720p reference)
  serialize.ts           JSON export/import + validation
  csharp.ts              Oxide / Carbon C# generator
  factory.ts             Element presets and templates
  ops.ts                 Name-based edit operations used by AI tools
src/lib/ai/              Tool definitions, executor, Claude agent loop, MCP bridge client
mcp/core.mjs             Shared MCP server factory + editor link
mcp/rustcui-mcp.mjs      Local MCP stdio server ↔ WebSocket bridge to the editor
mcp/relay.mjs            Remote MCP relay for claude.ai connectors (+ mcp/Dockerfile)
src/store/               Zustand stores (document + history, transient UI)
src/components/editor/   Canvas, element tree, inspector, dialogs
tests/                   Vitest suites
```

## License

GPL-3.0. See [LICENSE](LICENSE).
