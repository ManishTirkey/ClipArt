import { app, BrowserWindow, globalShortcut, clipboard, ipcMain, nativeTheme, screen, Tray, Menu } from 'electron';
import fs from 'fs';
import path from 'path';

type ClipItem = {
  id: string;
  text: string;
  timestamp: number;
};

const MAX_CLIPS = 50;
const VISIBLE_SLOTS = 10; // F1..F10

let windowsByDisplayId: Map<number, BrowserWindow> = new Map();
let tray: Tray | null = null;
let clipHistory: ClipItem[] = [];
let lastClipboardText = '';
let firstCopyShown = false; // retained but no longer used for gating visibility

function createWindowForDisplay(display: Electron.Display) {
  const { workArea, id } = display;
  const width = 360;
  const height = 480;
  const x = Math.round(workArea.x + workArea.width - width - 16);
  const y = Math.round(workArea.y + workArea.height - height - 16);

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true
    }
  });

  try { win.setVisibleOnAllWorkspaces?.(true, { visibleOnFullScreen: true }); } catch {}

  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => {
    windowsByDisplayId.delete(id);
  });

  windowsByDisplayId.set(id, win);
}

function createWindowsForAllDisplays() {
  for (const win of windowsByDisplayId.values()) {
    try { win.close(); } catch {}
  }
  windowsByDisplayId.clear();
  for (const d of screen.getAllDisplays()) {
    createWindowForDisplay(d);
  }
}

function addClipFromText(text: string) {
  const trimmed = text ?? '';
  if (!trimmed) return;
  if (clipHistory.length > 0 && clipHistory[0].text === trimmed) return;
  const item: ClipItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: trimmed,
    timestamp: Date.now()
  };
  clipHistory.unshift(item);
  if (clipHistory.length > MAX_CLIPS) clipHistory = clipHistory.slice(0, MAX_CLIPS);
  for (const win of windowsByDisplayId.values()) {
    win.webContents.send('clips:update', clipHistory.slice(0, MAX_CLIPS));
    win.webContents.send('clips:highlight', item.id);
  }
}

function pollClipboard() {
  const current = clipboard.readText();
  if (current && current !== lastClipboardText) {
    lastClipboardText = current;
    addClipFromText(current);
    const anyVisible = Array.from(windowsByDisplayId.values()).some(w => w.isVisible());
    if (!anyVisible) {
      for (const win of windowsByDisplayId.values()) win.showInactive();
    }
  }
}

function registerShortcuts() {
  // Toggle visibility: Ctrl+Alt+F12
  globalShortcut.register('Control+Alt+F12', () => {
    const anyVisible = Array.from(windowsByDisplayId.values()).some(w => w.isVisible());
    for (const w of windowsByDisplayId.values()) {
      if (anyVisible) w.hide(); else w.show();
    }
  });

  // Slots F1..F10 for quick paste
  for (let i = 1; i <= VISIBLE_SLOTS; i += 1) {
    const accel = `Control+Alt+F${i}`;
    globalShortcut.register(accel, () => {
      const item = clipHistory[i - 1];
      if (!item) return;
      clipboard.writeText(item.text);
      lastClipboardText = item.text;
      // brief feedback
      for (const w of windowsByDisplayId.values()) w.webContents.send('clips:highlight', item.id);
    });
  }
}

function setupTray() {
  try {
    const iconPath = process.platform === 'win32' ? path.join(__dirname, 'icon.ico') : path.join(__dirname, 'icon.png');
    if (!fs.existsSync(iconPath)) {
      return; // skip tray if icon is missing
    }
    tray = new Tray(iconPath);
    const menu = Menu.buildFromTemplate([
      { label: 'Show', click: () => { for (const w of windowsByDisplayId.values()) w.show(); } },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setToolTip('ClipArt');
    tray.setContextMenu(menu);
    tray.on('click', () => {
      for (const w of windowsByDisplayId.values()) w.show();
    });
  } catch (err) {
    // ignore tray errors in dev
  }
}

app.whenReady().then(() => {
  createWindowsForAllDisplays();
  setupTray();
  registerShortcuts();

  // initial seed from clipboard
  lastClipboardText = clipboard.readText();
  if (lastClipboardText) addClipFromText(lastClipboardText);

  setInterval(pollClipboard, 250); // poll frequently for low latency

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindowsForAllDisplays();
  });

  screen.on('display-added', (_e, display) => {
    createWindowForDisplay(display);
  });
  screen.on('display-removed', () => {
    createWindowsForAllDisplays();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC
ipcMain.handle('clips:get', () => clipHistory);
ipcMain.on('clips:select', (_e, id: string) => {
  const item = clipHistory.find(c => c.id === id);
  if (!item) return;
  clipboard.writeText(item.text);
  lastClipboardText = item.text;
  for (const w of windowsByDisplayId.values()) w.webContents.send('clips:highlight', item.id);
});

