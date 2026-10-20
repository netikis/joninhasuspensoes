'use strict';
/* Joninha — storage local (carregar/salvar) — etapa 2.2 */

function empresaPadrao() {
    return {
        nome: 'Joninha Suspensões',
        cnpj: '',
        ie: '',
        telefone: '',
        email: '',
        cep: '',
        rua: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        complemento: '',
        logo: '',
        logoNaMidia: false,
        atualizadoEm: ''
    };
}

function empresaEstaPadrao(emp) {
    var e = emp || {};
    return !e.atualizadoEm &&
        (!e.nome || e.nome === 'Joninha Suspensões') &&
        !e.cnpj && !e.ie && !e.telefone && !e.email &&
        !e.cep && !e.rua && !e.numero && !e.bairro &&
        !e.cidade && !e.estado && !e.complemento &&
        !e.logo && !e.logoNaMidia;
}

function mesclarEmpresa(localEmp, nuvemEmp, baseAtualizadoEm) {
    var L = Object.assign(empresaPadrao(), localEmp || {});
    var N = nuvemEmp ? Object.assign(empresaPadrao(), nuvemEmp) : null;
    if (!N) return L;
    if (empresaEstaPadrao(L)) return N;
    var tL = new Date(L.atualizadoEm || 0).getTime();
    var tN = new Date(N.atualizadoEm || baseAtualizadoEm || 0).getTime();
    if (!tL && tN) return N;
    return tN >= tL ? N : L;
}

function estadoVazio() {
    return {
        empresa: empresaPadrao(),
        clientes: [],
        atendimentos: [],
        produtos: [],
        orcamentos: [],
        caixa: [],
        caixaBanco: [],
        pendentes: [],
        caixaConfig: { inicialBalcao: 0, inicialBanco: 0 },
        fechamentosCaixa: [],
        pastasMes: {},
        excluidos: excluidosVazio(),
        contagemAtendimentosMes: {},
        contadorPainelAtend: null
    };
}

function mesclarFuncionarios(a, b) {
    var map = {};
    function add(lista) {
        (lista || []).forEach(function (f) {
            if (!f || !f.id) return;
            var id = String(f.id);
            var prev = map[id];
            if (!prev || String(f.atualizadoEm || f.criadoEm || '') > String(prev.atualizadoEm || prev.criadoEm || '')) {
                map[id] = f;
            }
        });
    }
    add(a);
    add(b);
    return Object.keys(map).map(function (k) { return map[k]; });
}

function excluidosVazio() {
    return {
        clientes: {},
        atendimentos: {},
        produtos: {},
        orcamentos: {},
        caixa: {},
        caixaBanco: {},
        pendentes: {},
        funcionarios: {}
    };
}

function garantirExcluidos(db) {
    if (!db.excluidos || typeof db.excluidos !== 'object') db.excluidos = excluidosVazio();
    var base = excluidosVazio();
    Object.keys(base).forEach(function (k) {
        if (!db.excluidos[k] || typeof db.excluidos[k] !== 'object' || Array.isArray(db.excluidos[k])) {
            db.excluidos[k] = {};
        }
    });
    return db.excluidos;
}

function marcarExcluido(db, colecao, id) {
    if (!db || !colecao || !id) return;
    var ex = garantirExcluidos(db);
    if (!ex[colecao]) ex[colecao] = {};
    ex[colecao][id] = new Date().toISOString();
}

function limparExcluido(db, colecao, id) {
    if (!db || !colecao || !id) return;
    var ex = garantirExcluidos(db);
    if (ex[colecao] && ex[colecao][id]) delete ex[colecao][id];
}

function mesclarMapaExcluidos(a, b) {
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

function mesclarExcluidos(localEx, nuvemEx) {
    var base = excluidosVazio();
    var L = localEx || {};
    var N = nuvemEx || {};
    Object.keys(base).forEach(function (k) {
        base[k] = mesclarMapaExcluidos(L[k], N[k]);
    });
    return base;
}

function aplicarExcluidosNaLista(lista, mapaEx) {
    if (!mapaEx) return lista || [];
    return (lista || []).filter(function (item) {
        if (!item || !item.id) return true;
        if (!mapaEx[item.id]) return true;
        var tItem = new Date(item.atualizadoEm || item.criadoEm || 0).getTime();
        var tEx = new Date(mapaEx[item.id] || 0).getTime();
        return tItem > tEx;
    });
}

function estadoInternoVazio() {
    return {
        produtos: [],
        orcamentos: [],
        caixa: [],
        caixaBanco: [],
        pendentes: [],
        caixaConfig: { inicialBalcao: 0, inicialBanco: 0 },
        funcionarios: [],
        pagamentosFuncionarios: [],
        anotacoesFuncionarios: [],
        fechamentosFuncionarios: []
    };
}

function carregarInternoRaw() {
    try {
        var raw = localStorage.getItem(STORAGE_INTERNO);
        if (!raw) return estadoInternoVazio();
        return Object.assign(estadoInternoVazio(), JSON.parse(raw) || {});
    } catch (e) {
        return estadoInternoVazio();
    }
}

function salvarInternoRaw(data) {
    localStorage.setItem(STORAGE_INTERNO, JSON.stringify(data));
}

/* Fotos das OS ficam no IndexedDB (cabe centenas de MB). O localStorage tem ~5 MB por site
   e enchia com as fotos — aí nenhuma OS salvava. Lá fica só { id, idb: true }. */
var FOTOS_IDB_NOME = 'joninha_fotos_v1';
var _fotosCache = {};
var _fotosIdbConfirmadas = {};
var _idbFotosP = null;

function chaveFotoLocal(atId, fotoId) {
    return String(atId) + '_' + String(fotoId);
}

function fotoTemDataLocal(f) {
    return !!(f && f.data && String(f.data).indexOf('data:') === 0);
}

function idbFotos() {
    if (!_idbFotosP) {
        _idbFotosP = new Promise(function (res, rej) {
            if (!window.indexedDB) { rej(new Error('sem IndexedDB')); return; }
            var req = indexedDB.open(FOTOS_IDB_NOME, 1);
            req.onupgradeneeded = function () { req.result.createObjectStore('fotos'); };
            req.onsuccess = function () { res(req.result); };
            req.onerror = function () { rej(req.error); };
        });
    }
    return _idbFotosP;
}

function gravarFotosIdb(mapa) {
    var chaves = Object.keys(mapa || {});
    if (!chaves.length) return Promise.resolve(false);
    return idbFotos().then(function (idb) {
        return new Promise(function (res, rej) {
            var tx = idb.transaction('fotos', 'readwrite');
            var st = tx.objectStore('fotos');
            chaves.forEach(function (k) { st.put(mapa[k], k); });
            tx.oncomplete = function () {
                chaves.forEach(function (k) { if (_fotosCache[k] === mapa[k]) _fotosIdbConfirmadas[k] = true; });
                res(true);
            };
            tx.onerror = function () { rej(tx.error); };
            tx.onabort = function () { rej(tx.error); };
        });
    });
}

function lerTodasFotosIdb() {
    return idbFotos().then(function (idb) {
        return new Promise(function (res, rej) {
            var out = {};
            var req = idb.transaction('fotos', 'readonly').objectStore('fotos').openCursor();
            req.onsuccess = function () {
                var c = req.result;
                if (c) {
                    out[c.key] = c.value;
                    c.continue();
                } else res(out);
            };
            req.onerror = function () { rej(req.error); };
        });
    });
}

function preencherFotosDoCache(db) {
    (db.atendimentos || []).forEach(function (a) {
        if (!a || !a.fotos) return;
        a.fotos.forEach(function (f) {
            if (!f || f.data || !f.id) return;
            var d = _fotosCache[chaveFotoLocal(a.id, f.id)];
            if (d) f.data = d;
        });
    });
    return db;
}

/* Cópia leve para o localStorage; a foto só sai de lá depois de confirmada no IndexedDB */
function separarFotosParaIdb(db, tirarTodas) {
    var novas = {};
    var copia = Object.assign({}, db);
    copia.atendimentos = (db.atendimentos || []).map(function (a) {
        if (!a || !a.fotos || !a.fotos.some(fotoTemDataLocal)) return a;
        return Object.assign({}, a, {
            fotos: a.fotos.map(function (f) {
                if (!fotoTemDataLocal(f)) return f;
                if (!f.id) f.id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                var k = chaveFotoLocal(a.id, f.id);
                if (_fotosCache[k] !== f.data) {
                    _fotosCache[k] = f.data;
                    novas[k] = f.data;
                    delete _fotosIdbConfirmadas[k];
                }
                var leve = Object.assign({}, f, { idb: true });
                if (tirarTodas || _fotosIdbConfirmadas[k]) delete leve.data;
                return leve;
            })
        });
    });
    return { copia: copia, novas: novas };
}

function carregarMain() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return estadoVazio();
        var data = JSON.parse(raw);
        return preencherFotosDoCache(Object.assign(estadoVazio(), data || {}));
    } catch (e) {
        return estadoVazio();
    }
}

function salvarMain(db) {
    var sep = separarFotosParaIdb(db, false);
    if (Object.keys(sep.novas).length) {
        gravarFotosIdb(sep.novas).then(function () {
            /* regrava já sem as fotos confirmadas no IndexedDB */
            try { salvarMain(carregarMain()); } catch (eR) { /* ok */ }
        }).catch(function (eI) { console.warn('fotos IndexedDB:', eI); });
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sep.copia));
    } catch (eCheio) {
        /* localStorage cheio: grava sem nenhuma foto embutida (já estão no cache indo para o IndexedDB) */
        localStorage.setItem(STORAGE_KEY, JSON.stringify(separarFotosParaIdb(db, true).copia));
    }
}

/* Na abertura: carrega as fotos do IndexedDB e migra as que ainda estão dentro do localStorage */
var fotosLocaisProntas = lerTodasFotosIdb().then(function (m) {
    Object.keys(m).forEach(function (k) {
        if (!_fotosCache[k]) _fotosCache[k] = m[k];
        if (_fotosCache[k] === m[k]) _fotosIdbConfirmadas[k] = true;
    });
}).catch(function (e) {
    console.warn('fotos IndexedDB indisponível:', e);
}).then(function () {
    try { salvarMain(carregarMain()); } catch (eMig) { console.warn('migrar fotos:', eMig); }
    try { if (typeof renderHistorico === 'function') renderHistorico(); } catch (eH) { /* ok */ }
});
window.fotosLocaisProntas = fotosLocaisProntas;

/* carregar/salvar: no modo interno, vendas/caixa ficam no banco interno.
   Produtos/estoque são UNIFICADOS (sempre no banco oficial). */
function carregar() {
    var main = carregarMain();
    if (canalVendas !== 'interno') return main;
    var int = carregarInternoRaw();
    return Object.assign({}, main, {
        orcamentos: int.orcamentos || [],
        caixa: int.caixa || [],
        caixaBanco: int.caixaBanco || [],
        pendentes: int.pendentes || [],
        caixaConfig: int.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
        funcionarios: (typeof mesclarFuncionarios === 'function'
            ? mesclarFuncionarios(main.funcionarios, int.funcionarios)
            : (int.funcionarios || []).concat(main.funcionarios || [])),
        pagamentosFuncionarios: int.pagamentosFuncionarios || [],
        anotacoesFuncionarios: int.anotacoesFuncionarios || [],
        fechamentosFuncionarios: int.fechamentosFuncionarios || []
    });
}

function salvar(db) {
    if (canalVendas !== 'interno') {
        salvarMain(db);
    } else {
        var intAtual = carregarInternoRaw();
        salvarInternoRaw({
            produtos: [], /* estoque unificado no oficial */
            orcamentos: db.orcamentos || [],
            caixa: db.caixa || [],
            caixaBanco: db.caixaBanco || [],
            pendentes: db.pendentes || [],
            caixaConfig: db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
            funcionarios: db.funcionarios != null ? db.funcionarios : (intAtual.funcionarios || []),
            pagamentosFuncionarios: db.pagamentosFuncionarios != null ? db.pagamentosFuncionarios : (intAtual.pagamentosFuncionarios || []),
            anotacoesFuncionarios: db.anotacoesFuncionarios != null ? db.anotacoesFuncionarios : (intAtual.anotacoesFuncionarios || []),
            fechamentosFuncionarios: db.fechamentosFuncionarios != null ? db.fechamentosFuncionarios : (intAtual.fechamentosFuncionarios || [])
        });
        var main = carregarMain();
        main.empresa = db.empresa || main.empresa;
        main.clientes = db.clientes || main.clientes;
        main.atendimentos = db.atendimentos || main.atendimentos;
        main.produtos = db.produtos || [];
        if (typeof mesclarFuncionarios === 'function') {
            main.funcionarios = mesclarFuncionarios(main.funcionarios, db.funcionarios);
        } else if (db.funcionarios && db.funcionarios.length && !(main.funcionarios || []).length) {
            main.funcionarios = db.funcionarios;
        }
        if (db.excluidos) main.excluidos = garantirExcluidos(db);
        if (db.pastasMes) main.pastasMes = db.pastasMes;
        if (db.fechamentosCaixa) main.fechamentosCaixa = db.fechamentosCaixa;
        salvarMain(main);
    }
    agendarSyncAutomatico('salvar');
}

/* Migra produtos que estavam só no interno para o estoque oficial (uma vez) */
function migrarProdutosInternoParaEstoqueUnificado() {
    var int = carregarInternoRaw();
    var listaInt = int.produtos || [];
    if (!listaInt.length) return 0;
    var main = carregarMain();
    var map = {};
    var porCodigo = {};

    function normCod(c) {
        return String(c || '').replace(/\D/g, '').toLowerCase();
    }
    function tempo(p) {
        return new Date((p && (p.atualizadoEm || p.criadoEm)) || 0).getTime() || 0;
    }
    function preferirNumero(a, b) {
        var na = Number(a) || 0;
        var nb = Number(b) || 0;
        return nb > na ? nb : na;
    }
    function registrar(p) {
        if (!p || !p.id) return;
        map[p.id] = p;
        var cod = normCod(p.codigo);
        if (cod) porCodigo[cod] = p.id;
    }

    (main.produtos || []).forEach(registrar);

    listaInt.forEach(function (n) {
        if (!n) return;
        var cod = normCod(n.codigo);
        var idAlvo = (n.id && map[n.id]) ? n.id : (cod && porCodigo[cod] ? porCodigo[cod] : null);
        if (!idAlvo) {
            if (!n.id) n.id = 'hm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            if (!n.criadoEm) n.criadoEm = new Date().toISOString();
            if (!n.atualizadoEm) n.atualizadoEm = n.criadoEm;
            registrar(n);
            return;
        }
        var L = map[idAlvo];
        var usarN = tempo(n) > tempo(L);
        var m = usarN ? Object.assign({}, L, n, { id: idAlvo }) : Object.assign({}, n, L, { id: idAlvo });
        /* preço: não ficar com zero se o outro lado tem valor */
        m.venda = preferirNumero(L.venda, n.venda);
        m.custo = preferirNumero(L.custo, n.custo);
        /* estoque: prioriza o mais recente; se ambos sem data, usa o maior */
        if (tempo(n) || tempo(L)) {
            m.qtd = usarN ? (Number(n.qtd) || 0) : (Number(L.qtd) || 0);
        } else {
            m.qtd = preferirNumero(L.qtd, n.qtd);
        }
        if (!m.nome) m.nome = L.nome || n.nome || '';
        if (!m.codigo) m.codigo = L.codigo || n.codigo || '';
        if (!m.codigoPeca) m.codigoPeca = L.codigoPeca || n.codigoPeca || L.codPeca || n.codPeca || '';
        if (!m.unidade) m.unidade = L.unidade || n.unidade || 'un';
        m.atualizadoEm = new Date().toISOString();
        registrar(m);
    });

    main.produtos = Object.keys(map).map(function (k) { return map[k]; });
    salvarMain(main);
    int.produtos = [];
    salvarInternoRaw(int);
    return listaInt.length;
}

