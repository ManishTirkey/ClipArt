import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('clipAPI', {
  getClips: async () => ipcRenderer.invoke('clips:get'),
  // Deprecated: kept for backward-compat if needed
  getToggleAccelerator: async () => ipcRenderer.invoke('shortcut:getToggle'),
  onToggleAccelerator: (cb: (accel: string) => void) => {
    const listener = (_: any, accel: string) => cb(accel);
    ipcRenderer.on('shortcut:toggle', listener);
    return () => ipcRenderer.removeListener('shortcut:toggle', listener);
  },
  onUpdate: (cb: (clips: any[]) => void) => {
    const listener = (_: any, clips: any[]) => cb(clips);
    ipcRenderer.on('clips:update', listener);
    return () => ipcRenderer.removeListener('clips:update', listener);
  },
  onHighlight: (cb: (id: string) => void) => {
    const listener = (_: any, id: string) => cb(id);
    ipcRenderer.on('clips:highlight', listener);
    return () => ipcRenderer.removeListener('clips:highlight', listener);
  },
  selectClip: (id: string) => ipcRenderer.send('clips:select', id)
});

declare global {
  interface Window {
    clipAPI: {
      getClips: () => Promise<any[]>;
      getToggleAccelerator: () => Promise<string>;
      onUpdate: (cb: (clips: any[]) => void) => () => void;
      onHighlight: (cb: (id: string) => void) => () => void;
      selectClip: (id: string) => void;
    };
  }
}



