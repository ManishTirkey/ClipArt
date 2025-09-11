export {};
declare global {
  interface Window {
    clipAPI: {
      getClips: () => Promise<any[]>;
      getToggleAccelerator: () => Promise<string>;
      onToggleAccelerator: (cb: (accel: string) => void) => () => void;
      onUpdate: (cb: (clips: any[]) => void) => () => void;
      onHighlight: (cb: (id: string) => void) => () => void;
      selectClip: (id: string) => void;
    };
  }
}


