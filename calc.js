dash.calc('filtrado', {
  inputs: ['liq'],
  title: 'Embarques con los filtros aplicados',
  description: 'Filas de 2026 que cumplen todos los filtros de la página (finca, mes, semanas, mercado, clase, cliente y código).',
  fn: (liq) => {
    const p = dash.params();
    const desde = Number(p.desde) || 0, hasta = Number(p.hasta) || 99;
    return liq.filter((r) =>
      (!p.finca || r.finca === p.finca) && (!p.mes || r.mes === p.mes) &&
      (!p.mercado || r.mercado === p.mercado) && (!p.clase || r.clase === p.clase) &&
      (!p.cliente || r.cliente === p.cliente) && (!p.codigo || r.codigo === p.codigo) &&
      r.sem >= desde && r.sem <= hasta);
  },
});

dash.calc('filtrado_empresa', {
  inputs: ['liq'],
  title: 'Embarques de todas las fincas',
  description: 'Las mismas filas pero sin filtrar por finca, para comparar con el total de la empresa.',
  fn: (liq) => {
    const p = dash.params();
    const desde = Number(p.desde) || 0, hasta = Number(p.hasta) || 99;
    return liq.filter((r) =>
      (!p.mes || r.mes === p.mes) &&
      (!p.mercado || r.mercado === p.mercado) && (!p.clase || r.clase === p.clase) &&
      (!p.cliente || r.cliente === p.cliente) && (!p.codigo || r.codigo === p.codigo) &&
      r.sem >= desde && r.sem <= hasta);
  },
});

dash.calc('kpis', {
  inputs: ['filtrado', 'filtrado_empresa'],
  title: 'Indicadores del periodo',
  description: 'Precio ponderado = Σ(precio × cajas) ÷ Σ cajas con precio en US$; última semana comparada con la anterior con embarques.',
  fn: (filtrado, filtrado_empresa) => {
    const suma = (a, f) => a.reduce((t, r) => t + r[f], 0);
    const pond = (a) => { const c = suma(a, 'cajas_precio'); return c > 0 ? suma(a, 'valor_usd') / c : null; };
    const sems = [...new Set(filtrado.map((r) => r.sem))].sort((a, b) => a - b);
    const ult = sems.length ? sems[sems.length - 1] : null;
    const ant = sems.length > 1 ? sems[sems.length - 2] : null;
    const wu = filtrado.filter((r) => r.sem === ult), wa = filtrado.filter((r) => r.sem === ant);
    const pu = pond(wu), pa = pond(wa), cu = suma(wu, 'cajas'), ca = suma(wa, 'cajas');
    return [{
      precio: pond(filtrado),
      cajas: suma(filtrado, 'cajas'),
      cajas_sin_precio_usd: suma(filtrado, 'cajas') - suma(filtrado, 'cajas_precio'),
      fincas: new Set(filtrado.map((r) => r.finca)).size,
      semanas: sems.length,
      sem_ini: sems.length ? sems[0] : null,
      sem_fin: ult,
      sem_ant: ant,
      precio_ult: pu,
      precio_ant: pa,
      var_precio: pu != null && pa != null ? pu - pa : null,
      cajas_ult: ult != null ? cu : null,
      var_cajas_pct: ant != null && ca > 0 ? cu / ca - 1 : null,
      precio_empresa: pond(filtrado_empresa),
      cajas_empresa: suma(filtrado_empresa, 'cajas'),
    }];
  },
});

dash.calc('semanal', {
  inputs: ['filtrado', 'filtrado_empresa'],
  title: 'Precio ponderado y cajas por semana',
  description: 'Por semana: cajas y precio ponderado de la selección, y los mismos datos de toda la empresa.',
  fn: (filtrado, filtrado_empresa) => {
    const agrupar = (a) => d3.rollup(a, (v) => ({
      c: d3.sum(v, (r) => r.cajas), cp: d3.sum(v, (r) => r.cajas_precio),
      v: d3.sum(v, (r) => r.valor_usd), mes: v[0].mes }), (r) => r.sem);
    const sel = agrupar(filtrado), emp = agrupar(filtrado_empresa);
    return [...emp.keys()].sort((a, b) => a - b).map((sem) => {
      const x = sel.get(sem), y = emp.get(sem);
      return { sem, mes: y.mes,
        cajas: x ? x.c : 0, precio: x && x.cp > 0 ? x.v / x.cp : null,
        cajas_empresa: y.c, precio_empresa: y.cp > 0 ? y.v / y.cp : null };
    });
  },
});

dash.calc('finca_semana', {
  inputs: ['filtrado_empresa'],
  title: 'Precio ponderado por finca y semana',
  description: 'Una fila por finca y semana con sus cajas y su precio ponderado.',
  fn: (filtrado_empresa) => {
    const g = d3.rollup(filtrado_empresa, (v) => ({
      c: d3.sum(v, (r) => r.cajas), cp: d3.sum(v, (r) => r.cajas_precio), v: d3.sum(v, (r) => r.valor_usd) }),
      (r) => r.finca, (r) => r.sem);
    const out = [];
    for (const [finca, m] of g) for (const [sem, x] of m)
      out.push({ finca, sem, cajas: x.c, precio: x.cp > 0 ? x.v / x.cp : null });
    return out;
  },
});

dash.calc('fincas', {
  inputs: ['filtrado_empresa'],
  title: 'Resumen por finca',
  description: 'Por finca: cajas, participación, precio ponderado del periodo y su precio semanal mínimo y máximo.',
  fn: (filtrado_empresa) => {
    const total = d3.sum(filtrado_empresa, (r) => r.cajas);
    const g = d3.group(filtrado_empresa, (r) => r.finca);
    const out = [];
    for (const [finca, v] of g) {
      const cp = d3.sum(v, (r) => r.cajas_precio);
      const sem = d3.rollups(v, (w) => {
        const c = d3.sum(w, (r) => r.cajas_precio);
        return c > 0 ? d3.sum(w, (r) => r.valor_usd) / c : null;
      }, (r) => r.sem).map((d) => d[1]).filter((x) => x != null);
      out.push({ finca,
        cajas: d3.sum(v, (r) => r.cajas),
        participacion: total > 0 ? d3.sum(v, (r) => r.cajas) / total : null,
        precio: cp > 0 ? d3.sum(v, (r) => r.valor_usd) / cp : null,
        precio_min_sem: sem.length ? d3.min(sem) : null,
        precio_max_sem: sem.length ? d3.max(sem) : null,
        semanas: new Set(v.map((r) => r.sem)).size });
    }
    return out.sort((a, b) => b.cajas - a.cajas);
  },
});
