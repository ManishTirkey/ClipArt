# ClipArt – Fast, glassy clipboard manager for Windows (Electron + TypeScript)

ClipArt is a lightweight, always-ready clipboard companion that mirrors the Windows clipboard and adds a fast, keyboard-driven UI. It shows your last copies, lets you paste the top 10 instantly with global hotkeys, and stays fixed at the bottom-right on every monitor.

## Features
- Multi-monitor HUD windows (one per display), fixed bottom-right
- Global shortcuts
  - Toggle visibility: Ctrl+Alt+F12
  - Quick-paste slots: Ctrl+Alt+F1..F10 (top 10 clips)
- Realtime clipboard sync: new copies are added to the top and auto-highlighted
- Click-to-copy any item (not just top 10)
- Minimal, glassy UI with blur and rounded corners
- Secure renderer (contextIsolation on, no nodeIntegration)

## How it works
- The main process polls the system clipboard and maintains an in-memory list (up to 50 items by default).
- The renderer displays all items in a scrollable list; the top 10 have F‑key badges and can be accessed via global shortcuts.
- Selecting a clip (click or shortcut) writes it to the system clipboard and highlights the item.
- If all windows are hidden and you copy something, ClipArt auto-shows to confirm the new item.

## Requirements
- Node.js 18+ (recommended) or newer
- Windows 10/11 (designed for Windows; macOS/Linux not tested)

## Getting started
Install dependencies and run in development:
```bash
npm install
npm run dev
```
- TypeScript compiler, asset copier, and Electron will start together.
- Copy text (Ctrl+C) to populate the list and show the window.

## Build
Produce compiled JavaScript into `dist/`:
```bash
npm run build
```
Start Electron from the compiled output:
```bash
npm run start
```

## Package (optional)
This repo contains an `electron-builder.yml`. To package locally:
```bash
npm run dist
```
Artifacts will be placed under `dist/` according to your builder config.

## Shortcuts
- Toggle all windows: Ctrl+Alt+F12
- Paste top slots: Ctrl+Alt+F1..F10
Notes:
- Some keyboards reserve Fn keys; consider using the keyboard’s “Fn lock”. Adding number-row backups is possible.

## Configuration
You can tweak behavior in `src/main.ts`:
- MAX_CLIPS: total stored items (default 50)
- Visible slots: top 10 exposed via F‑keys
- Poll interval: clipboard check every 250ms

## Tray icon (optional)
Place an icon at:
- `src/icon.ico` (Windows)
- `src/icon.png` (other)
If missing, the tray is skipped in dev.

## Security notes
- `contextIsolation: true` and `nodeIntegration: false` in the BrowserWindow
- A minimal preload exposes a small, typed IPC surface

## Troubleshooting
- Shortcuts don’t work: ensure another app isn’t using the same combo; try unlocking Fn
- Window not appearing: copy something with Ctrl+C; or use Ctrl+Alt+F12 to toggle
- Clear build output: delete `dist/` and run `npm run dev` again

## Roadmap ideas
- Rich clip types (images, HTML)
- Search and pin clips
- Optional persistent storage (SQLite / file-based)
- Per-app rules (ignore apps, formatting)

## License
ISC (see `package.json`).
