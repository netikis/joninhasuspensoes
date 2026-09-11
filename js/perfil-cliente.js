'use strict';
/* Joninha — perfil do cliente (histórico, carros e notas) */

var _perfilClienteIdAtual = null;
var _perfilClienteAbaAtual = 'os';

function _pertenceCliente(c, doc) {
    if (!c || !doc) return false;
    if (doc.clienteId && c.id && String(doc.clienteId) === String(c.id)) return true;
    var nDoc = String(doc.clienteNome || '').trim().toLowerCase();
    var nCli = String(c.nome || '').trim().toLowerCase();
    return !!(nDoc && nCli && nDoc === nCli);
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

function abrirPerfilCliente(id) {
    var db = carregar();
    var c = (db.clientes || []).find(function (x) { return String(x.id) === String(id); });
    if (!c) { toast('Cliente não encontrado.'); return; }
    _perfilClienteIdAtual = String(c.id);
    _perfilClienteAbaAtual = 'os';
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
    var abertos = oss.filter(function (a) { return typeof atendimentoEmAberto === 'function' ? atendimentoEmAberto(a) : true; }).length;
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
                '<p class="perfil-cli-meta">' +
                    esc(doc) +
                    (c.telefone ? ' · ' + esc(c.telefone) : '') +
                    (end ? '<br><span class="perfil-cli-end">' + esc(end) + '</span>' : '') +
                '</p>' +
            '</div>' +
            '<div class="perfil-cli-btns-top">' +
                '<button type="button" class="btn btn-ok" data-pf="novo-at">+ Novo atendimento</button>' +
                '<button type="button" class="btn btn-secondary" data-pf="edit-cli">Editar cadastro</button>' +
            '</div>' +
        '</div>';

    kpis.innerHTML =
        '<div class="perfil-kpi"><span>Em aberto</span><strong>' + esc(String(abertos)) + '</strong></div>' +
        '<div class="perfil-kpi"><span>O.S. / histórico</span><strong>' + esc(String(oss.length)) + '</strong></div>' +
        '<div class="perfil-kpi"><span>Carros</span><strong>' + esc(String(carros.length)) + '</strong></div>' +
        '<div class="perfil-kpi"><span>Vendas</span><strong>' + esc(String(vendas.length)) + '</strong></div>';

    var aba = _perfilClienteAbaAtual || 'os';
    var tabs = [
        { id: 'os', label: 'Histórico O.S. (' + oss.length + ')' },
        { id: 'carros', label: 'Carros (' + carros.length + ')' },
        { id: 'vendas', label: 'Vendas (' + vendas.length + ')' },
        { id: 'orcamentos', label: 'Orçamentos (' + orcs.length + ')' }
    ];
    var tabsHtml = '<div class="perfil-tabs">';
    tabs.forEach(function (t) {
        tabsHtml += '<button type="button" class="perfil-tab' + (aba === t.id ? ' ativo' : '') + '" data-pf="tab" data-aba="' + t.id + '">' + esc(t.label) + '</button>';
    });
    tabsHtml += '</div><div class="perfil-tab-painel">';
    if (aba === 'os') tabsHtml += _htmlPerfilOs(oss);
    else if (aba === 'carros') tabsHtml += _htmlPerfilCarros(carros);
    else if (aba === 'vendas') tabsHtml += _htmlPerfilVendas(vendas, false);
    else tabsHtml += _htmlPerfilVendas(orcs, true);
    tabsHtml += '</div>';
    cont.innerHTML = tabsHtml;
}

function _htmlPerfilOs(lista) {
    if (!lista.length) {
        return '<p class="perfil-vazio">Nenhuma ordem de serviço neste cliente. Use <strong>+ Novo atendimento</strong> para abrir a OS.</p>';
    }
    var h = '<table class="perfil-tabela"><thead><tr><th>Data</th><th>Carro</th><th>Placa</th><th>O que foi feito</th><th>Status</th><th>Total</th><th>Ações</th></tr></thead><tbody>';
    lista.forEach(function (a) {
        var pago = String(a.statusPagamento || '').toUpperCase() === 'PAGO';
        h += '<tr>' +
            '<td>' + esc(fmtData(_dataOs(a)) || '—') + '</td>' +
            '<td>' + esc(a.carro || '—') + '</td>' +
            '<td>' + esc((a.placa || '—').toUpperCase()) + '</td>' +
            '<td class="perfil-feito">' + esc(_resumoFeitoOs(a)) + '</td>' +
            '<td><span class="perfil-badge ' + (pago ? 'perfil-badge-ok' : 'perfil-badge-warn') + '">' +
            esc(a.status || '—') + (pago ? ' · PAGO' : '') + '</span></td>' +
            '<td>' + moeda(a.total) + '</td>' +
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
        return '<p class="perfil-vazio">Nenhuma ' + (ehOrc ? 'orçamento' : 'venda') + ' neste cliente.</p>';
    }
    var h = '<table class="perfil-tabela"><thead><tr><th>Nº</th><th>Data</th><th>Total</th><th>Pagamento</th><th>Ações</th></tr></thead><tbody>';
    lista.forEach(function (o) {
        var pago = String(o.statusPagamento || '').toUpperCase() === 'PAGO';
        h += '<tr>' +
            '<td>' + esc(o.numero || '—') + '</td>' +
            '<td>' + esc(fmtData(o.dataEmissao || o.criadoEm) || '—') + '</td>' +
            '<td>' + moeda(o.valor || o.total || 0) + '</td>' +
            '<td><span class="perfil-badge ' + (pago ? 'perfil-badge-ok' : 'perfil-badge-warn') + '">' +
            esc(pago ? 'PAGO' : (o.statusPagamento || '—')) + '</span></td>' +
            '<td><div class="perfil-acoes-linha">' +
                '<button type="button" class="btn btn-ver" data-pf="venda" data-id="' + esc(o.id) + '">Ver nota</button>' +
                '<button type="button" class="btn btn-secondary" data-pf="edit-vd" data-id="' + esc(o.id) + '">Editar</button>' +
            '</div></td></tr>';
    });
    return h + '</tbody></table>';
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
            _trocarAbaPerfilCliente(btn.getAttribute('data-aba') || 'os');
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
        if (acao === 'venda' && id && typeof abrirDocumentoVenda === 'function') {
            abrirDocumentoVenda(id);
            return;
        }
        if (acao === 'edit-vd' && id && typeof editarDocumentoVenda === 'function') {
            fecharPerfilCliente();
            editarDocumentoVenda(id);
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
