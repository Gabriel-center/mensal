/* Mensalinha — MVP sem servidor.
   Os dados ficam no navegador (localStorage) do aparelho de quem usa.
   Backup e restauração por arquivo JSON em Ajustes. */
(function () {
  'use strict';

  // ---------- Nichos ----------
  const NICHOS = {
    aulas: {
      nome: 'Aulas', cliente: 'Aluno', clientes: 'Alunos',
      contato: 'Responsável (se for menor)', extra: 'Turma ou horário',
      servico: 'mensalidade das aulas', multa: 0, juros: 0, valor: 250, dia: 10,
    },
    van: {
      nome: 'Transporte escolar', cliente: 'Aluno', clientes: 'Alunos',
      contato: 'Responsável', extra: 'Escola e período',
      servico: 'mensalidade da van', multa: 2, juros: 1, valor: 380, dia: 5,
    },
    aluguel: {
      nome: 'Aluguel', cliente: 'Inquilino', clientes: 'Inquilinos',
      contato: 'Nome para a mensagem (opcional)', extra: 'Imóvel',
      servico: 'aluguel', multa: 2, juros: 1, valor: 900, dia: 10,
    },
  };

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const MODELOS = {
    lembrete:
      'Oi, {contato}! Passando pra lembrar da {servico} de {mes} ({nome}): {valor}, vencimento {vencimento}.\n\n' +
      'Pix copia e cola:\n{pix}\n\nObrigado!\n{prestador}',
    atraso:
      'Oi, {contato}! A {servico} de {mes} ({nome}) venceu em {vencimento} e ainda não consta como paga. ' +
      'Valor atualizado: {valor}{detalhe}.\n\nPix copia e cola:\n{pix}\n\n' +
      'Se já pagou, me avisa que eu dou baixa. Obrigado!\n{prestador}',
    recibo:
      'Recebido! ✅\n{servico} de {mes} ({nome}): {valor}, pago em {pagoem}.\n\nObrigado!\n{prestador}',
  };

  const KEY = 'mensalinha.v1';
  const DAY = 86400000;

  // ---------- Estado ----------
  function blankState(nicho) {
    const n = NICHOS[nicho] ? nicho : 'aulas';
    return {
      settings: {
        nicho: n, nome: '', chaveTipo: 'telefone', chave: '', cidade: '',
        diasAntes: 3, multa: NICHOS[n].multa, juros: NICHOS[n].juros,
        mesesSem: [], modelos: Object.assign({}, MODELOS),
      },
      clientes: [], pagamentos: {}, lembretes: {},
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const b = blankState(s.settings && s.settings.nicho);
        s.settings = Object.assign(b.settings, s.settings || {});
        s.settings.modelos = Object.assign({}, MODELOS, s.settings.modelos || {});
        s.clientes = s.clientes || []; s.pagamentos = s.pagamentos || {}; s.lembretes = s.lembretes || {};
        return s;
      }
    } catch (e) { /* armazenamento indisponível: segue em memória */ }
    return blankState(new URLSearchParams(location.search).get('nicho'));
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Não consegui salvar neste navegador. Faça um backup em Ajustes.'); }
  }
  const N = () => NICHOS[S.settings.nicho] || NICHOS.aulas;

  // ---------- Utilidades ----------
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = (v) => BRL.format(Number(v) || 0);
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const round2 = (v) => Math.round(v * 100) / 100;

  function today() {
    const q = new URLSearchParams(location.search).get('hoje'); // útil para testar datas
    const d = q ? new Date(q + 'T12:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const ymOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  function addMonths(ym, k) {
    const [y, m] = ym.split('-').map(Number);
    return ymOf(new Date(y, m - 1 + k, 1));
  }
  function monthLabel(ym) { const [y, m] = ym.split('-').map(Number); return MESES[m - 1] + ' de ' + y; }
  function monthShort(ym) { const [y, m] = ym.split('-').map(Number); return MESES[m - 1] + '/' + String(y).slice(2); }
  function dueDate(ym, dia) {
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return new Date(y, m - 1, Math.min(Number(dia) || 1, last));
  }
  const fmtDate = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  const isoDate = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function parseIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function firstName(s) { return String(s || '').trim().split(/\s+/)[0] || ''; }
  function phoneDigits(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (!d) return '';
    if (!(d.startsWith('55') && d.length >= 12)) d = '55' + d;
    return d;
  }

  // ---------- Regras de cobrança ----------
  function payment(ym, id) { return (S.pagamentos[ym] || {})[id]; }

  function statusOf(c, ym) {
    const t = today();
    const month = Number(ym.slice(5));
    if (!c.ativo || (c.inicio && ym < c.inicio) || S.settings.mesesSem.includes(month)) return { st: 'isento' };
    const p = payment(ym, c.id);
    if (p) return { st: 'pago', pago: p };
    const due = dueDate(ym, c.dia);
    const diff = Math.round((due - t) / DAY);
    if (diff < 0) return { st: 'atrasado', dias: -diff, due };
    if (diff === 0) return { st: 'hoje', dias: 0, due };
    if (diff <= Number(S.settings.diasAntes)) return { st: 'breve', dias: diff, due };
    return { st: 'aberto', dias: diff, due };
  }

  function amountFor(c, info) {
    const base = Number(c.valor) || 0;
    if (info.st !== 'atrasado') return { total: base, extra: 0 };
    const multa = base * (Number(S.settings.multa) || 0) / 100;
    const juros = base * (Number(S.settings.juros) || 0) / 100 * info.dias / 30;
    const extra = round2(multa + juros);
    return { total: round2(base + extra), extra };
  }

  function chipText(info) {
    switch (info.st) {
      case 'atrasado': return info.dias === 1 ? 'atrasado 1 dia' : 'atrasado ' + info.dias + ' dias';
      case 'hoje': return 'vence hoje';
      case 'breve': return info.dias === 1 ? 'vence amanhã' : 'vence em ' + info.dias + ' dias';
      case 'aberto': return 'em aberto';
      case 'pago': return 'pago';
      default: return 'sem cobrança';
    }
  }
  const chip = (info) => '<span class="chip ' + info.st + '">' + chipText(info) + '</span>';

  // Itens a cobrar: mês atual e até 5 meses para trás ainda sem pagamento.
  function chargeList() {
    const cur = ymOf(today());
    const out = [];
    S.clientes.forEach((c) => {
      for (let k = -5; k <= 0; k++) {
        const ym = addMonths(cur, k);
        const info = statusOf(c, ym);
        if (info.st === 'atrasado' || info.st === 'hoje' || info.st === 'breve') out.push({ c, ym, info });
      }
    });
    const rank = { atrasado: 0, hoje: 1, breve: 2 };
    out.sort((a, b) => rank[a.info.st] - rank[b.info.st] || (b.info.dias - a.info.dias) * (a.info.st === 'atrasado' ? 1 : -1));
    return out;
  }

  function pixFor(c, ym, total) {
    const s = S.settings;
    if (!s.chave) return '';
    return Pix.payload({
      keyType: s.chaveTipo, key: s.chave, name: s.nome, city: s.cidade,
      amount: total, txid: 'M' + c.id.slice(0, 6) + ym.replace('-', ''),
    });
  }

  function fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)); }

  function messageFor(c, ym, info) {
    const { total, extra } = amountFor(c, info);
    const tpl = info.st === 'atrasado' ? S.settings.modelos.atraso : S.settings.modelos.lembrete;
    const due = dueDate(ym, c.dia);
    let detalhe = '';
    if (extra > 0) detalhe = ' (' + money(c.valor) + ' + ' + money(extra) + ' de multa e juros por ' + info.dias + (info.dias === 1 ? ' dia' : ' dias') + ')';
    return fill(tpl, {
      nome: c.nome, contato: firstName(c.contato) || firstName(c.nome), servico: N().servico,
      mes: monthLabel(ym), valor: money(total), vencimento: (info.st === 'hoje' ? 'hoje, ' : '') + fmtDate(due),
      pix: pixFor(c, ym, total) || '(cadastre sua chave Pix em Ajustes)', prestador: S.settings.nome, detalhe,
    });
  }

  function receiptFor(c, ym) {
    const p = payment(ym, c.id);
    if (!p) return '';
    return fill(S.settings.modelos.recibo, {
      nome: c.nome, contato: firstName(c.contato) || firstName(c.nome), servico: cap(N().servico),
      mes: monthLabel(ym), valor: money(p.valor), pagoem: fmtDate(parseIso(p.em)), prestador: S.settings.nome,
    });
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function waLink(c, text) {
    const d = phoneDigits(c.telefone);
    return (d ? 'https://wa.me/' + d : 'https://wa.me/') + '?text=' + encodeURIComponent(text);
  }

  function markPaid(id, ym, valor) {
    S.pagamentos[ym] = S.pagamentos[ym] || {};
    S.pagamentos[ym][id] = { em: isoDate(today()), valor: round2(valor) };
    save();
  }
  function unmarkPaid(id, ym) {
    if (S.pagamentos[ym]) { delete S.pagamentos[ym][id]; save(); }
  }
  function logReminder(id, ym) {
    S.lembretes[ym] = S.lembretes[ym] || {};
    (S.lembretes[ym][id] = S.lembretes[ym][id] || []).push(isoDate(today()));
    save();
  }
  function lastReminder(id, ym) {
    const l = (S.lembretes[ym] || {})[id];
    return l && l.length ? parseIso(l[l.length - 1]) : null;
  }
  const byId = (id) => S.clientes.find((c) => c.id === id);

  // ---------- Navegação ----------
  let tab = 'hoje';
  let viewMonth = ymOf(today());
  function go(t) {
    tab = t;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    render();
    window.scrollTo(0, 0);
  }
  document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) go(b.dataset.tab);
  });

  function render() {
    $('#nichePill').textContent = N().nome;
    $('#tabClientes').textContent = N().clientes;
    const v = $('#view');
    if (tab === 'hoje') v.innerHTML = viewHoje();
    else if (tab === 'clientes') v.innerHTML = viewClientes();
    else if (tab === 'mes') v.innerHTML = viewMes();
    else v.innerHTML = viewAjustes();
    if (tab === 'ajustes') bindAjustes();
  }

  // ---------- Tela: Hoje ----------
  function monthTotals(ym) {
    let recebido = 0, aReceber = 0, n = 0;
    S.clientes.forEach((c) => {
      const info = statusOf(c, ym);
      if (info.st === 'isento') return;
      n++;
      if (info.st === 'pago') recebido += Number(info.pago.valor) || 0;
      else aReceber += Number(c.valor) || 0;
    });
    return { recebido, aReceber, n };
  }

  function viewHoje() {
    const t = today();
    const cur = ymOf(t);
    const setupMissing = !S.settings.chave || !S.settings.nome;
    let h = '';
    if (setupMissing) {
      h += '<div class="banner"><b>Falta pouco pra começar</b>Cadastre seu nome e sua chave Pix em Ajustes. Eles entram no código Pix de cada cobrança. ' +
        '<div class="mt"><button class="btn primary sm" data-act="goto" data-tab="ajustes">Ir para Ajustes</button></div></div>';
    }
    h += '<h1>Hoje, ' + fmtDate(t) + '</h1><p class="sub">Resumo de ' + monthLabel(cur) + '</p>';

    const tot = monthTotals(cur);
    const list = chargeList();
    const late = list.filter((x) => x.info.st === 'atrasado');
    const lateSum = late.reduce((a, x) => a + amountFor(x.c, x.info).total, 0);
    h += '<div class="stats">' +
      '<div class="stat ok"><div class="lbl">Recebido no mês</div><div class="val">' + money(tot.recebido) + '</div></div>' +
      '<div class="stat"><div class="lbl">A receber no mês</div><div class="val">' + money(tot.aReceber) + '</div></div>' +
      '<div class="stat ' + (late.length ? 'bad' : '') + '"><div class="lbl">Em atraso (' + late.length + ')</div><div class="val">' + money(lateSum) + '</div></div>' +
      '</div>';

    h += '<h2>Cobrar agora</h2>';
    if (!S.clientes.length) {
      h += '<div class="empty"><div class="big">👋</div><b>Nenhum ' + N().cliente.toLowerCase() + ' cadastrado ainda</b>' +
        '<p>Cadastre quem te paga todo mês, ou carregue um exemplo para ver como funciona.</p>' +
        '<div class="actions" style="justify-content:center"><button class="btn primary" data-act="new">+ Cadastrar ' + N().cliente.toLowerCase() + '</button>' +
        '<button class="btn" data-act="demo">Carregar exemplo</button></div></div>';
      return h;
    }
    if (!list.length) {
      h += '<div class="empty"><div class="big">🎉</div><b>Ninguém pra cobrar agora</b><p>Os lembretes aparecem aqui ' +
        S.settings.diasAntes + ' dias antes do vencimento.</p></div>';
      return h;
    }
    h += '<div class="list">' + list.map(itemCard).join('') + '</div>';
    return h;
  }

  function itemCard(x) {
    const { c, ym, info } = x;
    const amt = amountFor(c, info);
    const lr = lastReminder(c.id, ym);
    const meta = [monthShort(ym), 'vence ' + fmtDate(dueDate(ym, c.dia))];
    if (c.extra) meta.push(esc(c.extra));
    return '<div class="item">' +
      '<div class="item-top"><div><div class="item-name">' + esc(c.nome) + ' ' + chip(info) + '</div>' +
      '<div class="item-meta">' + meta.join(' · ') + (lr ? ' · lembrete enviado ' + fmtDate(lr) : '') + '</div></div>' +
      '<div class="item-amount">' + money(amt.total) + (amt.extra ? '<small>' + money(c.valor) + ' + ' + money(amt.extra) + '</small>' : '') + '</div></div>' +
      '<div class="actions">' +
      '<button class="btn wa" data-act="wa" data-id="' + c.id + '" data-ym="' + ym + '">' + (lr ? 'Lembrar de novo' : 'Cobrar no WhatsApp') + '</button>' +
      '<button class="btn" data-act="qr" data-id="' + c.id + '" data-ym="' + ym + '">QR Pix</button>' +
      '<button class="btn" data-act="pay" data-id="' + c.id + '" data-ym="' + ym + '">✓ Pago</button>' +
      '</div></div>';
  }

  // ---------- Tela: Clientes ----------
  function viewClientes() {
    const n = N();
    let h = '<div class="fab-row"><div><h1>' + n.clientes + '</h1><p class="sub" style="margin:0">' +
      S.clientes.filter((c) => c.ativo).length + ' ativos</p></div>' +
      '<button class="btn primary" data-act="new">+ Novo</button></div>';
    if (!S.clientes.length) {
      return h + '<div class="empty"><div class="big">📋</div><b>Lista vazia</b><p>Cada ' + n.cliente.toLowerCase() +
        ' tem um valor e um dia de vencimento por mês.</p><button class="btn" data-act="demo">Carregar exemplo</button></div>';
    }
    const cur = ymOf(today());
    const sorted = S.clientes.slice().sort((a, b) => (b.ativo - a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'));
    h += '<div class="list">' + sorted.map((c) => {
      const info = statusOf(c, cur);
      return '<div class="item" style="cursor:pointer" data-act="edit" data-id="' + c.id + '">' +
        '<div class="item-top"><div><div class="item-name">' + esc(c.nome) + (c.ativo ? '' : ' <span class="chip isento">inativo</span>') + '</div>' +
        '<div class="item-meta">Dia ' + esc(c.dia) + (c.contato ? ' · ' + esc(c.contato) : '') + (c.extra ? ' · ' + esc(c.extra) : '') + '</div></div>' +
        '<div class="item-amount">' + money(c.valor) + '<small>' + (c.ativo ? chipText(info) + ' em ' + MESES_CURTOS[Number(cur.slice(5)) - 1] : '') + '</small></div></div></div>';
    }).join('') + '</div>';
    return h;
  }

  function clientForm(c) {
    const n = N();
    const isNew = !c;
    c = c || { id: '', nome: '', contato: '', telefone: '', valor: n.valor, dia: n.dia, inicio: ymOf(today()), extra: '', obs: '', ativo: true };
    return '<h2>' + (isNew ? 'Novo ' + n.cliente.toLowerCase() : 'Editar ' + n.cliente.toLowerCase()) + '</h2>' +
      '<form class="form" id="clientForm" data-id="' + esc(c.id) + '">' +
      field('nome', n.cliente, '<input name="nome" required value="' + esc(c.nome) + '" autocomplete="off">') +
      field('contato', n.contato, '<input name="contato" value="' + esc(c.contato) + '" autocomplete="off">') +
      field('telefone', 'WhatsApp', '<input name="telefone" type="tel" inputmode="tel" placeholder="(19) 99999-1234" value="' + esc(c.telefone) + '">') +
      '<div class="row2">' +
      field('valor', 'Valor mensal (R$)', '<input name="valor" type="number" min="0" step="0.01" inputmode="decimal" required value="' + esc(c.valor) + '">') +
      field('dia', 'Dia do vencimento', '<input name="dia" type="number" min="1" max="31" required value="' + esc(c.dia) + '">') +
      '</div>' +
      '<div class="row2">' +
      field('inicio', 'Cobrar a partir de', '<input name="inicio" type="month" value="' + esc(c.inicio) + '">') +
      field('extra', n.extra, '<input name="extra" value="' + esc(c.extra) + '">') +
      '</div>' +
      field('obs', 'Observações', '<input name="obs" value="' + esc(c.obs) + '">') +
      '<label class="switch"><input type="checkbox" name="ativo" ' + (c.ativo ? 'checked' : '') + '> Ativo (recebe cobranças)</label>' +
      '<button class="btn primary block" type="submit">Salvar</button>' +
      (isNew ? '' : '<button class="btn danger block" type="button" data-act="del" data-id="' + c.id + '">Excluir</button>') +
      '</form>';
  }
  function field(name, label, input, hint) {
    return '<div class="field"><label for="f_' + name + '">' + esc(label) + '</label>' +
      input.replace('name="' + name + '"', 'name="' + name + '" id="f_' + name + '"') +
      (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  }

  // ---------- Tela: Mês ----------
  function viewMes() {
    const ym = viewMonth;
    const rows = S.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((c) => ({ c, info: statusOf(c, ym) })).filter((r) => r.info.st !== 'isento' || payment(ym, r.c.id));
    let pago = 0, aberto = 0;
    rows.forEach((r) => { if (r.info.st === 'pago') pago += Number(r.info.pago.valor) || 0; else aberto += Number(r.c.valor) || 0; });

    let h = '<div class="print-head"><h1>Relatório de ' + monthLabel(ym) + '</h1><p>' + esc(S.settings.nome) + ' · ' + N().nome + '</p></div>' +
      '<div class="month-nav no-print"><button class="btn sm" data-act="month" data-k="-1" aria-label="Mês anterior">‹</button><h1>' + cap(monthLabel(ym)) + '</h1>' +
      '<button class="btn sm" data-act="month" data-k="1" aria-label="Próximo mês">›</button></div>';
    if (!rows.length) return h + '<div class="empty"><div class="big">🗓️</div><b>Nada neste mês</b><p>Não há cobranças previstas para ' + monthLabel(ym) + '.</p></div>';

    h += '<table class="report"><thead><tr><th>' + N().cliente + '</th><th class="num">Valor</th><th class="hide-sm">Vence</th><th>Situação</th><th class="no-print"></th></tr></thead><tbody>' +
      rows.map(({ c, info }) => {
        const val = info.st === 'pago' ? info.pago.valor : c.valor;
        const sit = info.st === 'pago' ? chip(info) + ' <span class="small muted">' + fmtDate(parseIso(info.pago.em)) + '</span>' : chip(info);
        const act = info.st === 'pago'
          ? '<button class="btn sm ghost" data-act="receipt" data-id="' + c.id + '" data-ym="' + ym + '">Recibo</button><button class="btn sm ghost" data-act="unpay" data-id="' + c.id + '" data-ym="' + ym + '">Desfazer</button>'
          : '<button class="btn sm" data-act="pay" data-id="' + c.id + '" data-ym="' + ym + '">✓ Pago</button>';
        return '<tr><td>' + esc(c.nome) + '</td><td class="num">' + money(val) + '</td><td class="hide-sm">' + fmtDate(dueDate(ym, c.dia)) + '</td><td>' + sit + '</td><td class="num no-print">' + act + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>Recebido</td><td class="num">' + money(pago) + '</td><td class="hide-sm"></td><td>Em aberto: ' + money(aberto) + '</td><td class="no-print"></td></tr></tfoot></table>' +
      '<div class="actions mt no-print"><button class="btn" data-act="print">Imprimir ou salvar PDF</button><button class="btn" data-act="csv">Baixar planilha (CSV)</button></div>';
    return h;
  }

  // ---------- Tela: Ajustes ----------
  function viewAjustes() {
    const s = S.settings;
    const first = !s.chave;
    const opt = (v, l, cur) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + l + '</option>';
    return (first ? '<div class="banner"><b>Bem-vindo à Mensalinha</b>Preencha seus dados uma vez. Depois é só cadastrar quem te paga e cobrar pelo WhatsApp.</div>' : '') +
      '<h1>Ajustes</h1><p class="sub">Tudo fica salvo neste aparelho.</p>' +
      '<form class="form card" id="setForm">' +
      field('nicho', 'Tipo de cobrança', '<select name="nicho">' + Object.keys(NICHOS).map((k) => opt(k, NICHOS[k].nome, s.nicho)).join('') + '</select>') +
      field('nome', 'Seu nome (aparece na mensagem e no Pix)', '<input name="nome" required value="' + esc(s.nome) + '" placeholder="Ex.: Tio Marcos Transporte">') +
      '<div class="row2">' +
      field('chaveTipo', 'Tipo de chave Pix', '<select name="chaveTipo">' + opt('telefone', 'Celular', s.chaveTipo) + opt('cpf', 'CPF', s.chaveTipo) + opt('cnpj', 'CNPJ', s.chaveTipo) + opt('email', 'E-mail', s.chaveTipo) + opt('aleatoria', 'Chave aleatória', s.chaveTipo) + '</select>') +
      field('chave', 'Chave Pix', '<input name="chave" required value="' + esc(s.chave) + '" autocomplete="off">') +
      '</div>' +
      field('cidade', 'Sua cidade', '<input name="cidade" required value="' + esc(s.cidade) + '" placeholder="Ex.: Campinas">', 'Exigida pelo padrão do Pix.') +
      field('diasAntes', 'Mostrar na lista de cobrança quantos dias antes do vencimento', '<input name="diasAntes" type="number" min="0" max="15" value="' + esc(s.diasAntes) + '">') +
      '<div class="row2">' +
      field('multa', 'Multa por atraso (%)', '<input name="multa" type="number" min="0" max="20" step="0.1" value="' + esc(s.multa) + '">', 'Em serviços, o usual é até 2%. Em aluguel, vale o contrato.') +
      field('juros', 'Juros ao mês (%)', '<input name="juros" type="number" min="0" max="10" step="0.1" value="' + esc(s.juros) + '">', 'Calculados por dia de atraso.') +
      '</div>' +
      '<div class="field"><label>Meses sem cobrança (ex.: férias)</label><div class="months">' +
      MESES_CURTOS.map((m, i) => '<label><input type="checkbox" name="mesesSem" value="' + (i + 1) + '"' + (s.mesesSem.includes(i + 1) ? ' checked' : '') + '>' + m + '</label>').join('') +
      '</div></div>' +
      '<details><summary class="small" style="cursor:pointer;font-weight:600">Editar textos das mensagens</summary>' +
      '<p class="small muted">Use {nome}, {contato}, {servico}, {mes}, {valor}, {vencimento}, {pix}, {prestador}, {detalhe} (atraso) e {pagoem} (recibo).</p>' +
      field('m_lembrete', 'Lembrete antes do vencimento', '<textarea name="m_lembrete">' + esc(s.modelos.lembrete) + '</textarea>') +
      field('m_atraso', 'Cobrança em atraso', '<textarea name="m_atraso">' + esc(s.modelos.atraso) + '</textarea>') +
      field('m_recibo', 'Recibo', '<textarea name="m_recibo">' + esc(s.modelos.recibo) + '</textarea>') +
      '<button class="btn sm" type="button" data-act="resetmsgs">Voltar aos textos padrão</button></details>' +
      '<button class="btn primary block" type="submit">Salvar ajustes</button>' +
      '</form>' +
      '<h2>Backup</h2><div class="card"><p class="small muted" style="margin-top:0">Os dados ficam só neste navegador. Baixe um backup de vez em quando, e use-o para passar tudo para outro aparelho.</p>' +
      '<div class="actions"><button class="btn" data-act="export">Baixar backup</button>' +
      '<label class="btn">Restaurar backup<input type="file" accept="application/json,.json" id="importFile" hidden></label>' +
      '<button class="btn danger" data-act="wipe">Apagar tudo</button></div></div>';
  }

  function bindAjustes() {
    $('#setForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const s = S.settings;
      const nichoChanged = f.get('nicho') !== s.nicho;
      s.nicho = f.get('nicho');
      s.nome = String(f.get('nome')).trim();
      s.chaveTipo = f.get('chaveTipo');
      s.chave = String(f.get('chave')).trim();
      s.cidade = String(f.get('cidade')).trim();
      s.diasAntes = Math.max(0, Number(f.get('diasAntes')) || 0);
      s.multa = Math.max(0, Number(f.get('multa')) || 0);
      s.juros = Math.max(0, Number(f.get('juros')) || 0);
      s.mesesSem = f.getAll('mesesSem').map(Number);
      s.modelos = { lembrete: f.get('m_lembrete'), atraso: f.get('m_atraso'), recibo: f.get('m_recibo') };
      save();
      toast(nichoChanged ? 'Ajustes salvos. Tipo de cobrança: ' + N().nome + '.' : 'Ajustes salvos.');
      go(S.clientes.length ? 'hoje' : 'clientes');
    });
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      file.text().then((txt) => {
        const data = JSON.parse(txt);
        if (!data || !data.settings || !Array.isArray(data.clientes)) throw new Error('formato');
        localStorage.setItem(KEY, JSON.stringify(data));
        S = load();
        toast('Backup restaurado: ' + S.clientes.length + ' cadastros.');
        go('hoje');
      }).catch(() => toast('Esse arquivo não parece um backup da Mensalinha.'));
    });
  }

  // ---------- Modal e toast ----------
  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
    const first = $('#modalBody input, #modalBody button');
    if (first && first.tagName === 'INPUT') first.focus();
  }
  function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }
  $('#modalClose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  let toastTimer;
  function toast(msg, action) {
    const t = $('#toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button>' + esc(action.label) + '</button>' : '');
    t.hidden = false;
    if (action) t.querySelector('button').onclick = () => { t.hidden = true; action.run(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, action ? 7000 : 3200);
  }

  function qrModal(c, ym) {
    const info = statusOf(c, ym);
    const { total } = amountFor(c, info);
    const code = pixFor(c, ym, total);
    if (!code) { toast('Cadastre sua chave Pix em Ajustes primeiro.'); return; }
    const qr = qrcode(0, 'M');
    qr.addData(code);
    qr.make();
    openModal('<h2>Pix de ' + esc(c.nome) + '</h2><p class="sub">' + monthLabel(ym) + ' · ' + money(total) + '</p>' +
      '<div class="qr">' + qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) + '</div>' +
      '<p class="small muted">Mostre o QR na tela ou copie o código.</p><div class="code" id="pixCode">' + esc(code) + '</div>' +
      '<div class="actions mt"><button class="btn primary" data-act="copy">Copiar código</button></div>');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((res, rej) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } finally { ta.remove(); }
    });
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function payAndOfferReceipt(c, ym) {
    const info = statusOf(c, ym);
    markPaid(c.id, ym, amountFor(c, info).total);
    render();
    toast(c.nome + ': ' + monthShort(ym) + ' marcado como pago.', c.telefone ? {
      label: 'Enviar recibo', run: () => window.open(waLink(c, receiptFor(c, ym)), '_blank', 'noopener'),
    } : null);
  }

  // ---------- Exemplo ----------
  function loadDemo() {
    const n = S.settings.nicho;
    const cur = ymOf(today());
    const prev = addMonths(cur, -1);
    const t = today().getDate();
    const sets = {
      aulas: [['Ana Beatriz', 'Carla (mãe)', 'Inglês · seg e qua 18h', 280], ['Pedro Henrique', '', 'Violão · sáb 10h', 220], ['Júlia Martins', 'Roberto (pai)', 'Inglês · ter e qui 17h', 280], ['Lucas Andrade', '', 'Conversação · sex 19h', 190]],
      van: [['Maria Eduarda', 'Fernanda', 'EMEF Jardim · manhã', 380], ['Davi Souza', 'Paulo', 'Colégio Objetivo · tarde', 420], ['Helena Costa', 'Patrícia', 'EMEF Jardim · manhã', 340], ['Arthur Lima', 'Renata', 'Colégio Objetivo · tarde', 420]],
      aluguel: [['João Pereira', '', 'Kitnet 1', 850], ['Larissa Gomes', '', 'Kitnet 2', 850], ['Marcos Vinícius', '', 'Casa dos fundos', 1300], ['Bianca Rocha', '', 'Kitnet 3', 900]],
    }[n];
    const days = [Math.max(1, t - 6), t, Math.min(28, t + 2), Math.min(28, t + 12)];
    sets.forEach((x, i) => {
      const id = uid();
      S.clientes.push({ id, nome: x[0], contato: x[1], telefone: '1999999' + String(1000 + i), valor: x[3], dia: days[i], inicio: prev, extra: x[2], obs: 'exemplo', ativo: true });
      markPaid(id, prev, x[3]);
    });
    if (!S.settings.nome) S.settings.nome = 'Seu Nome';
    if (!S.settings.chave) { S.settings.chaveTipo = 'email'; S.settings.chave = 'voce@exemplo.com'; }
    if (!S.settings.cidade) S.settings.cidade = 'Campinas';
    save();
    toast('Exemplo carregado. Troque nome e chave Pix em Ajustes antes de usar de verdade.');
    go('hoje');
  }

  // ---------- Ações ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const c = el.dataset.id ? byId(el.dataset.id) : null;
    const ym = el.dataset.ym;
    switch (act) {
      case 'goto': go(el.dataset.tab); break;
      case 'new': openModal(clientForm(null)); break;
      case 'edit': openModal(clientForm(c)); break;
      case 'demo': loadDemo(); break;
      case 'wa': {
        const info = statusOf(c, ym);
        if (!c.telefone) toast('Sem WhatsApp cadastrado. Escolha o contato no WhatsApp.');
        logReminder(c.id, ym);
        window.open(waLink(c, messageFor(c, ym, info)), '_blank', 'noopener');
        render();
        break;
      }
      case 'qr': qrModal(c, ym); break;
      case 'copy':
        copyText($('#pixCode').textContent).then(() => toast('Código Pix copiado.'), () => toast('Não deu pra copiar. Selecione o código e copie.'));
        break;
      case 'pay': payAndOfferReceipt(c, ym); break;
      case 'unpay': unmarkPaid(c.id, ym); render(); toast('Pagamento desfeito.'); break;
      case 'receipt': window.open(waLink(c, receiptFor(c, ym)), '_blank', 'noopener'); break;
      case 'month': viewMonth = addMonths(viewMonth, Number(el.dataset.k)); render(); break;
      case 'print': window.print(); break;
      case 'csv': {
        const rows = [['Nome', 'Contato', 'Telefone', 'Mês', 'Vencimento', 'Valor', 'Situação', 'Pago em']];
        S.clientes.forEach((cl) => {
          const info = statusOf(cl, viewMonth);
          if (info.st === 'isento') return;
          rows.push([cl.nome, cl.contato, cl.telefone, viewMonth, isoDate(dueDate(viewMonth, cl.dia)),
            String(info.st === 'pago' ? info.pago.valor : cl.valor).replace('.', ','), chipText(info), info.st === 'pago' ? info.pago.em : '']);
        });
        const csv = rows.map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
        download('mensalinha-' + viewMonth + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
        break;
      }
      case 'export':
        download('mensalinha-backup-' + isoDate(today()) + '.json', JSON.stringify(S, null, 2), 'application/json');
        break;
      case 'resetmsgs':
        ['lembrete', 'atraso', 'recibo'].forEach((k) => { $('textarea[name="m_' + k + '"]').value = MODELOS[k]; });
        toast('Textos padrão restaurados. Clique em Salvar ajustes.');
        break;
      case 'wipe':
      case 'del':
        if (!el.classList.contains('armed')) {
          el.classList.add('armed');
          el.dataset.label = el.textContent;
          el.textContent = act === 'wipe' ? 'Toque de novo para apagar tudo' : 'Toque de novo para excluir';
          setTimeout(() => { el.classList.remove('armed'); el.textContent = el.dataset.label; }, 4000);
          break;
        }
        if (act === 'wipe') {
          const nicho = S.settings.nicho;
          S = blankState(nicho); save(); toast('Tudo apagado.'); go('ajustes');
        } else {
          S.clientes = S.clientes.filter((x) => x.id !== c.id);
          Object.values(S.pagamentos).forEach((m) => { delete m[c.id]; });
          save(); closeModal(); render(); toast('Cadastro excluído.');
        }
        break;
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'clientForm') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const id = e.target.dataset.id;
    const data = {
      nome: String(f.get('nome')).trim(), contato: String(f.get('contato')).trim(), telefone: String(f.get('telefone')).trim(),
      valor: round2(Number(f.get('valor')) || 0), dia: Math.min(31, Math.max(1, Number(f.get('dia')) || 1)),
      inicio: f.get('inicio') || ymOf(today()), extra: String(f.get('extra')).trim(), obs: String(f.get('obs')).trim(), ativo: f.get('ativo') === 'on',
    };
    if (id) Object.assign(byId(id), data);
    else S.clientes.push(Object.assign({ id: uid() }, data));
    save(); closeModal(); render();
    toast(id ? 'Cadastro atualizado.' : data.nome + ' cadastrado.');
  });

  // ---------- Início ----------
  const qsNicho = new URLSearchParams(location.search).get('nicho');
  if (qsNicho && NICHOS[qsNicho] && !S.clientes.length && !S.settings.chave) {
    S.settings.nicho = qsNicho; S.settings.multa = NICHOS[qsNicho].multa; S.settings.juros = NICHOS[qsNicho].juros;
  }
  go(S.settings.chave ? 'hoje' : 'ajustes');
})();
