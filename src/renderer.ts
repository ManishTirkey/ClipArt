type ClipItem = {
  id: string;
  text: string;
  timestamp: number;
};

const appRoot = document.getElementById('app')!;

function render(clips: ClipItem[], highlightId?: string) {
  const list = clips
    .map((c, idx) => {
      const num = idx + 1;
      const hotkey = num <= 10 ? `F${num}` : '';
      const active = highlightId && c.id === highlightId ? 'active' : '';
      const text = c.text.replace(/\s+/g, ' ').slice(0, 200);
      return `
        <div class="clip ${active}" data-id="${c.id}">
          <div class="badge">${hotkey}</div>
          <div class="text" title="${escapeHtml(c.text)}">${escapeHtml(text)}</div>
        </div>
      `;
    })
    .join('');

  // Determine responsive classes based on number of clips
  const clipCount = clips.length;
  let containerClass = '';
  let listClass = '';
  
  // More granular responsive breakpoints
  // if (clipCount >= 20) {
  //   containerClass = 'tight';
  //   listClass = 'tight';
  // } else if (clipCount >= 12) {
  //   containerClass = 'compact';
  //   listClass = 'compact';
  // } else if (clipCount >= 6) {
  //   containerClass = 'semi-compact';
  //   listClass = 'semi-compact';
  // }

  appRoot.innerHTML = `
    <div class="container ${containerClass}">
      <div class="header">
        <h1>ClipArt</h1>
        <div class="spacer"></div>
        <label class="switch" title="Content protection (prevents screenshots)">
          <input type="checkbox" id="cp-toggle" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="list ${listClass}">${list || '<div class="empty"><p>Copy something with Ctrl+C to get started</p></div>'}</div>
      <div class="footer">
        <span>Press <span class="shortcut" id="toggle-accel">Ctrl+Alt+F12</span> to toggle</span>
        <span>F1-F10 for quick paste</span>
      </div>
    </div>
  `;

  for (const el of Array.from(document.querySelectorAll('.clip'))) {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.id!;
      window.clipAPI.selectClip(id);
    });
  }

  const cp = document.getElementById('cp-toggle') as HTMLInputElement | null;
  if (cp) {
    cp.addEventListener('change', () => {
      (window.clipAPI as any).setContentProtection?.(cp.checked);
    });
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let current: ClipItem[] = [];
let highlightedId: string | undefined;

window.clipAPI.getClips().then(clips => {
  current = clips;
  render(current, highlightedId);
});

window.clipAPI.onUpdate(clips => {
  current = clips;
  render(current, highlightedId);
});

window.clipAPI.onHighlight(id => {
  highlightedId = id;
  render(current, highlightedId);
});

// Update the displayed accelerator once known
(window.clipAPI as any).onToggleAccelerator?.((accel: string) => {
  const el = document.getElementById('toggle-accel');
  if (el) el.textContent = accel.replace('Control', 'Ctrl');
});

// Sync content protection state from main
(window.clipAPI as any).getContentProtection?.().then((enabled: boolean) => {
  const cp = document.getElementById('cp-toggle') as HTMLInputElement | null;
  if (cp) cp.checked = !!enabled;
});
(window.clipAPI as any).onContentProtectionChanged?.((enabled: boolean) => {
  const cp = document.getElementById('cp-toggle') as HTMLInputElement | null;
  if (cp) cp.checked = !!enabled;
});


