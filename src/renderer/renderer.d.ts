export {};
declare global {
  interface Window {
    clipAPI: {
      getClips: () => Promise<{ id: string; text: string; createdAt: number }[]>;
      onClipsUpdate: (callback: (clips: { id: string; text: string; createdAt: number }[]) => void) => void;
      onClipActivate: (callback: (id: string) => void) => void;
      selectClip: (id: string) => void;
    };
  }
}



