'use strict';
/* Joninha — caixa / balcão / banco / pastas / relatórios (etapa 2.2) */

/* ---------- Caixa / Relatórios (modelo FH Control) ---------- */
function getCaixaConfig(db) {
    return Object.assign({
        inicialBalcao: 0,
        inicialBanco: 0,
        basePainelEntradas: 0,
        basePainelSaidas: 0,
        atualizadoEm: '',
        osBloqueadasCaixa: {}
    }, (db && db.caixaConfig) || {});
}

function mesclarCaixaConfig(localCfg, nuvemCfg) {
    var L = getCaixaConfig({ caixaConfig: localCfg });
    var N = getCaixaConfig({ caixaConfig: nuvemCfg });
    function mergeBloqueadas(a, b) {
        var out = {};
        [a || {}, b || {}].forEach(function (map) {
            Object.keys(map).forEach(function (id) {
                var t = new Date(map[id] || 0).getTime();
                var tOut = new Date(out[id] || 0).getTime();
                if (!out[id] || t >= tOut) out[id] = map[id];
            });
        });
        return out;
    }
    if (!nuvemCfg) return L;
    if (!localCfg) return N;
    var tL = new Date(L.atualizadoEm || 0).getTime();
    var tN = new Date(N.atualizadoEm || 0).getTime();
    var base;
    if (tL && tN) base = tL >= tN ? L : N;
    else if (tL && !tN) base = L;
    else if (!tL && tN) {
        if ((Number(L.inicialBalcao) || 0) > 0 || (Number(L.inicialBanco) || 0) > 0) base = L;
        else base = N;
    } else if ((Number(L.inicialBalcao) || 0) !== (Number(N.inicialBalcao) || 0) ||
        (Number(L.inicialBanco) || 0) !== (Number(N.inicialBanco) || 0)) {
        base = {
            inicialBalcao: Math.max(Number(L.inicialBalcao) || 0, Number(N.inicialBalcao) || 0),
            inicialBanco: Math.max(Number(L.inicialBanco) || 0, Number(N.inicialBanco) || 0),
            basePainelEntradas: Number(L.basePainelEntradas) || Number(N.basePainelEntradas) || 0,
            basePainelSaidas: Number(L.basePainelSaidas) || Number(N.basePainelSaidas) || 0,
            zeradoEm: L.zeradoEm || N.zeradoEm || '',
            atualizadoEm: L.atualizadoEm || N.atualizadoEm || new Date().toISOString()
        };
    } else {
        base = L;
    }
    base.osBloqueadasCaixa = mergeBloqueadas(L.osBloqueadasCaixa, N.osBloqueadasCaixa);
    return base;
}

function salvarCaixaConfigOficial(cfg) {
    cfg = getCaixaConfig({ caixaConfig: cfg });
    cfg.atualizadoEm = new Date().toISOString();
    var db = carregarMain();
    db.caixaConfig = cfg;
    salvarMain(db);
    agendarSyncAutomatico('salvar');
    return cfg;
}

function somarLista(lista, tipo) {
    return (lista || []).filter(function (x) { return x.tipo === tipo; })
        .reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
}

function zerarPainelCaixa() {
    if (!confirm(
        '⚠️ ATENÇÃO: Zerar o painel do Caixa / Balcão?\n\n' +
        'Entradas, saídas e o caixa inicial do painel voltam para R$ 0,00.\n' +
        '(Os documentos da tabela NÃO são apagados — só o resumo numérico é limpo.)'
    )) return;
    var db = carregarMain();
    var cfg = getCaixaConfig(db);
    var lista = db.caixa || [];
    cfg.inicialBalcao = 0;
    cfg.basePainelEntradas = somarLista(lista, 'entrada');
    cfg.basePainelSaidas = somarLista(lista, 'saida');
    cfg.zeradoEm = new Date().toISOString();
    salvarCaixaConfigOficial(cfg);
    renderCaixa();
    atualizarKPIs(carregarMain());
    toast('Painel do caixa zerado.');
}

function sincronizarPainelCaixa() {
    sincronizarOficinaNoCaixaEmpresa();
    renderCaixa();
    atualizarKPIs(carregarMain());
    toast('Painel sincronizado.');
}

function editarCaixaInicial() {
    var db = carregarMain();
    var cfg = getCaixaConfig(db);
    var atual = Number(cfg.inicialBalcao) || 0;
    var v = prompt(
        'Editar caixa inicial do dia\n\n' +
        'Valor atual: ' + moeda(atual) + '\n\n' +
        'Digite o valor correto (R$):',
        String(atual).replace('.', ',')
    );
    if (v == null) return;
    var valor = parseMoeda(v);
    if (isNaN(valor) || valor < 0) {
        toast('Valor inválido.');
        return;
    }
    if (valor === atual) {
        toast('Caixa inicial permanece ' + moeda(atual) + '.');
        return;
    }
    if (!confirm(
        'Corrigir caixa inicial?\n\n' +
        'De: ' + moeda(atual) + '\n' +
        'Para: ' + moeda(valor)
    )) return;
    cfg.inicialBalcao = valor;
    salvarCaixaConfigOficial(cfg);
    toast('Caixa inicial corrigido: ' + moeda(valor));
    renderCaixa();
    atualizarKPIs(carregarMain());
}

document.getElementById('btnCxInicial').addEventListener('click', editarCaixaInicial);
var cardCxIni = document.getElementById('cardCxInicial');
if (cardCxIni) cardCxIni.addEventListener('click', editarCaixaInicial);

function lancarBalcaoRapido(tipo) {
    var titulo = tipo === 'saida' ? 'Lançar DESPESA no balcão' : 'Lançar ENTRADA no balcão';
    var desc = prompt(titulo + '\n\nDescrição / Cliente:', '');
    if (desc == null) return;
    desc = String(desc).trim();
    if (!desc) { toast('Informe a descrição.'); return; }
    var vStr = prompt('Valor (R$):', '0,00');
    if (vStr == null) return;
    var valor = parseMoeda(vStr);
    if (!(valor > 0)) { toast('Informe um valor válido.'); return; }
    var forma = prompt('Forma (Dinheiro, PIX, Cartão, Transferência):', 'Dinheiro');
    if (forma == null) return;
    forma = String(forma).trim() || 'Dinheiro';
    var db = carregarMain();
    if (!db.caixa) db.caixa = [];
    db.caixa.push({
        id: uid(),
        tipo: tipo === 'saida' ? 'saida' : 'entrada',
        descricao: desc,
        valor: valor,
        forma: forma,
        conta: 'balcao',
        criadoEm: new Date().toISOString()
    });
    salvarMain(db);
    agendarSyncAutomatico('salvar');
    toast(tipo === 'saida' ? 'Despesa lançada no balcão.' : 'Entrada lançada no balcão.');
    renderCaixa();
    atualizarKPIs(db);
}

document.getElementById('btnCxFocoEntrada').addEventListener('click', function () {
    lancarBalcaoRapido('entrada');
});

document.getElementById('btnCxFocoDespesa').addEventListener('click', function () {
    lancarBalcaoRapido('saida');
});

document.getElementById('btnZerarCaixa').addEventListener('click', zerarPainelCaixa);
document.getElementById('btnSincronizarPainelCaixa').addEventListener('click', sincronizarPainelCaixa);

function bloquearOsNoCaixa(db, atendimentoId) {
    if (!db || !atendimentoId) return;
    var cfg = getCaixaConfig(db);
    if (!cfg.osBloqueadasCaixa || typeof cfg.osBloqueadasCaixa !== 'object') {
        cfg.osBloqueadasCaixa = {};
    }
    cfg.osBloqueadasCaixa[String(atendimentoId)] = new Date().toISOString();
    cfg.atualizadoEm = new Date().toISOString();
    db.caixaConfig = cfg;
}

/* Blindagem: OS bloqueada não volta ao caixa após sync */
function blindarCaixaContraOsBloqueadas(db) {
    if (!db) return;
    var cfg = getCaixaConfig(db);
    var bloq = (cfg && cfg.osBloqueadasCaixa && typeof cfg.osBloqueadasCaixa === 'object')
        ? cfg.osBloqueadasCaixa
        : {};
    var keys = Object.keys(bloq);
    if (!keys.length) return;
    function filtrar(lista, nome) {
        return (lista || []).filter(function (x) {
            if (!x || !x.atendimentoId) return true;
            if (!bloq[x.atendimentoId] && !bloq[String(x.atendimentoId)]) return true;
            marcarExcluido(db, nome, x.id);
            return false;
        });
    }
    db.caixa = filtrar(db.caixa, 'caixa');
    db.caixaBanco = filtrar(db.caixaBanco, 'caixaBanco');
}

function excluirLancamentoCaixaBalcao(idLanc, atendimentoIdHint) {
    var db = carregarMain();
    var idEx = String(idLanc || '').trim();
    var atId = String(atendimentoIdHint || '').trim();
    var removidos = [];

    function coletar(lista, nomeLista) {
        return (lista || []).filter(function (x) {
            if (!x) return false;
            var mesmoId = idEx && String(x.id) === idEx;
            var mesmaOs = atId && x.atendimentoId && String(x.atendimentoId) === atId;
            if (mesmoId || mesmaOs) {
                removidos.push({ id: x.id, atendimentoId: x.atendimentoId, lista: nomeLista });
                return false;
            }
            return true;
        });
    }

    /* Se não achou pelo hint, tenta descobrir a OS pelo id do lançamento */
    if (!atId && idEx) {
        var achado = (db.caixa || []).concat(db.caixaBanco || []).find(function (x) {
            return x && String(x.id) === idEx;
        });
        if (achado && achado.atendimentoId) atId = String(achado.atendimentoId);
    }

    db.caixa = coletar(db.caixa, 'caixa');
    db.caixaBanco = coletar(db.caixaBanco, 'caixaBanco');

    if (!removidos.length && idEx) {
        /* fallback: remove só pelo id em qualquer lista */
        db.caixa = (db.caixa || []).filter(function (x) {
            if (x && String(x.id) === idEx) {
                removidos.push({ id: x.id, atendimentoId: x.atendimentoId, lista: 'caixa' });
                return false;
            }
            return true;
        });
        db.caixaBanco = (db.caixaBanco || []).filter(function (x) {
            if (x && String(x.id) === idEx) {
                removidos.push({ id: x.id, atendimentoId: x.atendimentoId, lista: 'caixaBanco' });
                return false;
            }
            return true;
        });
    }

    if (!removidos.length) {
        toast('Não encontrei esse lançamento para excluir.');
        return false;
    }

    removidos.forEach(function (r) {
        if (r.lista === 'caixaBanco') marcarExcluido(db, 'caixaBanco', r.id);
        else marcarExcluido(db, 'caixa', r.id);
        if (r.atendimentoId) bloquearOsNoCaixa(db, r.atendimentoId);
    });
    if (atId) bloquearOsNoCaixa(db, atId);

    salvarMain(db);
    agendarSyncAutomatico('salvar');
    toast('Excluído do caixa (' + removidos.length + ').');
    return true;
}

function classificarTipoCaixaFh(x) {
    if (x.tipo === 'saida' || x.tipo === 'DESPESA') return { sigla: 'DESPESAS', cls: 'despesas' };
    if (x.tipo === 'fechamento' || x.origemFechamento) return { sigla: 'FECH.CAIXA', cls: 'fech' };
    if (x.atendimentoId || x.origemOficina) return { sigla: 'ORDEM.SERV.', cls: 'os' };
    return { sigla: 'ENTRADA', cls: 'entrada' };
}

function numDocCaixaFh(x) {
    if (x.osResumo && x.osResumo.placa) return String(x.osResumo.placa).toUpperCase();
    if (x.numDoc) return String(x.numDoc);
    return String(x.id || '—').slice(-6).toUpperCase();
}

function clienteCaixaFh(x) {
    if (x.osResumo && x.osResumo.cliente) return x.osResumo.cliente;
    if (x.clienteNome) return x.clienteNome;
    return x.descricao || '—';
}

function renderCaixa() {
    sincronizarOficinaNoCaixaEmpresa();
    /* Sempre lê o caixa oficial da empresa (não o banco interno) */
    var db = carregarMain();
    var cfg = getCaixaConfig(db);
    var exCx = garantirExcluidos(db).caixa || {};
    var lista = aplicarExcluidosNaLista(db.caixa || [], exCx);
    /* Se ficou algum excluído no array, limpa de vez */
    if (lista.length !== (db.caixa || []).length) {
        db.caixa = lista;
        salvarMain(db);
    }
    var entradasBrutas = somarLista(lista, 'entrada');
    var saidasBrutas = somarLista(lista, 'saida');
    var entradas = Math.max(0, entradasBrutas - (Number(cfg.basePainelEntradas) || 0));
    var saidas = Math.max(0, saidasBrutas - (Number(cfg.basePainelSaidas) || 0));
    var inicial = Number(cfg.inicialBalcao) || 0;
    var elIni = document.getElementById('cxInicial');
    if (elIni) elIni.textContent = moeda(inicial);
    document.getElementById('cxEntradas').textContent = moeda(entradas);
    document.getElementById('cxSaidas').textContent = moeda(saidas);
    document.getElementById('cxSaldo').textContent = moeda(inicial + entradas - saidas);

    var hoje = hojeISO();
    var of = calcularRelatorioOficina({ inicio: hoje, fim: hoje, label: hoje });
    var elP = document.getElementById('cxOfPecas');
    var elG = document.getElementById('cxOfGanho');
    var elM = document.getElementById('cxOfMao');
    var elN = document.getElementById('cxOfNoCaixa');
    if (elP) elP.textContent = moeda(of.pecas);
    if (elG) elG.textContent = moeda(of.ganho);
    if (elM) elM.textContent = moeda(of.mao);
    if (elN) elN.textContent = moeda(totaisOficinaNoCaixaHoje(db, hoje));

    var tb = document.getElementById('tabelaCaixa');
    tb.innerHTML = '';
    /* pastas do balcão foram movidas para Relatório de Despesas */

    var q = ((document.getElementById('buscaCaixaBalcao') && document.getElementById('buscaCaixaBalcao').value) || '').toLowerCase().trim();
    var listaFiltrada = lista.slice().reverse().filter(function (x) {
        if (!q) return true;
        var dataLanc = fmtData(x.criadoEm);
        var venc = x.vencimento ? fmtData(x.vencimento) : dataLanc;
        var blob = [
            numDocCaixaFh(x),
            clienteCaixaFh(x),
            x.descricao,
            x.forma,
            x.tipo,
            dataLanc,
            venc,
            String(x.criadoEm || '').slice(0, 10)
        ].join(' ').toLowerCase();
        return blob.indexOf(q) > -1;
    });

    if (!listaFiltrada.length) {
        tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#fff;font-weight:700">' +
            (lista.length ? 'Nenhum registro encontrado na busca.' : 'Nenhum documento registrado no balcão.') +
            '</td></tr>';
        return;
    }

    var main = carregarMain();
    listaFiltrada.forEach(function (x) {
        var tip = classificarTipoCaixaFh(x);
        var doc = numDocCaixaFh(x);
        var cli = clienteCaixaFh(x);
        var dataLanc = fmtData(x.criadoEm);
        var venc = x.vencimento ? fmtData(x.vencimento) : dataLanc;
        var valorCor = tip.cls === 'despesas' ? '#e74c3c' : '#2ecc71';
        var forma = (x.forma || '').toUpperCase();
        var statusHtml;
        if (tip.cls === 'despesas' || tip.cls === 'fech') {
            statusHtml = '—';
        } else {
            statusHtml = '<span class="badge-cx pago">✅ PAGO' + (forma ? ' - ' + esc(forma) : '') + '</span>';
        }
        var assHtml = '—';
        if (x.atendimentoId) {
            var at = (main.atendimentos || []).find(function (a) { return a.id === x.atendimentoId; });
            if (at && at.assinaturaCliente) assHtml = '<span style="color:#2ecc71">✍️ OK</span>';
            else assHtml = '<span style="color:#e74c3c">❌ Pend</span>';
        }

        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="font-weight:800">' + esc(doc) + '</td>' +
            '<td><span class="badge-cx ' + tip.cls + '">' + tip.sigla + '</span></td>' +
            '<td>' + esc(dataLanc) + '</td>' +
            '<td>' + esc(cli) + '</td>' +
            '<td>' + esc(venc) + '</td>' +
            '<td style="color:' + valorCor + ';font-weight:800">' + moeda(x.valor) + '</td>' +
            '<td style="text-align:center">' + statusHtml + '</td>' +
            '<td style="text-align:center;font-size:0.8rem">' + assHtml + '</td>' +
            '<td class="cx-acoes-cell"></td>';
        var acoesCell = tr.querySelector('.cx-acoes-cell');
        var wrap = document.createElement('div');
        wrap.className = 'cx-acoes-fh';
        if (x.atendimentoId) {
            var bVer = document.createElement('button');
            bVer.type = 'button';
            bVer.className = 'btn btn-secondary';
            bVer.textContent = 'Ver';
            bVer.setAttribute('data-cx-ver', String(x.atendimentoId));
            wrap.appendChild(bVer);
            var bPdf = document.createElement('button');
            bPdf.type = 'button';
            bPdf.className = 'btn btn-pdf';
            bPdf.textContent = 'PDF';
            bPdf.setAttribute('data-cx-pdf', String(x.atendimentoId));
            wrap.appendChild(bPdf);
            var bLink = document.createElement('button');
            bLink.type = 'button';
            bLink.className = 'btn btn-assinar';
            bLink.textContent = 'Link';
            bLink.setAttribute('data-cx-link', String(x.atendimentoId));
            wrap.appendChild(bLink);
        }
        var bEx = document.createElement('button');
        bEx.type = 'button';
        bEx.className = 'btn btn-danger';
        bEx.textContent = 'Excluir';
        bEx.setAttribute('data-ex', String(x.id || ''));
        if (x.atendimentoId) bEx.setAttribute('data-ex-at', String(x.atendimentoId));
        wrap.appendChild(bEx);
        acoesCell.appendChild(wrap);
        tb.appendChild(tr);
    });

    if (!tb._cxClickLigado) {
        tb._cxClickLigado = true;
        tb.addEventListener('click', function (e) {
            var bEx = e.target.closest('[data-ex]');
            if (bEx) {
                e.preventDefault();
                e.stopPropagation();
                if (!confirm('Excluir este lançamento do caixa / balcão?')) return;
                var ok = excluirLancamentoCaixaBalcao(
                    bEx.getAttribute('data-ex'),
                    bEx.getAttribute('data-ex-at')
                );
                if (ok) {
                    renderCaixa();
                    atualizarKPIs(carregarMain());
                }
                return;
            }
            var bVer = e.target.closest('[data-cx-ver]');
            if (bVer) {
                abrirNota(bVer.getAttribute('data-cx-ver'));
                return;
            }
            var bPdf = e.target.closest('[data-cx-pdf]');
            if (bPdf) {
                imprimirNotaPdf(bPdf.getAttribute('data-cx-pdf'));
                return;
            }
            var bLink = e.target.closest('[data-cx-link]');
            if (bLink) {
                abrirLinkAssinatura(bLink.getAttribute('data-cx-link'));
            }
        });
    }
}

(function ligarBuscaCaixaBalcao() {
    var el = document.getElementById('buscaCaixaBalcao');
    if (!el || el._ligadoCx) return;
    el._ligadoCx = true;
    el.addEventListener('input', function () { renderCaixa(); });
})();

document.getElementById('btnBkInicial').addEventListener('click', function () {
    var db = carregarMain();
    var cfg = getCaixaConfig(db);
    var atual = Number(cfg.inicialBanco) || 0;
    var v = prompt('Informe o saldo inicial do banco (R$):', String(atual).replace('.', ','));
    if (v == null) return;
    var valor = parseMoeda(v);
    if (isNaN(valor) || valor < 0) {
        toast('Valor inválido.');
        return;
    }
    cfg.inicialBanco = valor;
    salvarCaixaConfigOficial(cfg);
    toast('Saldo inicial do banco gravado: ' + moeda(valor));
    renderCaixaBanco();
    atualizarKPIs(carregarMain());
});

document.getElementById('formBanco').addEventListener('submit', function (e) {
    e.preventDefault();
    var db = carregar();
    if (!db.caixaBanco) db.caixaBanco = [];
    db.caixaBanco.push({
        id: uid(),
        tipo: document.getElementById('bkTipo').value,
        descricao: document.getElementById('bkDesc').value.trim(),
        valor: parseMoeda(document.getElementById('bkValor').value),
        forma: document.getElementById('bkForma').value,
        conta: 'banco',
        criadoEm: new Date().toISOString()
    });
    salvar(db);
    document.getElementById('formBanco').reset();
    toast('Lançamento no banco registrado.');
    renderCaixaBanco();
    atualizarKPIs(db);
});

function renderCaixaBanco() {
    var db = carregarMain();
    var cfg = getCaixaConfig(db);
    var exBk = garantirExcluidos(db).caixaBanco || {};
    var lista = aplicarExcluidosNaLista(db.caixaBanco || [], exBk);
    var bloq = (cfg.osBloqueadasCaixa && typeof cfg.osBloqueadasCaixa === 'object') ? cfg.osBloqueadasCaixa : {};
    if (Object.keys(bloq).length) {
        var antes = lista.length;
        lista = lista.filter(function (x) {
            if (!x || !x.atendimentoId) return true;
            if (!bloq[x.atendimentoId] && !bloq[String(x.atendimentoId)]) return true;
            marcarExcluido(db, 'caixaBanco', x.id);
            return false;
        });
        if (lista.length !== antes || lista.length !== (db.caixaBanco || []).length) {
            db.caixaBanco = lista;
            salvarMain(db);
        }
    } else if (lista.length !== (db.caixaBanco || []).length) {
        db.caixaBanco = lista;
        salvarMain(db);
    }
    var entradas = somarLista(lista, 'entrada');
    var saidas = somarLista(lista, 'saida');
    var inicial = Number(cfg.inicialBanco) || 0;
    document.getElementById('bkInicial').textContent = moeda(inicial);
    document.getElementById('bkEntradas').textContent = moeda(entradas);
    document.getElementById('bkSaidas').textContent = moeda(saidas);
    document.getElementById('bkSaldo').textContent = moeda(inicial + entradas - saidas);

    var tb = document.getElementById('tabelaBanco');
    tb.innerHTML = '';
    if (typeof gerarArvorePastasCaixa === 'function') {
        gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
    }
    if (!lista.length) {
        tb.innerHTML = '<tr><td colspan="6" class="muted">Sem lançamentos no banco.</td></tr>';
        return;
    }
    lista.slice().reverse().forEach(function (x) {
        var tr = document.createElement('tr');
        var tdAcoes = document.createElement('td');
        tdAcoes.className = 'actions';
        var bEx = document.createElement('button');
        bEx.type = 'button';
        bEx.className = 'btn btn-danger';
        bEx.textContent = 'Excluir';
        bEx.setAttribute('data-ex', String(x.id || ''));
        if (x.atendimentoId) bEx.setAttribute('data-ex-at', String(x.atendimentoId));
        tdAcoes.appendChild(bEx);
        tr.innerHTML =
            '<td>' + esc(fmtData(x.criadoEm)) + '</td>' +
            '<td>' + esc(x.tipo) + '</td>' +
            '<td>' + esc(x.descricao) + '</td>' +
            '<td>' + esc(x.forma) + '</td>' +
            '<td>' + moeda(x.valor) + '</td>';
        tr.appendChild(tdAcoes);
        tb.appendChild(tr);
    });
    if (!tb._bkClickLigado) {
        tb._bkClickLigado = true;
        tb.addEventListener('click', function (e) {
            var b = e.target.closest('[data-ex]');
            if (!b) return;
            e.preventDefault();
            e.stopPropagation();
            if (!confirm('Excluir lançamento do caixa do banco (PIX / cartões)?')) return;
            var ok = excluirLancamentoCaixaBalcao(
                b.getAttribute('data-ex'),
                b.getAttribute('data-ex-at')
            );
            if (ok) {
                renderCaixaBanco();
                renderCaixa();
                atualizarKPIs(carregarMain());
            }
        });
    }
}

document.getElementById('formPendente').addEventListener('submit', function (e) {
    e.preventDefault();
    var db = carregar();
    if (!db.pendentes) db.pendentes = [];
    db.pendentes.push({
        id: uid(),
        cliente: document.getElementById('pdCliente').value.trim(),
        descricao: document.getElementById('pdDesc').value.trim(),
        valor: parseMoeda(document.getElementById('pdValor').value),
        vencimento: document.getElementById('pdVenc').value,
        status: 'aberto',
        criadoEm: new Date().toISOString()
    });
    salvar(db);
    document.getElementById('formPendente').reset();
    toast('Conta pendente adicionada.');
    renderPendentes();
});

function receberPendente(id, destino) {
    var db = carregar();
    var i = (db.pendentes || []).findIndex(function (p) { return p.id === id; });
    if (i < 0) return;
    var p = db.pendentes[i];
    var lanc = {
        id: uid(),
        tipo: 'entrada',
        descricao: p.cliente + ' — ' + p.descricao,
        valor: Number(p.valor) || 0,
        forma: destino === 'banco' ? 'PIX' : 'Dinheiro',
        conta: destino,
        pendenteId: p.id,
        criadoEm: new Date().toISOString()
    };
    if (destino === 'banco') {
        if (!db.caixaBanco) db.caixaBanco = [];
        db.caixaBanco.push(lanc);
    } else {
        if (!db.caixa) db.caixa = [];
        db.caixa.push(lanc);
    }
    if (canalVendas !== 'interno') marcarExcluido(db, 'pendentes', p.id);
    db.pendentes.splice(i, 1);
    salvar(db);
    toast('Recebido no ' + (destino === 'banco' ? 'banco' : 'balcão') + '.');
    renderPendentes();
    renderCaixa();
    renderCaixaBanco();
    atualizarKPIs(db);
}

function renderPendentes() {
    var db = carregar();
    var lista = (db.pendentes || []).filter(function (p) { return p.status !== 'pago'; });
    var total = lista.reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
    document.getElementById('pdTotal').textContent = moeda(total);
    document.getElementById('pdQtd').textContent = String(lista.length);
    var tb = document.getElementById('tabelaPendentes');
    tb.innerHTML = '';
    if (typeof gerarArvorePastasCaixa === 'function') {
        gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
    }
    if (!lista.length) {
        tb.innerHTML = '<tr><td colspan="5" class="muted">Nenhuma conta pendente.</td></tr>';
        return;
    }
    lista.slice().reverse().forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + esc(p.cliente) + '</td>' +
            '<td>' + esc(p.descricao) + '</td>' +
            '<td>' + esc(fmtData(p.vencimento)) + '</td>' +
            '<td>' + moeda(p.valor) + '</td>' +
            '<td class="actions">' +
            '<button type="button" class="btn btn-ok" data-rec-b="' + p.id + '">Receber balcão</button>' +
            '<button type="button" class="btn btn-primary" data-rec-k="' + p.id + '">Receber banco</button>' +
            '<button type="button" class="btn btn-danger" data-ex="' + p.id + '">Excluir</button>' +
            '</td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-rec-b]').forEach(function (b) {
        b.addEventListener('click', function () { receberPendente(b.getAttribute('data-rec-b'), 'balcao'); });
    });
    tb.querySelectorAll('[data-rec-k]').forEach(function (b) {
        b.addEventListener('click', function () { receberPendente(b.getAttribute('data-rec-k'), 'banco'); });
    });
    tb.querySelectorAll('[data-ex]').forEach(function (b) {
        b.addEventListener('click', function () {
            if (!confirm('Excluir pendente?')) return;
            var db2 = carregar();
            var idEx = b.getAttribute('data-ex');
            if (canalVendas !== 'interno') marcarExcluido(db2, 'pendentes', idEx);
            db2.pendentes = (db2.pendentes || []).filter(function (x) { return x.id !== idEx; });
            salvar(db2);
            renderPendentes();
        });
    });
}

/* ---------- Relatório mensal + pastas (modelo FH Control) ---------- */
var MES_NOMES_CX = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};
var REL_MES_TITULOS = {
    geral: 'RELATÓRIO MENSAL GERAL (BALCÃO + BANCO + CONTAS A RECEBER)',
    balcao: 'RELATÓRIO MENSAL — CAIXA / BALCÃO',
    banco: 'RELATÓRIO MENSAL — CAIXA BANCO (PIX / CARTÕES)',
    pendentes: 'RELATÓRIO MENSAL — CONTAS A RECEBER',
    despesas: 'RELATÓRIO MENSAL — DESPESAS / SAÍDAS'
};
var REL_MES_PREFIXO = {
    geral: 'Relatorio-Geral',
    balcao: 'Relatorio-Balcao',
    banco: 'Relatorio-Banco',
    pendentes: 'Relatorio-ContasReceber',
    despesas: 'Relatorio-Despesas'
};

function mesAnoDeIso(iso) {
    if (!iso) return '';
    var s = String(iso).trim();
    if (/^\d{4}-\d{2}/.test(s)) return s.slice(5, 7) + '/' + s.slice(0, 4);
    var limpa = s.split(/[\s,]/)[0];
    var p = limpa.split('/');
    if (p.length === 3) return p[1].padStart(2, '0') + '/' + p[2].slice(0, 4);
    return '';
}

function mesAnoAtualPadrao() {
    var d = new Date();
    return String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function pastaMesLabel(mesAno) {
    var p = String(mesAno || '').split('/');
    if (p.length !== 2) return mesAno;
    return (MES_NOMES_CX[p[0]] || p[0]) + ' / ' + p[1];
}

function coletarItensRelatorioMensal(db, filtro, mesAno) {
    filtro = filtro || 'geral';
    mesAno = String(mesAno || '').trim();
    var itens = [];

    function pushLanc(x, canal) {
        if (!x) return;
        var ma = mesAnoDeIso(x.criadoEm);
        if (ma !== mesAno) return;
        var desc = x.descricao || '';
        if (x.atendimentoId && x.osResumo) {
            desc = '[OS ' + (x.osResumo.placa || '') + '] ' + desc;
        }
        itens.push({
            data: fmtData(x.criadoEm),
            doc: x.atendimentoId ? 'OS' : (canal === 'banco' ? 'BANCO' : 'CX'),
            tipo: x.tipo === 'saida' ? 'SAÍDA' : 'ENTRADA',
            descricao: desc,
            forma: x.forma || '—',
            valor: Number(x.valor) || 0,
            natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
            canal: canal
        });
    }

    (db.caixa || []).forEach(function (x) { pushLanc(x, 'balcao'); });
    (db.caixaBanco || []).forEach(function (x) { pushLanc(x, 'banco'); });

    (db.pendentes || []).forEach(function (p) {
        if (!p || p.status === 'pago') return;
        var ref = p.criadoEm || p.vencimento;
        var ma = mesAnoDeIso(ref);
        if (!ma && p.vencimento) {
            var v = String(p.vencimento);
            if (/^\d{4}-\d{2}/.test(v)) ma = v.slice(5, 7) + '/' + v.slice(0, 4);
        }
        if (ma !== mesAno) return;
        itens.push({
            data: fmtData(ref) || (p.vencimento || '—'),
            doc: 'PEND',
            tipo: 'A RECEBER',
            descricao: (p.cliente ? p.cliente + ' — ' : '') + (p.descricao || ''),
            forma: p.vencimento ? ('Venc. ' + fmtData(p.vencimento)) : '—',
            valor: Number(p.valor) || 0,
            natureza: 'PENDENTE',
            canal: 'pendente'
        });
    });

    itens = itens.filter(function (it) {
        if (filtro === 'pendentes') return it.natureza === 'PENDENTE';
        if (filtro === 'balcao') return it.canal === 'balcao' && it.natureza !== 'PENDENTE';
        if (filtro === 'banco') return it.canal === 'banco' && it.natureza !== 'PENDENTE';
        if (filtro === 'despesas') return it.natureza === 'SAIDA';
        return true;
    });

    itens.sort(function (a, b) {
        var da = String(a.data).split('/').reverse().join('');
        var db2 = String(b.data).split('/').reverse().join('');
        return da.localeCompare(db2);
    });
    return itens;
}

function montarHtmlSecoesRelatorioMes(itens, filtro) {
    var totE = 0, totS = 0, totP = 0;
    var linE = '', linS = '', linP = '';
    itens.forEach(function (item) {
        var linha =
            '<tr>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd;width:70px">' + esc(item.data) + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd;width:60px">' + esc(item.doc) + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd;font-size:9px;width:80px">' + esc(item.tipo) + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(item.descricao) +
            '<br><small style="color:#777">' + esc(item.forma) + '</small></td>';
        if (item.natureza === 'PENDENTE') {
            totP += item.valor;
            linP += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#d35400;font-weight:bold;text-align:right">' +
                moeda(item.valor) + '</td></tr>';
        } else if (item.natureza === 'ENTRADA') {
            totE += item.valor;
            linE += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#27ae60;font-weight:bold;text-align:right">+ ' +
                moeda(item.valor) + '</td></tr>';
        } else {
            totS += item.valor;
            linS += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#e74c3c;font-weight:bold;text-align:right">- ' +
                moeda(item.valor) + '</td></tr>';
        }
    });
    if (!linE) linE = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma entrada neste período.</td></tr>';
    if (!linS) linS = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma saída neste período.</td></tr>';
    if (!linP) linP = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhum pendente neste período.</td></tr>';

    var resumo;
    if (filtro === 'pendentes') {
        resumo =
            '<div class="resumo"><div class="resumo-box" style="color:#f39c12">TOTAL A RECEBER<b>' + moeda(totP) + '</b></div></div>';
    } else if (filtro === 'despesas' || filtro === 'saidas') {
        resumo =
            '<div class="resumo"><div class="resumo-box" style="color:#e74c3c">TOTAL DESPESAS / SAÍDAS<b>' + moeda(totS) + '</b></div></div>';
    } else {
        resumo =
            '<div class="resumo">' +
            '<div class="resumo-box" style="color:#27ae60">RECEBIMENTOS / ENTRADAS<b>' + moeda(totE) + '</b></div>' +
            '<div class="resumo-box" style="color:#e74c3c">PAGAMENTOS / SAÍDAS<b>' + moeda(totS) + '</b></div>' +
            '<div class="resumo-box" style="color:#2980b9">SALDO LÍQUIDO DO MÊS<b>' + moeda(totE - totS) + '</b></div>' +
            '</div>';
    }

    var secE =
        '<div class="section-title entrada"><span>ENTRADAS (RECEBIMENTOS)</span><span>TOTAL: ' + moeda(totE) + '</span></div>' +
        '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição / Forma</th><th style="text-align:right">Valor</th></tr></thead>' +
        '<tbody>' + linE + '</tbody></table>';
    var secS =
        '<div class="section-title saida"><span>SAÍDAS E DESPESAS</span><span>TOTAL: ' + moeda(totS) + '</span></div>' +
        '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição / Motivo</th><th style="text-align:right">Valor</th></tr></thead>' +
        '<tbody>' + linS + '</tbody></table>';
    var secP =
        '<div class="section-title pendente"><span>CONTAS A RECEBER</span><span>TOTAL: ' + moeda(totP) + '</span></div>' +
        '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Cliente / Vencimento</th><th style="text-align:right">Valor</th></tr></thead>' +
        '<tbody>' + linP + '</tbody></table>';

    var secoes;
    if (filtro === 'pendentes') secoes = secP;
    else if (filtro === 'entradas') secoes = secE;
    else if (filtro === 'saidas' || filtro === 'despesas') secoes = secS;
    else if (filtro === 'geral') secoes = secE + secS + secP;
    else secoes = secE + secS;

    return {
        html: resumo + secoes,
        totEntradas: totE,
        totSaidas: totS,
        totPendentes: totP,
        saldo: totE - totS
    };
}

function gerarRelatorioMensalPDF(filtro, mesAnoFixo) {
    filtro = filtro || 'geral';
    var mesAno = mesAnoFixo || prompt('Digite o mês e ano do relatório (Ex: 07/2026):', mesAnoAtualPadrao());
    if (!mesAno) return;
    mesAno = String(mesAno).trim();
    if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
        alert('Use o formato MM/AAAA (Ex: 07/2026).');
        return;
    }
    var db = carregar();
    var emp = getEmpresa(db);
    var itens = coletarItensRelatorioMensal(db, filtro, mesAno);
    if (!itens.length) {
        alert('Nenhum registro encontrado para o período: ' + mesAno);
        return;
    }
    var montado = montarHtmlSecoesRelatorioMes(itens, filtro);
    var titulo = REL_MES_TITULOS[filtro] || REL_MES_TITULOS.geral;
    var html =
        '<div class="nota-espelho relatorio-mensal-print">' +
        htmlCabecalhoNotaEmpresa(emp,
            '<div class="nota-sub nota-titulo-espelho">' + esc(titulo) + '</div>' +
            '<div class="nota-sub">Competência: ' + esc(mesAno) + ' · ' + esc(pastaMesLabel(mesAno)) + '</div>'
        ) +
        '<style>' +
        '.relatorio-mensal-print .resumo{display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
        '.relatorio-mensal-print .resumo-box{text-align:center;font-size:11px}' +
        '.relatorio-mensal-print .resumo-box b{display:block;font-size:14px;margin-top:4px}' +
        '.relatorio-mensal-print .section-title{padding:8px 10px;font-size:11px;font-weight:bold;margin-top:18px;text-transform:uppercase;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;color:#fff}' +
        '.relatorio-mensal-print .section-title.entrada{background:#27ae60}' +
        '.relatorio-mensal-print .section-title.saida{background:#e74c3c}' +
        '.relatorio-mensal-print .section-title.pendente{background:#f39c12}' +
        '.relatorio-mensal-print table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}' +
        '.relatorio-mensal-print th{background:#ecf0f1;color:#111;padding:8px;text-align:left;font-size:10px;border-bottom:2px solid #bdc3c7}' +
        '</style>' +
        montado.html +
        '<div style="text-align:center;margin-top:24px;font-size:9px;color:#777">' +
        'Documento gerado pelo Joninha Suspensões em ' + esc(new Date().toLocaleString('pt-BR')) +
        '</div></div>';
    executarImpressaoHtml(html);
}

function montarArvoreCaixaDados(db) {
    var arvore = {};
    function addDoc(iso, item) {
        var ma = mesAnoDeIso(iso);
        if (!ma) return;
        var p = ma.split('/');
        var ano = p[1];
        var mesNum = p[0];
        var mesNome = MES_NOMES_CX[mesNum] || mesNum;
        if (!arvore[ano]) arvore[ano] = {};
        if (!arvore[ano][mesNome]) {
            arvore[ano][mesNome] = { mesNum: mesNum, mesAno: ma, entradas: [], saidas: [], pendentes: [] };
        }
        var bucket = arvore[ano][mesNome];
        if (item.natureza === 'ENTRADA') bucket.entradas.push(item);
        else if (item.natureza === 'SAIDA') bucket.saidas.push(item);
        else bucket.pendentes.push(item);
    }

    (db.caixa || []).forEach(function (x) {
        addDoc(x.criadoEm, {
            data: fmtData(x.criadoEm),
            descricao: x.descricao || '—',
            forma: x.forma || '—',
            valor: Number(x.valor) || 0,
            natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
            origem: 'Balcão'
        });
    });
    (db.caixaBanco || []).forEach(function (x) {
        addDoc(x.criadoEm, {
            data: fmtData(x.criadoEm),
            descricao: x.descricao || '—',
            forma: x.forma || '—',
            valor: Number(x.valor) || 0,
            natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
            origem: 'Banco'
        });
    });
    (db.pendentes || []).forEach(function (p) {
        if (!p || p.status === 'pago') return;
        var ref = p.criadoEm || p.vencimento;
        addDoc(ref, {
            data: fmtData(ref),
            descricao: (p.cliente ? p.cliente + ' — ' : '') + (p.descricao || '—'),
            forma: p.vencimento ? ('Venc. ' + fmtData(p.vencimento)) : '—',
            valor: Number(p.valor) || 0,
            natureza: 'PENDENTE',
            origem: 'Pendente'
        });
    });
    return arvore;
}

function htmlItensPastaCx(lista, classeValor) {
    if (!lista || !lista.length) {
        return '<div class="muted" style="padding:6px 0">Nenhum lançamento nesta pasta.</div>';
    }
    return lista.map(function (it) {
        return '<div class="pasta-cx-item">' +
            '<span><strong>[' + esc(it.origem || '') + ']</strong> ' + esc(it.data) + ' · ' + esc(it.descricao) +
            ' <small class="muted">(' + esc(it.forma) + ')</small></span>' +
            '<span class="' + classeValor + '">' + moeda(it.valor) + '</span></div>';
    }).join('');
}

function togglePastaCaixa(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
}
window.togglePastaCaixa = togglePastaCaixa;

function filtrarItensArvoreCaixa(lista, filtro) {
    if (!lista) return [];
    if (filtro === 'balcao') return lista.filter(function (x) { return x.origem === 'Balcão'; });
    if (filtro === 'banco') return lista.filter(function (x) { return x.origem === 'Banco'; });
    if (filtro === 'pendentes') return lista.filter(function (x) { return x.origem === 'Pendente'; });
    return lista.slice();
}

function gerarArvorePastasCaixa(opts) {
    opts = opts || {};
    var elId = opts.elId || 'arvorePastasCaixa';
    var filtro = opts.filtro || 'geral';
    var idPrefix = opts.idPrefix || 'pasta_cx';
    var el = document.getElementById(elId);
    if (!el) return;
    var db = carregar();
    var arvoreFull = montarArvoreCaixaDados(db);
    var arvore = {};
    Object.keys(arvoreFull).forEach(function (ano) {
        Object.keys(arvoreFull[ano]).forEach(function (mesNome) {
            var b = arvoreFull[ano][mesNome];
            var entradas = filtrarItensArvoreCaixa(b.entradas, filtro);
            var saidas = filtrarItensArvoreCaixa(b.saidas, filtro);
            var pendentes = filtrarItensArvoreCaixa(b.pendentes, filtro);
            if (filtro === 'pendentes') {
                entradas = [];
                saidas = [];
            } else if (filtro === 'despesas') {
                entradas = [];
                pendentes = [];
                saidas = (b.saidas || []).slice();
            } else if (filtro === 'balcao' || filtro === 'banco') {
                pendentes = [];
            }
            if (!entradas.length && !saidas.length && !pendentes.length) return;
            if (!arvore[ano]) arvore[ano] = {};
            arvore[ano][mesNome] = {
                mesNum: b.mesNum,
                mesAno: b.mesAno,
                entradas: entradas,
                saidas: saidas,
                pendentes: pendentes
            };
        });
    });
    var anos = Object.keys(arvore).sort().reverse();
    if (!anos.length) {
        el.innerHTML = '<div class="muted" style="padding:10px;text-align:center">' +
            (filtro === 'despesas'
                ? 'Ainda não há despesas lançadas para montar as pastas do mês.'
                : 'Ainda não há lançamentos para montar as pastas do mês.') +
            '</div>';
        return;
    }
    var html = '';
    var idc = 0;
    anos.forEach(function (ano) {
        idc++;
        var idAno = idPrefix + '_ano_' + idc;
        html += '<div class="pasta-cx-ano" onclick="togglePastaCaixa(\'' + idAno + '\')">📁 Ano: ' + esc(ano) + '</div>';
        html += '<div id="' + idAno + '" style="display:none">';
        Object.keys(arvore[ano]).forEach(function (mesNome) {
            var bucket = arvore[ano][mesNome];
            idc++;
            var idMes = idPrefix + '_mes_' + idc;
            var totE = bucket.entradas.reduce(function (s, x) { return s + x.valor; }, 0);
            var totS = bucket.saidas.reduce(function (s, x) { return s + x.valor; }, 0);
            var totP = bucket.pendentes.reduce(function (s, x) { return s + x.valor; }, 0);
            var resumoMes = filtro === 'pendentes'
                ? ('a receber ' + moeda(totP))
                : (filtro === 'despesas'
                    ? ('despesas ' + moeda(totS))
                    : ('saldo ' + moeda(totE - totS)));
            html += '<div class="pasta-cx-mes" onclick="togglePastaCaixa(\'' + idMes + '\')">📂 Mês: ' +
                esc(mesNome) + ' <small style="font-weight:500;opacity:.85">(' + esc(bucket.mesAno) +
                ' · ' + resumoMes + ')</small></div>';
            html += '<div class="pasta-cx-mes-acoes">' +
                '<button type="button" class="btn btn-pdf" style="padding:6px 10px;font-size:12px" data-rel-mes-fixo="' +
                esc(bucket.mesAno) + '" data-rel-mes="' + esc(filtro) + '">📄 Relatório geral</button>' +
                '<button type="button" class="btn btn-secondary" style="padding:6px 10px;font-size:12px" data-arquivar-mes="' +
                esc(bucket.mesAno) + '" data-arquivar-filtro="' + esc(filtro) + '">📂 Arquivar no PC</button></div>';
            html += '<div id="' + idMes + '" style="display:none">';

            if (filtro === 'despesas') {
                idc++;
                var idS = idPrefix + '_s_' + idc;
                html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idS + '\')">🔻 Despesas (' +
                    bucket.saidas.length + ' · ' + moeda(totS) + ')</div>';
                html += '<div id="' + idS + '" class="pasta-cx-conteudo" style="display:none">' +
                    htmlItensPastaCx(bucket.saidas, 'val-sai') + '</div>';
            } else if (filtro !== 'pendentes') {
                idc++;
                var idE = idPrefix + '_e_' + idc;
                html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idE + '\')">✅ Entradas (' +
                    bucket.entradas.length + ' · ' + moeda(totE) + ')</div>';
                html += '<div id="' + idE + '" class="pasta-cx-conteudo" style="display:none">' +
                    htmlItensPastaCx(bucket.entradas, 'val-ent') + '</div>';

                idc++;
                var idS2 = idPrefix + '_s_' + idc;
                html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idS2 + '\')">🔻 Saídas (' +
                    bucket.saidas.length + ' · ' + moeda(totS) + ')</div>';
                html += '<div id="' + idS2 + '" class="pasta-cx-conteudo" style="display:none">' +
                    htmlItensPastaCx(bucket.saidas, 'val-sai') + '</div>';
            }

            if (filtro === 'geral' || filtro === 'pendentes') {
                idc++;
                var idP = idPrefix + '_p_' + idc;
                html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idP + '\')">⏳ Pendentes (' +
                    bucket.pendentes.length + ' · ' + moeda(totP) + ')</div>';
                html += '<div id="' + idP + '" class="pasta-cx-conteudo" style="display:none">' +
                    htmlItensPastaCx(bucket.pendentes, 'val-pen') + '</div>';
            }

            html += '</div>';
        });
        html += '</div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('[data-rel-mes-fixo]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
            ev.stopPropagation();
            gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes') || 'geral', b.getAttribute('data-rel-mes-fixo'));
        });
    });
    el.querySelectorAll('[data-arquivar-mes]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
            ev.stopPropagation();
            arquivarMesPastaPC(b.getAttribute('data-arquivar-mes'), b.getAttribute('data-arquivar-filtro') || filtro);
        });
    });
}

function atualizarTodasPastasCaixa() {
    gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
    gerarArvorePastasCaixa({ elId: 'arvorePastasDespesas', filtro: 'despesas', idPrefix: 'pasta_des' });
    gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
    gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
}

function renderRelatorioDespesas() {
    var db = carregar();
    var mesAno = mesAnoAtualPadrao();
    var itensMes = coletarItensRelatorioMensal(db, 'despesas', mesAno);
    var totMes = itensMes.reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
    var totGeral = 0;
    (db.caixa || []).forEach(function (x) {
        if (x.tipo === 'saida') totGeral += Number(x.valor) || 0;
    });
    (db.caixaBanco || []).forEach(function (x) {
        if (x.tipo === 'saida') totGeral += Number(x.valor) || 0;
    });
    var elM = document.getElementById('rdDespesasMes');
    var elQ = document.getElementById('rdQtdMes');
    var elT = document.getElementById('rdDespesasTotal');
    if (elM) elM.textContent = moeda(totMes);
    if (elQ) elQ.textContent = String(itensMes.length);
    if (elT) elT.textContent = moeda(totGeral);
    gerarArvorePastasCaixa({ elId: 'arvorePastasDespesas', filtro: 'despesas', idPrefix: 'pasta_des' });
}

function htmlArquivoRelatorioMes(emp, titulo, mesAno, corpoHtml) {
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
        '<title>Joninha Suspensões</title>' +
        '<style>body{font-family:Segoe UI,Arial,sans-serif;font-size:12px;color:#222;margin:24px}' +
        'h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;color:#555;margin:0 0 16px}' +
        'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}' +
        'th{background:#ecf0f1}.section-title{padding:8px 10px;color:#fff;font-weight:bold;margin-top:18px;display:flex;justify-content:space-between}' +
        '.entrada{background:#27ae60}.saida{background:#e74c3c}.pendente{background:#f39c12}' +
        '.resumo{display:flex;gap:12px;flex-wrap:wrap;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
        '.resumo-box{text-align:center;flex:1;min-width:120px}.resumo-box b{display:block;margin-top:4px;font-size:14px}</style></head><body>' +
        '<h1>' + esc(titulo) + '</h1>' +
        '<h2>' + esc(emp.nome || 'Joninha Suspensões') + ' — Competência: ' + esc(mesAno) + '</h2>' +
        corpoHtml +
        '<p style="margin-top:28px;font-size:10px;color:#888;text-align:center">Gerado em ' +
        esc(new Date().toLocaleString('pt-BR')) + ' · Joninha Suspensões</p></body></html>';
}

async function gravarTextoNaPasta(dirHandle, nomeArquivo, texto) {
    var fh = await dirHandle.getFileHandle(nomeArquivo, { create: true });
    var w = await fh.createWritable();
    await w.write(texto);
    await w.close();
}

async function arquivarMesPastaPC(mesAnoFixo, filtroFixo) {
    if (!('showDirectoryPicker' in window)) {
        toast('Arquivar na pasta do PC só funciona no Chrome/Edge no computador.');
        return;
    }
    var filtro = filtroFixo || 'geral';
    var mesAno = mesAnoFixo || prompt('Qual mês arquivar na pasta do PC? (Ex: 07/2026)', mesAnoAtualPadrao());
    if (!mesAno) return;
    mesAno = String(mesAno).trim();
    if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
        alert('Use o formato MM/AAAA (Ex: 07/2026).');
        return;
    }
    var root = await carregarHandlePastaRaiz();
    if (!root) {
        toast('Configure a pasta do PC em Config primeiro.');
        return;
    }
    if (!(await solicitarPermissaoPasta(root))) {
        toast('Sem permissão na pasta do PC.');
        return;
    }

    var db = carregar();
    var emp = getEmpresa(db);
    var itens = coletarItensRelatorioMensal(db, filtro, mesAno);
    if (!itens.length) {
        alert('Nenhum registro para arquivar em ' + mesAno);
        return;
    }
    var entradas = itens.filter(function (x) { return x.natureza === 'ENTRADA'; });
    var saidas = itens.filter(function (x) { return x.natureza === 'SAIDA'; });
    var pendentes = itens.filter(function (x) { return x.natureza === 'PENDENTE'; });
    var filtroHtml = filtro === 'pendentes' ? 'pendentes' : (filtro === 'geral' ? 'geral' : filtro);
    var montGeral = montarHtmlSecoesRelatorioMes(itens, filtroHtml);
    var montEnt = montarHtmlSecoesRelatorioMes(entradas, 'entradas');
    var montSai = montarHtmlSecoesRelatorioMes(saidas, 'saidas');

    var partes = mesAno.split('/');
    var ano = partes[1];
    var mesNum = partes[0];
    var mesNome = MES_NOMES_CX[mesNum] || mesNum;
    var nomePastaMes = mesNum + '-' + slugPasta(mesNome);
    var subTipo = filtro === 'balcao' ? 'Balcao'
        : (filtro === 'banco' ? 'Banco'
            : (filtro === 'pendentes' ? 'Pendentes'
                : (filtro === 'despesas' ? 'Despesas' : 'Geral')));
    var tituloRel = REL_MES_TITULOS[filtro] || REL_MES_TITULOS.geral;

    try {
        var pastaCaixa = await root.getDirectoryHandle('Caixa', { create: true });
        var pastaTipo = await pastaCaixa.getDirectoryHandle(subTipo, { create: true });
        var pastaAno = await pastaTipo.getDirectoryHandle(ano, { create: true });
        var pastaMes = await pastaAno.getDirectoryHandle(nomePastaMes, { create: true });

        if (filtro === 'despesas') {
            var pastaSaidasD = await pastaMes.getDirectoryHandle('Despesas', { create: true });
            await gravarTextoNaPasta(pastaSaidasD, 'despesas-' + mesNum + '-' + ano + '.html',
                htmlArquivoRelatorioMes(emp, 'DESPESAS DO MÊS', mesAno, montSai.html));
            await gravarTextoNaPasta(pastaSaidasD, 'despesas-' + mesNum + '-' + ano + '.json',
                JSON.stringify(saidas, null, 2));
        } else if (filtro !== 'pendentes') {
            var pastaEntradas = await pastaMes.getDirectoryHandle('Entradas', { create: true });
            var pastaSaidas = await pastaMes.getDirectoryHandle('Saidas', { create: true });
            await gravarTextoNaPasta(pastaEntradas, 'entradas-' + mesNum + '-' + ano + '.html',
                htmlArquivoRelatorioMes(emp, 'ENTRADAS DO MÊS', mesAno, montEnt.html));
            await gravarTextoNaPasta(pastaEntradas, 'entradas-' + mesNum + '-' + ano + '.json',
                JSON.stringify(entradas, null, 2));
            await gravarTextoNaPasta(pastaSaidas, 'saidas-' + mesNum + '-' + ano + '.html',
                htmlArquivoRelatorioMes(emp, 'SAÍDAS DO MÊS', mesAno, montSai.html));
            await gravarTextoNaPasta(pastaSaidas, 'saidas-' + mesNum + '-' + ano + '.json',
                JSON.stringify(saidas, null, 2));
        } else {
            var pastaPend = await pastaMes.getDirectoryHandle('Pendentes', { create: true });
            await gravarTextoNaPasta(pastaPend, 'pendentes-' + mesNum + '-' + ano + '.html',
                htmlArquivoRelatorioMes(emp, 'CONTAS A RECEBER', mesAno, montGeral.html));
            await gravarTextoNaPasta(pastaPend, 'pendentes-' + mesNum + '-' + ano + '.json',
                JSON.stringify(pendentes, null, 2));
        }

        await gravarTextoNaPasta(pastaMes, 'Relatorio-' + subTipo + '-' + mesNum + '-' + ano + '.html',
            htmlArquivoRelatorioMes(emp, tituloRel, mesAno, montGeral.html));
        await gravarTextoNaPasta(pastaMes, 'resumo-' + mesNum + '-' + ano + '.json', JSON.stringify({
            mesAno: mesAno,
            mes: mesNome,
            filtro: filtro,
            geradoEm: new Date().toISOString(),
            totais: {
                entradas: montGeral.totEntradas,
                saidas: montGeral.totSaidas,
                pendentes: montGeral.totPendentes,
                saldo: montGeral.saldo
            },
            qtd: { entradas: entradas.length, saidas: saidas.length, pendentes: pendentes.length },
            pendentes: pendentes
        }, null, 2));

        var caminho = 'Caixa/' + subTipo + '/' + ano + '/' + nomePastaMes;
        toast('Mês ' + mesAno + ' arquivado em ' + caminho);
        alert(
            'Pasta do mês criada com sucesso!\n\n' +
            root.name + '/' + caminho + '/\n' +
            (filtro === 'pendentes'
                ? '  ├─ Pendentes/\n  └─ Relatorio-…html\n\nA receber: ' + moeda(montGeral.totPendentes)
                : (filtro === 'despesas'
                    ? '  ├─ Despesas/\n  └─ Relatorio-…html\n\nDespesas: ' + moeda(montGeral.totSaidas)
                    : '  ├─ Entradas/\n  ├─ Saidas/\n  └─ Relatorio-…html\n\nEntradas: ' + moeda(montGeral.totEntradas) +
                      '\nSaídas: ' + moeda(montGeral.totSaidas) +
                      '\nSaldo: ' + moeda(montGeral.saldo)))
        );
    } catch (err) {
        console.error(err);
        toast('Falha ao gravar a pasta do mês no PC.');
    }
}

/* ---------- Pastas mensais — Despesas por OS (Modo Interno) ---------- */
function listarOsDoMes(mesAno) {
    var main = carregarMain();
    var ocultas = obterOsOcultasDespesas();
    return (main.atendimentos || []).filter(function (a) {
        if (!a || !a.id) return false;
        if (ocultas[a.id] || ocultas[String(a.id)]) return false;
        return mesAnoDeIso(a.entrada || a.criadoEm) === mesAno;
    }).map(function (a) {
        var r = resumoLucroOs(a);
        var despesas = listarDespesasInternasPorOs(a.id);
        return {
            id: a.id,
            data: fmtData(a.entrada || a.criadoEm),
            cliente: nomeAtendimento(main, a),
            placa: (a.placa || '—').toUpperCase(),
            carro: a.carro || '—',
            status: a.status || '—',
            bruto: r.bruto,
            despesas: r.despesas,
            lucro: r.lucro,
            lancamentosDespesa: despesas.map(function (x) {
                return {
                    data: fmtData(x.criadoEm),
                    descricao: x.descricao || '—',
                    forma: x.forma || '—',
                    valor: Number(x.valor) || 0
                };
            })
        };
    }).sort(function (a, b) {
        return String(b.data).split('/').reverse().join('').localeCompare(String(a.data).split('/').reverse().join(''));
    });
}

function montarArvoreDespesasOs() {
    var main = carregarMain();
    var arvore = {};
    (main.atendimentos || []).forEach(function (a) {
        var ma = mesAnoDeIso(a.entrada || a.criadoEm);
        if (!ma) return;
        var p = ma.split('/');
        var ano = p[1];
        var mesNum = p[0];
        var mesNome = MES_NOMES_CX[mesNum] || mesNum;
        if (!arvore[ano]) arvore[ano] = {};
        if (!arvore[ano][mesNome]) {
            arvore[ano][mesNome] = { mesNum: mesNum, mesAno: ma, os: [] };
        }
        var r = resumoLucroOs(a);
        arvore[ano][mesNome].os.push({
            id: a.id,
            data: fmtData(a.entrada || a.criadoEm),
            cliente: nomeAtendimento(main, a),
            placa: (a.placa || '—').toUpperCase(),
            carro: a.carro || '—',
            status: a.status || '—',
            bruto: r.bruto,
            despesas: r.despesas,
            lucro: r.lucro,
            lancamentos: listarDespesasInternasPorOs(a.id)
        });
    });
    return arvore;
}

function htmlCorpoRelatorioDespesasOs(listaOs) {
    var totB = 0, totD = 0, totL = 0;
    var linhasOs = '';
    var linhasDesp = '';
    listaOs.forEach(function (o) {
        totB += o.bruto;
        totD += o.despesas;
        totL += o.lucro;
        linhasOs +=
            '<tr>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.data) + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.cliente) + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.carro) + ' · ' + esc(o.placa) + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#27ae60;font-weight:bold">' + moeda(o.bruto) + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#e74c3c;font-weight:bold">' + moeda(o.despesas) + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#2980b9;font-weight:bold">' + moeda(o.lucro) + '</td>' +
            '</tr>';
        (o.lancamentosDespesa || o.lancamentos || []).forEach(function (d) {
            linhasDesp +=
                '<tr>' +
                '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.data || fmtData(d.criadoEm)) + '</td>' +
                '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.placa) + '</td>' +
                '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.descricao) + '</td>' +
                '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.forma) + '</td>' +
                '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#e74c3c;font-weight:bold">' + moeda(d.valor) + '</td>' +
                '</tr>';
        });
    });
    if (!linhasOs) linhasOs = '<tr><td colspan="6" style="padding:10px;text-align:center;color:#777">Nenhuma OS neste período.</td></tr>';
    if (!linhasDesp) linhasDesp = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma despesa interna neste período.</td></tr>';

    return {
        html:
            '<div class="resumo">' +
            '<div class="resumo-box" style="color:#27ae60">BRUTO (OS)<b>' + moeda(totB) + '</b></div>' +
            '<div class="resumo-box" style="color:#e74c3c">DESPESAS INTERNAS<b>' + moeda(totD) + '</b></div>' +
            '<div class="resumo-box" style="color:#2980b9">LUCRO ESTIMADO<b>' + moeda(totL) + '</b></div>' +
            '</div>' +
            '<div class="section-title entrada"><span>BRUTO / ENTRADAS POR OS</span><span>TOTAL: ' + moeda(totB) + '</span></div>' +
            '<table><thead><tr><th>Data</th><th>Cliente</th><th>Veículo / Placa</th><th style="text-align:right">Bruto</th><th style="text-align:right">Despesas</th><th style="text-align:right">Lucro</th></tr></thead>' +
            '<tbody>' + linhasOs + '</tbody></table>' +
            '<div class="section-title saida"><span>DESPESAS / SAÍDAS INTERNAS</span><span>TOTAL: ' + moeda(totD) + '</span></div>' +
            '<table><thead><tr><th>Data</th><th>Placa</th><th>Descrição</th><th>Forma</th><th style="text-align:right">Valor</th></tr></thead>' +
            '<tbody>' + linhasDesp + '</tbody></table>',
        totBruto: totB,
        totDespesas: totD,
        totLucro: totL
    };
}

function gerarRelatorioMensalDespesasOsPDF(mesAnoFixo) {
    var mesAno = mesAnoFixo || prompt('Digite o mês e ano do relatório de despesas por OS (Ex: 07/2026):', mesAnoAtualPadrao());
    if (!mesAno) return;
    mesAno = String(mesAno).trim();
    if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
        alert('Use o formato MM/AAAA (Ex: 07/2026).');
        return;
    }
    var lista = listarOsDoMes(mesAno);
    if (!lista.length) {
        alert('Nenhuma OS encontrada para o período: ' + mesAno);
        return;
    }
    var emp = getEmpresa(carregarMain());
    var montado = htmlCorpoRelatorioDespesasOs(lista);
    var html =
        '<div class="nota-espelho relatorio-mensal-print">' +
        htmlCabecalhoNotaEmpresa(emp,
            '<div class="nota-sub nota-titulo-espelho">RELATÓRIO MENSAL — LUCRO POR OS (INTERNO)</div>' +
            '<div class="nota-sub">Competência: ' + esc(mesAno) + ' · ' + esc(pastaMesLabel(mesAno)) + '</div>'
        ) +
        '<style>' +
        '.relatorio-mensal-print .resumo{display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
        '.relatorio-mensal-print .resumo-box{text-align:center;font-size:11px}' +
        '.relatorio-mensal-print .resumo-box b{display:block;font-size:14px;margin-top:4px}' +
        '.relatorio-mensal-print .section-title{padding:8px 10px;font-size:11px;font-weight:bold;margin-top:18px;text-transform:uppercase;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;color:#fff}' +
        '.relatorio-mensal-print .section-title.entrada{background:#27ae60}' +
        '.relatorio-mensal-print .section-title.saida{background:#e74c3c}' +
        '.relatorio-mensal-print table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}' +
        '.relatorio-mensal-print th{background:#ecf0f1;color:#111;padding:8px;text-align:left;font-size:10px;border-bottom:2px solid #bdc3c7}' +
        '</style>' +
        montado.html +
        '<div style="text-align:center;margin-top:24px;font-size:9px;color:#777">' +
        'Documento interno · Joninha Suspensões · ' + esc(new Date().toLocaleString('pt-BR')) +
        '</div></div>';
    executarImpressaoHtml(html);
}

function gerarArvorePastasDespesasOs() {
    var el = document.getElementById('arvorePastasDespesasOs');
    if (!el) return;
    var arvore = montarArvoreDespesasOs();
    var anos = Object.keys(arvore).sort().reverse();
    if (!anos.length) {
        el.innerHTML = '<div class="muted" style="padding:10px;text-align:center">Ainda não há OS oficiais para montar as pastas do mês.</div>';
        return;
    }
    var html = '';
    var idc = 0;
    anos.forEach(function (ano) {
        idc++;
        var idAno = 'pasta_dos_ano_' + idc;
        html += '<div class="pasta-cx-ano" onclick="togglePastaCaixa(\'' + idAno + '\')">📁 Ano: ' + esc(ano) + '</div>';
        html += '<div id="' + idAno + '" style="display:none">';
        Object.keys(arvore[ano]).forEach(function (mesNome) {
            var bucket = arvore[ano][mesNome];
            var totB = 0, totD = 0, totL = 0;
            bucket.os.forEach(function (o) {
                totB += o.bruto;
                totD += o.despesas;
                totL += o.lucro;
            });
            idc++;
            var idMes = 'pasta_dos_mes_' + idc;
            html += '<div class="pasta-cx-mes" onclick="togglePastaCaixa(\'' + idMes + '\')">📂 Mês: ' +
                esc(mesNome) + ' <small style="font-weight:500;opacity:.85">(' + esc(bucket.mesAno) +
                ' · ' + bucket.os.length + ' OS · lucro ' + moeda(totL) + ')</small></div>';
            html += '<div class="pasta-cx-mes-acoes">' +
                '<button type="button" class="btn btn-pdf" style="padding:6px 10px;font-size:12px" data-dos-rel="' +
                esc(bucket.mesAno) + '">📄 Relatório geral</button>' +
                '<button type="button" class="btn btn-secondary" style="padding:6px 10px;font-size:12px" data-dos-arquivar="' +
                esc(bucket.mesAno) + '">📂 Arquivar no PC</button></div>';
            html += '<div id="' + idMes + '" style="display:none">';

            /* Bruto / Entradas */
            idc++;
            var idE = 'pasta_dos_e_' + idc;
            html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idE + '\')">✅ Bruto / Entradas (' +
                bucket.os.length + ' OS · ' + moeda(totB) + ')</div>';
            html += '<div id="' + idE + '" class="pasta-cx-conteudo" style="display:none">';
            if (!bucket.os.length) {
                html += '<div class="muted">Nenhuma OS neste mês.</div>';
            } else {
                bucket.os.forEach(function (o) {
                    html += '<div class="pasta-cx-item">' +
                        '<span><strong>' + esc(o.data) + '</strong> · ' + esc(o.cliente) +
                        ' · ' + esc(o.placa) +
                        ' <button type="button" class="btn btn-primary" style="padding:3px 8px;font-size:11px;margin-left:8px" data-dos-abrir-pasta="' +
                        esc(o.id) + '">Despesas</button></span>' +
                        '<span class="val-ent">' + moeda(o.bruto) + '</span></div>';
                });
            }
            html += '</div>';

            /* Despesas / Saídas */
            idc++;
            var idS = 'pasta_dos_s_' + idc;
            var qtdDesp = 0;
            bucket.os.forEach(function (o) { qtdDesp += (o.lancamentos || []).length; });
            html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idS + '\')">🔻 Despesas / Saídas (' +
                qtdDesp + ' · ' + moeda(totD) + ')</div>';
            html += '<div id="' + idS + '" class="pasta-cx-conteudo" style="display:none">';
            if (!qtdDesp) {
                html += '<div class="muted">Nenhuma despesa interna lançada neste mês.</div>';
            } else {
                bucket.os.forEach(function (o) {
                    (o.lancamentos || []).forEach(function (d) {
                        html += '<div class="pasta-cx-item">' +
                            '<span><strong>[' + esc(o.placa) + ']</strong> ' + esc(fmtData(d.criadoEm)) +
                            ' · ' + esc(d.descricao || '—') +
                            ' <small class="muted">(' + esc(d.forma || '—') + ')</small></span>' +
                            '<span class="val-sai">' + moeda(d.valor) + '</span></div>';
                    });
                });
            }
            html += '</div>';

            /* Relatório / Lucro */
            idc++;
            var idL = 'pasta_dos_l_' + idc;
            html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idL + '\')">📊 Lucro / Relatório (' +
                moeda(totL) + ')</div>';
            html += '<div id="' + idL + '" class="pasta-cx-conteudo" style="display:none">' +
                '<div class="pasta-cx-item"><span>Total bruto</span><span class="val-ent">' + moeda(totB) + '</span></div>' +
                '<div class="pasta-cx-item"><span>Total despesas</span><span class="val-sai">' + moeda(totD) + '</span></div>' +
                '<div class="pasta-cx-item"><span><strong>Lucro estimado do mês</strong></span><span class="val-ent"><strong>' +
                moeda(totL) + '</strong></span></div></div>';

            html += '</div>';
        });
        html += '</div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('[data-dos-rel]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
            ev.stopPropagation();
            gerarRelatorioMensalDespesasOsPDF(b.getAttribute('data-dos-rel'));
        });
    });
    el.querySelectorAll('[data-dos-arquivar]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
            ev.stopPropagation();
            arquivarMesDespesasOsPastaPC(b.getAttribute('data-dos-arquivar'));
        });
    });
    el.querySelectorAll('[data-dos-abrir-pasta]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
            ev.stopPropagation();
            abrirLancarDespesaOs(b.getAttribute('data-dos-abrir-pasta'));
        });
    });
}

async function arquivarMesDespesasOsPastaPC(mesAnoFixo) {
    if (!('showDirectoryPicker' in window)) {
        toast('Arquivar na pasta do PC só funciona no Chrome/Edge no computador.');
        return;
    }
    var mesAno = mesAnoFixo || prompt('Qual mês de despesas por OS arquivar? (Ex: 07/2026)', mesAnoAtualPadrao());
    if (!mesAno) return;
    mesAno = String(mesAno).trim();
    if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
        alert('Use o formato MM/AAAA (Ex: 07/2026).');
        return;
    }
    var root = await carregarHandlePastaRaiz();
    if (!root) {
        toast('Configure a pasta do PC em Config primeiro.');
        return;
    }
    if (!(await solicitarPermissaoPasta(root))) {
        toast('Sem permissão na pasta do PC.');
        return;
    }

    var lista = listarOsDoMes(mesAno);
    if (!lista.length) {
        alert('Nenhuma OS para arquivar em ' + mesAno);
        return;
    }
    var emp = getEmpresa(carregarMain());
    var montado = htmlCorpoRelatorioDespesasOs(lista);
    var entradas = lista.map(function (o) {
        return { data: o.data, cliente: o.cliente, placa: o.placa, carro: o.carro, bruto: o.bruto, status: o.status };
    });
    var saidas = [];
    lista.forEach(function (o) {
        (o.lancamentosDespesa || []).forEach(function (d) {
            saidas.push({
                data: d.data,
                placa: o.placa,
                cliente: o.cliente,
                descricao: d.descricao,
                forma: d.forma,
                valor: d.valor
            });
        });
    });

    var partes = mesAno.split('/');
    var ano = partes[1];
    var mesNum = partes[0];
    var mesNome = MES_NOMES_CX[mesNum] || mesNum;
    var nomePastaMes = mesNum + '-' + slugPasta(mesNome);

    var htmlEntradas =
        '<div class="resumo"><div class="resumo-box" style="color:#27ae60">BRUTO TOTAL<b>' + moeda(montado.totBruto) + '</b></div></div>' +
        '<table><thead><tr><th>Data</th><th>Cliente</th><th>Veículo / Placa</th><th style="text-align:right">Bruto</th></tr></thead><tbody>' +
        entradas.map(function (o) {
            return '<tr><td>' + esc(o.data) + '</td><td>' + esc(o.cliente) + '</td><td>' +
                esc(o.carro) + ' · ' + esc(o.placa) + '</td><td style="text-align:right;color:#27ae60;font-weight:bold">' +
                moeda(o.bruto) + '</td></tr>';
        }).join('') + '</tbody></table>';

    var htmlSaidas =
        '<div class="resumo"><div class="resumo-box" style="color:#e74c3c">DESPESAS TOTAL<b>' + moeda(montado.totDespesas) + '</b></div></div>' +
        '<table><thead><tr><th>Data</th><th>Placa</th><th>Descrição</th><th>Forma</th><th style="text-align:right">Valor</th></tr></thead><tbody>' +
        (saidas.length ? saidas.map(function (d) {
            return '<tr><td>' + esc(d.data) + '</td><td>' + esc(d.placa) + '</td><td>' + esc(d.descricao) +
                '</td><td>' + esc(d.forma) + '</td><td style="text-align:right;color:#e74c3c;font-weight:bold">' +
                moeda(d.valor) + '</td></tr>';
        }).join('') : '<tr><td colspan="5" style="text-align:center;color:#777;padding:10px">Sem despesas neste mês.</td></tr>') +
        '</tbody></table>';

    try {
        var pastaRaizDos = await root.getDirectoryHandle('Despesas-OS', { create: true });
        var pastaAno = await pastaRaizDos.getDirectoryHandle(ano, { create: true });
        var pastaMes = await pastaAno.getDirectoryHandle(nomePastaMes, { create: true });
        var pastaEntradas = await pastaMes.getDirectoryHandle('Entradas', { create: true });
        var pastaSaidas = await pastaMes.getDirectoryHandle('Saidas', { create: true });

        await gravarTextoNaPasta(pastaEntradas, 'bruto-os-' + mesNum + '-' + ano + '.html',
            htmlArquivoRelatorioMes(emp, 'BRUTO / ENTRADAS POR OS', mesAno, htmlEntradas));
        await gravarTextoNaPasta(pastaEntradas, 'bruto-os-' + mesNum + '-' + ano + '.json',
            JSON.stringify(entradas, null, 2));

        await gravarTextoNaPasta(pastaSaidas, 'despesas-' + mesNum + '-' + ano + '.html',
            htmlArquivoRelatorioMes(emp, 'DESPESAS / SAÍDAS INTERNAS', mesAno, htmlSaidas));
        await gravarTextoNaPasta(pastaSaidas, 'despesas-' + mesNum + '-' + ano + '.json',
            JSON.stringify(saidas, null, 2));

        await gravarTextoNaPasta(pastaMes, 'Relatorio-Geral-Lucro-OS-' + mesNum + '-' + ano + '.html',
            htmlArquivoRelatorioMes(emp, 'RELATÓRIO MENSAL — LUCRO POR OS (INTERNO)', mesAno, montado.html));
        await gravarTextoNaPasta(pastaMes, 'resumo-lucro-os-' + mesNum + '-' + ano + '.json', JSON.stringify({
            mesAno: mesAno,
            mes: mesNome,
            geradoEm: new Date().toISOString(),
            totais: {
                bruto: montado.totBruto,
                despesas: montado.totDespesas,
                lucro: montado.totLucro
            },
            qtdOs: lista.length,
            os: lista
        }, null, 2));

        toast('Mês ' + mesAno + ' arquivado em Despesas-OS/' + ano + '/' + nomePastaMes);
        alert(
            'Pasta de despesas por OS criada!\n\n' +
            root.name + '/Despesas-OS/' + ano + '/' + nomePastaMes + '/\n' +
            '  ├─ Entradas/  (bruto das OS)\n' +
            '  ├─ Saidas/    (despesas internas)\n' +
            '  └─ Relatorio-Geral-Lucro-OS-…html\n\n' +
            'Bruto: ' + moeda(montado.totBruto) +
            '\nDespesas: ' + moeda(montado.totDespesas) +
            '\nLucro: ' + moeda(montado.totLucro)
        );
    } catch (err) {
        console.error(err);
        toast('Falha ao gravar a pasta de despesas por OS no PC.');
    }
}

function renderRelatorioCaixa() {
    var db = carregar();
    var cfg = getCaixaConfig(db);
    var balEnt = somarLista(db.caixa, 'entrada');
    var balSai = somarLista(db.caixa, 'saida');
    var banEnt = somarLista(db.caixaBanco, 'entrada');
    var banSai = somarLista(db.caixaBanco, 'saida');
    var pend = (db.pendentes || []).reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
    var salBal = (Number(cfg.inicialBalcao) || 0) + balEnt - balSai;
    var salBan = (Number(cfg.inicialBanco) || 0) + banEnt - banSai;
    document.getElementById('relCxBalcao').textContent = moeda(salBal);
    document.getElementById('relCxBanco').textContent = moeda(salBan);
    document.getElementById('relCxPend').textContent = moeda(pend);
    document.getElementById('relCxGeral').textContent = moeda(salBal + salBan);

    var mapa = {};
    function acum(origem, item) {
        var k = origem + '|' + (item.forma || '—') + '|' + (item.tipo || '—');
        if (!mapa[k]) mapa[k] = { origem: origem, forma: item.forma || '—', tipo: item.tipo || '—', qtd: 0, total: 0 };
        mapa[k].qtd++;
        mapa[k].total += Number(item.valor) || 0;
    }
    (db.caixa || []).forEach(function (x) { acum('Balcão', x); });
    (db.caixaBanco || []).forEach(function (x) { acum('Banco', x); });

    var tb = document.getElementById('tabelaRelCx');
    var rows = Object.keys(mapa).map(function (k) { return mapa[k]; });
    tb.innerHTML = '';
    if (!rows.length) {
        tb.innerHTML = '<tr><td colspan="5" class="muted">Sem movimentações para resumir.</td></tr>';
    } else {
        rows.sort(function (a, b) { return a.origem.localeCompare(b.origem) || a.forma.localeCompare(b.forma); });
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + esc(r.origem) + '</td>' +
                '<td>' + esc(r.forma) + '</td>' +
                '<td>' + esc(r.tipo) + '</td>' +
                '<td>' + r.qtd + '</td>' +
                '<td>' + moeda(r.total) + '</td>';
            tb.appendChild(tr);
        });
    }

    /* No modo interno: resumo de lucro por OS (despesas vinculadas) */
    var boxRel = document.getElementById('relCxConteudo');
    var oldLucro = document.getElementById('relLucroOsBox');
    if (oldLucro) oldLucro.remove();
    if (canalVendas === 'interno') {
        var main = carregarMain();
        var linhasLucro = [];
        var totBruto = 0, totDesp = 0;
        (main.atendimentos || []).forEach(function (a) {
            var r = resumoLucroOs(a);
            if (r.despesas <= 0 && r.bruto <= 0) return;
            if (r.despesas <= 0) return; /* só OS com despesa interna */
            totBruto += r.bruto;
            totDesp += r.despesas;
            linhasLucro.push({
                data: fmtData(a.entrada || a.criadoEm),
                cliente: nomeAtendimento(main, a),
                placa: (a.placa || '—').toUpperCase(),
                bruto: r.bruto,
                despesas: r.despesas,
                lucro: r.lucro
            });
        });
        var wrap = document.createElement('div');
        wrap.id = 'relLucroOsBox';
        wrap.style.marginTop = '18px';
        if (!linhasLucro.length) {
            wrap.innerHTML = '<h2>Lucro por OS (despesas internas)</h2><p class="muted">Nenhuma despesa vinculada a OS ainda.</p>';
        } else {
            wrap.innerHTML =
                '<h2>Lucro por OS (despesas internas)</h2>' +
                '<p class="hint">Bruto das OS oficiais − saídas do caixa interno vinculadas. Total despesas: <strong>' +
                moeda(totDesp) + '</strong> · Lucro: <strong>' + moeda(totBruto - totDesp) + '</strong></p>' +
                '<table><thead><tr><th>Data</th><th>Cliente</th><th>Placa</th><th>Bruto</th><th>Despesas</th><th>Lucro</th></tr></thead>' +
                '<tbody>' +
                linhasLucro.map(function (r) {
                    return '<tr><td>' + esc(r.data) + '</td><td>' + esc(r.cliente) + '</td><td>' +
                        esc(r.placa) + '</td><td>' + moeda(r.bruto) + '</td><td>' +
                        moeda(r.despesas) + '</td><td><strong>' + moeda(r.lucro) + '</strong></td></tr>';
                }).join('') +
                '</tbody></table>';
        }
        boxRel.appendChild(wrap);
    }

    gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
}

document.getElementById('btnAtualizarRelCx').addEventListener('click', function () {
    renderRelatorioCaixa();
    toast('Relatório atualizado.');
});
document.getElementById('btnImprimirRelCx').addEventListener('click', function () {
    renderRelatorioCaixa();
    var db = carregar();
    var emp = getEmpresa(db);
    executarImpressaoHtml(
        '<div class="nota-espelho">' +
        htmlCabecalhoNotaEmpresa(emp,
            '<div class="nota-sub nota-titulo-espelho">Relatório de Caixa · ' + esc(fmtData(hojeISO())) + '</div>'
        ) +
        document.getElementById('relCxConteudo').innerHTML +
        '<div style="margin-top:12px">Balcão: <strong>' + document.getElementById('relCxBalcao').textContent +
        '</strong> · Banco: <strong>' + document.getElementById('relCxBanco').textContent +
        '</strong> · Pendentes: <strong>' + document.getElementById('relCxPend').textContent +
        '</strong> · Geral: <strong>' + document.getElementById('relCxGeral').textContent + '</strong></div></div>'
    );
});

document.querySelectorAll('[data-rel-mes]').forEach(function (b) {
    if (b.hasAttribute('data-rel-mes-fixo')) return;
    b.addEventListener('click', function () {
        gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes') || 'geral');
    });
});
document.getElementById('btnAtualizarPastasCx').addEventListener('click', function () {
    gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
    toast('Pastas atualizadas.');
});
document.getElementById('btnArquivarMesPc').addEventListener('click', function () {
    arquivarMesPastaPC(null, 'geral');
});

document.getElementById('btnAtualizarPastasDespesas').addEventListener('click', function () {
    renderRelatorioDespesas();
    toast('Pastas de despesas atualizadas.');
});
document.getElementById('btnRelMesDespesas').addEventListener('click', function () {
    gerarRelatorioMensalPDF('despesas');
});
document.getElementById('btnArquivarMesDespesas').addEventListener('click', function () {
    arquivarMesPastaPC(null, 'despesas');
});

document.getElementById('btnAtualizarPastasBanco').addEventListener('click', function () {
    gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
    toast('Pastas do banco atualizadas.');
});
document.getElementById('btnRelMesBanco').addEventListener('click', function () {
    gerarRelatorioMensalPDF('banco');
});
document.getElementById('btnArquivarMesBanco').addEventListener('click', function () {
    arquivarMesPastaPC(null, 'banco');
});

document.getElementById('btnAtualizarPastasPend').addEventListener('click', function () {
    gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
    toast('Pastas a receber atualizadas.');
});
document.getElementById('btnRelMesPend').addEventListener('click', function () {
    gerarRelatorioMensalPDF('pendentes');
});
document.getElementById('btnArquivarMesPend').addEventListener('click', function () {
    arquivarMesPastaPC(null, 'pendentes');
});


function fecharCaixaDoDia() {
    var db = carregar();
    var hoje = hojeISO();
    var cfg = db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 };
    var ent = 0, sai = 0;
    (db.caixa || []).forEach(function (l) {
        if (String(l.criadoEm || '').slice(0, 10) !== hoje) return;
        if (l.tipo === 'entrada') ent += Number(l.valor) || 0;
        if (l.tipo === 'saida') sai += Number(l.valor) || 0;
    });
    var inicial = Number(cfg.inicialBalcao) || 0;
    var saldo = inicial + ent - sai;
    var of = calcularRelatorioOficina({ inicio: hoje, fim: hoje, label: hoje });
    if (!confirm(
        'Fechar o caixa do dia ' + fmtData(hoje) + '?\n\n' +
        'Inicial: ' + moeda(inicial) + '\nEntradas: ' + moeda(ent) + '\nSaídas: ' + moeda(sai) + '\nSaldo: ' + moeda(saldo) + '\n\n' +
        'Oficina — ganho peças: ' + moeda(of.ganho) + ' · MO: ' + moeda(of.mao)
    )) return;
    if (!db.fechamentosCaixa) db.fechamentosCaixa = [];
    db.fechamentosCaixa.push({
        id: uid(),
        data: hoje,
        inicialBalcao: inicial,
        entradas: ent,
        saidas: sai,
        saldo: saldo,
        pecasBruto: of.pecas,
        ganhoPecas: of.ganho,
        maoObra: of.mao,
        despesas: of.despesas,
        resultado: of.resultado,
        criadoEm: new Date().toISOString()
    });
    salvar(db);
    toast('Caixa do dia fechado e salvo no histórico.');
    imprimirFechamentoDia(db.fechamentosCaixa[db.fechamentosCaixa.length - 1]);
}

function imprimirFechamentoDia(f) {
    var emp = getEmpresa();
    var html = '<html><head><title>Fechamento ' + esc(f.data) + '</title><style>body{font-family:Segoe UI,sans-serif;padding:24px} h1{margin:0 0 8px} .l{margin:6px 0}</style></head><body>';
    html += '<h1>' + esc(emp.nome || 'Joninha Suspensões') + '</h1>';
    html += '<h2>Fechamento de caixa — ' + esc(fmtData(f.data)) + '</h2>';
    html += '<div class="l">Caixa inicial: <b>' + moeda(f.inicialBalcao) + '</b></div>';
    html += '<div class="l">Entradas: <b>' + moeda(f.entradas) + '</b></div>';
    html += '<div class="l">Saídas: <b>' + moeda(f.saidas) + '</b></div>';
    html += '<div class="l">Saldo final: <b>' + moeda(f.saldo) + '</b></div><hr>';
    html += '<div class="l">Peças (venda): <b>' + moeda(f.pecasBruto) + '</b></div>';
    html += '<div class="l">Ganho em peças: <b>' + moeda(f.ganhoPecas) + '</b></div>';
    html += '<div class="l">Mão de obra: <b>' + moeda(f.maoObra) + '</b></div>';
    html += '<div class="l">Despesas: <b>' + moeda(f.despesas) + '</b></div>';
    html += '<div class="l">Resultado estimado: <b>' + moeda(f.resultado) + '</b></div>';
    html += '<p style="margin-top:18px;color:#666;font-size:12px">Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + '</p></body></html>';
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
}

