'use strict';
/* Joninha — perfil do cliente (visual ERP PDV: KPIs, boletos, contas, vendas, orçamentos) */

var _perfilClienteIdAtual = null;
var _perfilClienteAbaAtual = 'boletos';

function _pertenceCliente(c, doc) {
    if (!c || !doc) return false;
    if (doc.clienteId && c.id && String(doc.clienteId) === String(c.id)) return true;
    var nDoc = String(doc.clienteNome || doc.cliente || '').trim().toLowerCase();
    var nCli = String(c.nome || '').trim().toLowerCase();
    var ape = typeof apelidoCliente === 'function' ? apelidoCliente(c).toLowerCase() : String(c.apelido || '').trim().toLowerCase();
    if (nDoc && nCli && nDoc === nCli) return true;
    return !!(nDoc && ape && nDoc === ape);
}

function _resumoFeitoOs(a) {
    var parts = [];
    if (a && a.servicos) parts.push(String(a.servicos).trim());
    (a && a.itens ? a.itens : []).forEach(function (it) {
        if (it && it.desc) parts.push(String(it.desc).trim());
    });
    var t = parts.filter(Boolean).join(' · ');
    if (!t) return '—';
    return t.length > 140 ? t.slice(0, 137) + '…' : t;
}

function _dataOs(a) {
    return (a && (a.entrada || a.criadoEm || a.agendadoPara)) || '';
}

function _coletarOsCliente(db, c) {
    return (db.atendimentos || []).filter(function (a) {
        return _pertenceCliente(c, a);
    }).sort(function (a, b) {
        return String(_dataOs(b)).localeCompare(String(_dataOs(a)));
    });
}

function _coletarVendasCliente(db, c, tipo) {
    var tWant = String(tipo || '').toUpperCase();
    return (db.orcamentos || []).filter(function (o) {
        if (!_pertenceCliente(c, o)) return false;
        var t = String(o.tipo || 'VENDA').toUpperCase();
        if (tWant === 'ORCAMENTO') return t === 'ORCAMENTO';
        return t === 'VENDA' || t === 'VD';
    }).sort(function (a, b) {
        return String(b.dataEmissao || b.criadoEm || '').localeCompare(String(a.dataEmissao || a.criadoEm || ''));
    });
}

function _carrosDoCliente(oss) {
    var map = {};
    (oss || []).forEach(function (a) {
        var placa = String(a.placa || '').toUpperCase().trim();
        var carro = String(a.carro || '').trim();
        var key = placa || carro.toLowerCase() || String(a.id);
        if (!map[key]) {
            map[key] = { placa: placa || '—', carro: carro || '—', cor: a.cor || '', qtd: 0, ultimo: a };
        }
        map[key].qtd += 1;
        if (carro) map[key].carro = carro;
        if (a.cor) map[key].cor = a.cor;
        if (String(_dataOs(a)).localeCompare(String(_dataOs(map[key].ultimo))) > 0) map[key].ultimo = a;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
        return String(_dataOs(b.ultimo)).localeCompare(String(_dataOs(a.ultimo)));
    });
}

function _formaEhBoleto(doc) {
    if (String(doc.formaPagamento || doc.formaPrevista || '').toLowerCase().indexOf('boleto') >= 0) return true;
    if (doc.ehBoleto) return true;
    return (doc.recebimentos || []).some(function (r) {
        return String(r.forma || '').toLowerCase().indexOf('boleto') >= 0;
    });
}

function _valorAbertoDoc(o) {
    if (!o) return 0;
    var st = String(o.statusPagamento || o.status || 'PAGO').toUpperCase();
    if (st === 'PAGO') return 0;
    var total = Number(o.valor != null ? o.valor : o.total) || 0;
    var rec = Number(o.valorRecebido) || 0;
    if (o.saldoAberto != null && !isNaN(Number(o.saldoAberto))) return Math.max(0, Number(o.saldoAberto));
    return Math.max(0, +(total - rec).toFixed(2));
}

function _diasAtrasoISO(venc) {
    if (!venc) return 0;
    var d = new Date(String(venc).slice(0, 10) + 'T12:00:00');
    if (isNaN(d.getTime())) return 0;
    var hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    return Math.floor((hoje.getTime() - d.getTime()) / 86400000);
}

function _statusAbertoLinha(venc, aberto) {
    if (!(aberto > 0.009)) return { label: 'Pago', cls: 'perfil-badge-ok' };
    var atraso = _diasAtrasoISO(venc);
    if (atraso >= 30) return { label: '30+ dias vencido', cls: 'perfil-badge-danger' };
    if (atraso > 0) return { label: 'Vencido', cls: 'perfil-badge-danger' };
    if (atraso === 0 && venc) return { label: 'Vence hoje', cls: 'perfil-badge-warn' };
    return { label: 'Em aberto', cls: 'perfil-badge-warn' };
}

function _textoRecebimentos(o) {
    var recs = o && o.recebimentos ? o.recebimentos : [];
    if (!recs.length && Number(o && o.valorRecebido) > 0) {
        return (o.formaPagamento || 'Recebido') + ' ' + moeda(o.valorRecebido);
    }
    return recs.map(function (r) { return (r.forma || '—') + ' ' + moeda(r.valor); }).join(' · ');
}

function _coletarContasCliente(db, c) {
    var contas = [];
    var idsDoc = {};
    (db.orcamentos || []).forEach(function (o) {
        if (!_pertenceCliente(c, o)) return;
        var aberto = _valorAbertoDoc(o);
        if (aberto < 0.01) return;
        idsDoc[String(o.id)] = true;
        contas.push({
            kind: 'doc',
            id: o.id,
            tipo: o.tipo || 'VENDA',
            numero: o.numero,
            emissao: o.dataEmissao || o.criadoEm,
            vencimento: o.dataVencimento,
            forma: o.formaPagamento,
            aberto: aberto,
            recebido: Number(o.valorRecebido) || 0,
            recebimentos: o.recebimentos || [],
            status: o.statusPagamento,
            ehBoleto: _formaEhBoleto(o),
            doc: o
        });
    });
    var idsOs = {};
    (db.atendimentos || []).forEach(function (a) {
        if (!_pertenceCliente(c, a)) return;
        var st = String(a.statusPagamento || '').toUpperCase();
        if (st === 'PAGO') return;
        if (st !== 'PARCIAL' && st !== 'PENDENTE' && !(Number(a.saldoAberto) > 0.009)) return;
        var aberto = _valorAbertoDoc(a);
        if (aberto < 0.01) return;
        idsOs[String(a.id)] = true;
        contas.push({
            kind: 'os',
            id: a.id,
            tipo: 'O.S.',
            numero: a.numero || a.id,
            emissao: _dataOs(a),
            vencimento: a.dataVencimento || a.entrada,
            forma: a.formaPagamento || '',
            aberto: aberto,
            recebido: Number(a.valorRecebido) || 0,
            recebimentos: a.recebimentos || [],
            status: a.statusPagamento || a.status || 'PENDENTE',
            ehBoleto: _formaEhBoleto(a),
            doc: a
        });
    });
    (db.pendentes || []).forEach(function (p) {
        if (p.status === 'pago') return;
        if (p.vendaId && idsDoc[String(p.vendaId)]) return;
        if (p.atendimentoId && idsOs[String(p.atendimentoId)]) return;
        if (!_pertenceCliente(c, p) && String(p.cliente || '').trim().toLowerCase() !== String(c.nome || '').trim().toLowerCase()) return;
        contas.push({
            kind: 'pendente',
            id: p.id,
            tipo: 'Conta',
            numero: '',
            emissao: p.criadoEm,
            vencimento: p.vencimento,
            forma: p.formaPrevista || '',
            aberto: Number(p.valor) || 0,
            recebido: 0,
            recebimentos: [],
            status: 'PENDENTE',
            ehBoleto: _formaEhBoleto(p),
            vendaId: p.vendaId,
            doc: p
        });
    });
    return contas.sort(function (a, b) {
        return String(b.emissao || '').localeCompare(String(a.emissao || ''));
    });
}

function abrirPerfilCliente(id) {
    var db = carregar();
    var c = (db.clientes || []).find(function (x) { return String(x.id) === String(id); });
    if (!c) { toast('Cliente não encontrado.'); return; }
    _perfilClienteIdAtual = String(c.id);
    _perfilClienteAbaAtual = 'boletos';
    renderizarPerfilCliente(c, db);
    var m = document.getElementById('modalPerfilCliente');
    if (m) m.classList.add('aberto');
}

function fecharPerfilCliente() {
    var m = document.getElementById('modalPerfilCliente');
    if (m) m.classList.remove('aberto');
    _perfilClienteIdAtual = null;
}

function _trocarAbaPerfilCliente(aba) {
    _perfilClienteAbaAtual = aba;
    var db = carregar();
    var c = (db.clientes || []).find(function (x) { return String(x.id) === String(_perfilClienteIdAtual); });
    if (c) renderizarPerfilCliente(c, db);
}

function renderizarPerfilCliente(c, db) {
    db = db || carregar();
    var oss = _coletarOsCliente(db, c);
    var vendas = _coletarVendasCliente(db, c, 'VENDA');
    var orcs = _coletarVendasCliente(db, c, 'ORCAMENTO');
    var carros = _carrosDoCliente(oss);
    var contas = _coletarContasCliente(db, c);
    var boletos = contas.filter(function (x) { return x.ehBoleto; });
    var contasSemBoleto = contas.filter(function (x) { return !x.ehBoleto; });
    var totalAberto = contas.reduce(function (s, x) { return s + (Number(x.aberto) || 0); }, 0);
    var vendasOsQtd = vendas.length + oss.length;
    var alerta30 = contas.filter(function (x) { return _diasAtrasoISO(x.vencimento) >= 30 && x.aberto > 0.009; });
    var doc = c.cpf ? c.cpf : (c.cnpj || '—');
    var end = [c.endereco, c.numero, c.cidade].filter(Boolean).join(' — ');

    var cab = document.getElementById('perfilCliCabecalho');
    var kpis = document.getElementById('perfilCliKpis');
    var cont = document.getElementById('perfilCliConteudo');
    if (!cab || !kpis || !cont) return;

    cab.innerHTML =
        '<div class="perfil-cli-top">' +
            '<div>' +
                '<h2 class="perfil-cli-nome">' + esc(c.nome || 'Cliente') + '</h2>' +
                (apelidoCliente(c)
                    ? '<p class="perfil-cli-apelido" style="margin:2px 0 0;font-weight:700;opacity:.9">Apelido: ' + esc(apelidoCliente(c)) + '</p>'
                    : '') +
                '<p class="perfil-cli-meta">' +
                    '<span>' + esc(doc) + '</span>' +
                    (c.telefone ? ' · <span>' + esc(c.telefone) + '</span>' : '') +
                    (end ? '<br><span class="perfil-cli-end">' + esc(end) + '</span>' : '') +
                '</p>' +
            '</div>' +
            '<div class="perfil-cli-btns-top">' +
                '<button type="button" class="btn btn-ok" data-pf="nova-venda">+ Nova venda</button>' +
                '<button type="button" class="btn btn-secondary" data-pf="edit-cli">Editar cadastro</button>' +
            '</div>' +
        '</div>' +
        (alerta30.length
            ? '<div class="perfil-alerta-30">Alerta: ' + alerta30.length + ' conta(s)/boleto(s) com mais de 30 dias vencidos (' +
              moeda(alerta30.reduce(function (s, x) { return s + x.aberto; }, 0)) + ').</div>'
            : '');

    kpis.innerHTML =
        '<div class="perfil-kpi"><span>Em aberto</span><strong>' + moeda(totalAberto) + '</strong></div>' +
        '<div class="perfil-kpi"><span>Boletos abertos</span><strong>' + esc(String(boletos.length)) + '</strong></div>' +
        '<div class="perfil-kpi"><span>Vendas / O.S.</span><strong>' + esc(String(vendasOsQtd)) + '</strong></div>' +
        '<div class="perfil-kpi"><span>Orçamentos</span><strong>' + esc(String(orcs.length)) + '</strong></div>';

    var aba = _perfilClienteAbaAtual || 'boletos';
    var tabs = [
        { id: 'boletos', label: 'Boletos (' + boletos.length + ')' },
        { id: 'contas', label: 'Contas (' + contasSemBoleto.length + ')' },
        { id: 'vendas', label: 'Vendas (' + vendasOsQtd + ')' },
        { id: 'orcamentos', label: 'Orçamentos (' + orcs.length + ')' },
        { id: 'nfe', label: 'NF-e' },
        { id: 'carros', label: 'Carros (' + carros.length + ')' }
    ];
    var tabsHtml = '<div class="perfil-tabs">';
    tabs.forEach(function (t) {
        tabsHtml += '<button type="button" class="perfil-tab' + (aba === t.id ? ' ativo' : '') + '" data-pf="tab" data-aba="' + t.id + '">' + esc(t.label) + '</button>';
    });
    tabsHtml += '</div><div class="perfil-tab-painel">';
    if (aba === 'boletos') tabsHtml += _htmlPerfilBoletos(boletos);
    else if (aba === 'contas') tabsHtml += _htmlPerfilContas(contasSemBoleto);
    else if (aba === 'vendas') tabsHtml += _htmlPerfilVendasMistas(vendas, oss);
    else if (aba === 'orcamentos') tabsHtml += _htmlPerfilVendas(orcs, true);
    else if (aba === 'nfe') tabsHtml += '<p class="perfil-vazio">NF-e ainda não está habilitada neste sistema.</p>';
    else tabsHtml += _htmlPerfilCarros(carros);
    tabsHtml += '</div>';
    cont.innerHTML = tabsHtml;
}

function _acoesDocPerfil(item) {
    var h = '<div class="perfil-acoes-linha">';
    if (item.kind === 'os') {
        h += '<button type="button" class="btn btn-ver" data-pf="nota" data-id="' + esc(item.id) + '">Ver</button>';
        h += '<button type="button" class="btn btn-ok" data-pf="receber-os" data-id="' + esc(item.id) + '">Receber</button>';
        h += '<button type="button" class="btn btn-secondary" data-pf="edit-os" data-id="' + esc(item.id) + '">Editar</button>';
    } else if (item.kind === 'pendente') {
        if (item.vendaId) {
            h += '<button type="button" class="btn btn-ver" data-pf="venda" data-id="' + esc(item.vendaId) + '">Ver</button>';
            h += '<button type="button" class="btn btn-ok" data-pf="receber-vd" data-id="' + esc(item.vendaId) + '">Receber</button>';
        }
    } else {
        h += '<button type="button" class="btn btn-ver" data-pf="venda" data-id="' + esc(item.id) + '">Ver</button>';
        h += '<button type="button" class="btn btn-ok" data-pf="receber-vd" data-id="' + esc(item.id) + '">Receber</button>';
        h += '<button type="button" class="btn btn-secondary" data-pf="edit-vd" data-id="' + esc(item.id) + '">Editar</button>';
    }
    h += '</div>';
    return h;
}

function _htmlPerfilBoletos(lista) {
    if (!lista.length) {
        return '<p class="perfil-vazio">Nenhum boleto vinculado a este cliente. Na venda, escolha forma <strong>Boleto</strong>, status <strong>PENDENTE</strong> ou <strong>PARCIAL</strong>.</p>';
    }
    var h = '<table class="perfil-tabela"><thead><tr><th>Doc</th><th>Vencimento</th><th>Em aberto</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
    lista.forEach(function (item) {
        var st = _statusAbertoLinha(item.vencimento, item.aberto);
        h += '<tr>' +
            '<td>' + esc(item.tipo) + (item.numero ? ' Nº ' + esc(String(item.numero)) : '') + '</td>' +
            '<td>' + esc(fmtData(item.vencimento) || '—') + '</td>' +
            '<td><strong>' + moeda(item.aberto) + '</strong></td>' +
            '<td><span class="perfil-badge ' + st.cls + '">' + esc(st.label) + '</span></td>' +
            '<td>' + _acoesDocPerfil(item) + '</td></tr>';
    });
    return h + '</tbody></table>';
}

function _htmlPerfilContas(lista) {
    if (!lista.length) {
        return '<p class="perfil-vazio">Nenhuma conta em aberto para este cliente. Recebimento parcial fica aqui até quitar.</p>';
    }
    var h = '<table class="perfil-tabela"><thead><tr><th>Doc</th><th>Emissão</th><th>Vencimento</th><th>Forma / recebido</th><th>Em aberto</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
    lista.forEach(function (item) {
        var st = _statusAbertoLinha(item.vencimento, item.aberto);
        h += '<tr>' +
            '<td>' + esc(item.tipo) + (item.numero ? ' Nº ' + esc(String(item.numero)) : '') + '</td>' +
            '<td>' + esc(fmtData(item.emissao) || '—') + '</td>' +
            '<td>' + esc(fmtData(item.vencimento) || '—') + '</td>' +
            '<td>' + esc(_textoRecebimentos(item.doc) || item.forma || '—') + '</td>' +
            '<td><strong>' + moeda(item.aberto) + '</strong></td>' +
            '<td><span class="perfil-badge ' + st.cls + '">' + esc(st.label) + '</span></td>' +
            '<td>' + _acoesDocPerfil(item) + '</td></tr>';
    });
    return h + '</tbody></table>';
}

function _htmlPerfilOs(lista) {
    if (!lista.length) {
        return '<p class="perfil-vazio">Nenhuma ordem de serviço neste cliente.</p>';
    }
    var h = '<table class="perfil-tabela"><thead><tr><th>Data</th><th>Carro</th><th>Placa</th><th>O que foi feito</th><th>Status</th><th>Total</th><th>Ações</th></tr></thead><tbody>';
    lista.forEach(function (a) {
        var pago = String(a.statusPagamento || '').toUpperCase() === 'PAGO';
        var stPg = String(a.statusPagamento || '').toUpperCase();
        var stLbl = a.status || '—';
        if (pago) stLbl += ' · PAGO';
        else if (stPg === 'PARCIAL') stLbl += ' · PARCIAL';
        else if (stPg === 'PENDENTE') stLbl += ' · EM ABERTO';
        h += '<tr>' +
            '<td>' + esc(fmtData(_dataOs(a)) || '—') + '</td>' +
            '<td>' + esc(a.carro || '—') + '</td>' +
            '<td>' + esc((a.placa || '—').toUpperCase()) + '</td>' +
            '<td class="perfil-feito">' + esc(_resumoFeitoOs(a)) +
            (_textoRecebimentos(a) ? '<div class="perfil-feito">' + esc(_textoRecebimentos(a)) + '</div>' : '') + '</td>' +
            '<td><span class="perfil-badge ' + (pago ? 'perfil-badge-ok' : 'perfil-badge-warn') + '">' +
            esc(stLbl) + '</span></td>' +
            '<td>' + moeda(a.total) + (Number(a.saldoAberto) > 0.009 ? '<div class="perfil-feito">Aberto ' + moeda(a.saldoAberto) + '</div>' : '') + '</td>' +
            '<td><div class="perfil-acoes-linha">' +
                '<button type="button" class="btn btn-ver" data-pf="nota" data-id="' + esc(a.id) + '">Ver nota</button>' +
                '<button type="button" class="btn btn-secondary" data-pf="edit-os" data-id="' + esc(a.id) + '">Editar</button>' +
            '</div></td></tr>';
    });
    return h + '</tbody></table>';
}

function _htmlPerfilCarros(lista) {
    if (!lista.length) {
        return '<p class="perfil-vazio">Ainda não há carro neste cliente. O veículo entra na OS (modelo e placa) e aparece aqui.</p>';
    }
    var h = '<table class="perfil-tabela"><thead><tr><th>Placa</th><th>Carro</th><th>Cor</th><th>Visitas</th><th>Último serviço</th><th>Ações</th></tr></thead><tbody>';
    lista.forEach(function (car) {
        var u = car.ultimo || {};
        h += '<tr>' +
            '<td>' + esc(car.placa) + '</td>' +
            '<td>' + esc(car.carro) + '</td>' +
            '<td>' + esc(car.cor || '—') + '</td>' +
            '<td>' + esc(String(car.qtd)) + '</td>' +
            '<td>' + esc(fmtData(_dataOs(u)) || '—') + '<div class="perfil-feito">' + esc(_resumoFeitoOs(u)) + '</div></td>' +
            '<td><div class="perfil-acoes-linha">' +
                '<button type="button" class="btn btn-ver" data-pf="nota" data-id="' + esc(u.id) + '">Ver nota</button>' +
                '<button type="button" class="btn btn-ok" data-pf="carro-os" data-placa="' + esc(car.placa === '—' ? '' : car.placa) + '" data-carro="' + esc(car.carro === '—' ? '' : car.carro) + '">Nova OS neste carro</button>' +
            '</div></td></tr>';
    });
    return h + '</tbody></table>';
}

function _htmlPerfilVendas(lista, ehOrc) {
    if (!lista.length) {
        return '<p class="perfil-vazio">Nenhum' + (ehOrc ? ' orçamento' : 'a venda') + ' neste cliente.</p>';
    }
    var h = '<table class="perfil-tabela"><thead><tr><th>Nº</th><th>Data</th><th>Total</th><th>Recebido</th><th>Pagamento</th><th>Ações</th></tr></thead><tbody>';
    lista.forEach(function (o) {
        var st = String(o.statusPagamento || '').toUpperCase();
        var pago = st === 'PAGO';
        var recTxt = _textoRecebimentos(o);
        h += '<tr>' +
            '<td>' + esc(o.numero || '—') + '</td>' +
            '<td>' + esc(fmtData(o.dataEmissao || o.criadoEm) || '—') + '</td>' +
            '<td>' + moeda(o.valor || o.total || 0) + '</td>' +
            '<td>' + esc(recTxt || '—') + '</td>' +
            '<td><span class="perfil-badge ' + (pago ? 'perfil-badge-ok' : (st === 'PARCIAL' ? 'perfil-badge-warn' : 'perfil-badge-warn')) + '">' +
            esc(st || '—') + '</span>' +
            (_valorAbertoDoc(o) > 0.009 ? '<div class="perfil-feito">Aberto ' + moeda(_valorAbertoDoc(o)) + '</div>' : '') +
            '</td>' +
            '<td><div class="perfil-acoes-linha">' +
                '<button type="button" class="btn btn-ver" data-pf="venda" data-id="' + esc(o.id) + '">Ver nota</button>' +
                '<button type="button" class="btn btn-secondary" data-pf="edit-vd" data-id="' + esc(o.id) + '">Editar</button>' +
            '</div></td></tr>';
    });
    return h + '</tbody></table>';
}

function _htmlPerfilVendasMistas(vendas, oss) {
    if (!vendas.length && !oss.length) {
        return '<p class="perfil-vazio">Nenhuma venda ou O.S. neste cliente.</p>';
    }
    return (vendas.length ? '<h4 class="perfil-sub">Vendas</h4>' + _htmlPerfilVendas(vendas, false) : '') +
        (oss.length ? '<h4 class="perfil-sub">Ordens de serviço</h4>' + _htmlPerfilOs(oss) : '');
}

function _preencherOsComCliente(c, extra) {
    extra = extra || {};
    if (typeof fecharPerfilCliente === 'function') fecharPerfilCliente();
    abrirPainel('painelVeiculo');
    document.getElementById('atClienteId').value = c.id;
    document.getElementById('atClienteBusca').value = c.nome || '';
    if (typeof atualizarStatusClienteAt === 'function') atualizarStatusClienteAt();
    if (extra.carro != null) document.getElementById('atCarro').value = extra.carro;
    if (extra.placa != null) document.getElementById('atPlaca').value = String(extra.placa).toUpperCase();
    toast('Cliente carregado na OS.');
}

function _preencherVendaComCliente(c) {
    if (typeof fecharPerfilCliente === 'function') fecharPerfilCliente();
    canalVendas = 'normal';
    if (typeof atualizarBadgeCanal === 'function') atualizarBadgeCanal();
    if (typeof limparVendaForm === 'function') limparVendaForm();
    var inp = document.getElementById('vdCliente');
    if (inp) inp.value = c.nome || '';
    var btnPainel = document.querySelector('.nav-btn[data-panel="painelOrcamento"][data-canal="normal"]') ||
        document.querySelector('.nav-btn[data-panel="painelOrcamento"]');
    abrirPainel('painelOrcamento', btnPainel || undefined);
    toast('Cliente carregado na venda / orçamento.');
}

(function ligarPerfilCliente() {
    var modal = document.getElementById('modalPerfilCliente');
    if (!modal) return;
    var btnX = document.getElementById('btnFecharPerfilCli');
    if (btnX) btnX.addEventListener('click', fecharPerfilCliente);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) fecharPerfilCliente();
        var btn = e.target.closest('[data-pf]');
        if (!btn || !modal.contains(btn)) return;
        var acao = btn.getAttribute('data-pf');
        var id = btn.getAttribute('data-id');
        var db = carregar();
        var c = (db.clientes || []).find(function (x) { return String(x.id) === String(_perfilClienteIdAtual); });
        if (acao === 'tab') {
            _trocarAbaPerfilCliente(btn.getAttribute('data-aba') || 'boletos');
            return;
        }
        if (acao === 'nota' && id && typeof abrirNota === 'function') {
            abrirNota(id);
            return;
        }
        if (acao === 'edit-os' && id && typeof editarAtendimento === 'function') {
            fecharPerfilCliente();
            editarAtendimento(id);
            return;
        }
        if (acao === 'receber-os' && id && typeof abrirModalReceberOs === 'function') {
            abrirModalReceberOs(id);
            return;
        }
        if (acao === 'venda' && id && typeof abrirDocumentoVenda === 'function') {
            abrirDocumentoVenda(id);
            return;
        }
        if ((acao === 'edit-vd' || acao === 'receber-vd') && id && typeof editarDocumentoVenda === 'function') {
            fecharPerfilCliente();
            editarDocumentoVenda(id);
            if (acao === 'receber-vd') toast('Informe o valor recebido (pode misturar dinheiro, PIX e cartão) e salve.');
            return;
        }
        if (acao === 'nova-venda' && c) {
            _preencherVendaComCliente(c);
            return;
        }
        if (acao === 'novo-at' && c) {
            _preencherOsComCliente(c);
            return;
        }
        if (acao === 'edit-cli' && c && typeof editarCliente === 'function') {
            fecharPerfilCliente();
            editarCliente(c.id);
            return;
        }
        if (acao === 'carro-os' && c) {
            _preencherOsComCliente(c, {
                carro: btn.getAttribute('data-carro') || '',
                placa: btn.getAttribute('data-placa') || ''
            });
        }
    });
    var card = document.getElementById('atClienteCard');
    if (card && !card.getAttribute('data-pf-card')) {
        card.setAttribute('data-pf-card', '1');
        card.addEventListener('click', function () {
            var cid = document.getElementById('atClienteId') && document.getElementById('atClienteId').value;
            if (cid) abrirPerfilCliente(cid);
        });
    }
})();
