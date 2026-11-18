// ---------- Códigos exportados por finca ----------
dash.calc('codigos_base', {
  inputs: ['liq'],
  title: 'Embarques de exportación de la finca elegida',
  description: 'Filas del mercado Exportación con los filtros de la página (menos finca) y la finca elegida en la sección de códigos.',
  fn: (liq) => {
    const p = dash.params();
    const finca = p.fcod === '__todas' ? '' : (p.fcod || p.finca || '');
    const desde = Number(p.desde) || 0, hasta = Number(p.hasta) || 99;
    return liq.filter((r) => r.mercado === 'Exportación' &&
      (!finca || r.finca === finca) && (!p.mes || r.mes === p.mes) &&
      (!p.clase || r.clase === p.clase) && (!p.cliente || r.cliente === p.cliente) &&
      (!p.codigo || r.codigo === p.codigo) && r.sem >= desde && r.sem <= hasta);
  },
});

dash.calc('codigos', {
  inputs: ['codigos_base'],
  title: 'Resumen por código exportado',
  description: 'Los 15 códigos con más cajas y el resto agrupado en «Otros códigos»: cajas, participación y precio ponderado del periodo.',
  fn: (codigos_base) => {
    const tot = d3.rollup(codigos_base, (v) => d3.sum(v, (r) => r.cajas), (r) => r.codigo);
    const top = new Set([...tot].sort((a, b) => b[1] - a[1]).slice(0, 15).map((d) => d[0]));
    const total = d3.sum(codigos_base, (r) => r.cajas);
    const out = [];
    for (const [codigo, v] of d3.group(codigos_base, (r) => (top.has(r.codigo) ? r.codigo : 'Otros códigos'))) {
      const c = d3.sum(v, (r) => r.cajas), cp = d3.sum(v, (r) => r.cajas_precio);
      out.push({ codigo, cajas: c, participacion: total > 0 ? c / total : null,
        precio: cp > 0 ? d3.sum(v, (r) => r.valor_usd) / cp : null, semanas: new Set(v.map((r) => r.sem)).size });
    }
    return out.sort((a, b) => (a.codigo === 'Otros códigos') - (b.codigo === 'Otros códigos') || b.cajas - a.cajas);
  },
});

dash.calc('codigo_semana', {
  inputs: ['codigos_base'],
  title: 'Precio ponderado por código exportado y semana',
  description: 'Por código (15 principales más «Otros códigos») y semana: cajas y precio ponderado.',
  fn: (codigos_base) => {
    const tot = d3.rollup(codigos_base, (v) => d3.sum(v, (r) => r.cajas), (r) => r.codigo);
    const top = new Set([...tot].sort((a, b) => b[1] - a[1]).slice(0, 15).map((d) => d[0]));
    const g = d3.rollup(codigos_base, (v) => ({ c: d3.sum(v, (r) => r.cajas), cp: d3.sum(v, (r) => r.cajas_precio), v: d3.sum(v, (r) => r.valor_usd) }),
      (r) => (top.has(r.codigo) ? r.codigo : 'Otros códigos'), (r) => r.sem);
    const out = [];
    for (const [codigo, m] of g) for (const [sem, x] of m)
      out.push({ codigo, sem, cajas: x.c, precio: x.cp > 0 ? x.v / x.cp : null });
    return out;
  },
});

// ---------- Clase de fruta ----------
dash.calc('filtrado_sin_clase', {
  inputs: ['liq'],
  title: 'Embarques de todas las clases de fruta',
  description: 'Filas con todos los filtros de la página excepto el de clase de fruta, para comparar clases entre sí.',
  fn: (liq) => {
    const p = dash.params();
    const desde = Number(p.desde) || 0, hasta = Number(p.hasta) || 99;
    return liq.filter((r) =>
      (!p.finca || r.finca === p.finca) && (!p.mes || r.mes === p.mes) &&
      (!p.mercado || r.mercado === p.mercado) && (!p.cliente || r.cliente === p.cliente) &&
      (!p.codigo || r.codigo === p.codigo) && r.sem >= desde && r.sem <= hasta);
  },
});

dash.calc('clase_semana', {
  inputs: ['filtrado_sin_clase'],
  title: 'Cajas, mezcla y precio ponderado por clase de fruta y semana',
  description: 'Por clase y semana: cajas, participación en las cajas de la semana y precio ponderado.',
  fn: (filtrado_sin_clase) => {
    const semTot = d3.rollup(filtrado_sin_clase, (v) => d3.sum(v, (r) => r.cajas), (r) => r.sem);
    const g = d3.rollup(filtrado_sin_clase, (v) => ({ c: d3.sum(v, (r) => r.cajas), cp: d3.sum(v, (r) => r.cajas_precio), v: d3.sum(v, (r) => r.valor_usd) }),
      (r) => r.clase, (r) => r.sem);
    const out = [];
    for (const [clase, m] of g) for (const [sem, x] of m)
      out.push({ clase, sem, cajas: x.c, participacion: semTot.get(sem) > 0 ? x.c / semTot.get(sem) : null, precio: x.cp > 0 ? x.v / x.cp : null });
    return out.sort((a, b) => a.sem - b.sem);
  },
});

dash.calc('clases', {
  inputs: ['filtrado_sin_clase'],
  title: 'Resumen por clase de fruta',
  description: 'Por clase: cajas, participación y precio ponderado del periodo.',
  fn: (filtrado_sin_clase) => {
    const total = d3.sum(filtrado_sin_clase, (r) => r.cajas);
    const out = [];
    for (const [clase, v] of d3.group(filtrado_sin_clase, (r) => r.clase)) {
      const c = d3.sum(v, (r) => r.cajas), cp = d3.sum(v, (r) => r.cajas_precio);
      out.push({ clase, cajas: c, participacion: total > 0 ? c / total : null, precio: cp > 0 ? d3.sum(v, (r) => r.valor_usd) / cp : null });
    }
    return out.sort((a, b) => b.cajas - a.cajas);
  },
});

(function () {
  const L = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['US$', ''] });
  const f2 = L.format(',.2f'), f0 = L.format(',.0f'), fp = L.format('.1%'), fp0 = L.format('.0%');
  const F = {
    p: (v) => (v == null ? '—' : f2(v)),
    n: (v) => (v == null ? '—' : f0(v)),
    k: (v) => (v == null ? '—' : v >= 1e6 ? f2(v / 1e6) + ' M' : v >= 1e4 ? f0(v / 1e3) + ' mil' : f0(v)),
    pct: (v) => (v == null ? '—' : fp(v)),
  };
  const C = () => dash.colors;
  // El color sigue a la clase, no a su posición: así no cambia al filtrar.
  const CLASES = ['PREMIUM', 'APROVECHAMIENTO', 'NACIONAL'];
  const colorClase = (c) => { const i = CLASES.indexOf(c); return C()[i >= 0 ? i : 3 + (c.length % 4)]; };
  const corto = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);
  function msg(el, text) { const d = document.createElement('div'); d.className = 'pv-msg'; d.textContent = text; el.append(d); }
  function tipIn(el) { const t = document.createElement('div'); t.className = 'pv-tip'; el.append(t); return t; }
  function tipShow(el, t, lines, x, y) {
    t.replaceChildren();
    lines.forEach((ln, i) => {
      const d = document.createElement('div'); d.className = i === 0 ? 't' : '';
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
  const tipHide = (t) => { t.style.opacity = 0; };
  function textW(svg, s) { const t = svg.append('text').text(s); const w = t.node().getComputedTextLength(); t.remove(); return w; }
  function status(...ids) { const s = ids.map((i) => dash.data(i).status); return s.includes('loading') ? 'loading' : s.find((x) => x !== 'ok') || 'ok'; }
  function settle(el, st) { if (st === 'loading') { el.classList.add('dash-skeleton'); return false; } el.classList.remove('dash-skeleton'); return true; }
  const fincaCod = () => { const p = dash.params(); return p.fcod === '__todas' ? '' : (p.fcod || p.finca || ''); };

  // Selector de finca de la sección de códigos
  dash.draw('f-fcod', (sel) => {
    const d = dash.data('liq');
    const fincas = d.status === 'ok' ? [...new Set(d.data.map((r) => r.finca))].sort(d3.ascending) : [];
    sel.replaceChildren(new Option('Todas las fincas', '__todas'), ...fincas.map((f) => new Option(f, f)));
    sel.value = fincaCod() || '__todas';
    sel.onchange = () => dash.setParams({ fcod: sel.value });
  });
  dash.draw('cod-finca', (el) => { el.textContent = fincaCod() || 'todas las fincas'; });

  dash.draw('matriz-codigos', (el) => {
    el.replaceChildren();
    const st = status('codigo_semana', 'codigos');
    if (!settle(el, st)) return;
    if (st !== 'ok') { msg(el, 'No se pudo cargar este gráfico.'); return; }
    const resumen = dash.data('codigos').data || [];
    const all = dash.data('codigo_semana').data || [];
    const cells = all.filter((r) => r.precio != null);
    if (!resumen.length) { msg(el, 'Sin embarques de exportación para los filtros elegidos.'); return; }
    const order = resumen.map((r) => r.codigo);
    const wks = [...new Set(all.map((r) => r.sem))].sort(d3.ascending);
    const W = Math.max(700, el.clientWidth);
    const svg = d3.select(el).append('svg').attr('width', W).attr('role', 'img')
      .attr('aria-label', 'Matriz de precio ponderado por código exportado y semana');
    const lab = (c) => corto(c, 34);
    const lw = Math.ceil(d3.max(order, (s) => textW(svg, lab(s)))) + 14;
    const colA = Math.ceil(textW(svg, 'Precio pond.')) + 16, colC = Math.ceil(textW(svg, '0.000 mil')) + 12;
    const cw = (W - lw - colA - colC - 10) / wks.length, ch = 22, top = 22;
    const H = top + order.length * ch + 64;
    svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const xs = d3.scaleBand(wks, [lw, lw + cw * wks.length]).padding(0.08);
    const ys = d3.scaleBand(order, [top, top + order.length * ch]).padding(0.1);
    const xA = lw + cw * wks.length + 10 + colA - 4, xC = xA + colC;
    const vals = cells.map((r) => r.precio).sort(d3.ascending);
    let lo = vals.length ? d3.quantileSorted(vals, 0.05) : 0, hi = vals.length ? d3.quantileSorted(vals, 0.95) : 1;
    if (lo === hi) { lo -= 0.1; hi += 0.1; }
    const NSTEP = 7, q = d3.scaleQuantize().domain([lo, hi]).range(d3.range(NSTEP));
    const fill = (i) => `color-mix(in oklab, ${C()[0]} ${Math.round(14 + i * (86 / (NSTEP - 1)))}%, var(--color-panel))`;
    const stepL = Math.max(1, Math.ceil(26 / cw));
    svg.append('g').selectAll('text').data(wks.filter((s, i) => i % stepL === 0)).join('text')
      .attr('x', (s) => xs(s) + xs.bandwidth() / 2).attr('y', 12).attr('text-anchor', 'middle').text((s) => s);
    svg.append('text').attr('x', 0).attr('y', 12).text('Sem.');
    svg.append('text').attr('x', xA).attr('y', 12).attr('text-anchor', 'end').attr('class', 'pv-strong').text('Precio pond.');
    svg.append('text').attr('x', xC).attr('y', 12).attr('text-anchor', 'end').text('Cajas');
    const tip = tipIn(el);
    const cy = (r) => ys(r.codigo) + ys.bandwidth() / 2;
    const row = svg.append('g').selectAll('g').data(resumen).join('g');
    row.append('text').attr('x', lw - 8).attr('y', cy).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => lab(r.codigo));
    row.append('text').attr('x', xA).attr('y', cy).attr('dy', '0.35em').attr('text-anchor', 'end').attr('class', 'pv-strong').text((r) => F.p(r.precio));
    row.append('text').attr('x', xC).attr('y', cy).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => F.k(r.cajas));
    row.on('pointermove', (ev, r) => {
      const box = el.getBoundingClientRect();
      tipShow(el, tip, [r.codigo, ['Precio ponderado', F.p(r.precio) + ' US$'], ['Cajas', F.n(r.cajas)], ['Participación', F.pct(r.participacion)], ['Semanas', F.n(r.semanas)]], ev.clientX - box.left, ev.clientY - box.top);
    }).on('pointerleave', () => tipHide(tip));
    // Celdas: con precio en US$ van coloreadas; con precio solo en pesos, en gris con borde.
    svg.append('g').selectAll('rect').data(all).join('rect')
      .attr('x', (r) => xs(r.sem)).attr('y', (r) => ys(r.codigo)).attr('width', xs.bandwidth()).attr('height', ys.bandwidth()).attr('rx', 2)
      .style('fill', (r) => (r.precio != null ? fill(q(r.precio)) : 'transparent'))
      .style('stroke', (r) => (r.precio != null ? null : 'var(--cds-chart-axis)')).attr('stroke-dasharray', (r) => (r.precio != null ? null : '2 2'))
      .on('pointermove', (ev, r) => {
        const box = el.getBoundingClientRect();
        tipShow(el, tip, [corto(r.codigo, 40) + ' · semana ' + r.sem, ['Precio ponderado', r.precio != null ? F.p(r.precio) + ' US$' : 'precio en pesos'], ['Cajas', F.n(r.cajas)]], ev.clientX - box.left, ev.clientY - box.top);
      })
      .on('pointerleave', () => tipHide(tip));
    const ly = top + order.length * ch + 22;
    const sw = Math.min(64, (W - lw - 160) / NSTEP);
    svg.append('text').attr('x', lw).attr('y', ly - 6).text('Precio ponderado de la semana (US$/caja) · celda punteada: precio en pesos');
    const th = q.thresholds();
    const lg = svg.append('g').selectAll('g').data(d3.range(NSTEP)).join('g').attr('transform', (i) => `translate(${lw + i * (sw + 2)},${ly})`);
    lg.append('rect').attr('width', sw).attr('height', 12).attr('rx', 2).style('fill', (i) => fill(i));
    lg.append('text').attr('y', 28).text((i) => (i === 0 ? '≤ ' + f2(th[0]) : i === NSTEP - 1 ? '≥ ' + f2(th[NSTEP - 2]) : i % 2 === 0 ? f2(th[i - 1]) : ''));
  });

  // ---------- Clase de fruta ----------
  dash.draw('clase-evolucion', (el) => {
    el.replaceChildren();
    const st = status('clase_semana');
    if (!settle(el, st)) return;
    if (st !== 'ok') { msg(el, 'No se pudo cargar este gráfico.'); return; }
    const data = dash.data('clase_semana').data || [];
    if (!data.length) { msg(el, 'Sin embarques para los filtros elegidos.'); return; }
    const clases = [...new Set(data.map((r) => r.clase))].sort((a, b) => (CLASES.indexOf(a) + 9) % 9 - (CLASES.indexOf(b) + 9) % 9);
    const wks = [...new Set(data.map((r) => r.sem))].sort(d3.ascending);
    const by = d3.index(data, (r) => r.clase, (r) => r.sem);

    const legend = document.createElement('div'); legend.className = 'pv-legend';
    for (const c of clases) { const s = document.createElement('span'); const i = document.createElement('i'); i.className = 'sq'; i.style.background = colorClase(c); s.append(i, document.createTextNode(c.charAt(0) + c.slice(1).toLowerCase())); legend.append(s); }
    el.append(legend);

    const W = Math.max(280, el.clientWidth), H1 = 220, H2 = 150, G = 34, top = 18, bottom = 24;
    const H = top + H1 + G + H2 + bottom;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
      .attr('role', 'img').attr('aria-label', 'Precio ponderado semanal y mezcla de cajas por clase de fruta');
    const vals = data.map((r) => r.precio).filter((v) => v != null);
    const yP = d3.scaleLinear().domain(d3.extent(vals)).nice(5);
    if (yP.domain()[0] === yP.domain()[1]) yP.domain([yP.domain()[0] - 0.5, yP.domain()[1] + 0.5]);
    const yM = d3.scaleLinear().domain([0, 1]);
    const ml = Math.ceil(Math.max(...yP.ticks(5).map((t) => textW(svg, f2(t))), textW(svg, '100%'))) + 10;
    const lastOf = (c) => [...wks].reverse().map((s) => by.get(c)?.get(s)).find((r) => r && r.precio != null);
    const mr = Math.ceil(d3.max(clases, (c) => { const r = lastOf(c); return r ? textW(svg, F.p(r.precio)) : 0; })) + 12;
    const x = d3.scaleBand(wks, [ml, W - mr]).paddingInner(0.2).paddingOuter(0.1);
    yP.range([top + H1, top]); yM.range([top + H1 + G + H2, top + H1 + G]);
    const cx = (s) => x(s) + x.bandwidth() / 2;
    svg.append('text').attr('x', ml).attr('y', 10).text('US$ por caja');
    svg.append('text').attr('x', ml).attr('y', top + H1 + G - 8).text('Mezcla de cajas por semana');
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(yP).ticks(5).tickSize(-(W - ml - mr)).tickFormat(f2))
      .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -8));
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(yM).ticks(2).tickSize(-(W - ml - mr)).tickFormat(fp0))
      .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -8));
    const step = Math.max(1, Math.ceil(wks.length * 30 / (W - ml - mr)));
    svg.append('g').attr('transform', `translate(0,${top + H1 + G + H2})`)
      .call(d3.axisBottom(x).tickValues(wks.filter((s, i) => i % step === 0)).tickSize(0).tickPadding(8))
      .call((g) => g.select('.domain').attr('stroke', 'var(--cds-chart-axis)'));

    // Barras 100% apiladas, con 2px de separación entre segmentos
    const segs = [];
    for (const s of wks) { let acc = 0; for (const c of clases) { const r = by.get(c)?.get(s); if (!r || !r.participacion) continue; segs.push({ c, s, y0: acc, y1: acc + r.participacion }); acc += r.participacion; } }
    svg.append('g').selectAll('rect').data(segs).join('rect')
      .attr('x', (d) => x(d.s)).attr('width', x.bandwidth())
      .attr('y', (d) => yM(d.y1) + 1).attr('height', (d) => Math.max(0, yM(d.y0) - yM(d.y1) - 2))
      .style('fill', (d) => colorClase(d.c));

    for (const c of clases) {
      const rows = wks.map((s) => ({ s, v: by.get(c)?.get(s)?.precio ?? null }));
      svg.append('path').datum(rows).attr('fill', 'none').style('stroke', colorClase(c)).attr('stroke-width', 2)
        .attr('d', d3.line().defined((r) => r.v != null).x((r) => cx(r.s)).y((r) => yP(r.v)));
      const r = lastOf(c);
      if (r) svg.append('text').attr('class', 'pv-strong').attr('x', cx(r.sem) + 8).attr('y', yP(r.precio)).attr('dy', '0.35em').text(F.p(r.precio));
    }

    const tip = tipIn(el);
    const guide = svg.append('line').attr('y1', top).attr('y2', top + H1 + G + H2).style('stroke', 'var(--cds-chart-axis)').style('opacity', 0);
    svg.append('rect').attr('x', ml).attr('y', top).attr('width', W - ml - mr).attr('height', H1 + G + H2).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [mx] = d3.pointer(ev);
        const i = Math.max(0, Math.min(wks.length - 1, Math.floor((mx - x.range()[0] - x.step() * x.paddingOuter()) / x.step())));
        const s = wks[i];
        guide.attr('x1', cx(s)).attr('x2', cx(s)).style('opacity', 1);
        const lines = ['Semana ' + s];
        for (const c of clases) { const r = by.get(c)?.get(s); if (r) lines.push([c.charAt(0) + c.slice(1).toLowerCase(), F.p(r.precio) + ' US$ · ' + F.pct(r.participacion) + ' · ' + F.n(r.cajas) + ' cajas']); }
        const box = el.getBoundingClientRect();
        tipShow(el, tip, lines, ev.clientX - box.left, ev.clientY - box.top);
      })
      .on('pointerleave', () => { guide.style('opacity', 0); tipHide(tip); });
  });

  dash.draw('clases-tabla', (tb) => {
    const d = dash.data('clases');
    tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-key', encodeURIComponent(r.clase));
      const td = (txt, num) => { const c = document.createElement('td'); if (num) c.className = 'n'; c.textContent = txt; tr.append(c); return c; };
      const c0 = td('');
      const sw = document.createElement('i'); sw.className = 'pv-sw'; sw.style.background = colorClase(r.clase);
      c0.append(sw, document.createTextNode(r.clase));
      td(F.n(r.cajas), true); td(F.pct(r.participacion), true); td(F.p(r.precio), true);
      tb.append(tr);
    }
  });
})();
