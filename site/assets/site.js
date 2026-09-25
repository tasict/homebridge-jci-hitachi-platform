// Project site: language choice and the hero's climate demo.

// Remember an explicit language choice so the English root page stops redirecting to the browser language.
for (const a of document.querySelectorAll('a[hreflang]')) {
  a.addEventListener('click', () => {
    try { localStorage.setItem('lang', a.hreflang); } catch { /* storage blocked: the choice just isn't remembered */ }
  });
}

// Close the language menu when clicking elsewhere.
const langMenu = document.querySelector('.lang');
document.addEventListener('click', e => {
  if (langMenu?.open && !langMenu.contains(e.target)) langMenu.open = false;
});

// Climate demo: the mode tints the room and the air, and the room temperature drifts toward the target the way the
// unit would move it (cooling only lowers it, heating only raises it, Auto does both). As in the plugin, the target
// moves in 1 °C steps and Auto has a single target.
const room = document.querySelector('[data-demo]');
if (room) {
  const text = JSON.parse(room.dataset.t);
  const fmt = v => `${Number.isInteger(v) ? v : v.toFixed(1)}°`;
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const MIN = 16, MAX = 32;
  let target = 26, now = 29.5;

  const mode = () => room.querySelector('input[name="mode"]:checked').value;

  function render() {
    const m = mode();
    room.dataset.mode = m;
    room.querySelector('[data-target]').textContent = fmt(target);
    room.querySelector('[data-now]').textContent = fill(text.now, { t: fmt(now) });
    room.querySelector('[data-status]').textContent = fill(text.st[m], { t: fmt(target) });
    for (const b of room.querySelectorAll('[data-step]')) {
      const next = target + Number(b.dataset.step);
      b.disabled = m === 'off' || next < MIN || next > MAX;
    }
  }

  room.addEventListener('change', render);
  for (const b of room.querySelectorAll('[data-step]')) {
    b.addEventListener('click', () => {
      target = Math.min(MAX, Math.max(MIN, target + Number(b.dataset.step)));
      render();
    });
  }

  setInterval(() => {
    const m = mode();
    if ((m === 'cool' || m === 'auto') && now > target) now -= 0.5;
    else if ((m === 'heat' || m === 'auto') && now < target) now += 0.5;
    else return;
    render();
  }, 2500);

  render();
}
