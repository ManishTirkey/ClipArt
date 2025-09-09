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
  appRoot.innerHTML = `
    <div class="container">
      <div class="header">
        <h1>ClipArt</h1>
      </div>
      <div class="list">${list || '<div class="empty"><p>Copy something with Ctrl+C to get started</p></div>'}</div>
      <div class="footer">
        <span>Press <span class="shortcut">Ctrl+Alt+F12</span> to toggle</span>
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


