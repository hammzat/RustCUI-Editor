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

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS v4 · Zustand + Immer · Vitest.

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
src/store/               Zustand stores (document + history, transient UI)
src/components/editor/   Canvas, element tree, inspector, dialogs
tests/                   Vitest suites
```

## License

GPL-3.0. See [LICENSE](LICENSE).
