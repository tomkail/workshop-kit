# workshop-kit

Shared building blocks for Tom's woodworking tools ([Serpentine](https://github.com/tomkail/serpentine), Star Knobs, …), so each new tool starts with the same look, the same canvas controls and exports that print at true size.

Most of the theme, toolbar, tooltip, notification, viewport and grid code started in Serpentine and was generalised here.

| Module | What it gives you |
| --- | --- |
| `theme/` | Serpentine's three-tier design tokens and themes (Amber, Midnight, Paper, …), `ThemeProvider`, and `createThemeStore(key)`. Share a key such as `workshop-theme` across tools to keep one theme. |
| `ui/Toolbar` | Floating bottom toolbar: `Toolbar`, `ToolbarGroup`, `IconButton`, `IconToggle`, `DropdownMenu`, `MenuItem`… Set `--toolbar-inset-right` to centre it over a canvas that has a side panel. |
| `ui/Panel` | Parameter panel: `Panel`, `PanelSection`, `Field`, `NumberField` (custom format/parse, arrow-key steps, optional slider), `Segmented`, `Select`, `Switch`, `Stat`, `Callout`, `Modal`. |
| `ui/Notifications` | Toasts and `notify.info/success/warning/error`. |
| `ui/useHotkeys` | `useHotkeys({ 'mod+z': undo, f: fit })`; skipped while typing in fields. |
| `canvas/` | `createViewportStore()`, `useViewportCanvas()` (wheel/pinch zoom, space/middle/empty-drag pan, touch pinch, DPR resize, app drag handles), and Serpentine's multi-level `renderGrid()`. |
| `drawing/` | A small vector model in millimetres (`Drawing` of paths/arcs/circles/lines/text) with backends: `drawingToSvg` (physical units), `drawingsToPdf` (dependency-free vector PDF), `drawingToDxf`, `printDrawings` (true-scale browser printing), plus paper sizes and `scaleCheck()` rulers. |
| `drawing/page` | `composePage(content, setup, scale)`: puts any drawing on a page with a header and rulers. Scale is `{ mode: 'physical', mmPerUnit }` for true size, or `{ mode: 'fit' }` for unitless tools. Also `pageArea()` and `scaleItems()`. |
| `ui/PrintDialog` | Print and download dialog with a live preview, paper and orientation. It downloads PDF and SVG itself; apps add their own options as children. |
| `canvas/tooltip` | Serpentine's hover tooltips for handles: `drawTooltip(ctx, { value, action, modifiers }, at, theme, { held })` shows the current value, what dragging does, and modifier hints such as `⇧ drag freely` that light up while the key is held (`useModifierKeys()`). Every tool should use it for its canvas handles. |
| `canvas/screenScale` | 1:1 on screen: recognises Apple displays from their resolution, works out the scale from a typed diagonal for other screens, and keys saved calibrations per screen (`resolveScreenScale`). |
| `units/` | mm/inch formatting and parsing (fractions), and standard metric/imperial drill bit sizes. |
| `state/history` | `createHistory(store, select, apply)`: debounced undo/redo for any zustand store. |

Peer dependencies: `react` 18, `zustand` 4, `lucide-react`. The package ships TypeScript source, and Vite compiles it directly.

## Printing from a tool without physical units (e.g. Serpentine)

Serpentine's coordinates aren't tied to anything physical. Convert its paths to `DrawItem`s in canvas units, then compose the page:

```ts
const content = { items: serpentineToItems(paths), bounds: pathBounds }
// Fit the drawing to the paper…
const page = composePage(content, { paperId: 'a4', landscape: true, header: { title: doc.name } }, { mode: 'fit' })
// …or print at a scale the user picks, e.g. 1 unit = 1 mm, with rulers
const trueSize = composePage(content, { paperId: 'a4', landscape: true, scaleCheck: true }, { mode: 'physical', mmPerUnit: 1 })
```

Then show `<PrintDialog page={page} physical={false} … />`, or call `printDrawings([page])`, `drawingsToPdf`, `drawingToSvg` or `drawingToDxf` directly. Stroke widths and text sizes are always in mm on the page, so they stay the same whatever the scale.

## Installing

Install it from GitHub by tag:

```bash
npm install github:tomkail/workshop-kit#v0.1.0
```

The package ships TypeScript and CSS modules, not compiled code, so Vite compiles it along with the app. Each app needs this in `vite.config.ts`:

```ts
export default defineConfig({
  optimizeDeps: { exclude: ['@tomkail/workshop-kit'] }, // let Vite compile its TS + CSS modules
  resolve: { dedupe: ['react', 'react-dom', 'zustand', 'lucide-react'] },
  test: { server: { deps: { inline: ['@tomkail/workshop-kit'] } } }, // vitest, if used
})
```

Import the base stylesheet once: `import '@tomkail/workshop-kit/base.css'`.

## Releasing

1. Bump `version` in `package.json` and commit.
2. Tag the commit and push the tag: `git tag v0.2.0 && git push --tags`.
3. In each app, run `npm install github:tomkail/workshop-kit#v0.2.0`.

## Developing the kit alongside an app

```bash
cd workshop-kit && npm link
cd ../star-knobs && npm link @tomkail/workshop-kit
```

Vite then serves the kit from your local folder, and edits hot-reload. Because the link points outside the app's folder, the app's config also needs `server: { fs: { allow: ['.', '../workshop-kit'] } }`. Run `npm install` in the app afterwards to return to the tagged version.

## Checks

```bash
npm install
npm run typecheck
npm test
```
