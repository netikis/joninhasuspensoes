'use strict';
/* Joninha — caixa / balcão / banco / pastas / relatórios (etapa 2.2) */

/* ---------- Caixa / Relatórios (modelo FH Control) ---------- */
function getCaixaConfig(db) {
    return Object.assign({
        inicialBalcao: 0,
        inicialBanco: 0,
        basePainelEntradas: 0,
        basePainelSaidas: 0,
        basePainelEntradasBanco: 0,
        basePainelSaidasBanco: 0,
        baseOficinaMes: '',
        baseOficinaInicio: '',
        baseOficinaPecas: 0,
        baseOficinaGanho: 0,
        baseOficinaMao: 0,
        atualizadoEm: '',
        zeradoEm: '',
        fechadoEm: '',
        osBloqueadasCaixa: {}
    }, (db && db.caixaConfig) || {});
}

var paginaAtualCaixa = 1;
var itensPorPaginaCaixa = 20;
var paginaAtualBanco = 1;
var itensPorPaginaBanco = 20;

function formaEhDigitalCx(forma) {
    if (typeof formaPagamentoEhDigital === 'function') return formaPagamentoEhDigital(forma);
    var f = String(forma || '').toLowerCase();
    return /pix|cart[aã]o|boleto|transfer/.test(f);
}

function dataLancISO(x) {
    return String(x && (x.data || x.criadoEm) || '').slice(0, 10);
}

function ordenarLancamentosPorData(lista) {
    return (lista || []).slice().sort(function (a, b) {
        var da = dataLancISO(a);
        var dbd = dataLancISO(b);
        if (da !== dbd) return String(dbd).localeCompare(String(da));
        return String(b.criadoEm || b.id || '').localeCompare(String(a.criadoEm || a.id || ''));
    });
}

function renderResumoCaixaHoje() {
    var tbody = document.getElementById('tabelaResumoPgto');
    if (!tbody) return;
    var db = carregarMain();
    var cfg = getCaixaConfig(db);
    var corte = cfg.zeradoEm || cfg.fechadoEm || '';
    var resumo = {};
    var resumoDigital = {};
    var qtdDespesas = 0;
    var totalDespesas = 0;

    function noCaixaAberto(x) {
        if (!x) return false;
        if (!corte) return true;
        return String(x.criadoEm || '') >= corte;
    }

    function addEntrada(mapa, forma, valor, icone) {
        var chave = forma || 'Outros';
        if (!mapa[chave]) mapa[chave] = { qtd: 0, total: 0, icone: icone || '💰' };
        mapa[chave].qtd++;
        mapa[chave].total += Number(valor) || 0;
    }

    (db.caixa || []).forEach(function (x) {
        if (!noCaixaAberto(x)) return;
        var valor = Number(x.valor) || 0;
        if (x.tipo === 'saida') {
            qtdDespesas++;
            totalDespesas += valor;
            return;
        }
        if (x.tipo !== 'entrada') return;
        var forma = x.forma || 'Dinheiro';
        if (formaEhDigitalCx(forma)) addEntrada(resumoDigital, forma.replace(/Cartão de /i, ''), valor, /pix/i.test(forma) ? '🌀' : '💳');
        else addEntrada(resumo, forma, valor, '💰');
    });
    (db.caixaBanco || []).forEach(function (x) {
        if (!noCaixaAberto(x)) return;
        var valor = Number(x.valor) || 0;
        if (x.tipo === 'saida') {
            qtdDespesas++;
            totalDespesas += valor;
            return;
        }
        if (x.tipo !== 'entrada') return;
        var forma = x.forma || 'PIX';
        addEntrada(resumoDigital, forma.replace(/Cartão de /i, ''), valor, /pix/i.test(forma) ? '🌀' : '💳');
    });

    var html = '';
    Object.keys(resumo).forEach(function (forma) {
        var r = resumo[forma];
        html += '<tr><td style="font-weight:700">' + esc(r.icone + ' ' + forma) +
            ' <small class="muted">(gaveta)</small></td>' +
            '<td style="text-align:center">' + r.qtd + '</td>' +
            '<td style="text-align:right;color:#2ecc71;font-weight:800">' + moeda(r.total) + '</td>' +
            '<td style="text-align:center"><span class="badge-cx entrada">ENTRADA</span></td></tr>';
    });
    Object.keys(resumoDigital).forEach(function (forma) {
        var r = resumoDigital[forma];
        html += '<tr><td style="font-weight:700">' + esc(r.icone + ' ' + forma) +
            ' <small class="muted">(banco — recebido hoje)</small></td>' +
            '<td style="text-align:center">' + r.qtd + '</td>' +
            '<td style="text-align:right;color:#5dade2;font-weight:800">' + moeda(r.total) + '</td>' +
            '<td style="text-align:center"><span class="badge-cx os">BANCO</span></td></tr>';
    });
    html += '<tr><td style="font-weight:700;color:#e74c3c">🔻 Despesas / Saídas</td>' +
        '<td style="text-align:center;color:#e74c3c">' + qtdDespesas + '</td>' +
        '<td style="text-align:right;color:#e74c3c;font-weight:800">- ' + moeda(totalDespesas) + '</td>' +
        '<td style="text-align:center"><span class="badge-cx despesas">SAÍDA</span></td></tr>';
    if (!Object.keys(resumo).length && !Object.keys(resumoDigital).length && !qtdDespesas) {
        html = '<tr><td colspan="4" class="muted" style="text-align:center">Sem movimentação no caixa aberto. Feche o caixa para zerar os cards — o mês continua no Relatório Caixa.</td></tr>';
    }
    tbody.innerHTML = html;
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
            basePainelEntradasBanco: Number(L.basePainelEntradasBanco) || Number(N.basePainelEntradasBanco) || 0,
            basePainelSaidasBanco: Number(L.basePainelSaidasBanco) || Number(N.basePainelSaidasBanco) || 0,
            baseOficinaMes: L.baseOficinaMes || N.baseOficinaMes || '',
            baseOficinaInicio: L.baseOficinaInicio || N.baseOficinaInicio || '',
            baseOficinaPecas: Math.max(Number(L.baseOficinaPecas) || 0, Number(N.baseOficinaPecas) || 0),
            baseOficinaGanho: Math.max(Number(L.baseOficinaGanho) || 0, Number(N.baseOficinaGanho) || 0),
            baseOficinaMao: Math.max(Number(L.baseOficinaMao) || 0, Number(N.baseOficinaMao) || 0),
            zeradoEm: L.zeradoEm || N.zeradoEm || '',
            fechadoEm: L.fechadoEm || N.fechadoEm || '',
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

function somarListaPeriodo(lista, tipo, ini, fim) {
    return (lista || []).filter(function (x) {
        if (!x || x.tipo !== tipo) return false;
        var d = String(x.criadoEm || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
        if (ini && d < ini) return false;
        if (fim && d > fim) return false;
        return true;
    }).reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
}

function totaisPainelLista(lista, baseEnt, baseSai, inicial) {
    var brutasE = somarLista(lista, 'entrada');
    var brutasS = somarLista(lista, 'saida');
    var entradas = Math.max(0, brutasE - (Number(baseEnt) || 0));
    var saidas = Math.max(0, brutasS - (Number(baseSai) || 0));
    var ini = Number(inicial) || 0;
    return {
        brutasE: brutasE,
        brutasS: brutasS,
        inicial: ini,
        entradas: entradas,
        saidas: saidas,
        saldo: ini + entradas - saidas
    };
}

function totaisPainelCaixa(db) {
    db = db || ((typeof carregarMain === 'function') ? carregarMain() : carregar());
    var cfg = getCaixaConfig(db);
    return {
        cfg: cfg,
        balcao: totaisPainelLista(db.caixa, cfg.basePainelEntradas, cfg.basePainelSaidas, cfg.inicialBalcao),
        banco: totaisPainelLista(db.caixaBanco, cfg.basePainelEntradasBanco, cfg.basePainelSaidasBanco, cfg.inicialBanco)
    };
}

function aplicarZerarPaineisCaixa(db) {
    var cfg = getCaixaConfig(db);
    cfg.inicialBalcao = 0;
    cfg.inicialBanco = 0;
    cfg.basePainelEntradas = somarLista(db.caixa, 'entrada');
    cfg.basePainelSaidas = somarLista(db.caixa, 'saida');
    cfg.basePainelEntradasBanco = somarLista(db.caixaBanco, 'entrada');
    cfg.basePainelSaidasBanco = somarLista(db.caixaBanco, 'saida');
    var hoje = (typeof hojeISO === 'function') ? hojeISO() : new Date().toISOString().slice(0, 10);
    var ym = String(hoje).slice(0, 7);
    if (typeof calcularRelatorioOficina === 'function') {
        var ofLive = calcularRelatorioOficina({ inicio: ym + '-01', fim: hoje, label: ym });
        cfg.baseOficinaMes = ym;
        cfg.baseOficinaInicio = hoje;
        cfg.baseOficinaPecas = Number(ofLive.pecas) || 0;
        cfg.baseOficinaGanho = Number(ofLive.ganho) || 0;
        cfg.baseOficinaMao = Number(ofLive.mao) || 0;
    }
    cfg.zeradoEm = new Date().toISOString();
    cfg.fechadoEm = cfg.zeradoEm;
    return cfg;
}

function lancamentoEhFechamento(x) {
    return !!(x && (x.tipo === 'fechamento' || x.origemFechamento || x.fechamentoId));
}

function totaisOficinaPainel(db) {
    db = db || ((typeof carregarMain === 'function') ? carregarMain() : null);
    var hoje = (typeof hojeISO === 'function') ? hojeISO() : new Date().toISOString().slice(0, 10);
    var ym = String(hoje).slice(0, 7);
    var live = { pecas: 0, ganho: 0, mao: 0, despesas: 0, resultado: 0, maoCasa: 0, comissao: 0, linhas: [] };
    if (typeof calcularRelatorioOficina === 'function') {
        live = calcularRelatorioOficina({ inicio: ym + '-01', fim: hoje, label: ym });
    }
    var cfg = getCaixaConfig(db);
    var mesmaMes = String(cfg.baseOficinaMes || '') === ym;
    var pecas = Math.max(0, (Number(live.pecas) || 0) - (mesmaMes ? (Number(cfg.baseOficinaPecas) || 0) : 0));
    var ganho = Math.max(0, (Number(live.ganho) || 0) - (mesmaMes ? (Number(cfg.baseOficinaGanho) || 0) : 0));
    var mao = Math.max(0, (Number(live.mao) || 0) - (mesmaMes ? (Number(cfg.baseOficinaMao) || 0) : 0));
    return {
        pecas: pecas,
        ganho: ganho,
        mao: mao,
        totalOficina: pecas + mao,
        moGanho: mao + ganho,
        despesas: Number(live.despesas) || 0,
        resultado: Number(live.resultado) || 0,
        live: live,
        ini: ym + '-01',
        fim: hoje,
        ym: ym
    };
}

function snapshotDiscricaoFechamento(db, ini, fim, corteIso) {
    db = db || ((typeof carregarMain === 'function') ? carregarMain() : (typeof carregar === 'function' ? carregar() : {}));
    var of = { pecas: 0, ganho: 0, mao: 0, despesas: 0, resultado: 0, comissao: 0, maoCasa: 0, linhas: [] };
    if (typeof calcularRelatorioOficina === 'function') {
        of = calcularRelatorioOficina({ inicio: ini, fim: fim, label: ini });
    }
    var linhasOficina = (of.linhas || []).map(function (l) {
        var pecas = Number(l.pecas) || 0;
        var mao = Number(l.mao) || 0;
        var tot = Number(l.total);
        return {
            origem: l.origem || '',
            data: l.data || '',
            cliente: l.cliente || '',
            placa: l.placa || '',
            numero: l.numero || '',
            pecas: pecas,
            mao: mao,
            ganho: Number(l.ganho) || 0,
            total: tot > 0 ? tot : (pecas + mao)
        };
    });
    var corte = corteIso || (ini ? (String(ini) + 'T00:00:00.000') : '');
    var entOf = [];
    var entOut = [];
    function walk(lista, canal) {
        (lista || []).forEach(function (x) {
            if (!x || lancamentoEhFechamento(x) || x.tipo !== 'entrada') return;
            if (corte && String(x.criadoEm || '') < corte) return;
            var item = {
                data: String(x.criadoEm || '').slice(0, 10),
                desc: String(x.clienteNome || x.descricao || 'Entrada'),
                canal: canal,
                forma: x.forma || '',
                valor: Number(x.valor) || 0
            };
            if (x.atendimentoId || x.origemOficina || x.origemVenda || x.vendaId || x.orcamentoId) {
                entOf.push(item);
            } else {
                entOut.push(item);
            }
        });
    }
    walk(db.caixa, 'Balcão');
    walk(db.caixaBanco, 'Banco');
    return {
        pecas: Number(of.pecas) || 0,
        ganho: Number(of.ganho) || 0,
        mao: Number(of.mao) || 0,
        despesas: Number(of.despesas) || 0,
        resultado: Number(of.resultado) || 0,
        comissao: Number(of.comissao) || 0,
        maoCasa: Number(of.maoCasa) || 0,
        totalOficina: (Number(of.pecas) || 0) + (Number(of.mao) || 0),
        linhasOficina: linhasOficina,
        entradasCaixaOficina: entOf,
        entradasCaixaOutras: entOut
    };
}

function enriquecerFechamentoParaRelatorio(f) {
    if (!f) return f;
    if (f.linhasOficina && f.linhasOficina.length) return f;
    var ini = f.periodoDe || f.data;
    var fim = f.periodoAte || f.data;
    if (!ini || !fim) return f;
    try {
        var db = (typeof carregarMain === 'function') ? carregarMain() : carregar();
        var snap = snapshotDiscricaoFechamento(db, ini, fim, ini ? (String(ini) + 'T00:00:00.000') : '');
        f.linhasOficina = snap.linhasOficina;
        f.entradasCaixaOficina = snap.entradasCaixaOficina;
        f.entradasCaixaOutras = snap.entradasCaixaOutras;
        if (f.totalOficina == null) f.totalOficina = snap.totalOficina;
        if (f.comissao == null) f.comissao = snap.comissao;
        if (f.maoCasa == null) f.maoCasa = snap.maoCasa;
    } catch (eEnr) { /* ok */ }
    return f;
}

function montarLancamentoFechamentoCaixa(f) {
    var ini = Number(f.inicialBalcao != null ? f.inicialBalcao : f.inicial) || 0;
    var ent = Number(f.entradasBalcao != null ? f.entradasBalcao : f.entradas) || 0;
    var sai = Number(f.saidasBalcao != null ? f.saidasBalcao : f.saidas) || 0;
    var sal = Number(f.saldoBalcao != null ? f.saldoBalcao : f.saldo) || 0;
    var dataRef = String(f.data || f.criadoEm || ((typeof hojeISO === 'function') ? hojeISO() : '')).slice(0, 10);
    var parts = dataRef.split('-');
    var numDoc = 'FECH' + (parts.length === 3 ? (parts[2] + parts[1] + String(parts[0]).slice(2)) : '');
    return {
        id: 'fech_' + f.id,
        tipo: 'fechamento',
        origemFechamento: true,
        fechamentoId: f.id,
        numDoc: numDoc,
        clienteNome: 'Fechamento caixa — inicial ' + moeda(ini) +
            ' · entradas ' + moeda(ent) +
            ' · saídas ' + moeda(sai) +
            ' · balanço ' + moeda(sal),
        descricao: 'Fechamento de caixa',
        valor: Number(f.saldo != null ? f.saldo : sal) || 0,
        forma: '',
        conta: 'balcao',
        vencimento: dataRef,
        fechamento: f,
        criadoEm: f.criadoEm || (dataRef + 'T23:59:59.000Z')
    };
}

function garantirLancamentosFechamento(db) {
    if (!db) return false;
    if (!db.caixa) db.caixa = [];
    var ids = {};
    var exCx = (typeof garantirExcluidos === 'function') ? (garantirExcluidos(db).caixa || {}) : {};
    db.caixa.forEach(function (l) {
        if (!l) return;
        if (l.fechamentoId) ids[String(l.fechamentoId)] = true;
        if (l.origemFechamento && l.id) ids[String(l.id).replace(/^fech_/, '')] = true;
    });
    var mudou = false;
    (db.fechamentosCaixa || []).forEach(function (f) {
        if (!f || !f.id || ids[String(f.id)]) return;
        var lancId = 'fech_' + f.id;
        if (exCx[lancId] || exCx[String(f.id)]) return;
        db.caixa.push(montarLancamentoFechamentoCaixa(f));
        ids[String(f.id)] = true;
        mudou = true;
    });
    return mudou;
}

function fechamentoPorId(id, db) {
    if (!id) return null;
    db = db || ((typeof carregarMain === 'function') ? carregarMain() : carregar());
    var hit = (db.fechamentosCaixa || []).find(function (f) { return f && String(f.id) === String(id); });
    if (hit) return hit;
    var lanc = lancamentoCaixaPorId(id);
    if (lanc && lanc.fechamento && lanc.fechamento.id) return lanc.fechamento;
    if (lanc && lanc.fechamentoId) {
        return (db.fechamentosCaixa || []).find(function (f) {
            return f && String(f.id) === String(lanc.fechamentoId);
        }) || lanc.fechamento || null;
    }
    return null;
}

function abrirRelatorioFechamento(id) {
    var f = fechamentoPorId(id);
    if (!f) {
        toast('Fechamento não encontrado.');
        return;
    }
    verFechamentoDia(f);
}
window.abrirRelatorioFechamento = abrirRelatorioFechamento;

function zerarPainelCaixa() {
    if (!confirm(
        '⚠️ ATENÇÃO: Zerar o painel do Caixa / Balcão e do Caixa digital?\n\n' +
        'Os cards voltam para R$ 0,00.\n' +
        'Os documentos NÃO são apagados — Relatório Caixa e as pastas do mês continuam com tudo.'
    )) return;
    var db = carregarMain();
    salvarCaixaConfigOficial(aplicarZerarPaineisCaixa(db));
    renderCaixa();
    renderCaixaBanco();
    atualizarKPIs(carregarMain());
    toast('Painel do caixa zerado (balcão + digital).');
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
    if (x.origemVenda || x.vendaId || x.orcamentoId) return { sigla: 'VENDA', cls: 'entrada' };
    var ids = resolverDocCaixa(x);
    if (ids.idOs) return { sigla: 'ORDEM.SERV.', cls: 'os' };
    if (ids.idVd) return { sigla: 'VENDA', cls: 'entrada' };
    return { sigla: 'ENTRADA', cls: 'entrada' };
}

function numDocCaixaFh(x) {
    if (lancamentoEhFechamento(x) && x.numDoc) return String(x.numDoc);
    if (x.osResumo && x.osResumo.placa) return String(x.osResumo.placa).toUpperCase();
    if (x.vendaResumo && x.vendaResumo.numero != null && String(x.vendaResumo.numero) !== '') {
        return String(x.vendaResumo.numero);
    }
    if (x.numDoc) return String(x.numDoc);
    return String(x.id || '—').slice(-6).toUpperCase();
}

function clienteCaixaFh(x) {
    if (lancamentoEhFechamento(x)) {
        return x.clienteNome || x.descricao || 'Fechamento de caixa';
    }
    if (x.osResumo && x.osResumo.cliente) return x.osResumo.cliente;
    if (x.vendaResumo && x.vendaResumo.cliente) return x.vendaResumo.cliente;
    if (x.clienteNome) return x.clienteNome;
    return x.descricao || '—';
}

function renderCaixa() {
    sincronizarOficinaNoCaixaEmpresa();
    /* Sempre lê o caixa oficial da empresa (não o banco interno) */
    var db = carregarMain();
    if (garantirLancamentosFechamento(db)) {
        salvarMain(db);
        if (typeof agendarSyncAutomatico === 'function') agendarSyncAutomatico('salvar');
    }
    var cfg = getCaixaConfig(db);
    var exCx = garantirExcluidos(db).caixa || {};
    var lista = aplicarExcluidosNaLista(db.caixa || [], exCx);
    /* Se ficou algum excluído no array, limpa de vez */
    if (lista.length !== (db.caixa || []).length) {
        db.caixa = lista;
        salvarMain(db);
    }
    var painelCx = totaisPainelLista(lista, cfg.basePainelEntradas, cfg.basePainelSaidas, cfg.inicialBalcao);
    var elIni = document.getElementById('cxInicial');
    if (elIni) elIni.textContent = moeda(painelCx.inicial);
    document.getElementById('cxEntradas').textContent = moeda(painelCx.entradas);
    document.getElementById('cxSaidas').textContent = moeda(painelCx.saidas);
    document.getElementById('cxSaldo').textContent = moeda(painelCx.saldo);

    var of = totaisOficinaPainel(db);
    var elPecas = document.getElementById('cxOfPecas');
    var elG = document.getElementById('cxOfGanho');
    var elM = document.getElementById('cxOfMao');
    var elN = document.getElementById('cxOfNoCaixa');
    var elSomaSub = document.getElementById('cxOfSomaSub');
    if (elPecas) elPecas.textContent = moeda(of.pecas);
    if (elG) elG.textContent = moeda(of.ganho);
    if (elM) elM.textContent = moeda(of.mao);
    if (elN) elN.textContent = moeda(of.moGanho);
    if (elSomaSub) elSomaSub.textContent = 'Mão de obra + ganho em peças';

    var tb = document.getElementById('tabelaCaixa');
    tb.innerHTML = '';
    if (typeof gerarArvorePastasCaixa === 'function') {
        try {
            gerarArvorePastasCaixa({ elId: 'arvorePastasBalcao', filtro: 'balcao', idPrefix: 'pasta_bal' });
        } catch (errPasta) {
            var elP = document.getElementById('arvorePastasBalcao');
            if (elP) elP.innerHTML = '<div class="muted" style="padding:10px;text-align:center">Não foi possível montar as pastas. Use a lista abaixo.</div>';
        }
    }
    renderResumoCaixaHoje();

    var q = ((document.getElementById('buscaCaixaBalcao') && document.getElementById('buscaCaixaBalcao').value) || '').toLowerCase().trim();
    var listaFiltrada = ordenarLancamentosPorData(lista).filter(function (x) {
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
        var infoVazia = document.getElementById('infoPaginaCaixa');
        if (infoVazia) infoVazia.textContent = 'Pág 1';
        return;
    }

    var maxPag = Math.max(1, Math.ceil(listaFiltrada.length / itensPorPaginaCaixa));
    if (paginaAtualCaixa > maxPag) paginaAtualCaixa = maxPag;
    if (paginaAtualCaixa < 1) paginaAtualCaixa = 1;
    var inicio = (paginaAtualCaixa - 1) * itensPorPaginaCaixa;
    var pagina = listaFiltrada.slice(inicio, inicio + itensPorPaginaCaixa);
    var infoPag = document.getElementById('infoPaginaCaixa');
    if (infoPag) infoPag.textContent = 'Pág ' + paginaAtualCaixa + ' de ' + maxPag;

    var main = carregarMain();
    pagina.forEach(function (x) {
        var tip = classificarTipoCaixaFh(x);
        var doc = numDocCaixaFh(x);
        var cli = clienteCaixaFh(x);
        var dataLanc = fmtData(x.criadoEm);
        var venc = x.vencimento ? fmtData(x.vencimento) : dataLanc;
        var valorCor = tip.cls === 'despesas' ? '#e74c3c' : (tip.cls === 'fech' ? '#f39c12' : '#2ecc71');
        var forma = (x.forma || '').toUpperCase();
        var statusHtml;
        if (tip.cls === 'fech') {
            statusHtml = '<span class="badge-cx fech">FECHADO</span>';
        } else if (tip.cls === 'despesas') {
            statusHtml = '—';
        } else {
            statusHtml = '<span class="badge-cx pago">✅ PAGO' + (forma ? ' - ' + esc(forma) : '') + '</span>';
        }
        var assHtml = htmlAssinaturaCaixa(main, x);

        var tr = document.createElement('tr');
        var idsRow = resolverDocCaixa(x);
        if (x.id) tr.setAttribute('data-cx-lanc', String(x.id));
        if (lancamentoEhFechamento(x)) {
            tr.setAttribute('data-cx-abrir-fech', String(x.fechamentoId || x.id));
            tr.style.cursor = 'pointer';
            tr.title = 'Clique para ver o relatório do fechamento';
        } else if (idsRow.idVd) {
            tr.setAttribute('data-cx-abrir-vd', idsRow.idVd);
            tr.style.cursor = 'pointer';
            tr.title = 'Clique para abrir a venda';
        } else if (idsRow.idOs) {
            tr.setAttribute('data-cx-abrir-os', idsRow.idOs);
            tr.style.cursor = 'pointer';
            tr.title = 'Clique para abrir a OS';
        }
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
        montarAcoesDocumentoCaixa(wrap, x);
        var bEx = document.createElement('button');
        bEx.type = 'button';
        bEx.className = 'btn btn-danger btn-cx-acao';
        bEx.innerHTML = '<span class="cx-acao-ico">🗑️</span><span class="cx-acao-txt">Excluir</span>';
        bEx.title = 'Excluir lançamento';
        bEx.setAttribute('data-ex', String(x.id || ''));
        if (x.atendimentoId) bEx.setAttribute('data-ex-at', String(x.atendimentoId));
        wrap.appendChild(bEx);
        acoesCell.appendChild(compactarAcoesOpcoesNota(wrap));
        tb.appendChild(tr);
    });

    if (!tb._cxClickLigado) {
        tb._cxClickLigado = true;
        tb.addEventListener('click', function (e) {
            var opt = e.target.closest('.btn-opcoes-nota');
            if (opt) {
                e.preventDefault();
                e.stopPropagation();
                var wrapOp = opt.closest('.cx-opcoes-wrap');
                document.querySelectorAll('.cx-opcoes-wrap.aberto').forEach(function (w) {
                    if (w !== wrapOp) w.classList.remove('aberto');
                });
                if (wrapOp) wrapOp.classList.toggle('aberto');
                return;
            }
            if (tratarCliqueAcoesDocumentoCaixa(e)) return;
            if (!e.target.closest('button') && !e.target.closest('a')) {
                var trAbrir = e.target.closest('tr[data-cx-abrir-fech], tr[data-cx-abrir-vd], tr[data-cx-abrir-os], tr[data-cx-lanc]');
                if (trAbrir) {
                    var idFech = trAbrir.getAttribute('data-cx-abrir-fech');
                    if (idFech) {
                        abrirRelatorioFechamento(idFech);
                        return;
                    }
                    var lanc = lancamentoCaixaPorId(trAbrir.getAttribute('data-cx-lanc'));
                    if (lanc && abrirDocumentoDoLancamentoCaixa(lanc)) return;
                    var idVd = trAbrir.getAttribute('data-cx-abrir-vd');
                    var idOs = trAbrir.getAttribute('data-cx-abrir-os');
                    if (idVd && typeof editarDocumentoVenda === 'function') {
                        editarDocumentoVenda(idVd);
                        return;
                    }
                    if (idOs && typeof editarAtendimento === 'function') {
                        editarAtendimento(idOs);
                        return;
                    }
                }
            }
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
            }
        });
    }
}

function valorTotalAtendimentoOs(at) {
    if (!at) return 0;
    var doc = Number(at.total) || 0;
    var itens = 0;
    try {
        if (typeof totaisItens === 'function') itens = Number(totaisItens(at.itens || []).total) || 0;
    } catch (eTot) { itens = 0; }
    return Math.max(doc, itens);
}

function totalNotaLancamentoCaixa(x) {
    if (!x) return 0;
    var nota = Number(x.osResumo && x.osResumo.totalOs);
    if (nota > 0.009) return nota;
    return Number(x.valor) || 0;
}

function acharAtendimentoPorLancamentoCaixa(x, db) {
    db = db || ((typeof carregarMain === 'function') ? carregarMain() : (typeof carregar === 'function' ? carregar() : null));
    var lista = (db && db.atendimentos) || [];
    if (!x || !lista.length) return null;
    var idOs = x.atendimentoId ? String(x.atendimentoId) : '';
    var totalAlvo = totalNotaLancamentoCaixa(x);
    var valorLanc = Number(x.valor) || 0;
    var placa = String((x.osResumo && x.osResumo.placa) || '').toUpperCase().trim();
    if (placa === '—' || placa === '-') placa = '';
    var nome = String((x.osResumo && x.osResumo.cliente) || x.clienteNome || '').toLowerCase().trim();

    function score(at) {
        if (!at) return -999;
        var s = 0;
        var tot = valorTotalAtendimentoOs(at);
        if (totalAlvo > 0.009 && Math.abs(tot - totalAlvo) < 0.05) s += 120;
        else if (valorLanc > 0.009 && Math.abs(tot - valorLanc) < 0.05) s += 90;
        else if (totalAlvo > 0.009 && tot > 0 && Math.abs(tot - totalAlvo) / Math.max(totalAlvo, tot) > 0.35) s -= 80;
        if (idOs && String(at.id) === idOs) s += 35;
        if (placa && String(at.placa || '').toUpperCase() === placa) s += 18;
        if (nome && String(at.clienteNome || '').toLowerCase() === nome) s += 12;
        return s;
    }

    var byId = idOs ? (lista.find(function (at) { return at && String(at.id) === idOs; }) || null) : null;
    var totId = valorTotalAtendimentoOs(byId);
    var notaResumo = Number(x.osResumo && x.osResumo.totalOs) || 0;
    if (byId) {
        if (notaResumo > 0.009 && Math.abs(totId - notaResumo) < 0.05) return byId;
        if (!(notaResumo > 0.009) && valorLanc > 0.009 && valorLanc <= totId + 0.05) return byId;
        if (Math.abs(totId - totalAlvo) < 0.05) return byId;
    }

    var melhor = null;
    var melhorS = -999;
    lista.forEach(function (at) {
        var s = score(at);
        if (s > melhorS) {
            melhorS = s;
            melhor = at;
        }
    });
    if (melhor && melhorS >= 90) return melhor;
    if (byId) return byId;
    return melhorS > 0 ? melhor : null;
}

function resolverDocCaixa(x) {
    if (lancamentoEhFechamento(x)) return { idOs: '', idVd: '' };
    var db = (typeof carregarMain === 'function') ? carregarMain() : carregar();
    var at = acharAtendimentoPorLancamentoCaixa(x, db);
    var idOs = at && at.id ? String(at.id) : (x && x.atendimentoId ? String(x.atendimentoId) : '');
    var idVd = x && (x.vendaId || x.orcamentoId) ? String(x.vendaId || x.orcamentoId) : '';
    if (!idVd && x) {
        var blob = [x.descricao, x.clienteNome].join(' ');
        var m = String(blob).match(/venda\s*n[ºo°]?\s*(\d+)/i);
        if (m) {
            var num = Number(m[1]);
            var o = (db.orcamentos || []).find(function (d) {
                return d && Number(d.numero) === num;
            });
            if (o && o.id) idVd = String(o.id);
        }
    }
    return { idOs: idOs, idVd: idVd };
}

function lancamentoCaixaPorId(id) {
    if (!id) return null;
    var db = (typeof carregarMain === 'function') ? carregarMain() : carregar();
    var listas = [(db && db.caixa) || [], (db && db.caixaBanco) || []];
    for (var i = 0; i < listas.length; i++) {
        var hit = listas[i].find(function (l) { return l && String(l.id) === String(id); });
        if (hit) return hit;
    }
    return null;
}

function abrirDocumentoDoLancamentoCaixa(x) {
    if (!x) return false;
    if (lancamentoEhFechamento(x)) {
        abrirRelatorioFechamento(x.fechamentoId || (x.fechamento && x.fechamento.id) || x.id);
        return true;
    }
    var ids = resolverDocCaixa(x);
    if (ids.idVd && typeof editarDocumentoVenda === 'function') {
        editarDocumentoVenda(ids.idVd);
        return true;
    }
    if (ids.idOs && typeof editarAtendimento === 'function') {
        editarAtendimento(ids.idOs, (x.osResumo && x.osResumo.placa) || x.descricao || '');
        return true;
    }
    return false;
}

function htmlAssinaturaCaixa(db, x) {
    if (lancamentoEhFechamento(x)) return '—';
    var ids = resolverDocCaixa(x);
    if (ids.idOs) {
        var at = (db.atendimentos || []).find(function (a) { return a && String(a.id) === ids.idOs; });
        if (at && at.assinaturaCliente) return '<span style="color:#2ecc71">✍️ OK</span>';
        return '<span style="color:#e74c3c">❌ Pend</span>';
    }
    if (ids.idVd) {
        var vd = (db.orcamentos || []).find(function (o) { return o && String(o.id) === ids.idVd; });
        if (vd && vd.assinaturaCliente) return '<span style="color:#2ecc71">✍️ OK</span>';
        return '<span style="color:#e74c3c">❌ Pend</span>';
    }
    return '—';
}

function appendBtnIconeCaixa(wrap, cls, emoji, texto, attr, valor, title) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + cls + ' btn-cx-acao';
    b.innerHTML = '<span class="cx-acao-ico">' + emoji + '</span><span class="cx-acao-txt">' + texto + '</span>';
    b.setAttribute(attr, valor);
    b.title = title || texto;
    wrap.appendChild(b);
}

/** Imprimir / PDF / Assinar / Excluir dentro da engrenagem. */
function compactarAcoesOpcoesNota(wrap) {
    var box = document.createElement('div');
    box.className = 'cx-opcoes-wrap';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary btn-opcoes-nota';
    btn.setAttribute('title', 'Ações da nota');
    btn.setAttribute('aria-label', 'Ações da nota');
    btn.textContent = '⚙️';
    var menu = document.createElement('div');
    menu.className = 'cx-opcoes-menu';
    while (wrap.firstChild) menu.appendChild(wrap.firstChild);
    box.appendChild(btn);
    box.appendChild(menu);
    return box;
}

function montarAcoesDocumentoCaixa(wrap, x) {
    if (!wrap || !x) return;
    if (lancamentoEhFechamento(x)) {
        var fid = String(x.fechamentoId || (x.fechamento && x.fechamento.id) || x.id);
        appendBtnIconeCaixa(wrap, 'btn-secondary', '👁️', 'Ver', 'data-cx-fech', fid, 'Ver relatório do fechamento');
        appendBtnIconeCaixa(wrap, 'btn-pdf', '📄', 'PDF', 'data-cx-fech-pdf', fid, 'Imprimir / salvar PDF do fechamento');
        return;
    }
    var ids = resolverDocCaixa(x);
    if (ids.idOs) {
        appendBtnIconeCaixa(wrap, 'btn-secondary', '🖨️', 'Imprimir', 'data-cx-imp', ids.idOs, 'Imprimir nota');
        appendBtnIconeCaixa(wrap, 'btn-pdf', '📄', 'PDF', 'data-cx-pdf', ids.idOs, 'Gerar PDF');
        appendBtnIconeCaixa(wrap, 'btn-assinar', '✍️', 'Assinar', 'data-cx-link', ids.idOs, 'Enviar para o cliente assinar');
        return;
    }
    if (ids.idVd) {
        appendBtnIconeCaixa(wrap, 'btn-secondary', '🖨️', 'Imprimir', 'data-cx-imp-vd', ids.idVd, 'Imprimir nota');
        appendBtnIconeCaixa(wrap, 'btn-pdf', '📄', 'PDF', 'data-cx-pdf-vd', ids.idVd, 'Gerar PDF');
        appendBtnIconeCaixa(wrap, 'btn-assinar', '✍️', 'Assinar', 'data-cx-link-vd', ids.idVd, 'Enviar para o cliente assinar');
    }
}

function appendBtnAcaoCaixa(wrap, cls, texto, attr, valor) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + cls;
    b.textContent = texto;
    b.setAttribute(attr, valor);
    wrap.appendChild(b);
}

function tratarCliqueAcoesDocumentoCaixa(e) {
    var b;
    function fecharMenus() {
        document.querySelectorAll('.cx-opcoes-wrap.aberto').forEach(function (w) {
            w.classList.remove('aberto');
        });
    }
    function hit() {
        e.preventDefault();
        e.stopPropagation();
        fecharMenus();
    }
    b = e.target.closest('[data-cx-ver]');
    if (b) { hit(); abrirNota(b.getAttribute('data-cx-ver')); return true; }
    b = e.target.closest('[data-cx-imp]');
    if (b) { hit(); imprimirNotaPdf(b.getAttribute('data-cx-imp')); return true; }
    b = e.target.closest('[data-cx-pdf]');
    if (b) {
        hit();
        var idOsPdf = b.getAttribute('data-cx-pdf');
        abrirNota(idOsPdf);
        setTimeout(function () { salvarNotaPdfArquivo(); }, 80);
        return true;
    }
    b = e.target.closest('[data-cx-link]');
    if (b) { hit(); abrirLinkAssinatura(b.getAttribute('data-cx-link')); return true; }
    b = e.target.closest('[data-cx-edit-os]');
    if (b) { hit(); editarAtendimento(b.getAttribute('data-cx-edit-os')); return true; }
    b = e.target.closest('[data-cx-ver-os]');
    if (b) { hit(); abrirNota(b.getAttribute('data-cx-ver-os')); return true; }
    b = e.target.closest('[data-cx-rec-os]');
    if (b) {
        hit();
        if (typeof abrirModalReceberOs === 'function') abrirModalReceberOs(b.getAttribute('data-cx-rec-os'));
        return true;
    }
    b = e.target.closest('[data-cx-ver-vd]');
    if (b) { hit(); abrirDocumentoVenda(b.getAttribute('data-cx-ver-vd')); return true; }
    b = e.target.closest('[data-cx-imp-vd]');
    if (b) { hit(); imprimirDocumentoVenda(b.getAttribute('data-cx-imp-vd')); return true; }
    b = e.target.closest('[data-cx-pdf-vd]');
    if (b) { hit(); salvarPdfDocumentoVenda(b.getAttribute('data-cx-pdf-vd')); return true; }
    b = e.target.closest('[data-cx-link-vd]');
    if (b) {
        hit();
        if (typeof abrirLinkAssinaturaVenda === 'function') {
            abrirLinkAssinaturaVenda(b.getAttribute('data-cx-link-vd'));
        }
        return true;
    }
    b = e.target.closest('[data-cx-fech]');
    if (b) {
        hit();
        abrirRelatorioFechamento(b.getAttribute('data-cx-fech'));
        return true;
    }
    b = e.target.closest('[data-cx-fech-pdf]');
    if (b) {
        hit();
        var fPdf = fechamentoPorId(b.getAttribute('data-cx-fech-pdf'));
        if (fPdf) imprimirFechamentoDia(fPdf);
        else toast('Fechamento não encontrado.');
        return true;
    }
    b = e.target.closest('[data-cx-edit-vd]');
    if (b) { hit(); editarDocumentoVenda(b.getAttribute('data-cx-edit-vd')); return true; }
    return false;
}

(function ligarBuscaCaixaBalcao() {
    var el = document.getElementById('buscaCaixaBalcao');
    if (!el || el._ligadoCx) return;
    el._ligadoCx = true;
    el.addEventListener('input', function () {
        paginaAtualCaixa = 1;
        renderCaixa();
    });
})();

document.addEventListener('click', function (e) {
    if (!e.target.closest('.cx-opcoes-wrap')) {
        document.querySelectorAll('.cx-opcoes-wrap.aberto').forEach(function (w) {
            w.classList.remove('aberto');
        });
    }
});

(function ligarPaginacaoCaixa() {
    var ant = document.getElementById('btnCxPagAnt');
    var prox = document.getElementById('btnCxPagProx');
    if (ant && !ant._ligado) {
        ant._ligado = true;
        ant.addEventListener('click', function () {
            paginaAtualCaixa = Math.max(1, paginaAtualCaixa - 1);
            renderCaixa();
        });
    }
    if (prox && !prox._ligado) {
        prox._ligado = true;
        prox.addEventListener('click', function () {
            paginaAtualCaixa += 1;
            renderCaixa();
        });
    }
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

var btnFecharBk = document.getElementById('btnFecharCaixaBanco');
if (btnFecharBk) btnFecharBk.addEventListener('click', function () { fecharCaixaDoDia(); });

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
    var painelBk = totaisPainelLista(lista, cfg.basePainelEntradasBanco, cfg.basePainelSaidasBanco, cfg.inicialBanco);
    var elBkIni = document.getElementById('bkInicial');
    if (elBkIni) elBkIni.textContent = moeda(painelBk.inicial);
    document.getElementById('bkEntradas').textContent = moeda(painelBk.entradas);
    document.getElementById('bkSaidas').textContent = moeda(painelBk.saidas);
    document.getElementById('bkSaldo').textContent = moeda(painelBk.saldo);

    var tb = document.getElementById('tabelaBanco');
    tb.innerHTML = '';
    if (typeof gerarArvorePastasCaixa === 'function') {
        gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
    }
    var qBk = ((document.getElementById('buscaCaixaBanco') && document.getElementById('buscaCaixaBanco').value) || '').toLowerCase().trim();
    var listaFiltradaBk = ordenarLancamentosPorData(lista).filter(function (x) {
        if (!qBk) return true;
        var blob = [numDocCaixaFh(x), clienteCaixaFh(x), x.descricao, x.forma, x.tipo, fmtData(x.criadoEm)].join(' ').toLowerCase();
        return blob.indexOf(qBk) > -1;
    });
    if (!listaFiltradaBk.length) {
        tb.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center">' +
            (lista.length ? 'Nenhum registro encontrado na busca.' : 'Sem lançamentos no banco.') + '</td></tr>';
        var infoVaziaBk = document.getElementById('infoPaginaBanco');
        if (infoVaziaBk) infoVaziaBk.textContent = 'Pág 1';
        return;
    }
    var maxPagBk = Math.max(1, Math.ceil(listaFiltradaBk.length / itensPorPaginaBanco));
    if (paginaAtualBanco > maxPagBk) paginaAtualBanco = maxPagBk;
    if (paginaAtualBanco < 1) paginaAtualBanco = 1;
    var paginaBk = listaFiltradaBk.slice((paginaAtualBanco - 1) * itensPorPaginaBanco, paginaAtualBanco * itensPorPaginaBanco);
    var infoBk = document.getElementById('infoPaginaBanco');
    if (infoBk) infoBk.textContent = 'Pág ' + paginaAtualBanco + ' de ' + maxPagBk;

    var mainBk = carregarMain();
    paginaBk.forEach(function (x) {
        var tip = classificarTipoCaixaFh(x);
        var doc = numDocCaixaFh(x);
        var cli = clienteCaixaFh(x);
        var dataLanc = fmtData(x.criadoEm);
        var venc = x.vencimento ? fmtData(x.vencimento) : dataLanc;
        var valorCor = tip.cls === 'despesas' ? '#e74c3c' : '#2ecc71';
        var forma = (x.forma || '').toUpperCase();
        var statusHtml = (tip.cls === 'despesas' || tip.cls === 'fech')
            ? '—'
            : '<span class="badge-cx pago">✅ PAGO' + (forma ? ' - ' + esc(forma) : '') + '</span>';
        var assHtml = htmlAssinaturaCaixa(mainBk, x);
        var tr = document.createElement('tr');
        var idsBk = resolverDocCaixa(x);
        if (x.id) tr.setAttribute('data-cx-lanc', String(x.id));
        if (idsBk.idVd) {
            tr.setAttribute('data-cx-abrir-vd', idsBk.idVd);
            tr.style.cursor = 'pointer';
            tr.title = 'Clique para abrir a venda';
        } else if (idsBk.idOs) {
            tr.setAttribute('data-cx-abrir-os', idsBk.idOs);
            tr.style.cursor = 'pointer';
            tr.title = 'Clique para abrir a OS';
        }
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
        montarAcoesDocumentoCaixa(wrap, x);
        var bEx = document.createElement('button');
        bEx.type = 'button';
        bEx.className = 'btn btn-danger btn-cx-acao';
        bEx.innerHTML = '<span class="cx-acao-ico">🗑️</span><span class="cx-acao-txt">Excluir</span>';
        bEx.title = 'Excluir lançamento';
        bEx.setAttribute('data-ex', String(x.id || ''));
        if (x.atendimentoId) bEx.setAttribute('data-ex-at', String(x.atendimentoId));
        wrap.appendChild(bEx);
        acoesCell.appendChild(compactarAcoesOpcoesNota(wrap));
        tb.appendChild(tr);
    });
    if (!tb._bkClickLigado) {
        tb._bkClickLigado = true;
        tb.addEventListener('click', function (e) {
            var opt = e.target.closest('.btn-opcoes-nota');
            if (opt) {
                e.preventDefault();
                e.stopPropagation();
                var wrapOp = opt.closest('.cx-opcoes-wrap');
                document.querySelectorAll('.cx-opcoes-wrap.aberto').forEach(function (w) {
                    if (w !== wrapOp) w.classList.remove('aberto');
                });
                if (wrapOp) wrapOp.classList.toggle('aberto');
                return;
            }
            if (tratarCliqueAcoesDocumentoCaixa(e)) return;
            if (!e.target.closest('button') && !e.target.closest('a')) {
                var trAbrirBk = e.target.closest('tr[data-cx-abrir-vd], tr[data-cx-abrir-os], tr[data-cx-lanc]');
                if (trAbrirBk) {
                    var lancBk = lancamentoCaixaPorId(trAbrirBk.getAttribute('data-cx-lanc'));
                    if (lancBk && abrirDocumentoDoLancamentoCaixa(lancBk)) return;
                    var idVdBk = trAbrirBk.getAttribute('data-cx-abrir-vd');
                    var idOsBk = trAbrirBk.getAttribute('data-cx-abrir-os');
                    if (idVdBk && typeof editarDocumentoVenda === 'function') {
                        editarDocumentoVenda(idVdBk);
                        return;
                    }
                    if (idOsBk && typeof editarAtendimento === 'function') {
                        editarAtendimento(idOsBk);
                        return;
                    }
                }
            }
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

(function ligarBuscaPaginacaoBanco() {
    var el = document.getElementById('buscaCaixaBanco');
    if (el && !el._ligadoBk) {
        el._ligadoBk = true;
        el.addEventListener('input', function () {
            paginaAtualBanco = 1;
            renderCaixaBanco();
        });
    }
    var ant = document.getElementById('btnBkPagAnt');
    var prox = document.getElementById('btnBkPagProx');
    if (ant && !ant._ligado) {
        ant._ligado = true;
        ant.addEventListener('click', function () {
            paginaAtualBanco = Math.max(1, paginaAtualBanco - 1);
            renderCaixaBanco();
        });
    }
    if (prox && !prox._ligado) {
        prox._ligado = true;
        prox.addEventListener('click', function () {
            paginaAtualBanco += 1;
            renderCaixaBanco();
        });
    }
})();

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
        vendaId: p.vendaId || '',
        atendimentoId: p.atendimentoId || '',
        criadoEm: new Date().toISOString()
    };
    if (destino === 'banco') {
        if (!db.caixaBanco) db.caixaBanco = [];
        db.caixaBanco.push(lanc);
    } else {
        if (!db.caixa) db.caixa = [];
        db.caixa.push(lanc);
    }
    if (p.vendaId) {
        var o = (db.orcamentos || []).find(function (x) { return x && String(x.id) === String(p.vendaId); });
        if (o) {
            var rec = (Number(o.valorRecebido) || 0) + (Number(p.valor) || 0);
            var tot = Number(o.valor) || 0;
            o.valorRecebido = +rec.toFixed(2);
            o.saldoAberto = Math.max(0, +(tot - rec).toFixed(2));
            o.statusPagamento = o.saldoAberto < 0.01 ? 'PAGO' : 'PARCIAL';
            if (!o.recebimentos) o.recebimentos = [];
            o.recebimentos.push({ forma: lanc.forma, valor: lanc.valor, em: lanc.criadoEm });
            o.atualizadoEm = new Date().toISOString();
        }
    }
    if (p.atendimentoId) {
        var os = (db.atendimentos || []).find(function (x) { return x && String(x.id) === String(p.atendimentoId); });
        if (os) {
            var recOs = (Number(os.valorRecebido) || 0) + (Number(p.valor) || 0);
            var totOs = Number(os.total) || 0;
            os.valorRecebido = +recOs.toFixed(2);
            os.saldoAberto = Math.max(0, +(totOs - recOs).toFixed(2));
            os.statusPagamento = os.saldoAberto < 0.01 ? 'PAGO' : 'PARCIAL';
            if (!os.recebimentos) os.recebimentos = [];
            os.recebimentos.push({ forma: lanc.forma, valor: lanc.valor, em: lanc.criadoEm });
            os.formaPagamento = (os.formaPagamento ? os.formaPagamento + ' + ' : '') + lanc.forma;
            os.atualizadoEm = new Date().toISOString();
            if (os.statusPagamento === 'PAGO' && (os.status || '') !== 'Entregue') {
                os.status = 'Entregue';
                if (!os.saida) os.saida = (typeof hojeISO === 'function') ? hojeISO() : new Date().toISOString().slice(0, 10);
            }
        }
    }
    if (canalVendas !== 'interno') marcarExcluido(db, 'pendentes', p.id);
    db.pendentes.splice(i, 1);
    salvar(db);
    toast('Recebido no ' + (destino === 'banco' ? 'banco' : 'balcão') + '.');
    renderPendentes();
    renderCaixa();
    renderCaixaBanco();
    if (typeof renderOrcamentos === 'function') renderOrcamentos();
    atualizarKPIs(db);
}

function excluirPendenteDaLista(id) {
    id = String(id || '').trim();
    if (!id) return;
    if (!confirm('Excluir esta pendência da lista de contas a receber?\n\nA OS ou a venda continua no sistema. Só some daqui.')) return;
    var db2 = carregar();
    var p = (db2.pendentes || []).find(function (x) { return x && String(x.id) === id; });
    if (typeof marcarPendenteExcluido === 'function' && p) {
        marcarPendenteExcluido(db2, p);
    } else if (typeof marcarExcluido === 'function' && canalVendas !== 'interno') {
        marcarExcluido(db2, 'pendentes', id);
        if (p && p.atendimentoId) marcarExcluido(db2, 'pendentes', 'os:' + String(p.atendimentoId));
        if (p && p.vendaId) marcarExcluido(db2, 'pendentes', 'vd:' + String(p.vendaId));
    }
    db2.pendentes = (db2.pendentes || []).filter(function (x) { return String(x && x.id) !== id; });
    salvar(db2);
    toast('Pendente excluída da lista.');
    renderPendentes();
    if (typeof atualizarKPIs === 'function') {
        atualizarKPIs(typeof carregarMain === 'function' ? carregarMain() : db2);
    }
}
window.excluirPendenteDaLista = excluirPendenteDaLista;

function renderPendentes() {
    var db = carregar();
    if (typeof sincronizarPendentesDoAberto === 'function' && sincronizarPendentesDoAberto(db)) {
        salvar(db);
    }
    var exPd = (typeof garantirExcluidos === 'function') ? (garantirExcluidos(db).pendentes || {}) : {};
    var lista = (typeof aplicarExcluidosNaLista === 'function'
        ? aplicarExcluidosNaLista(db.pendentes || [], exPd)
        : (db.pendentes || [])).filter(function (p) {
        if (!p || p.status === 'pago') return false;
        if (p.atendimentoId && exPd['os:' + String(p.atendimentoId)]) return false;
        if (p.vendaId && exPd['vd:' + String(p.vendaId)]) return false;
        return true;
    });
    var total = lista.reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
    document.getElementById('pdTotal').textContent = moeda(total);
    document.getElementById('pdQtd').textContent = String(lista.length);
    var tb = document.getElementById('tabelaPendentes');
    if (!tb._pdDocClickLigado) {
        tb._pdDocClickLigado = true;
        tb.addEventListener('click', function (e) {
            if (tratarCliqueAcoesDocumentoCaixa(e)) return;
            var bEx = e.target.closest('[data-ex]');
            if (bEx && tb.contains(bEx)) {
                e.preventDefault();
                e.stopPropagation();
                excluirPendenteDaLista(bEx.getAttribute('data-ex'));
            }
        });
    }
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
        var descExibir = p.descricao || '';
        if (p.atendimentoId) {
            var osPend = (db.atendimentos || []).find(function (x) { return x && String(x.id) === String(p.atendimentoId); });
            var placaPend = (osPend && osPend.placa)
                ? String(osPend.placa).toUpperCase()
                : (typeof placaDeTextoLivre === 'function' ? placaDeTextoLivre(descExibir) : '');
            var nomePend = p.cliente || '';
            if (!descExibir || /^OS\b/i.test(descExibir) || /saldo em aberto/i.test(descExibir)) {
                descExibir = 'OS ' + (placaPend || 'sem placa') + (nomePend ? ' · ' + nomePend : '') + ' — saldo em aberto';
            }
        }
        var acoesDoc = p.vendaId
            ? '<button type="button" class="btn btn-secondary" data-cx-ver-vd="' + esc(p.vendaId) + '">Ver</button>' +
              '<button type="button" class="btn btn-secondary" data-cx-imp-vd="' + esc(p.vendaId) + '">Imprimir</button>' +
              '<button type="button" class="btn btn-pdf" data-cx-pdf-vd="' + esc(p.vendaId) + '">PDF</button>' +
              '<button type="button" class="btn btn-secondary" data-cx-edit-vd="' + esc(p.vendaId) + '">Editar</button>'
            : (p.atendimentoId
                ? '<button type="button" class="btn btn-ver" data-cx-ver-os="' + esc(p.atendimentoId) + '">Ver OS</button>' +
                  '<button type="button" class="btn btn-ok" data-cx-rec-os="' + esc(p.atendimentoId) + '">Receber OS</button>'
                : '');
        var atraso = 0;
        if (p.vencimento) {
            var dv = new Date(String(p.vencimento).slice(0, 10) + 'T12:00:00');
            var hj = new Date();
            hj.setHours(12, 0, 0, 0);
            if (!isNaN(dv.getTime())) atraso = Math.floor((hj.getTime() - dv.getTime()) / 86400000);
        }
        var vencIso = typeof dataISODia === 'function' ? dataISODia(p.vencimento) : String(p.vencimento || '').slice(0, 10);
        var vencHtml = esc(fmtData(p.vencimento) || '—');
        if (vencIso && atraso === 0) vencHtml += ' <span style="color:#b45309;font-weight:800">Vence hoje</span>';
        else if (atraso >= 30) vencHtml += ' <span style="color:#b91c1c;font-weight:800">30+ dias vencido</span>';
        else if (atraso > 0) vencHtml += ' <span style="color:#b45309;font-weight:800">Vencido</span>';
        var recAvulso = p.atendimentoId
            ? ''
            : '<button type="button" class="btn btn-ok" data-rec-b="' + p.id + '">Receber balcão</button>' +
              '<button type="button" class="btn btn-primary" data-rec-k="' + p.id + '">Receber banco</button>';
        tr.innerHTML =
            '<td>' + esc(p.cliente) + '</td>' +
            '<td>' + esc(descExibir) + '</td>' +
            '<td class="pd-venc-td">' +
            '<div class="pd-venc-linha"><span>' + vencHtml + '</span>' +
            '<button type="button" class="btn btn-secondary" data-pd-edit-venc="' + esc(p.id) + '">Editar</button></div>' +
            '<div class="pd-venc-edit" hidden>' +
            '<span class="muted">Dia combinado de pagamento</span>' +
            '<input type="date" data-pd-venc-input="' + esc(p.id) + '" value="' + esc(vencIso) + '">' +
            '<button type="button" class="btn btn-ok" data-pd-venc-salvar="' + esc(p.id) + '">Salvar data</button>' +
            '</div></td>' +
            '<td>' + moeda(p.valor) + '</td>' +
            '<td class="actions"><div class="cx-acoes-fh">' + acoesDoc + recAvulso +
            '<button type="button" class="btn btn-danger" data-ex="' + esc(p.id) + '">Excluir</button>' +
            '</div></td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-rec-b]').forEach(function (b) {
        b.addEventListener('click', function () { receberPendente(b.getAttribute('data-rec-b'), 'balcao'); });
    });
    tb.querySelectorAll('[data-rec-k]').forEach(function (b) {
        b.addEventListener('click', function () { receberPendente(b.getAttribute('data-rec-k'), 'banco'); });
    });
    tb.querySelectorAll('[data-pd-edit-venc]').forEach(function (b) {
        b.addEventListener('click', function () {
            var cell = b.closest('td');
            var box = cell ? cell.querySelector('.pd-venc-edit') : null;
            if (!box) return;
            box.hidden = !box.hidden;
            if (!box.hidden) {
                var inp = cell.querySelector('input[type="date"]');
                if (inp) inp.focus();
            }
        });
    });
    tb.querySelectorAll('[data-pd-venc-salvar]').forEach(function (b) {
        b.addEventListener('click', function () {
            var id = b.getAttribute('data-pd-venc-salvar');
            var cell = b.closest('td');
            var inp = cell ? cell.querySelector('[data-pd-venc-input]') : null;
            salvarVencimentoPendente(id, inp ? inp.value : '');
        });
    });
}

function salvarVencimentoPendente(id, ymd) {
    ymd = typeof dataISODia === 'function' ? dataISODia(ymd) : String(ymd || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        toast('Informe o dia que o cliente combinou pagar.');
        return;
    }
    var db = carregar();
    var p = (db.pendentes || []).find(function (x) { return x && String(x.id) === String(id); });
    if (!p) {
        toast('Pendente não encontrada.');
        return;
    }
    p.vencimento = ymd;
    if (p.atendimentoId) {
        var a = (db.atendimentos || []).find(function (x) { return x && String(x.id) === String(p.atendimentoId); });
        if (a) {
            a.dataVencimento = ymd;
            a.atualizadoEm = new Date().toISOString();
        }
    }
    if (p.vendaId) {
        var o = (db.orcamentos || []).find(function (x) { return x && String(x.id) === String(p.vendaId); });
        if (o) {
            o.dataVencimento = ymd;
            o.atualizadoEm = new Date().toISOString();
        }
    }
    salvar(db);
    toast('Vencimento salvo. No Início o alerta usa essa data.');
    renderPendentes();
    if (typeof renderAlertaVencidos30 === 'function') renderAlertaVencidos30(typeof carregarMain === 'function' ? carregarMain() : db);
    if (typeof atualizarKPIs === 'function') atualizarKPIs(typeof carregarMain === 'function' ? carregarMain() : db);
}
window.salvarVencimentoPendente = salvarVencimentoPendente;

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

function mesAnoParaYm(mesAno) {
    var p = String(mesAno || '').split('/');
    if (p.length !== 2) return '';
    return p[1] + '-' + p[0];
}

function ymParaMesAno(ym) {
    ym = String(ym || '');
    if (ym.length < 7) return '';
    return ym.slice(5, 7) + '/' + ym.slice(0, 4);
}

function ymAnteriorDe(ym) {
    var y = Number(String(ym).slice(0, 4));
    var m = Number(String(ym).slice(5, 7)) - 1;
    if (!y || isNaN(m)) return '';
    if (m < 1) {
        m = 12;
        y -= 1;
    }
    return y + '-' + String(m).padStart(2, '0');
}

function ultimoDiaYm(ym) {
    var y = Number(String(ym).slice(0, 4));
    var m = Number(String(ym).slice(5, 7));
    if (!y || !m) return String(ym) + '-31';
    var d = new Date(y, m, 0).getDate();
    return String(ym) + '-' + String(d).padStart(2, '0');
}

var _htmlPrintRelatorioAberto = '';

function fecharVisualizacaoRelatorio() {
    var overlay = document.getElementById('modalVerRelatorio');
    if (overlay) overlay.classList.remove('aberto');
}

function abrirVisualizacaoRelatorio(titulo, html) {
    _htmlPrintRelatorioAberto = html || '';
    var overlay = document.getElementById('modalVerRelatorio');
    var tit = document.getElementById('modalVerRelTitulo');
    var corpo = document.getElementById('modalVerRelCorpo');
    if (tit) tit.textContent = titulo || 'Relatório';
    if (corpo) corpo.innerHTML = html || '';
    if (overlay) overlay.classList.add('aberto');
    if (corpo) corpo.scrollTop = 0;
}

(function ligarModalVerRelatorio() {
    var overlay = document.getElementById('modalVerRelatorio');
    var btnF = document.getElementById('btnVerRelFechar');
    var btnI = document.getElementById('btnVerRelImprimir');
    if (btnF && !btnF._ligadoVerRel) {
        btnF._ligadoVerRel = true;
        btnF.addEventListener('click', fecharVisualizacaoRelatorio);
    }
    if (btnI && !btnI._ligadoVerRel) {
        btnI._ligadoVerRel = true;
        btnI.addEventListener('click', function () {
            if (_htmlPrintRelatorioAberto && typeof executarImpressaoHtml === 'function') {
                executarImpressaoHtml(_htmlPrintRelatorioAberto);
            }
        });
    }
    if (overlay && !overlay._ligadoVerRel) {
        overlay._ligadoVerRel = true;
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) fecharVisualizacaoRelatorio();
        });
    }
})();

function arquivoPastasMes(db) {
    if (!db.pastasMes || typeof db.pastasMes !== 'object' || Array.isArray(db.pastasMes)) {
        db.pastasMes = {};
    }
    return db.pastasMes;
}

function snapshotPastaMes(db, ym) {
    db = db || ((typeof carregarMain === 'function') ? carregarMain() : carregar());
    var mesAno = ymParaMesAno(ym);
    var ini = ym + '-01';
    var fim = ultimoDiaYm(ym);
    var of = { pecas: 0, ganho: 0, mao: 0, maoCasa: 0, comissao: 0, despesas: 0, resultado: 0 };
    if (typeof calcularRelatorioOficina === 'function') {
        of = calcularRelatorioOficina({ inicio: ini, fim: fim, label: mesAno });
    }
    var itens = coletarItensRelatorioMensal(db, 'geral', mesAno);
    var mont = montarHtmlSecoesRelatorioMes(itens, 'geral');
    var nAtend = (typeof contarAtendimentosNoMes === 'function')
        ? contarAtendimentosNoMes(db, ym).total
        : 0;
    return {
        ym: ym,
        mesAno: mesAno,
        nome: pastaMesLabel(mesAno),
        pecas: Number(of.pecas) || 0,
        ganho: Number(of.ganho) || 0,
        mao: Number(of.mao) || 0,
        maoCasa: Number(of.maoCasa) || 0,
        comissao: Number(of.comissao) || 0,
        despesas: Number(of.despesas) || 0,
        resultado: Number(of.resultado) || 0,
        totEntradas: Number(mont.totEntradas) || 0,
        totSaidas: Number(mont.totSaidas) || 0,
        totPendentes: Number(mont.totPendentes) || 0,
        saldo: Number(mont.saldo) || 0,
        nAtend: nAtend,
        geradoEm: new Date().toISOString()
    };
}

function pastaMesTemMovimento(snap) {
    if (!snap) return false;
    return !!(snap.pecas || snap.ganho || snap.mao || snap.totEntradas ||
        snap.totSaidas || snap.totPendentes || snap.nAtend);
}

function garantirPastasMesEncerrados() {
    var db = (typeof carregarMain === 'function') ? carregarMain() : carregar();
    var arq = arquivoPastasMes(db);
    var atual = (typeof hojeISO === 'function' ? hojeISO() : new Date().toISOString().slice(0, 10)).slice(0, 7);
    var yms = {};
    var prev = ymAnteriorDe(atual);
    if (prev) yms[prev] = true;
    Object.keys(arq).forEach(function (k) {
        if (k) yms[k] = true;
    });
    try {
        var arvore = montarArvoreCaixaDados(db);
        Object.keys(arvore).forEach(function (ano) {
            Object.keys(arvore[ano] || {}).forEach(function (mesNome) {
                var ma = arvore[ano][mesNome] && arvore[ano][mesNome].mesAno;
                var ym = mesAnoParaYm(ma);
                if (ym) yms[ym] = true;
            });
        });
    } catch (eArv) { /* ok */ }
    (db.fechamentosCaixa || []).forEach(function (f) {
        var ym = String((f && (f.data || f.criadoEm)) || '').slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) yms[ym] = true;
    });
    Object.keys(db.contagemAtendimentosMes || {}).forEach(function (ym) {
        if (/^\d{4}-\d{2}$/.test(ym)) yms[ym] = true;
    });
    var mudou = false;
    Object.keys(yms).forEach(function (ym) {
        if (!/^\d{4}-\d{2}$/.test(ym) || ym >= atual) return;
        var snap = snapshotPastaMes(db, ym);
        if (!pastaMesTemMovimento(snap) && !arq[ym]) return;
        var old = arq[ym];
        if (old) {
            snap.geradoEm = old.geradoEm || snap.geradoEm;
            if (old.pecas === snap.pecas && old.ganho === snap.ganho && old.mao === snap.mao &&
                old.maoCasa === snap.maoCasa && old.totEntradas === snap.totEntradas &&
                old.totSaidas === snap.totSaidas && old.totPendentes === snap.totPendentes &&
                old.nAtend === snap.nAtend && old.resultado === snap.resultado) {
                return;
            }
        }
        arq[ym] = snap;
        mudou = true;
    });
    if (mudou) {
        db.pastasMes = arq;
        if (typeof salvarMain === 'function') salvarMain(db);
        else salvar(db);
    }
    return arq;
}

function renderPastasMesEncerrados() {
    var box = document.getElementById('relCxPastasMes');
    if (!box) return;
    var db = (typeof carregarMain === 'function') ? carregarMain() : carregar();
    var arq = arquivoPastasMes(db);
    var keys = Object.keys(arq).sort().reverse();
    if (!keys.length) {
        box.innerHTML = '<p class="muted">Quando o mês acabar, a pasta aparece aqui sozinha (mão de obra, ganho em peças, entradas e saídas).</p>';
        return;
    }
    function item(label, val) {
        return '<div class="pm-item"><span>' + esc(label) + '</span><b>' + moeda(val) + '</b></div>';
    }
    box.innerHTML = keys.map(function (ym) {
        var p = arq[ym] || {};
        return '<div class="pasta-mes-enc">' +
            '<h3>📂 ' + esc(p.nome || pastaMesLabel(p.mesAno || ymParaMesAno(ym))) + '</h3>' +
            '<div class="pm-grid">' +
            item('Mão de obra', p.mao) +
            item('Ganho em peças', p.ganho) +
            item('Peças (venda)', p.pecas) +
            item('Entradas', p.totEntradas) +
            item('Saídas', p.totSaidas) +
            item('Pendentes', p.totPendentes) +
            item('Resultado da casa', p.resultado) +
            '<div class="pm-item"><span>Atendimentos pagos</span><b>' + (Number(p.nAtend) || 0) + '</b></div>' +
            '</div>' +
            '<div class="acoes-relatorio-mes">' +
            '<button type="button" class="btn btn-secondary" data-ver-pasta-mes="' + esc(ym) + '">👁️ Ver</button>' +
            '<button type="button" class="btn btn-pdf" data-imp-pasta-mes="' + esc(ym) + '">🖨️ Imprimir</button>' +
            '</div></div>';
    }).join('');
    box.querySelectorAll('[data-ver-pasta-mes]').forEach(function (b) {
        b.addEventListener('click', function () {
            var ym = b.getAttribute('data-ver-pasta-mes');
            var pasta = arq[ym] || {};
            gerarRelatorioMensalPDF('geral', pasta.mesAno || ymParaMesAno(ym), 'ver');
        });
    });
    box.querySelectorAll('[data-imp-pasta-mes]').forEach(function (b) {
        b.addEventListener('click', function () {
            var ym = b.getAttribute('data-imp-pasta-mes');
            var pasta = arq[ym] || {};
            gerarRelatorioMensalPDF('geral', pasta.mesAno || ymParaMesAno(ym), 'print');
        });
    });
}

function coletarItensRelatorioMensal(db, filtro, mesAno) {
    filtro = filtro || 'geral';
    mesAno = String(mesAno || '').trim();
    var itens = [];

    function pushLanc(x, canal) {
        if (!x) return;
        if (x.tipo === 'fechamento' || x.origemFechamento) return;
        var ma = mesAnoDeIso(x.criadoEm);
        if (ma !== mesAno) return;
        var desc = x.descricao || '';
        if (x.atendimentoId && x.osResumo) {
            desc = '[OS ' + (x.osResumo.placa || '') + '] ' + desc;
        } else if (x.vendaId || x.origemVenda) {
            desc = '[VENDA' + (x.numDoc ? ' ' + x.numDoc : '') + '] ' + desc;
        }
        itens.push({
            data: fmtData(x.criadoEm),
            doc: x.atendimentoId ? 'OS' : ((x.vendaId || x.origemVenda || x.orcamentoId) ? 'VENDA' : (canal === 'banco' ? 'BANCO' : 'CX')),
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

function htmlBlocoOficinaMes(of, nAtend) {
    of = of || {};
    return '<div class="resumo">' +
        '<div class="resumo-box" style="color:#2980b9">MÃO DE OBRA<b>' + moeda(of.mao) + '</b></div>' +
        '<div class="resumo-box" style="color:#16a085">GANHO EM PEÇAS<b>' + moeda(of.ganho) + '</b></div>' +
        '<div class="resumo-box" style="color:#34495e">PEÇAS (VENDA)<b>' + moeda(of.pecas) + '</b></div>' +
        '<div class="resumo-box" style="color:#8e44ad">MO DA CASA<b>' + moeda(of.maoCasa) + '</b></div>' +
        '<div class="resumo-box" style="color:#c0392b">COMISSÃO<b>' + moeda(of.comissao) + '</b></div>' +
        '<div class="resumo-box" style="color:#e74c3c">DESPESAS OFICINA<b>' + moeda(of.despesas) + '</b></div>' +
        '<div class="resumo-box" style="color:#1e3a5f">RESULTADO DA CASA<b>' + moeda(of.resultado) + '</b></div>' +
        '<div class="resumo-box" style="color:#1e3a5f">ATENDIMENTOS PAGOS<b>' + (Number(nAtend) || 0) + '</b></div>' +
        '</div>';
}

function montarHtmlRelatorioMensal(filtro, mesAnoFixo) {
    filtro = filtro || 'geral';
    var mesAno = mesAnoFixo || prompt('Digite o mês e ano do relatório (Ex: 07/2026):', mesAnoAtualPadrao());
    if (!mesAno) return null;
    mesAno = String(mesAno).trim();
    if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
        alert('Use o formato MM/AAAA (Ex: 07/2026).');
        return null;
    }
    var db = (typeof carregarMain === 'function') ? carregarMain() : carregar();
    var emp = getEmpresa(db);
    var ymRel = mesAno.slice(3) + '-' + mesAno.slice(0, 2);
    var ini = ymRel + '-01';
    var fim = ultimoDiaYm(ymRel);
    var of = { pecas: 0, ganho: 0, mao: 0, maoCasa: 0, comissao: 0, despesas: 0, resultado: 0 };
    if (typeof calcularRelatorioOficina === 'function') {
        of = calcularRelatorioOficina({ inicio: ini, fim: fim, label: mesAno });
    }
    var nAtend = 0;
    if (typeof contarAtendimentosNoMes === 'function') {
        nAtend = contarAtendimentosNoMes(db, ymRel).total;
    }
    var itens = coletarItensRelatorioMensal(db, filtro, mesAno);
    var temOficina = (Number(of.pecas) || 0) || (Number(of.mao) || 0) || (Number(of.ganho) || 0) || nAtend;
    if (!itens.length && !temOficina) {
        alert('Nenhum registro encontrado para o período: ' + mesAno);
        return null;
    }
    var montado = montarHtmlSecoesRelatorioMes(itens, filtro);
    var titulo = REL_MES_TITULOS[filtro] || REL_MES_TITULOS.geral;
    var blocoTopo = (filtro === 'geral')
        ? htmlBlocoOficinaMes(of, nAtend)
        : ('<div class="resumo"><div class="resumo-box" style="color:#1e3a5f">ATENDIMENTOS PAGOS NO MÊS (OS + VENDA)<b>' +
            nAtend + '</b></div></div>');
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
        blocoTopo +
        montado.html +
        '<div style="text-align:center;margin-top:24px;font-size:9px;color:#777">' +
        'Documento gerado pelo Joninha Suspensões em ' + esc(new Date().toLocaleString('pt-BR')) +
        '</div></div>';
    return { html: html, titulo: titulo, mesAno: mesAno };
}

function gerarRelatorioMensalPDF(filtro, mesAnoFixo, modo) {
    var doc = montarHtmlRelatorioMensal(filtro, mesAnoFixo);
    if (!doc) return;
    if (modo === 'ver') {
        abrirVisualizacaoRelatorio(doc.titulo + ' · ' + doc.mesAno, doc.html);
        return;
    }
    if (typeof executarImpressaoHtml === 'function') executarImpressaoHtml(doc.html);
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
        if (!x || x.tipo === 'fechamento' || x.origemFechamento) return;
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

function expandirPastaCaixa(elId, tipo) {
    var raiz = document.getElementById(elId);
    if (!raiz) return false;
    raiz.querySelectorAll('.pasta-cx-tipo').forEach(function (n) {
        n.classList.remove('pasta-cx-destaque');
    });
    var anoBox = raiz.querySelector('[data-pasta-nivel="ano"]');
    if (!anoBox) {
        raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return false;
    }
    anoBox.style.display = 'block';
    var mesBox = anoBox.querySelector('[data-pasta-nivel="mes"]');
    if (mesBox) mesBox.style.display = 'block';
    var alvoTipo = tipo === 'saidas' ? 'saidas' : tipo;
    var host = mesBox || anoBox;
    var conteudo = host.querySelector('[data-pasta-tipo="' + alvoTipo + '"]');
    if (!conteudo && alvoTipo === 'saidas') {
        conteudo = host.querySelector('[data-pasta-tipo="despesas"]');
    }
    if (conteudo) {
        conteudo.style.display = 'block';
        var btn = conteudo.previousElementSibling;
        if (btn && btn.classList.contains('pasta-cx-tipo')) btn.classList.add('pasta-cx-destaque');
        setTimeout(function () {
            (btn || conteudo).scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
        return true;
    }
    raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return false;
}
window.expandirPastaCaixa = expandirPastaCaixa;

function irParaPastaInicio(tipo) {
    var mapa = {
        entradas: { panel: 'painelCaixa', elId: 'arvorePastasBalcao', tipo: 'entradas' },
        saidas: { panel: 'painelCaixa', elId: 'arvorePastasBalcao', tipo: 'saidas' },
        pendentes: { panel: 'painelPendentes', elId: 'arvorePastasPendentes', tipo: 'pendentes' }
    };
    var dest = mapa[tipo];
    if (!dest) return;
    abrirPainel(dest.panel);
    setTimeout(function () {
        expandirPastaCaixa(dest.elId, dest.tipo);
    }, 180);
}
window.irParaPastaInicio = irParaPastaInicio;

function destacarAtalhoCaixa(el) {
    if (!el) return;
    el.classList.add('cx-atalho-foco');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { el.classList.remove('cx-atalho-foco'); }, 1800);
}

function abrirRelatorioOficinaDia(focoId) {
    var rof = document.getElementById('rofPeriodo');
    if (rof) rof.value = 'dia';
    abrirPainel('painelRelatorioOficina');
    if (typeof renderRelatorioOficina === 'function') renderRelatorioOficina();
    setTimeout(function () {
        var alvo = focoId ? document.getElementById(focoId) : null;
        destacarAtalhoCaixa(alvo ? (alvo.closest('.card') || alvo) : document.getElementById('rofConteudo'));
    }, 220);
}

function irParaAtalhoCaixa(acao, origem) {
    origem = origem || 'balcao';
    var pastaId = origem === 'banco' ? 'arvorePastasBanco' : 'arvorePastasBalcao';

    if (acao === 'inicial') {
        if (origem === 'banco') {
            var btnBk = document.getElementById('btnBkInicial');
            if (btnBk) btnBk.click();
        } else {
            editarCaixaInicial();
        }
        return;
    }
    if (acao === 'entradas') {
        if (typeof abrirRelatorioServicos === 'function') {
            abrirRelatorioServicos('entradas');
        } else {
            expandirPastaCaixa(pastaId, acao);
        }
        return;
    }
    if (acao === 'saidas') {
        expandirPastaCaixa(pastaId, acao);
        return;
    }
    if (acao === 'balanco') {
        destacarAtalhoCaixa(document.querySelector('#painelCaixa .resumo-caixa-hoje'));
        return;
    }
    if (acao === 'saldo') {
        var movBk = document.getElementById('tabelaBanco');
        destacarAtalhoCaixa(movBk ? (movBk.closest('.box') || movBk) : document.getElementById('arvorePastasBanco'));
        return;
    }
    if (acao === 'oficina-pecas' || acao === 'oficina-ganho' || acao === 'oficina-mao' || acao === 'oficina-os') {
        if (typeof abrirRelatorioServicos === 'function') {
            abrirRelatorioServicos('oficina');
            return;
        }
    }
    if (acao === 'oficina-pecas') {
        abrirRelatorioOficinaDia('rofPecasBruto');
        return;
    }
    if (acao === 'oficina-ganho') {
        abrirRelatorioOficinaDia('rofPecasLucro');
        return;
    }
    if (acao === 'oficina-mao') {
        abrirRelatorioOficinaDia('rofMaoBruta');
        return;
    }
    if (acao === 'oficina-os') {
        expandirPastaCaixa('arvorePastasBalcao', 'entradas');
        setTimeout(function () {
            var tb = document.getElementById('tabelaCaixa');
            destacarAtalhoCaixa(tb ? tb.closest('.table-wrap') : null);
        }, 280);
        return;
    }
    if (acao === 'rel-geral') {
        expandirPastaCaixa('arvorePastasCaixa', 'entradas');
    }
}
window.irParaAtalhoCaixa = irParaAtalhoCaixa;

document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cx-atalho]');
    if (!btn) return;
    irParaAtalhoCaixa(btn.getAttribute('data-cx-atalho'), btn.getAttribute('data-cx-origem') || 'balcao');
});

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
        html += '<div id="' + idAno + '" data-pasta-nivel="ano" style="display:none">';
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
            var ymBucket = mesAnoParaYm(bucket.mesAno);
            var atualYm = (typeof hojeISO === 'function' ? hojeISO() : '').slice(0, 7);
            var tagEnc = (ymBucket && atualYm && ymBucket < atualYm) ? ' · 📁 encerrado' : '';
            var pastaSnap = (typeof arquivoPastasMes === 'function' && db)
                ? (arquivoPastasMes(db)[ymBucket] || null)
                : null;
            html += '<div class="pasta-cx-mes" onclick="togglePastaCaixa(\'' + idMes + '\')">📂 Mês: ' +
                esc(mesNome) + ' <small style="font-weight:500;opacity:.85">(' + esc(bucket.mesAno) +
                ' · ' + resumoMes + tagEnc + ')</small></div>';
            html += '<div class="pasta-cx-mes-acoes">' +
                '<button type="button" class="btn btn-secondary" style="padding:6px 10px;font-size:12px" data-rel-mes-fixo="' +
                esc(bucket.mesAno) + '" data-rel-mes-ver="' + esc(filtro) + '">👁️ Ver</button>' +
                '<button type="button" class="btn btn-pdf" style="padding:6px 10px;font-size:12px" data-rel-mes-fixo="' +
                esc(bucket.mesAno) + '" data-rel-mes="' + esc(filtro) + '">🖨️ Imprimir</button>' +
                '<button type="button" class="btn btn-secondary" style="padding:6px 10px;font-size:12px" data-arquivar-mes="' +
                esc(bucket.mesAno) + '" data-arquivar-filtro="' + esc(filtro) + '">📂 Arquivar no PC</button></div>';
            if (filtro === 'geral' && pastaSnap) {
                html += '<div class="pasta-cx-tipo" style="cursor:default">📊 Oficina · MO ' +
                    moeda(pastaSnap.mao) + ' · ganho peças ' + moeda(pastaSnap.ganho) +
                    ' · entradas ' + moeda(pastaSnap.totEntradas) +
                    ' · saídas ' + moeda(pastaSnap.totSaidas) + '</div>';
            }
            html += '<div id="' + idMes + '" data-pasta-nivel="mes" style="display:none">';

            if (filtro === 'despesas') {
                idc++;
                var idS = idPrefix + '_s_' + idc;
                html += '<div class="pasta-cx-tipo" data-pasta-tipo-btn="despesas" onclick="togglePastaCaixa(\'' + idS + '\')">🔻 Despesas (' +
                    bucket.saidas.length + ' · ' + moeda(totS) + ')</div>';
                html += '<div id="' + idS + '" class="pasta-cx-conteudo" data-pasta-tipo="despesas" style="display:none">' +
                    htmlItensPastaCx(bucket.saidas, 'val-sai') + '</div>';
            } else if (filtro !== 'pendentes') {
                idc++;
                var idE = idPrefix + '_e_' + idc;
                html += '<div class="pasta-cx-tipo" data-pasta-tipo-btn="entradas" onclick="togglePastaCaixa(\'' + idE + '\')">✅ Entradas (' +
                    bucket.entradas.length + ' · ' + moeda(totE) + ')</div>';
                html += '<div id="' + idE + '" class="pasta-cx-conteudo" data-pasta-tipo="entradas" style="display:none">' +
                    htmlItensPastaCx(bucket.entradas, 'val-ent') + '</div>';

                idc++;
                var idS2 = idPrefix + '_s_' + idc;
                html += '<div class="pasta-cx-tipo" data-pasta-tipo-btn="saidas" onclick="togglePastaCaixa(\'' + idS2 + '\')">🔻 Saídas (' +
                    bucket.saidas.length + ' · ' + moeda(totS) + ')</div>';
                html += '<div id="' + idS2 + '" class="pasta-cx-conteudo" data-pasta-tipo="saidas" style="display:none">' +
                    htmlItensPastaCx(bucket.saidas, 'val-sai') + '</div>';
            }

            if (filtro === 'geral' || filtro === 'pendentes') {
                idc++;
                var idP = idPrefix + '_p_' + idc;
                html += '<div class="pasta-cx-tipo" data-pasta-tipo-btn="pendentes" onclick="togglePastaCaixa(\'' + idP + '\')">⏳ Pendentes (' +
                    bucket.pendentes.length + ' · ' + moeda(totP) + ')</div>';
                html += '<div id="' + idP + '" class="pasta-cx-conteudo" data-pasta-tipo="pendentes" style="display:none">' +
                    htmlItensPastaCx(bucket.pendentes, 'val-pen') + '</div>';
            }

            html += '</div>';
        });
        html += '</div>';
    });
    el.innerHTML = html;

    el.querySelectorAll('[data-rel-mes-fixo][data-rel-mes-ver]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
            ev.stopPropagation();
            gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes-ver') || 'geral', b.getAttribute('data-rel-mes-fixo'), 'ver');
        });
    });
    el.querySelectorAll('[data-rel-mes-fixo][data-rel-mes]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
            ev.stopPropagation();
            gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes') || 'geral', b.getAttribute('data-rel-mes-fixo'), 'print');
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
    gerarArvorePastasCaixa({ elId: 'arvorePastasBalcao', filtro: 'balcao', idPrefix: 'pasta_bal' });
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
    try { garantirPastasMesEncerrados(); } catch (ePastas) { /* ok */ }
    var db = carregar();
    var hoje = hojeISO();
    var iniMes = hoje.slice(0, 7) + '-01';
    var balEnt = somarListaPeriodo(db.caixa, 'entrada', iniMes, hoje);
    var balSai = somarListaPeriodo(db.caixa, 'saida', iniMes, hoje);
    var banEnt = somarListaPeriodo(db.caixaBanco, 'entrada', iniMes, hoje);
    var banSai = somarListaPeriodo(db.caixaBanco, 'saida', iniMes, hoje);
    var pend = (db.pendentes || []).filter(function (p) { return p && p.status !== 'pago'; })
        .reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
    var salBal = balEnt - balSai;
    var salBan = banEnt - banSai;
    document.getElementById('relCxBalcao').textContent = moeda(salBal);
    document.getElementById('relCxBanco').textContent = moeda(salBan);
    document.getElementById('relCxPend').textContent = moeda(pend);
    document.getElementById('relCxGeral').textContent = moeda(salBal + salBan);

    var mapa = {};
    function acum(origem, item) {
        var d = String(item.criadoEm || '').slice(0, 10);
        if (d < iniMes || d > hoje) return;
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
    try { renderPastasMesEncerrados(); } catch (ePm) { /* ok */ }

    var boxF = document.getElementById('relCxFechamentos');
    if (boxF) {
        var listaF = (db.fechamentosCaixa || []).slice().sort(function (a, b) {
            return String(b.data || b.criadoEm || '').localeCompare(String(a.data || a.criadoEm || ''));
        });
        if (!listaF.length) {
            boxF.innerHTML = '<p class="muted">Ainda não há fechamento gravado. Ao fechar o caixa, o saldo da tela entra aqui e os cards zeram.</p>';
        } else {
            boxF.innerHTML = '<table><thead><tr><th>Data</th><th>Balcão</th><th>Digital</th><th>Total</th><th></th></tr></thead><tbody>' +
                listaF.map(function (f) {
                    var sb = f.saldoBalcao != null ? f.saldoBalcao : f.saldo;
                    var sd = Number(f.saldoBanco) || 0;
                    return '<tr><td>' + esc(fmtData(f.data)) + '</td><td>' + moeda(sb) +
                        '</td><td>' + moeda(sd) + '</td><td><strong>' + moeda(f.saldo) +
                        '</strong></td><td class="acoes-relatorio-mes">' +
                        '<button type="button" class="btn btn-secondary" data-ver-fech="' + esc(f.id) + '">👁️ Ver</button>' +
                        '<button type="button" class="btn btn-pdf" data-imp-fech="' + esc(f.id) + '">🖨️ Imprimir</button>' +
                        '</td></tr>';
                }).join('') + '</tbody></table>';
            boxF.querySelectorAll('[data-ver-fech]').forEach(function (b) {
                b.addEventListener('click', function () {
                    var id = b.getAttribute('data-ver-fech');
                    var hit = listaF.find(function (x) { return String(x.id) === String(id); });
                    if (hit) verFechamentoDia(hit);
                });
            });
            boxF.querySelectorAll('[data-imp-fech]').forEach(function (b) {
                b.addEventListener('click', function () {
                    var id = b.getAttribute('data-imp-fech');
                    var hit = listaF.find(function (x) { return String(x.id) === String(id); });
                    if (hit) imprimirFechamentoDia(hit);
                });
            });
        }
    }
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
        gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes') || 'geral', null, 'print');
    });
});
document.querySelectorAll('[data-rel-mes-ver]').forEach(function (b) {
    if (b.hasAttribute('data-rel-mes-fixo')) return;
    b.addEventListener('click', function () {
        gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes-ver') || 'geral', null, 'ver');
    });
});
/* Pastas Ano→Mês removidas da UI (1.3.1) — listeners desligados de propósito */

function fecharCaixaDoDia() {
    if (typeof sincronizarOficinaNoCaixaEmpresa === 'function') {
        try { sincronizarOficinaNoCaixaEmpresa(); } catch (eSyncF) { /* ok */ }
    }
    var db = carregarMain();
    var hoje = hojeISO();
    var painel = totaisPainelCaixa(db);
    var bal = painel.balcao;
    var ban = painel.banco;
    var cfg = painel.cfg;
    var corte = String(cfg.zeradoEm || cfg.fechadoEm || '');
    var iniOf = /^\d{4}-\d{2}-\d{2}$/.test(corte.slice(0, 10)) ? corte.slice(0, 10) : (hoje.slice(0, 7) + '-01');
    var of = totaisOficinaPainel(db);
    var snap = snapshotDiscricaoFechamento(db, iniOf, hoje, corte);
    var totalOficina = snap.totalOficina != null ? snap.totalOficina : ((Number(of.pecas) || 0) + (Number(of.mao) || 0));
    if (!confirm(
        'Fechar o caixa com o saldo da TELA e zerar balcão + digital + oficina?\n\n' +
        '(Se não fechou os dias anteriores, fecha tudo que está aberto agora.)\n\n' +
        'BALCÃO\n' +
        'Inicial: ' + moeda(bal.inicial) + '\nEntradas: ' + moeda(bal.entradas) +
        '\nSaídas: ' + moeda(bal.saidas) + '\nBalanço: ' + moeda(bal.saldo) + '\n\n' +
        'DIGITAL / BANCO\n' +
        'Inicial: ' + moeda(ban.inicial) + '\nEntradas: ' + moeda(ban.entradas) +
        '\nSaídas: ' + moeda(ban.saidas) + '\nSaldo: ' + moeda(ban.saldo) + '\n\n' +
        'OFICINA (peças + mão de obra = cobrado)\n' +
        'Peças (venda): ' + moeda(snap.pecas) +
        '\nMão de obra: ' + moeda(snap.mao) +
        '\nTotal oficina: ' + moeda(totalOficina) +
        '\nGanho em peças (já está nas peças): ' + moeda(snap.ganho) + '\n\n' +
        'O fechamento entra na tabela com a discriminação. Os cards voltam para R$ 0,00.'
    )) return;

    if (!db.fechamentosCaixa) db.fechamentosCaixa = [];
    if (!db.caixa) db.caixa = [];
    var rec = {
        id: uid(),
        data: hoje,
        periodoDe: iniOf,
        periodoAte: hoje,
        inicialBalcao: bal.inicial,
        entradasBalcao: bal.entradas,
        saidasBalcao: bal.saidas,
        saldoBalcao: bal.saldo,
        inicialBanco: ban.inicial,
        entradasBanco: ban.entradas,
        saidasBanco: ban.saidas,
        saldoBanco: ban.saldo,
        inicial: bal.inicial,
        entradas: bal.entradas + ban.entradas,
        saidas: bal.saidas + ban.saidas,
        saldo: bal.saldo + ban.saldo,
        pecasBruto: snap.pecas,
        ganhoPecas: snap.ganho,
        maoObra: snap.mao,
        totalOficina: totalOficina,
        comissao: snap.comissao,
        maoCasa: snap.maoCasa,
        despesas: snap.despesas,
        resultado: snap.resultado,
        linhasOficina: snap.linhasOficina,
        entradasCaixaOficina: snap.entradasCaixaOficina,
        entradasCaixaOutras: snap.entradasCaixaOutras,
        criadoEm: new Date().toISOString()
    };
    db.fechamentosCaixa.push(rec);
    db.caixa.push(montarLancamentoFechamentoCaixa(rec));
    db.caixaConfig = aplicarZerarPaineisCaixa(db);
    db.caixaConfig.atualizadoEm = rec.criadoEm;
    salvarMain(db);
    if (typeof agendarSyncAutomatico === 'function') agendarSyncAutomatico('salvar');
    toast('Caixa fechado. Linha FECH.CAIXA gravada. Cards do caixa e da oficina zerados.');
    renderCaixa();
    renderCaixaBanco();
    if (typeof renderRelatorioCaixa === 'function') renderRelatorioCaixa();
    atualizarKPIs(carregarMain());
    imprimirFechamentoDia(rec);
}
window.fecharCaixaDoDia = fecharCaixaDoDia;

function htmlCorpoFechamentoCaixa(f) {
    if (!f) return '';
    f = enriquecerFechamentoParaRelatorio(f);
    var iniB = f.inicialBalcao != null ? f.inicialBalcao : f.inicial;
    var entB = f.entradasBalcao != null ? f.entradasBalcao : f.entradas;
    var saiB = f.saidasBalcao != null ? f.saidasBalcao : f.saidas;
    var salB = f.saldoBalcao != null ? f.saldoBalcao : f.saldo;
    var pecas = Number(f.pecasBruto) || 0;
    var mao = Number(f.maoObra) || 0;
    var ganho = Number(f.ganhoPecas) || 0;
    var totOf = f.totalOficina != null ? Number(f.totalOficina) : (pecas + mao);
    var linhas = f.linhasOficina || [];
    if (linhas.length) {
        pecas = 0; mao = 0; ganho = 0; totOf = 0;
        linhas.forEach(function (l) {
            pecas += Number(l.pecas) || 0;
            mao += Number(l.mao) || 0;
            ganho += Number(l.ganho) || 0;
            totOf += Number(l.total) || ((Number(l.pecas) || 0) + (Number(l.mao) || 0));
        });
    }
    var entCxOf = f.entradasCaixaOficina || [];
    var entCxOut = f.entradasCaixaOutras || [];
    var somaEntOf = entCxOf.reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
    var somaEntOut = entCxOut.reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
    var totEnt = Number(f.entradas) || 0;
    var dif = totEnt - totOf;

    function bloco(titulo, pares) {
        var h = titulo
            ? '<h3 style="margin:16px 0 8px;border-bottom:2px solid #0d3b66;padding-bottom:4px">' + titulo + '</h3>'
            : '';
        return h + pares.map(function (p) {
            return '<div class="l" style="display:flex;justify-content:space-between;gap:16px;margin:6px 0;' +
                (p[2] ? 'font-weight:800;font-size:1.05em' : '') + '">' +
                '<span>' + p[0] + '</span><b>' + moeda(p[1]) + '</b></div>';
        }).join('');
    }
    function tabela(cols, rows, rodape) {
        if (!rows || !rows.length) {
            return '<p class="muted" style="margin:6px 0 12px">Nenhum item neste período.</p>';
        }
        var h = '<table style="width:100%;border-collapse:collapse;font-size:9pt;margin:6px 0 14px">';
        h += '<thead><tr>';
        cols.forEach(function (c) {
            h += '<th style="text-align:' + (c.num ? 'right' : 'left') +
                ';border-bottom:2px solid #0d3b66;padding:4px 6px">' + c.t + '</th>';
        });
        h += '</tr></thead><tbody>';
        rows.forEach(function (r) {
            h += '<tr>';
            cols.forEach(function (c) {
                var v = r[c.k];
                h += '<td style="text-align:' + (c.num ? 'right' : 'left') +
                    ';border-bottom:1px solid #ddd;padding:3px 6px">' +
                    (c.num ? moeda(v) : esc(v == null || v === '' ? '—' : String(v))) + '</td>';
            });
            h += '</tr>';
        });
        h += '</tbody>';
        if (rodape && rodape.length) {
            h += '<tfoot>';
            rodape.forEach(function (r) {
                h += '<tr>';
                cols.forEach(function (c, i) {
                    var v = r[c.k];
                    h += '<td style="text-align:' + (c.num ? 'right' : 'left') +
                        ';border-top:2px solid #0d3b66;padding:4px 6px;font-weight:800">' +
                        (i === 0 && r.label != null ? esc(r.label) : (c.num ? moeda(v || 0) : '')) +
                        '</td>';
                });
                h += '</tr>';
            });
            h += '</tfoot>';
        }
        h += '</table>';
        return h;
    }

    var html = '';
    if (f.periodoDe && f.periodoAte) {
        html += '<p>Período aberto: <b>' + esc(fmtData(f.periodoDe)) + '</b> a <b>' + esc(fmtData(f.periodoAte)) + '</b></p>';
    }
    html += bloco('Caixa / Balcão', [
        ['Caixa inicial', iniB],
        ['Entradas', entB],
        ['Saídas', saiB],
        ['Balanço do dia', salB, true]
    ]);
    html += bloco('Digital / Banco', [
        ['Saldo inicial', f.inicialBanco || 0],
        ['Entradas', f.entradasBanco || 0],
        ['Saídas', f.saidasBanco || 0],
        ['Saldo', f.saldoBanco || 0, true]
    ]);
    html += bloco('Total fechado', [
        ['Entradas', totEnt, true],
        ['Saídas', f.saidas],
        ['Balanço do dia', f.saldo, true]
    ]);

    html += '<h3 style="margin:16px 0 8px;border-bottom:2px solid #0d3b66;padding-bottom:4px">Oficina no fechamento</h3>';
    html += '<p style="margin:0 0 8px;font-size:9.5pt;color:#444">Peças + mão de obra é o que a oficina cobrou. ' +
        '<b>Ganho em peças</b> é lucro (já está dentro do valor das peças — não soma de novo nas entradas).</p>';
    html += bloco('', [
        ['Peças (venda)', pecas],
        ['Mão de obra', mao],
        ['Total oficina (peças + mão de obra)', totOf, true],
        ['Ganho em peças (lucro, já incluso nas peças)', ganho]
    ]);

    html += '<h3 style="margin:16px 0 8px;border-bottom:2px solid #0d3b66;padding-bottom:4px">Discriminação da oficina (OS e vendas pagas)</h3>';
    html += tabela(
        [
            { k: 'dataFmt', t: 'Data' },
            { k: 'doc', t: 'Doc' },
            { k: 'cliente', t: 'Cliente' },
            { k: 'pecas', t: 'Peças', num: true },
            { k: 'mao', t: 'Mão de obra', num: true },
            { k: 'ganho', t: 'Ganho peças', num: true },
            { k: 'total', t: 'Total cobrado', num: true }
        ],
        linhas.map(function (l) {
            var doc = l.origem === 'VENDA'
                ? ('Venda' + (l.numero != null && l.numero !== '' ? ' Nº ' + l.numero : ''))
                : ('OS' + (l.placa ? ' ' + String(l.placa).toUpperCase() : ''));
            return {
                dataFmt: fmtData(l.data) || l.data || '—',
                doc: doc,
                cliente: l.cliente || '—',
                pecas: l.pecas,
                mao: l.mao,
                ganho: l.ganho,
                total: l.total
            };
        }),
        [{ label: 'TOTAL OFICINA', pecas: pecas, mao: mao, ganho: ganho, total: totOf }]
    );

    html += '<h3 style="margin:16px 0 8px;border-bottom:2px solid #0d3b66;padding-bottom:4px">Conferência com as entradas</h3>';
    html += bloco('', [
        ['Total oficina (peças + mão de obra)', totOf, true],
        ['Entradas de OS/venda no caixa', somaEntOf],
        ['Outras entradas (não OS/venda)', somaEntOut],
        ['Total de entradas do caixa', totEnt, true],
        ['Diferença (entradas − oficina)', dif]
    ]);
    if (Math.abs(dif) > 0.05) {
        html += '<p style="margin:0 0 10px;font-size:9.5pt;color:#444">A diferença são outras entradas, desconto, entrada parcial ou lançamento que não é OS/venda. Veja a lista abaixo.</p>';
    } else {
        html += '<p style="margin:0 0 10px;font-size:9.5pt;color:#1e7a3a"><b>Oficina bate com as entradas.</b></p>';
    }

    if (entCxOut.length) {
        html += '<h3 style="margin:16px 0 8px;border-bottom:2px solid #0d3b66;padding-bottom:4px">Outras entradas (não OS/venda)</h3>';
        html += tabela(
            [
                { k: 'dataFmt', t: 'Data' },
                { k: 'canal', t: 'Canal' },
                { k: 'desc', t: 'Descrição' },
                { k: 'forma', t: 'Forma' },
                { k: 'valor', t: 'Valor', num: true }
            ],
            entCxOut.map(function (x) {
                return {
                    dataFmt: fmtData(x.data) || x.data || '—',
                    canal: x.canal || '—',
                    desc: x.desc || '—',
                    forma: x.forma || '—',
                    valor: x.valor
                };
            }),
            [{ label: 'TOTAL OUTRAS', valor: somaEntOut }]
        );
    }

    html += '<p style="margin-top:18px;color:#666;font-size:12px">Gerado em ' +
        esc(new Date().toLocaleString('pt-BR')) +
        ' · Os documentos do mês ficam no Relatório Caixa.</p>';
    return html;
}

function htmlDocumentoFechamento(f) {
    if (!f) return '';
    var emp = (typeof getEmpresa === 'function') ? getEmpresa() : {};
    if (typeof htmlCabecalhoNotaEmpresa === 'function') {
        return '<div class="nota-espelho">' +
            htmlCabecalhoNotaEmpresa(emp,
                '<div class="nota-sub nota-titulo-espelho">Fechamento de caixa · ' + esc(fmtData(f.data)) + '</div>'
            ) +
            htmlCorpoFechamentoCaixa(f) +
            '</div>';
    }
    return '<h1>' + esc((emp && emp.nome) || 'Joninha Suspensões') + '</h1>' +
        '<h2>Fechamento de caixa — ' + esc(fmtData(f.data)) + '</h2>' +
        htmlCorpoFechamentoCaixa(f);
}

function verFechamentoDia(f) {
    if (!f) return;
    abrirVisualizacaoRelatorio('Fechamento · ' + fmtData(f.data), htmlDocumentoFechamento(f));
}

function imprimirFechamentoDia(f) {
    if (!f) return;
    var html = htmlDocumentoFechamento(f);
    if (typeof executarImpressaoHtml === 'function') {
        executarImpressaoHtml(html);
        return;
    }
    var doc = '<html><head><title>Fechamento ' + esc(f.data) + '</title><style>body{font-family:Segoe UI,sans-serif;padding:24px} h1{margin:0 0 8px} .l{margin:6px 0} h3{margin:16px 0 6px}</style></head><body>';
    doc += html + '</body></html>';
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.write(doc);
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
}

