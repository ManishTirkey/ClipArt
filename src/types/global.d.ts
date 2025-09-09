export {};
declare global {
  interface Window {
    clipAPI: {
      getClips: () => Promise<any[]>;
      onUpdate: (cb: (clips: any[]) => void) => () => void;
      onHighlight: (cb: (id: string) => void) => () => void;
      selectClip: (id: string) => void;
    };
  }
}


