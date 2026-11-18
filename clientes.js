dash.calc('filtrado_clientes', {
  inputs: ['liq'],
  title: 'Embarques de todos los clientes',
  description: 'Filas con todos los filtros de la página excepto el de cliente, para comparar clientes entre sí.',
  fn: (liq) => {
    const p = dash.params();
    const desde = Number(p.desde) || 0, hasta = Number(p.hasta) || 99;
    return liq.filter((r) =>
      (!p.finca || r.finca === p.finca) && (!p.mes || r.mes === p.mes) &&
      (!p.mercado || r.mercado === p.mercado) && (!p.clase || r.clase === p.clase) &&
      (!p.codigo || r.codigo === p.codigo) && r.sem >= desde && r.sem <= hasta);
  },
});

dash.calc('cliente_semana', {
  inputs: ['filtrado_clientes'],
  title: 'Precio ponderado por cliente y semana, con acumulado',
  description: 'Por cliente y semana: cajas, precio ponderado de la semana y precio ponderado acumulado desde la primera semana del periodo de 2026.',
  fn: (filtrado_clientes) => {
    const g = d3.rollup(filtrado_clientes, (v) => ({
      c: d3.sum(v, (r) => r.cajas), cp: d3.sum(v, (r) => r.cajas_precio), v: d3.sum(v, (r) => r.valor_usd) }),
      (r) => r.cliente, (r) => r.sem);
    const out = [];
    for (const [cliente, m] of g) {
      let c = 0, cp = 0, val = 0;
      for (const sem of [...m.keys()].sort((a, b) => a - b)) {
        const x = m.get(sem); c += x.c; cp += x.cp; val += x.v;
        out.push({ cliente, sem, cajas: x.c, precio: x.cp > 0 ? x.v / x.cp : null,
          cajas_acum: c, precio_acum: cp > 0 ? val / cp : null });
      }
    }
    return out;
  },
});

dash.calc('empresa_acumulado', {
  inputs: ['filtrado_clientes'],
  title: 'Precio ponderado acumulado de la empresa por semana',
  description: 'Por semana: precio ponderado de la semana y acumulado desde la primera semana del periodo, con todos los clientes.',
  fn: (filtrado_clientes) => {
    const m = d3.rollup(filtrado_clientes, (v) => ({
      c: d3.sum(v, (r) => r.cajas), cp: d3.sum(v, (r) => r.cajas_precio), v: d3.sum(v, (r) => r.valor_usd) }), (r) => r.sem);
    let c = 0, cp = 0, val = 0;
    return [...m.keys()].sort((a, b) => a - b).map((sem) => {
      const x = m.get(sem); c += x.c; cp += x.cp; val += x.v;
      return { sem, cajas: x.c, precio: x.cp > 0 ? x.v / x.cp : null, cajas_acum: c, precio_acum: cp > 0 ? val / cp : null };
    });
  },
});

dash.calc('clientes', {
  inputs: ['filtrado_clientes'],
  title: 'Resumen por cliente (acumulado 2026)',
  description: 'Por cliente: cajas, participación y precio ponderado acumulado del periodo de 2026.',
  fn: (filtrado_clientes) => {
    const total = d3.sum(filtrado_clientes, (r) => r.cajas);
    const out = [];
    for (const [cliente, v] of d3.group(filtrado_clientes, (r) => r.cliente)) {
      const cp = d3.sum(v, (r) => r.cajas_precio), c = d3.sum(v, (r) => r.cajas);
      out.push({ cliente, cajas: c, participacion: total > 0 ? c / total : null,
        precio: cp > 0 ? d3.sum(v, (r) => r.valor_usd) / cp : null,
        semanas: new Set(v.map((r) => r.sem)).size });
    }
    return out.sort((a, b) => b.cajas - a.cajas);
  },
});

(function () {
  const L = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['US$', ''] });
  const f2 = L.format(',.2f'), f0 = L.format(',.0f'), fp = L.format('.1%');
  const F = {
    p: (v) => (v == null ? '—' : f2(v)),
    n: (v) => (v == null ? '—' : f0(v)),
    k: (v) => (v == null ? '—' : v >= 1e6 ? f2(v / 1e6) + ' M' : v >= 1e4 ? f0(v / 1e3) + ' mil' : f0(v)),
    pct: (v) => (v == null ? '—' : fp(v)),
  };
  const C = () => dash.colors;
  const corto = (s) => {
    let t = String(s).trim();
    const h = Math.floor(t.length / 2);
    if (t.length > 10 && t.slice(0, h).trim() === t.slice(h).trim()) t = t.slice(0, h).trim();
    return t.length > 30 ? t.slice(0, 29).trim() + '…' : t;
  };
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
  function status(...ids) {
    const s = ids.map((i) => dash.data(i).status);
    return s.includes('loading') ? 'loading' : s.find((x) => x !== 'ok') || 'ok';
  }
  function settle(el, st) {
    if (st === 'loading') { el.classList.add('dash-skeleton'); return false; }
    el.classList.remove('dash-skeleton'); return true;
  }
  // Cliente elegido para el gráfico: el de este selector, o el del filtro general, o el de más cajas.
  function clienteElegido() {
    const c = dash.data('clientes');
    const list = c.status === 'ok' && c.data ? c.data.map((r) => r.cliente) : [];
    const p = dash.params();
    if (p.cli && list.includes(p.cli)) return p.cli;
    if (p.cliente && list.includes(p.cliente)) return p.cliente;
    return list[0] || null;
  }

  dash.draw('f-cli', (sel) => {
    const c = dash.data('clientes');
    const rows = c.status === 'ok' && c.data ? c.data : [];
    sel.replaceChildren(...rows.map((r) => new Option(corto(r.cliente), r.cliente)));
    const cur = clienteElegido();
    if (cur) sel.value = cur;
    sel.onchange = () => dash.setParams({ cli: sel.value || null });
  });

  function resumenCli(name, field, fmt) {
    dash.draw(name, (el) => {
      const c = dash.data('clientes'), cur = clienteElegido();
      const r = c.status === 'ok' && c.data ? c.data.find((x) => x.cliente === cur) : null;
      if (!r) { el.textContent = '—'; el.removeAttribute('data-where'); return; }
      el.setAttribute('data-where', 'cliente=' + encodeURIComponent(r.cliente));
      el.textContent = fmt(r[field]);
    });
  }
  resumenCli('c-nombre', 'cliente', corto);
  resumenCli('c-precio', 'precio', F.p);
  resumenCli('c-cajas', 'cajas', F.n);
  resumenCli('c-part', 'participacion', F.pct);

  // ---------- Evolución semanal del cliente con acumulado ----------
  dash.draw('cliente-evolucion', (el) => {
    el.replaceChildren();
    const st = status('cliente_semana', 'empresa_acumulado', 'clientes');
    if (!settle(el, st)) return;
    if (st !== 'ok') { msg(el, 'No se pudo cargar este gráfico.'); return; }
    const cur = clienteElegido();
    const emp = dash.data('empresa_acumulado').data || [];
    const mine = new Map((dash.data('cliente_semana').data || []).filter((r) => r.cliente === cur).map((r) => [r.sem, r]));
    if (!cur || !mine.size || !emp.length) { msg(el, 'Sin embarques para los filtros elegidos.'); return; }
    const rows = emp.map((e) => { const m = mine.get(e.sem); return { sem: e.sem, emp_acum: e.precio_acum,
      precio: m ? m.precio : null, acum: null, cajas: m ? m.cajas : 0, cajas_acum: null }; });
    let last = null;
    for (const r of rows) { const m = mine.get(r.sem); if (m) last = m; if (last) { r.acum = last.precio_acum; r.cajas_acum = last.cajas_acum; } }

    const legend = document.createElement('div'); legend.className = 'pv-legend';
    const leg = (cls, color, label) => { const s = document.createElement('span'); const i = document.createElement('i'); if (cls) i.className = cls; if (color) i.style.background = color; s.append(i, document.createTextNode(label)); legend.append(s); };
    leg('', C()[0], 'Precio de la semana');
    leg('', C()[1], 'Acumulado 2026 del cliente');
    leg('dash', null, 'Acumulado 2026 empresa');
    leg('sq', C()[0], 'Cajas del cliente');
    el.append(legend);

    const W = Math.max(280, el.clientWidth), H1 = 220, H2 = 110, G = 34, top = 18, bottom = 24;
    const H = top + H1 + G + H2 + bottom;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
      .attr('role', 'img').attr('aria-label', 'Precio ponderado semanal y acumulado 2026 del cliente ' + cur);
    const vals = rows.flatMap((r) => [r.precio, r.acum, r.emp_acum]).filter((v) => v != null);
    const yP = d3.scaleLinear().domain(d3.extent(vals)).nice(5);
    if (yP.domain()[0] === yP.domain()[1]) yP.domain([yP.domain()[0] - 0.5, yP.domain()[1] + 0.5]);
    const yC = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.cajas) || 1]).nice(3);
    const ml = Math.ceil(Math.max(...yP.ticks(5).map((t) => textW(svg, f2(t))), ...yC.ticks(3).map((t) => textW(svg, F.k(t))))) + 10;
    const lastA = [...rows].reverse().find((r) => r.acum != null);
    const mr = Math.ceil(textW(svg, lastA ? F.p(lastA.acum) : '0')) + 12;
    const x = d3.scaleBand(rows.map((r) => r.sem), [ml, W - mr]).paddingInner(0.25).paddingOuter(0.1);
    yP.range([top + H1, top]); yC.range([top + H1 + G + H2, top + H1 + G]);
    const cx = (s) => x(s) + x.bandwidth() / 2;

    svg.append('text').attr('x', ml).attr('y', 10).text('US$ por caja');
    svg.append('text').attr('x', ml).attr('y', top + H1 + G - 8).text('Cajas');
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(yP).ticks(5).tickSize(-(W - ml - mr)).tickFormat(f2))
      .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -8));
    svg.append('g').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(yC).ticks(3).tickSize(-(W - ml - mr)).tickFormat(F.k))
      .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('x', -8));
    const step = Math.max(1, Math.ceil(rows.length * 30 / (W - ml - mr)));
    svg.append('g').attr('transform', `translate(0,${top + H1 + G + H2})`)
      .call(d3.axisBottom(x).tickValues(rows.map((r) => r.sem).filter((s, i) => i % step === 0)).tickSize(0).tickPadding(8))
      .call((g) => g.select('.domain').attr('stroke', 'var(--cds-chart-axis)'));

    svg.append('g').selectAll('rect').data(rows.filter((r) => r.cajas > 0)).join('rect')
      .attr('x', (r) => x(r.sem)).attr('width', x.bandwidth()).attr('rx', Math.min(2, x.bandwidth() / 2))
      .attr('y', (r) => yC(r.cajas)).attr('height', (r) => yC(0) - yC(r.cajas)).style('fill', C()[0]).style('opacity', 0.85);

    const line = (k) => d3.line().defined((r) => r[k] != null).x((r) => cx(r.sem)).y((r) => yP(r[k]));
    svg.append('path').datum(rows).attr('d', line('emp_acum')).attr('fill', 'none')
      .style('stroke', 'var(--cds-chart-reference)').attr('stroke-width', 2).attr('stroke-dasharray', '5 4');
    svg.append('path').datum(rows).attr('d', line('precio')).attr('fill', 'none').style('stroke', C()[0]).attr('stroke-width', 1.5);
    svg.append('g').selectAll('circle').data(rows.filter((r) => r.precio != null)).join('circle')
      .attr('cx', (r) => cx(r.sem)).attr('cy', (r) => yP(r.precio)).attr('r', 2.5).style('fill', C()[0]);
    svg.append('path').datum(rows).attr('d', line('acum')).attr('fill', 'none').style('stroke', C()[1]).attr('stroke-width', 2.5);
    if (lastA) svg.append('text').attr('class', 'pv-strong').attr('x', cx(lastA.sem) + 8).attr('y', yP(lastA.acum)).attr('dy', '0.35em').text(F.p(lastA.acum));

    const tip = tipIn(el);
    const guide = svg.append('line').attr('y1', top).attr('y2', top + H1 + G + H2).style('stroke', 'var(--cds-chart-axis)').style('opacity', 0);
    svg.append('rect').attr('x', ml).attr('y', top).attr('width', W - ml - mr).attr('height', H1 + G + H2).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [mx] = d3.pointer(ev);
        const i = Math.max(0, Math.min(rows.length - 1, Math.floor((mx - x.range()[0] - x.step() * x.paddingOuter()) / x.step())));
        const r = rows[i];
        guide.attr('x1', cx(r.sem)).attr('x2', cx(r.sem)).style('opacity', 1);
        const box = el.getBoundingClientRect();
        tipShow(el, tip, [corto(cur) + ' · semana ' + r.sem, ['Precio semana', F.p(r.precio) + ' US$'], ['Acumulado 2026', F.p(r.acum) + ' US$'],
          ['Acumulado empresa', F.p(r.emp_acum) + ' US$'], ['Cajas semana', F.n(r.cajas)], ['Cajas acumuladas', F.n(r.cajas_acum)]],
          ev.clientX - box.left, ev.clientY - box.top);
      })
      .on('pointerleave', () => { guide.style('opacity', 0); tipHide(tip); });
  });

  // ---------- Matriz cliente × semana con acumulado ----------
  dash.draw('matriz-clientes', (el) => {
    el.replaceChildren();
    const st = status('cliente_semana', 'clientes');
    if (!settle(el, st)) return;
    if (st !== 'ok') { msg(el, 'No se pudo cargar este gráfico.'); return; }
    const cells = (dash.data('cliente_semana').data || []).filter((r) => r.precio != null);
    const resumen = dash.data('clientes').data || [];
    const order = resumen.map((r) => r.cliente);
    if (!cells.length) { msg(el, 'Sin embarques para los filtros elegidos.'); return; }
    const cur = clienteElegido();
    const wks = [...new Set((dash.data('cliente_semana').data || []).map((r) => r.sem))].sort(d3.ascending);
    const W = Math.max(680, el.clientWidth);
    const svg = d3.select(el).append('svg').attr('width', W).attr('role', 'img')
      .attr('aria-label', 'Matriz de precio ponderado por cliente y semana con acumulado 2026');
    const lw = Math.ceil(d3.max(order, (s) => textW(svg, corto(s)))) + 14;
    const colA = Math.ceil(textW(svg, 'Acum. 2026')) + 16, colC = Math.ceil(textW(svg, '0.000.000')) + 12;
    const cw = (W - lw - colA - colC - 10) / wks.length, ch = 20, top = 22;
    const H = top + order.length * ch + 64;
    svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const xs = d3.scaleBand(wks, [lw, lw + cw * wks.length]).padding(0.08);
    const ys = d3.scaleBand(order, [top, top + order.length * ch]).padding(0.08);
    const xA = lw + cw * wks.length + 10 + colA - 4, xC = xA + colC;
    const sorted = cells.map((r) => r.precio).sort(d3.ascending);
    let lo = d3.quantileSorted(sorted, 0.05), hi = d3.quantileSorted(sorted, 0.95);
    if (lo === hi) { lo -= 0.1; hi += 0.1; }
    const NSTEP = 7;
    const q = d3.scaleQuantize().domain([lo, hi]).range(d3.range(NSTEP));
    const fill = (i) => `color-mix(in oklab, ${C()[0]} ${Math.round(14 + i * (86 / (NSTEP - 1)))}%, var(--color-panel))`;

    const stepL = Math.max(1, Math.ceil(26 / cw));
    svg.append('g').selectAll('text').data(wks.filter((s, i) => i % stepL === 0)).join('text')
      .attr('x', (s) => xs(s) + xs.bandwidth() / 2).attr('y', 12).attr('text-anchor', 'middle').text((s) => s);
    svg.append('text').attr('x', 0).attr('y', 12).text('Sem.');
    svg.append('text').attr('x', xA).attr('y', 12).attr('text-anchor', 'end').attr('class', 'pv-strong').text('Acum. 2026');
    svg.append('text').attr('x', xC).attr('y', 12).attr('text-anchor', 'end').text('Cajas');

    if (cur && order.includes(cur)) svg.append('rect').attr('x', 2).attr('y', ys(cur) - 1).attr('width', xC + 4)
      .attr('height', ys.bandwidth() + 2).attr('rx', 3).attr('fill', 'none').style('stroke', 'var(--color-fg)').attr('stroke-width', 1.5);

    const tip = tipIn(el);
    const row = svg.append('g').selectAll('g').data(resumen).join('g').style('cursor', 'pointer')
      .on('click', (ev, r) => dash.setParams({ cli: r.cliente }));
    const cy = (r) => ys(r.cliente) + ys.bandwidth() / 2;
    row.append('text').attr('x', lw - 8).attr('y', cy).attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('class', (r) => (r.cliente === cur ? 'pv-strong' : null)).text((r) => corto(r.cliente));
    row.append('text').attr('x', xA).attr('y', cy).attr('dy', '0.35em').attr('text-anchor', 'end').attr('class', 'pv-strong').text((r) => F.p(r.precio));
    row.append('text').attr('x', xC).attr('y', cy).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => F.k(r.cajas));
    row.on('pointermove', (ev, r) => {
      if (ev.target.tagName === 'rect') return;
      const box = el.getBoundingClientRect();
      tipShow(el, tip, [r.cliente, ['Precio acumulado 2026', F.p(r.precio) + ' US$'], ['Cajas', F.n(r.cajas)], ['Participación', F.pct(r.participacion)], ['Semanas con embarques', F.n(r.semanas)]], ev.clientX - box.left, ev.clientY - box.top);
    }).on('pointerleave', () => tipHide(tip));

    svg.append('g').selectAll('rect').data(cells.filter((r) => order.includes(r.cliente))).join('rect')
      .attr('x', (r) => xs(r.sem)).attr('y', (r) => ys(r.cliente)).attr('width', xs.bandwidth()).attr('height', ys.bandwidth()).attr('rx', 2)
      .style('fill', (r) => fill(q(r.precio))).style('cursor', 'pointer')
      .on('pointermove', (ev, r) => {
        const box = el.getBoundingClientRect();
        tipShow(el, tip, [corto(r.cliente) + ' · semana ' + r.sem, ['Precio semana', F.p(r.precio) + ' US$'], ['Acumulado a la semana', F.p(r.precio_acum) + ' US$'], ['Cajas', F.n(r.cajas)]], ev.clientX - box.left, ev.clientY - box.top);
        d3.select(ev.currentTarget).style('stroke', 'var(--color-fg)').attr('stroke-width', 1.5);
      })
      .on('pointerleave', (ev) => { tipHide(tip); d3.select(ev.currentTarget).style('stroke', null); })
      .on('click', (ev, r) => dash.setParams({ cli: r.cliente }));

    const ly = top + order.length * ch + 22;
    const sw = Math.min(64, (W - lw - 140) / NSTEP);
    svg.append('text').attr('x', lw).attr('y', ly - 6).text('Precio ponderado de la semana (US$/caja)');
    const th = q.thresholds();
    const lg = svg.append('g').selectAll('g').data(d3.range(NSTEP)).join('g').attr('transform', (i) => `translate(${lw + i * (sw + 2)},${ly})`);
    lg.append('rect').attr('width', sw).attr('height', 12).attr('rx', 2).style('fill', (i) => fill(i));
    lg.append('text').attr('y', 28).text((i) => (i === 0 ? '≤ ' + f2(th[0]) : i === NSTEP - 1 ? '≥ ' + f2(th[NSTEP - 2]) : i % 2 === 0 ? f2(th[i - 1]) : ''));
  });
})();
