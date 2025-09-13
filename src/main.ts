import { app, BrowserWindow, globalShortcut, clipboard, ipcMain, nativeTheme, screen, Tray, Menu, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
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
let activeToggleAccelerator: string = 'Control+Alt+F12';
let contentProtectionEnabled: boolean = false;

function broadcastToggleAccelerator() {
  for (const win of windowsByDisplayId.values()) {
    try { win.webContents.send('shortcut:toggle', activeToggleAccelerator); } catch {}
  }
}

function areAnyVisible(): boolean {
  return Array.from(windowsByDisplayId.values()).some(w => w.isVisible());
}

function showAll() {
  for (const w of windowsByDisplayId.values()) w.show();
}

function showAllInactive() {
  for (const w of windowsByDisplayId.values()) w.showInactive();
}

function hideAll() {
  for (const w of windowsByDisplayId.values()) w.hide();
}

function toggleAll() {
  if (areAnyVisible()) hideAll(); else showAll();
}

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
  win.webContents.on('did-finish-load', () => {
    broadcastToggleAccelerator();
    try { win.setContentProtection(contentProtectionEnabled); } catch {}
    
    // Open DevTools in detach mode for debugging
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });
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
    if (!areAnyVisible()) showAllInactive();
  }
}

function registerShortcuts() {
  // Prefer F12, but fall back if taken (e.g., Intel graphics hotkeys)
  const toggleCandidates = [
    'Control+Alt+F12',
    'Control+Alt+`',
    'Control+Alt+\\',
    'Control+Alt+0'
  ];
  for (const candidate of toggleCandidates) {
    try {
      globalShortcut.register(candidate, () => {
        toggleAll();
      });
      if (globalShortcut.isRegistered(candidate)) {
        activeToggleAccelerator = candidate;
        broadcastToggleAccelerator();
        break;
      }
    } catch {}
  }

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
  
  // DevTools toggle shortcut
  globalShortcut.register('Control+Alt+D', () => {
    for (const win of windowsByDisplayId.values()) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
}

function setupTray() {
  try {
    const iconPath = process.platform === 'win32' ? path.join(__dirname, 'icon.ico') : path.join(__dirname, 'icon.png');
    if (!fs.existsSync(iconPath)) {
      return; // skip tray if icon is missing
    }
    tray = new Tray(iconPath);
    tray.setToolTip('ClipArt');
    updateTrayMenu();
    tray.on('click', () => {
      toggleAll();
    });
  } catch (err) {
    // ignore tray errors in dev
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const anyVisible = areAnyVisible();
  const isAutoStart = app.getLoginItemSettings().openAtLogin;
  const menu = Menu.buildFromTemplate([
    { label: anyVisible ? 'Hide' : 'Show', click: () => toggleAll() },
    { type: 'separator' },
    { label: 'Check for updates…', click: () => checkForUpdatesManually() },
    { type: 'separator' },
    { 
      label: 'Start at Login', 
      type: 'checkbox', 
      checked: isAutoStart,
      click: () => {
        const newState = !isAutoStart;
        app.setLoginItemSettings({ openAtLogin: newState, openAsHidden: true });
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  ]);
  tray.setContextMenu(menu);
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

  setupAutoUpdater();
  // Check on startup, but do not auto-download until user confirms
  autoUpdater.checkForUpdates().catch(() => {});
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC
ipcMain.handle('clips:get', () => clipHistory);
ipcMain.handle('shortcut:getToggle', () => activeToggleAccelerator);
ipcMain.handle('cp:get', () => contentProtectionEnabled);
ipcMain.on('cp:set', (_e, enabled: boolean) => {
  contentProtectionEnabled = !!enabled;
  for (const win of windowsByDisplayId.values()) {
    try { win.setContentProtection(contentProtectionEnabled); } catch {}
    try { win.webContents.send('cp:changed', contentProtectionEnabled); } catch {}
  }
});
ipcMain.on('clips:select', (_e, id: string) => {
  const item = clipHistory.find(c => c.id === id);
  if (!item) return;
  clipboard.writeText(item.text);
  lastClipboardText = item.text;
  for (const w of windowsByDisplayId.values()) w.webContents.send('clips:highlight', item.id);
});

// Auto-update integration
let isManualCheck = false;

function setupAutoUpdater() {
  autoUpdater.autoDownload = false; // prompt before downloading
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Set the feed URL for GitHub releases
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'ManishTirkey',
    repo: 'ClipArt'
  });

  autoUpdater.on('update-available', (info) => {
    const result = dialog.showMessageBoxSync({
      type: 'info',
      title: 'Update available',
      message: `A new version (${info.version}) is available.`,
      detail: 'Would you like to download and install it now?',
      buttons: ['Update', 'Later'],
      cancelId: 1,
      defaultId: 0,
      noLink: true
    });
    if (result === 0) {
      autoUpdater.downloadUpdate().catch(() => {});
    }
  });

  autoUpdater.on('update-not-available', () => {
    // Notify only when user triggers manual check
    if (isManualCheck) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No updates',
        message: 'You are on the latest version.'
      }).catch(() => {});
    }
    isManualCheck = false;
  });

  autoUpdater.on('download-progress', () => {
    // Minimal UX; could add tray balloon later
  });

  autoUpdater.on('update-downloaded', () => {
    const result = dialog.showMessageBoxSync({
      type: 'question',
      title: 'Install update',
      message: 'Update downloaded. Install and restart now?',
      buttons: ['Install and Restart', 'Later'],
      cancelId: 1,
      defaultId: 0,
      noLink: true
    });
    if (result === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
    // Only show error dialog for manual checks, not automatic ones
    if (isManualCheck) {
      dialog.showMessageBox({
        type: 'error',
        title: 'Update check failed',
        message: 'Could not check for updates. Please try again later.',
        detail: error.message || 'Unknown error occurred'
      }).catch(() => {});
    }
  });
}

function checkForUpdatesManually() {
  isManualCheck = true;
  console.log('Checking for updates...');
  console.log('Current version:', app.getVersion());
  console.log('Feed URL:', autoUpdater.getFeedURL());
  
  autoUpdater.checkForUpdates().catch((error) => {
    console.error('Update check failed:', error);
    isManualCheck = false;
    dialog.showMessageBox({
      type: 'error',
      title: 'Update check failed',
      message: 'Could not check for updates. Please try again later.',
      detail: `Error: ${error.message || 'Unknown error occurred'}\n\nThis might be because the latest.yml file is not available on GitHub.`
    }).catch(() => {});
  });
}

