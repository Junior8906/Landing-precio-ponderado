(function () {
  const L = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['US$', ''] });
  const f2 = L.format(',.2f'), f0 = L.format(',.0f'), fp = L.format('.1%'), fps = L.format('+.1%');
  const F = {
    p: (v) => (v == null ? '—' : f2(v)),
    n: (v) => (v == null ? '—' : f0(v)),
    k: (v) => (v == null ? '—' : v >= 1e6 ? f2(v / 1e6) + ' M' : v >= 1e4 ? f0(v / 1e3) + ' mil' : f0(v)),
    pct: (v) => (v == null ? '—' : fp(v)),
    dp: (v) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '±') + f2(Math.abs(v))),
    dpct: (v) => (v == null ? '—' : fps(v).replace('-', '−')),
  };
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const C = () => dash.colors;
  const motion = () => window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  function toggleFinca(f) { const p = dash.params(); dash.setParams({ finca: p.finca === f ? null : f }); }

  function settle(el, st) {
    if (st === 'loading') { el.classList.add('dash-skeleton'); return false; }
    el.classList.remove('dash-skeleton');
    return true;
  }
  function msg(el, text) { const d = document.createElement('div'); d.className = 'pv-msg'; d.textContent = text; el.append(d); }
  function tipIn(el) { const t = document.createElement('div'); t.className = 'pv-tip'; el.append(t); return t; }
  function tipShow(el, t, lines, x, y) {
    t.replaceChildren();
    lines.forEach((ln, i) => {
      const d = document.createElement('div');
      d.className = i === 0 ? 't' : '';
      if (Array.isArray(ln)) { const a = document.createElement('span'); a.className = 'm'; a.textContent = ln[0] + ': '; const b = document.createElement('span'); b.textContent = ln[1]; d.append(a, b); }
      else d.textContent = ln;
      t.append(d);
    });
    t.style.opacity = 1;
    const W = el.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
    let left = x + 14; if (left + tw > W) left = x - tw - 14; if (left < 0) left = 0;
    let top = y - th - 10; if (top < 0) top = y + 14;
    t.style.left = left + 'px'; t.style.top = top + 'px';
  }
  function tipHide(t) { t.style.opacity = 0; }
  function textW(svg, s) {
    const t = svg.append('text').text(s);
    const w = t.node().getComputedTextLength(); t.remove(); return w;
  }

  // ---------- Filtros ----------
  function slicer(name, allLabel, values) {
    dash.draw('f-' + name, (sel) => {
      const d = dash.data('liq');
      const vals = d.status === 'ok' ? values(d.data) : [];
      sel.replaceChildren(new Option(allLabel, ''), ...vals.map((v) => new Option(v[1], v[0])));
      sel.value = String(dash.params()[name] ?? '');
      if (sel.value === '' && dash.params()[name]) sel.value = '';
      sel.onchange = () => dash.setParams({ [name]: sel.value || null });
    });
  }
  const uniq = (rows, k) => [...new Set(rows.map((r) => r[k]))].sort(d3.ascending).map((v) => [String(v), String(v)]);
  const weeks = (rows) => [...new Set(rows.map((r) => r.sem))].sort(d3.ascending).map((v) => [String(v), 'Semana ' + v]);
  slicer('finca', 'Todas las fincas', (r) => uniq(r, 'finca'));
  slicer('mes', 'Todos los meses', (r) => { const s = new Set(r.map((x) => x.mes)); return MESES.filter((m) => s.has(m)).map((m) => [m, m]); });
  slicer('desde', 'Desde el inicio', weeks);
  slicer('hasta', 'Hasta la última', weeks);
  slicer('mercado', 'Todos los mercados', (r) => uniq(r, 'mercado'));
  slicer('clase', 'Todas las clases', (r) => uniq(r, 'clase'));
  slicer('cliente', 'Todos los clientes', (r) => uniq(r, 'cliente'));
  slicer('codigo', 'Todos los códigos', (r) => [...new Set(r.map((x) => x.codigo))].sort((a, b) => parseInt(a) - parseInt(b)).map((v) => [v, v]));
  document.querySelectorAll('#pv-reset').forEach((b) => b.addEventListener('click', () => dash.resetParams()));

  dash.onData(() => {
    const k = dash.data('kpis');
    const empty = k.status === 'ok' && k.data && k.data[0] && k.data[0].cajas === 0;
    document.querySelectorAll('#resumen').forEach((e) => { e.hidden = !!empty; });
    document.querySelectorAll('#resumen-vacio').forEach((e) => { e.hidden = !empty; });
  });

  // ---------- Textos e indicadores ----------
  function kd(name, fn) {
    dash.draw(name, (el) => {
      const d = dash.data('kpis');
      if (d.status !== 'ok' || !d.data || !d.data.length) { if (d.status !== 'loading') el.classList.remove('dash-skeleton'); el.textContent = '—'; return; }
      el.classList.remove('dash-skeleton');
      fn(el, d.data[0]);
    });
  }
  kd('t-ambito', (el) => { const p = dash.params(); el.textContent = p.finca ? 'la finca ' + p.finca : 'la empresa'; });
  kd('t-precio', (el, k) => { el.textContent = F.p(k.precio); });
  kd('t-cajas', (el, k) => { el.textContent = F.n(k.cajas); });
  kd('t-ini', (el, k) => { el.textContent = k.sem_ini ?? '—'; });
  kd('t-fin', (el, k) => { el.textContent = k.sem_fin ?? '—'; });
  kd('k-precio', (el, k) => { el.textContent = F.p(k.precio); });
  kd('k-ini', (el, k) => { el.textContent = k.sem_ini ?? '—'; });
  kd('k-fin', (el, k) => { el.textContent = k.sem_fin ?? '—'; });
  kd('k-fin2', (el, k) => { el.textContent = k.sem_fin ?? '—'; });
  kd('k-precio-emp', (el, k) => { el.textContent = F.p(k.precio_empresa); });
  kd('k-cajas', (el, k) => { el.textContent = F.n(k.cajas); });
  kd('k-cajas-cop', (el, k) => { el.textContent = F.n(k.cajas_sin_precio_usd); });
  kd('k-precio-ult', (el, k) => { el.textContent = F.p(k.precio_ult); });
  kd('k-var-precio', (el, k) => { el.textContent = F.dp(k.var_precio); el.classList.toggle('pv-up', k.var_precio > 0); el.classList.toggle('pv-down', k.var_precio < 0); });
  kd('k-ant', (el, k) => { el.textContent = k.sem_ant ?? '—'; });
  kd('k-ant2', (el, k) => { el.textContent = k.sem_ant ?? '—'; });
  kd('k-cajas-ult', (el, k) => { el.textContent = F.n(k.cajas_ult); });
  kd('k-var-cajas', (el, k) => { el.textContent = F.dpct(k.var_cajas_pct); el.classList.toggle('pv-up', k.var_cajas_pct > 0); el.classList.toggle('pv-down', k.var_cajas_pct < 0); });
  kd('k-fincas', (el, k) => { el.textContent = F.n(k.fincas); });
  kd('k-semanas', (el, k) => { el.textContent = F.n(k.semanas); });

  function extremo(name, cual, campo) {
    dash.draw(name, (el) => {
      const d = dash.data('fincas');
      const rows = d.status === 'ok' && d.data ? d.data.filter((r) => r.precio != null) : [];
      if (!rows.length) { el.textContent = '—'; el.removeAttribute('data-where'); return; }
      const r = cual === 'max' ? rows.reduce((a, b) => (b.precio > a.precio ? b : a)) : rows.reduce((a, b) => (b.precio < a.precio ? b : a));
      el.setAttribute('data-where', 'finca=' + encodeURIComponent(r.finca));
      el.textContent = campo === 'finca' ? r.finca : F.p(r.precio);
    });
  }
  extremo('t-top', 'max', 'finca'); extremo('t-top-p', 'max', 'precio');
  extremo('t-bot', 'min', 'finca'); extremo('t-bot-p', 'min', 'precio');

  // ---------- Evolución semanal ----------
  let evoAnimated = false;
  dash.draw('evolucion', (el) => {
    const d = dash.data('semanal');
    el.replaceChildren();
    if (!settle(el, d.status)) return;
    if (d.status !== 'ok') { msg(el, 'No se pudo cargar este gráfico.'); return; }
    const rows = d.data || [];
    const p = dash.params();
    const sel = !!p.finca;
    const hasSel = rows.some((r) => r.cajas > 0);
    if (!rows.length || !hasSel) { msg(el, 'Sin embarques para los filtros elegidos.'); return; }

    const legend = document.createElement('div'); legend.className = 'pv-legend';
    const addLeg = (cls, color, label) => { const s = document.createElement('span'); const i = document.createElement('i'); if (cls) i.className = cls; if (color) i.style.background = color; s.append(i, document.createTextNode(label)); legend.append(s); };
    addLeg('', C()[0], sel ? 'Precio ' + p.finca : 'Precio empresa');
    if (sel) addLeg('dash', null, 'Precio empresa');
    addLeg('sq', C()[0], sel ? 'Cajas ' + p.finca : 'Cajas empresa');
    el.append(legend);

    const W = Math.max(280, el.clientWidth);
    const H1 = 220, H2 = 120, G = 34, top = 18, bottom = 24;
    const H = top + H1 + G + H2 + bottom;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
      .attr('role', 'img').attr('aria-label', 'Precio ponderado semanal y cajas por semana, 2026');

    const vals = rows.flatMap((r) => [r.precio, sel ? r.precio_empresa : null]).filter((v) => v != null);
    const yP = d3.scaleLinear().domain(d3.extent(vals)).nice(5);
    if (yP.domain()[0] === yP.domain()[1]) yP.domain([yP.domain()[0] - 0.5, yP.domain()[1] + 0.5]);
    const yC = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.cajas) || 1]).nice(3);
    const ml = Math.ceil(Math.max(...yP.ticks(5).map((t) => textW(svg, f2(t))), ...yC.ticks(3).map((t) => textW(svg, F.k(t))))) + 10;
    const lastP = [...rows].reverse().find((r) => r.precio != null);
    const mr = Math.ceil(textW(svg, lastP ? F.p(lastP.precio) : '0')) + 12;
    const x = d3.scaleBand(rows.map((r) => r.sem), [ml, W - mr]).paddingInner(0.25).paddingOuter(0.1);
    yP.range([top + H1, top]); yC.range([top + H1 + G + H2, top + H1 + G]);
    const cx = (s) => x(s) + x.bandwidth() / 2;

    // títulos de panel
    svg.append('text').attr('x', ml).attr('y', 10).text('US$ por caja');
    svg.append('text').attr('x', ml).attr('y', top + H1 + G - 8).text('Cajas');

    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(yP).ticks(5).tickSize(-(W - ml - mr)).tickFormat(f2))
      .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -8));
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(yC).ticks(3).tickSize(-(W - ml - mr)).tickFormat(F.k))
      .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -8));
    const step = Math.max(1, Math.ceil(rows.length * 30 / (W - ml - mr)));
    const tickVals = rows.map((r) => r.sem).filter((s, i) => i % step === 0);
    svg.append('g').attr('transform', `translate(0,${top + H1 + G + H2})`).call(d3.axisBottom(x).tickValues(tickVals).tickSize(0).tickPadding(8))
      .call((g) => g.select('.domain').attr('stroke', 'var(--cds-chart-axis)'));

    // barras de cajas
    const bars = svg.append('g').selectAll('rect').data(rows.filter((r) => r.cajas > 0)).join('rect')
      .attr('x', (r) => x(r.sem)).attr('width', x.bandwidth()).attr('rx', Math.min(2, x.bandwidth() / 2))
      .style('fill', C()[0]).style('opacity', 0.85);
    const anim = motion() && !evoAnimated;
    if (anim) bars.attr('y', yC(0)).attr('height', 0).transition().duration(600).ease(d3.easeCubicOut)
      .attr('y', (r) => yC(r.cajas)).attr('height', (r) => yC(0) - yC(r.cajas));
    else bars.attr('y', (r) => yC(r.cajas)).attr('height', (r) => yC(0) - yC(r.cajas));

    // líneas de precio
    const line = (k) => d3.line().defined((r) => r[k] != null).x((r) => cx(r.sem)).y((r) => yP(r[k]));
    if (sel) svg.append('path').datum(rows).attr('d', line('precio_empresa')).attr('fill', 'none')
      .style('stroke', 'var(--cds-chart-reference)').attr('stroke-width', 2).attr('stroke-dasharray', '5 4');
    const lp = svg.append('path').datum(rows).attr('d', line('precio')).attr('fill', 'none').style('stroke', C()[0]).attr('stroke-width', 2);
    if (anim) { const len = lp.node().getTotalLength(); lp.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len).transition().duration(800).attr('stroke-dashoffset', 0).on('end', () => lp.attr('stroke-dasharray', null)); }
    evoAnimated = true;
    const pts = rows.filter((r) => r.precio != null);
    if (pts.length <= 60) svg.append('g').selectAll('circle').data(pts).join('circle')
      .attr('cx', (r) => cx(r.sem)).attr('cy', (r) => yP(r.precio)).attr('r', 2.5).style('fill', C()[0]);
    if (lastP) svg.append('text').attr('class', 'pv-strong').attr('x', cx(lastP.sem) + 8).attr('y', yP(lastP.precio)).attr('dy', '0.35em').text(F.p(lastP.precio));

    // capa de hover
    const tip = tipIn(el);
    const guide = svg.append('line').attr('y1', top).attr('y2', top + H1 + G + H2).style('stroke', 'var(--cds-chart-axis)').attr('stroke-width', 1).style('opacity', 0);
    const hp = svg.append('circle').attr('r', 5).style('fill', C()[0]).style('stroke', 'var(--color-panel)').attr('stroke-width', 2).style('opacity', 0);
    svg.append('rect').attr('x', ml).attr('y', top).attr('width', W - ml - mr).attr('height', H1 + G + H2).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [mx] = d3.pointer(ev);
        const i = Math.max(0, Math.min(rows.length - 1, Math.floor((mx - x.range()[0] - x.step() * x.paddingOuter()) / x.step())));
        const r = rows[i];
        guide.attr('x1', cx(r.sem)).attr('x2', cx(r.sem)).style('opacity', 1);
        if (r.precio != null) hp.attr('cx', cx(r.sem)).attr('cy', yP(r.precio)).style('opacity', 1); else hp.style('opacity', 0);
        const lines = ['Semana ' + r.sem + ' · ' + r.mes, [sel ? 'Precio ' + p.finca : 'Precio', F.p(r.precio) + ' US$']];
        if (sel) lines.push(['Precio empresa', F.p(r.precio_empresa) + ' US$']);
        lines.push([sel ? 'Cajas ' + p.finca : 'Cajas', F.n(r.cajas)]);
        if (sel) lines.push(['Cajas empresa', F.n(r.cajas_empresa)]);
        const box = el.getBoundingClientRect();
        tipShow(el, tip, lines, ev.clientX - box.left, ev.clientY - box.top);
      })
      .on('pointerleave', () => { guide.style('opacity', 0); hp.style('opacity', 0); tipHide(tip); });
  });

  // ---------- Matriz finca × semana ----------
  dash.draw('matriz', (el) => {
    const d = dash.data('finca_semana'), f = dash.data('fincas');
    el.replaceChildren();
    const st = d.status === 'loading' || f.status === 'loading' ? 'loading' : d.status !== 'ok' ? d.status : f.status;
    if (!settle(el, st)) return;
    if (st !== 'ok') { msg(el, 'No se pudo cargar este gráfico.'); return; }
    const cells = (d.data || []).filter((r) => r.precio != null);
    const order = (f.data || []).map((r) => r.finca);
    if (!cells.length) { msg(el, 'Sin embarques para los filtros elegidos.'); return; }
    const p = dash.params();
    const wks = [...new Set((d.data || []).map((r) => r.sem))].sort(d3.ascending);
    const W = Math.max(560, el.clientWidth);
    const svg = d3.select(el).append('svg').attr('width', W).attr('role', 'img')
      .attr('aria-label', 'Matriz de precio ponderado por finca y semana');
    const lw = Math.ceil(d3.max(order, (s) => textW(svg, s))) + 14;
    const cw = (W - lw - 4) / wks.length, ch = 18, top = 22;
    const H = top + order.length * ch + 64;
    svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const xs = d3.scaleBand(wks, [lw, lw + cw * wks.length]).padding(0.08);
    const ys = d3.scaleBand(order, [top, top + order.length * ch]).padding(0.08);
    const sorted = cells.map((r) => r.precio).sort(d3.ascending);
    let lo = d3.quantileSorted(sorted, 0.05), hi = d3.quantileSorted(sorted, 0.95);
    if (lo === hi) { lo -= 0.1; hi += 0.1; }
    const NSTEP = 7;
    const q = d3.scaleQuantize().domain([lo, hi]).range(d3.range(NSTEP));
    const fill = (i) => `color-mix(in oklab, ${C()[0]} ${Math.round(14 + i * (86 / (NSTEP - 1)))}%, var(--color-panel))`;

    const step = Math.max(1, Math.ceil(26 / cw));
    svg.append('g').selectAll('text').data(wks.filter((s, i) => i % step === 0)).join('text')
      .attr('x', (s) => xs(s) + xs.bandwidth() / 2).attr('y', 12).attr('text-anchor', 'middle').text((s) => s);
    svg.append('text').attr('x', 0).attr('y', 12).text('Sem.');

    const lab = svg.append('g').selectAll('text').data(order).join('text')
      .attr('x', lw - 8).attr('y', (s) => ys(s) + ys.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('class', (s) => (s === p.finca ? 'pv-strong' : null)).style('cursor', 'pointer').text((s) => s)
      .on('click', (ev, s) => toggleFinca(s));
    if (p.finca && order.includes(p.finca)) svg.append('rect').attr('x', lw - 2).attr('y', ys(p.finca) - 1)
      .attr('width', cw * wks.length + 2).attr('height', ys.bandwidth() + 2).attr('fill', 'none').attr('rx', 2)
      .style('stroke', 'var(--color-fg)').attr('stroke-width', 1.5);

    const tip = tipIn(el);
    svg.append('g').selectAll('rect').data(cells.filter((r) => order.includes(r.finca))).join('rect')
      .attr('x', (r) => xs(r.sem)).attr('y', (r) => ys(r.finca)).attr('width', xs.bandwidth()).attr('height', ys.bandwidth()).attr('rx', 2)
      .style('fill', (r) => fill(q(r.precio))).style('cursor', 'pointer')
      .style('opacity', (r) => (p.finca && r.finca !== p.finca ? 0.55 : 1))
      .on('pointermove', (ev, r) => {
        const box = el.getBoundingClientRect();
        tipShow(el, tip, [r.finca + ' · semana ' + r.sem, ['Precio', F.p(r.precio) + ' US$'], ['Cajas', F.n(r.cajas)]], ev.clientX - box.left, ev.clientY - box.top);
        d3.select(ev.currentTarget).style('stroke', 'var(--color-fg)').attr('stroke-width', 1.5);
      })
      .on('pointerleave', (ev) => { tipHide(tip); d3.select(ev.currentTarget).style('stroke', null); })
      .on('click', (ev, r) => toggleFinca(r.finca));

    // leyenda
    const ly = top + order.length * ch + 22;
    const sw = Math.min(64, (W - lw - 140) / NSTEP);
    svg.append('text').attr('x', lw).attr('y', ly - 6).text('Precio ponderado (US$/caja)');
    const th = q.thresholds();
    const lg = svg.append('g').selectAll('g').data(d3.range(NSTEP)).join('g').attr('transform', (i) => `translate(${lw + i * (sw + 2)},${ly})`);
    lg.append('rect').attr('width', sw).attr('height', 12).attr('rx', 2).style('fill', (i) => fill(i));
    lg.append('text').attr('x', 0).attr('y', 28).text((i) => (i === 0 ? '≤ ' + f2(th[0]) : i === NSTEP - 1 ? '≥ ' + f2(th[NSTEP - 2]) : i % 2 === 0 ? f2(th[i - 1]) : ''));
  });

  // ---------- Ranking ----------
  dash.draw('ranking', (el) => {
    const f = dash.data('fincas'), k = dash.data('kpis');
    el.replaceChildren();
    const st = f.status === 'loading' || k.status === 'loading' ? 'loading' : f.status !== 'ok' ? f.status : k.status;
    if (!settle(el, st)) return;
    if (st !== 'ok') { msg(el, 'No se pudo cargar este gráfico.'); return; }
    const rows = (f.data || []).filter((r) => r.precio != null).sort((a, b) => b.precio - a.precio);
    if (!rows.length) { msg(el, 'Sin embarques para los filtros elegidos.'); return; }
    const emp = k.data && k.data[0] ? k.data[0].precio_empresa : null;
    const p = dash.params();
    const W = Math.max(280, el.clientWidth), rh = 22, top = 26;
    const H = top + rows.length * rh + 26;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
      .attr('role', 'img').attr('aria-label', 'Ranking de precio ponderado por finca frente al promedio de la empresa');
    const lab = (r) => F.p(r.precio) + ' · ' + F.k(r.cajas);
    const lw = Math.ceil(d3.max(rows, (r) => textW(svg, r.finca))) + 12;
    const rw = Math.ceil(d3.max(rows, (r) => textW(svg, lab(r)))) + 14;
    const ext = d3.extent([...rows.map((r) => r.precio), emp].filter((v) => v != null));
    const pad = Math.max(0.05, (ext[1] - ext[0]) * 0.08);
    const xs = d3.scaleLinear([ext[0] - pad, ext[1] + pad], [lw, W - rw]).nice(4);
    const ys = d3.scaleBand(rows.map((r) => r.finca), [top, top + rows.length * rh]);
    const rs = d3.scaleSqrt([0, d3.max(rows, (r) => r.cajas)], [3, 8]);
    svg.append('g').attr('transform', `translate(0,${top + rows.length * rh})`)
      .call(d3.axisBottom(xs).ticks(Math.max(2, Math.floor((W - lw - rw) / 70))).tickSize(-(rows.length * rh)).tickFormat(f2).tickPadding(8))
      .call((g) => g.select('.domain').remove());
    if (emp != null) {
      svg.append('line').attr('x1', xs(emp)).attr('x2', xs(emp)).attr('y1', top - 4).attr('y2', top + rows.length * rh)
        .style('stroke', 'var(--cds-chart-reference)').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3');
      svg.append('text').attr('x', xs(emp)).attr('y', top - 10).attr('text-anchor', 'middle').text('Empresa ' + F.p(emp));
    }
    const tip = tipIn(el);
    const g = svg.append('g').selectAll('g').data(rows).join('g').style('cursor', 'pointer')
      .on('click', (ev, r) => toggleFinca(r.finca))
      .on('pointermove', (ev, r) => {
        const box = el.getBoundingClientRect();
        tipShow(el, tip, [r.finca, ['Precio ponderado', F.p(r.precio) + ' US$'], ['Vs empresa', F.dp(emp != null ? r.precio - emp : null) + ' US$'], ['Cajas', F.n(r.cajas)], ['Participación', F.pct(r.participacion)]], ev.clientX - box.left, ev.clientY - box.top);
      })
      .on('pointerleave', () => tipHide(tip));
    g.append('rect').attr('x', 0).attr('y', (r) => ys(r.finca)).attr('width', W).attr('height', rh).attr('fill', 'transparent');
    const cy = (r) => ys(r.finca) + rh / 2;
    g.append('text').attr('x', lw - 8).attr('y', cy).attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('class', (r) => (r.finca === p.finca ? 'pv-strong' : null)).text((r) => r.finca);
    if (emp != null) g.append('line').attr('x1', xs(emp)).attr('x2', (r) => xs(r.precio)).attr('y1', cy).attr('y2', cy)
      .style('stroke', 'var(--cds-chart-axis)').attr('stroke-width', 2);
    g.append('circle').attr('cx', (r) => xs(r.precio)).attr('cy', cy).attr('r', (r) => rs(r.cajas))
      .style('fill', C()[0]).style('stroke', (r) => (r.finca === p.finca ? 'var(--color-fg)' : 'var(--color-panel)')).attr('stroke-width', 2)
      .style('opacity', (r) => (p.finca && r.finca !== p.finca ? 0.45 : 1));
    g.append('text').attr('x', W - rw + 10).attr('y', cy).attr('dy', '0.35em')
      .attr('class', (r) => (r.finca === p.finca ? 'pv-strong' : null)).text(lab);
  });

  // ---------- Tabla ----------
  window.pvSort = window.pvSort || { key: 'cajas', dir: -1 };
  document.querySelectorAll('#detalle-fincas th[data-sort]').forEach((th) => th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    window.pvSort = { key, dir: window.pvSort.key === key ? -window.pvSort.dir : key === 'finca' ? 1 : -1 };
    document.querySelectorAll('#detalle-fincas th[data-sort]').forEach((h) => {
      if (h.getAttribute('data-sort') === key) h.setAttribute('aria-sort', window.pvSort.dir > 0 ? 'ascending' : 'descending');
      else h.removeAttribute('aria-sort');
    });
    dash.draw('detalle');
  }));

  dash.draw('detalle', (tb) => {
    const f = dash.data('fincas');
    tb.replaceChildren();
    if (f.status !== 'ok' || !f.data) return;
    const p = dash.params();
    const { key, dir } = window.pvSort;
    const rows = [...f.data].sort((a, b) => {
      const x = a[key], y = b[key];
      if (x == null) return 1; if (y == null) return -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir;
    });
    const maxC = d3.max(rows, (r) => r.cajas) || 1;
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-key', encodeURIComponent(r.finca));
      if (r.finca === p.finca) tr.className = 'sel';
      const td = (txt, num) => { const c = document.createElement('td'); if (num) c.className = 'n'; c.textContent = txt; tr.append(c); return c; };
      td(r.finca);
      const cc = td(F.n(r.cajas), true);
      const bar = document.createElement('span'); bar.className = 'pv-bar'; bar.style.width = Math.max(2, (r.cajas / maxC) * 70) + 'px'; bar.style.background = C()[0];
      cc.append(bar);
      td(F.pct(r.participacion), true);
      td(F.p(r.precio), true);
      td(F.p(r.precio_min_sem), true);
      td(F.p(r.precio_max_sem), true);
      td(F.n(r.semanas), true);
      tr.addEventListener('click', () => toggleFinca(r.finca));
      tb.append(tr);
    }
  });

  dash.draw('detalle-total', (tf) => {
    const k = dash.data('kpis'), f = dash.data('fincas');
    tf.replaceChildren();
    if (k.status !== 'ok' || !k.data || !k.data[0] || f.status !== 'ok') return;
    const r = k.data[0];
    const tr = document.createElement('tr');
    const td = (txt, num, field) => { const c = document.createElement('td'); if (num) c.className = 'n'; c.textContent = txt; if (field) { c.setAttribute('data-source', 'kpis'); c.setAttribute('data-field', field); c.setAttribute('data-row', '0'); } tr.append(c); };
    td('Total empresa'); td(F.n(r.cajas_empresa), true, 'cajas_empresa'); td(r.cajas_empresa > 0 ? '100,0%' : '—', true);
    td(F.p(r.precio_empresa), true, 'precio_empresa'); td('', true); td('', true); td('', true);
    tf.append(tr);
  });
})();
