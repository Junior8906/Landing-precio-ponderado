// Motor mínimo para que la página funcione sola (fuera de Claude):
// carga el JSON, calcula los resúmenes, guarda los filtros y redibuja.
window.dash = (function () {
  const DEFAULTS = { finca: '', mes: '', desde: '', hasta: '', mercado: '', clase: '', cliente: '', codigo: '', cli: '', fcod: '' };
  const sources = {}, calcs = {}, draws = {}, onData = [];
  let params = { ...DEFAULTS }, cache = {};

  function data(id) {
    if (id in sources) return { status: 'ok', data: sources[id] };
    const c = calcs[id];
    if (!c) return { status: 'loading', data: [] };
    const ins = c.inputs.map((i) => data(i));
    if (ins.some((d) => d.status !== 'ok')) return { status: 'loading', data: null };
    if (!(id in cache)) cache[id] = c.fn(...ins.map((d) => d.data));
    return { status: 'ok', data: cache[id] };
  }
  function runDraw(name) {
    document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
      try { draws[name](el); } catch (e) { console.error('Dibujo', name, e); }
    });
  }
  function render() {
    cache = {};
    onData.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    Object.keys(draws).forEach(runDraw);
  }
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 150); });

  return {
    colors: ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'],
    data,
    calc: (id, def) => { calcs[id] = def; },
    loader: () => {},
    draw: (name, fn) => { if (fn) draws[name] = fn; else if (draws[name]) runDraw(name); },
    onData: (fn) => { onData.push(fn); },
    params: () => ({ ...params }),
    setParams: (o) => { for (const k in o) params[k] = o[k] == null ? '' : o[k]; render(); },
    resetParams: () => { params = { ...DEFAULTS }; render(); },
    setLink: () => {},
    refresh: () => {},
    _load: (id, rows) => { sources[id] = rows; render(); },
    _render: render,
  };
})();
