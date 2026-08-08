'use strict';
/* Joninha — nuvem Firebase / sync (etapa 2.2) */

function configNuvemInjetada() {
    var c = window.JONINHA_FIREBASE_CONFIG;
    if (!c || typeof c !== 'object') return null;
    if (!c.apiKey || !c.projectId) return null;
    return {
        apiKey: String(c.apiKey || '').trim(),
        authDomain: String(c.authDomain || '').trim(),
        projectId: String(c.projectId || '').trim(),
        storageBucket: String(c.storageBucket || '').trim(),
        messagingSenderId: String(c.messagingSenderId || '').trim(),
        appId: String(c.appId || '').trim(),
        email: String(c.email || '').trim(),
        senha: String(c.senha || '')
    };
}

function carregarConfigNuvem() {
    var local = null;
    try {
        local = JSON.parse(localStorage.getItem(NUVEM_KEY) || 'null');
    } catch (e) {
        local = null;
    }
    var inj = configNuvemInjetada();
    if (!local && !inj) return null;
    if (!local) return inj;
    if (!inj) return local;
    return {
        apiKey: local.apiKey || inj.apiKey,
        authDomain: local.authDomain || inj.authDomain,
        projectId: local.projectId || inj.projectId,
        storageBucket: local.storageBucket || inj.storageBucket,
        messagingSenderId: local.messagingSenderId || inj.messagingSenderId,
        appId: local.appId || inj.appId,
        email: local.email || inj.email,
        senha: local.senha || inj.senha
    };
}

function salvarConfigNuvem(cfg) {
    if (!cfg) localStorage.removeItem(NUVEM_KEY);
    else localStorage.setItem(NUVEM_KEY, JSON.stringify(cfg));
}

function atualizarStatusNuvemUI() {
    var el = document.getElementById('nuvemStatusTexto') ||
        document.getElementById('statusNuvem') ||
        document.getElementById('nuvemStatus');
    if (!el) return;
    var cfg = carregarConfigNuvem();
    var user = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
        el.className = 'config-status aviso';
        el.innerHTML = '<strong>Nuvem:</strong> faltam chaves — rode <code>npm run build</code> com o arquivo .env.';
        return;
    }
    if (user) {
        el.className = 'config-status';
        var syncTxt = _syncUltimaOkEm
            ? ' · última sync ' + esc(fmtHoraSync(_syncUltimaOkEm))
            : '';
        el.innerHTML = '<strong>Nuvem:</strong> conectado como ' + esc(user.email || 'usuário') +
            ' · ' + esc(cfg.projectId) +
            ' · sync automática' + syncTxt +
            (_syncEmAndamento ? ' · sincronizando…' : '') + '.';
    } else {
        el.className = 'config-status aviso';
        el.innerHTML = '<strong>Nuvem:</strong> entre com e-mail/senha do Firebase Authentication.';
    }
}

var _fbSessao = null;
var _fbMods = null;
var _syncEmAndamento = false;
var _syncDebounceTimer = null;
var _syncIntervalId = null;
var _syncUltimaOkEm = 0;
try {
    var _ultSyncRaw = localStorage.getItem('joninha_suspensoes_sync_ultima');
    if (_ultSyncRaw) _syncUltimaOkEm = Number(_ultSyncRaw) || 0;
} catch (eUlt0) { /* ok */ }
var _syncListenersLigados = false;

function fmtHoraSync(ts) {
    try {
        var d = new Date(ts);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch (e) {
        return '';
    }
}

function usuarioNuvemLogado() {
    return !!(!_fbSessao || !_fbSessao.auth ? false : _fbSessao.auth.currentUser);
}

function usuarioNuvemEhAnonimo() {
    var u = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
    return !!(u && u.isAnonymous);
}

/* Admin e-mail OU anônimo (funcionário no celular) */
async function garantirSessaoNuvemQualquer() {
    var cfg = carregarConfigNuvem();
    if (!cfg || !cfg.apiKey || !cfg.projectId) return false;
    try {
        var sessao = await initFirebaseApp();
        if (sessao.auth.currentUser) return true;
        await sessao.authMod.signInAnonymously(sessao.auth);
        return !!(sessao.auth.currentUser);
    } catch (e) {
        console.warn('garantirSessaoNuvemQualquer:', e);
        return false;
    }
}

function agendarSyncAutomatico(motivo) {
    if (_syncEmAndamento) return;
    var cfg = carregarConfigNuvem();
    if (!cfg || !cfg.apiKey || !cfg.projectId) return;
    /* Ao salvar, agenda mesmo com aba em segundo plano (envia o que acabou de mudar) */
    if (motivo !== 'salvar' && document.hidden) return;
    clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(function () {
        if (_syncEmAndamento) return;
        if (motivo !== 'salvar' && document.hidden) return;
        dispararSyncConformeSessao({ silencioso: true, motivo: motivo || 'auto' }).catch(function () { /* offline */ });
    }, motivo === 'salvar' ? 2800 : 800);
}

async function dispararSyncConformeSessao(opts) {
    opts = opts || {};
    var okAuth = usuarioNuvemLogado() || await garantirSessaoNuvemQualquer();
    if (!okAuth) return;
    if (sessaoFuncionarioId && usuarioNuvemEhAnonimo()) {
        return sincronizarOficinaNuvem(opts);
    }
    if (sessaoFuncionarioId) {
        /* Funcionário com sessão Admin já logada: sync oficina (não mexe caixa no push cego) */
        return sincronizarOficinaNuvem(opts);
    }
    return sincronizarTodosNuvem(opts);
}

function iniciarSyncAutomatico() {
    if (_syncIntervalId) return;
    /* A cada 60s, se a aba estiver aberta */
    _syncIntervalId = setInterval(function () {
        if (document.hidden) return;
        dispararSyncConformeSessao({ silencioso: true, motivo: 'intervalo' }).catch(function () { /* offline */ });
    }, 60000);

    if (_syncListenersLigados) return;
    _syncListenersLigados = true;
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) agendarSyncAutomatico('visivel');
    });
    window.addEventListener('focus', function () {
        agendarSyncAutomatico('foco');
    });
    window.addEventListener('online', function () {
        agendarSyncAutomatico('online');
    });
}

function pararSyncAutomatico() {
    if (_syncIntervalId) {
        clearInterval(_syncIntervalId);
        _syncIntervalId = null;
    }
    clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = null;
}

async function initFirebaseApp() {
    var cfg = carregarConfigNuvem();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
        throw new Error('Nuvem sem chaves. Rode npm run build com o .env ou configure no Vercel.');
    }
    if (_fbSessao && _fbSessao.projectId === cfg.projectId && _fbSessao.auth) {
        return _fbSessao;
    }
    var firebaseConfig = {
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain || (cfg.projectId + '.firebaseapp.com'),
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket || undefined,
        messagingSenderId: cfg.messagingSenderId || '',
        appId: cfg.appId || ''
    };
    var appMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js');
    var authMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
    var fsMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    _fbMods = { appMod: appMod, authMod: authMod, fsMod: fsMod };
    var appName = 'joninha-' + cfg.projectId;
    var app;
    try {
        app = appMod.getApp(appName);
    } catch (e) {
        app = appMod.initializeApp(firebaseConfig, appName);
    }
    var auth = authMod.getAuth(app);
    try {
        await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    } catch (e) { /* ok */ }
    var dbFs = fsMod.getFirestore(app);
    _fbSessao = { projectId: cfg.projectId, app: app, auth: auth, dbFs: dbFs, fsMod: fsMod, authMod: authMod };
    return _fbSessao;
}

async function initnuvemApp() { return initFirebaseApp(); }

async function obterSessaoFirebase() {
    var sessao = await initFirebaseApp();
    if (!sessao.auth.currentUser) {
        throw new Error('Faça login com o e-mail e senha do Firebase para usar a nuvem.');
    }
    return sessao;
}

async function obterSessaonuvem() { return obterSessaoFirebase(); }

async function loginComFirebase(email, senha) {
    var sessao = await initFirebaseApp();
    await sessao.authMod.signInWithEmailAndPassword(sessao.auth, email, senha);
    return sessao.auth.currentUser;
}

async function loginComnuvem(email, senha) { return loginComFirebase(email, senha); }

async function logoutFirebase() {
    try {
        var sessao = await initFirebaseApp();
        if (sessao.auth.currentUser) {
            await sessao.authMod.signOut(sessao.auth);
        }
    } catch (e) { /* ok */ }
}

async function logoutnuvem() { return logoutFirebase(); }

async function enviarAtendimentoNuvem(atendimento) {
    var sessao = await obterSessaonuvem();
    var fsMod = sessao.fsMod;
    var dbFs = sessao.dbFs;
    var docOut = JSON.parse(JSON.stringify(atendimento));
    var fotos = docOut.fotos || [];
    for (var i = 0; i < fotos.length; i++) {
        var f = fotos[i];
        if (!f.data || !String(f.data).startsWith('data:')) continue;
        var fotoId = f.id || ('f' + i);
        f.id = fotoId;
        try {
            f.data = await garantirFotoComprimida(f.data);
            if (!f.data || String(f.data).length > FOTO_MAX_CHARS * 1.35) {
                return { ok: false, motivo: 'foto ainda grande demais após compressão' };
            }
            await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_midia', atendimento.id + '_' + fotoId), {
                atendimentoId: atendimento.id,
                fotoId: fotoId,
                data: f.data,
                comprimida: true,
                atualizadoEm: new Date().toISOString()
            });
            delete f.data;
        } catch (midErr) {
            return { ok: false, motivo: 'falha ao enviar foto: ' + (midErr.message || midErr.code || '') };
        }
    }
    docOut.fotos = fotos;
    docOut.atualizadoEm = new Date().toISOString();
    await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_atendimentos', atendimento.id), docOut);
    return { ok: true, atendimento: docOut };
}

async function hidratarFotosDaNuvem(atendimento) {
    var sessao = await obterSessaonuvem();
    var fsMod = sessao.fsMod;
    var dbFs = sessao.dbFs;
    var fotos = atendimento.fotos || [];
    for (var i = 0; i < fotos.length; i++) {
        var f = fotos[i];
        if (f.data || f.url) continue;
        if (!f.id) continue;
        try {
            var snap = await fsMod.getDoc(fsMod.doc(dbFs, 'joninha_suspensoes_midia', atendimento.id + '_' + f.id));
            if (snap.exists()) {
                var d = snap.data() || {};
                if (d.data) f.data = d.data;
                if (d.url) f.url = d.url;
            }
        } catch (e) { /* segue */ }
    }
    return atendimento;
}

async function baixarAtendimentosNuvem() {
    var sessao = await obterSessaonuvem();
    var fsMod = sessao.fsMod;
    var dbFs = sessao.dbFs;
    var snap = await fsMod.getDocs(fsMod.collection(dbFs, 'joninha_suspensoes_atendimentos'));
    var lista = [];
    snap.forEach(function (docSnap) {
        var a = docSnap.data() || {};
        if (!a.id) a.id = docSnap.id;
        lista.push(a);
    });
    for (var i = 0; i < lista.length; i++) {
        await hidratarFotosDaNuvem(lista[i]);
    }
    return lista;
}

function mesclarAtendimentosLocalNuvem(localLista, nuvemLista) {
    var map = {};
    (localLista || []).forEach(function (a) {
        if (a && a.id) map[a.id] = a;
    });
    (nuvemLista || []).forEach(function (n) {
        if (!n || !n.id) return;
        var L = map[n.id];
        if (!L) {
            map[n.id] = n;
            return;
        }
        var tL = new Date(L.atualizadoEm || L.criadoEm || 0).getTime();
        var tN = new Date(n.atualizadoEm || n.criadoEm || 0).getTime();
        if (tN >= tL) {
            var fotosLoc = L.fotos || [];
            var fotosNuv = n.fotos || [];
            map[n.id] = Object.assign({}, L, n);
            /* Assinatura do celular (coleção própria) não pode sumir se a OS na nuvem for mais nova sem o campo */
            if (!map[n.id].assinaturaCliente && L.assinaturaCliente) {
                map[n.id].assinaturaCliente = L.assinaturaCliente;
                map[n.id].assinadoEm = L.assinadoEm || map[n.id].assinadoEm || null;
            }
            if (!map[n.id].tokenAssinatura && L.tokenAssinatura) {
                map[n.id].tokenAssinatura = L.tokenAssinatura;
            }
            if (fotosNuv.length) {
                map[n.id].fotos = fotosNuv.map(function (fn, idx) {
                    if (fn.data || fn.url) return fn;
                    var fl = fotosLoc.find(function (x) { return x.id === fn.id; }) || fotosLoc[idx];
                    if (fl && (fl.data || fl.url)) return Object.assign({}, fn, { data: fl.data || null, url: fl.url || null });
                    return fn;
                });
            } else if (fotosLoc.length) {
                map[n.id].fotos = fotosLoc;
            }
        } else {
            (n.fotos || []).forEach(function (fn) {
                if (!fn.id) return;
                var fl = (L.fotos || []).find(function (x) { return x.id === fn.id; });
                if (fl && !fl.data && !fl.url && (fn.data || fn.url)) {
                    fl.data = fn.data || null;
                    fl.url = fn.url || null;
                }
            });
        }
    });
    return Object.keys(map).map(function (k) { return map[k]; });
}

function mesclarAtendimentosComExcluidos(localLista, nuvemLista, mapaEx) {
    return aplicarExcluidosNaLista(mesclarAtendimentosLocalNuvem(localLista, nuvemLista), mapaEx);
}

function tempoRegistro(item, seSemData) {
    var t = new Date((item && (item.atualizadoEm || item.criadoEm)) || 0).getTime();
    if (t) return t;
    return seSemData != null ? seSemData : 0;
}

function mesclarListaPorId(localLista, nuvemLista, mapaEx) {
    var map = {};
    (localLista || []).forEach(function (x) {
        if (x && x.id) map[x.id] = x;
    });
    (nuvemLista || []).forEach(function (n) {
        if (!n || !n.id) return;
        var L = map[n.id];
        if (!L) {
            map[n.id] = n;
            return;
        }
        /* Local sem data = edição recente (evita nuvem antiga zerar preço/estoque).
           Empate: local vence. Só nuvem mais nova sobrescreve. */
        var tL = tempoRegistro(L, Date.now());
        var tN = tempoRegistro(n, 0);
        map[n.id] = tN > tL ? Object.assign({}, L, n) : Object.assign({}, n, L);
    });
    return aplicarExcluidosNaLista(Object.keys(map).map(function (k) { return map[k]; }), mapaEx);
}

async function enviarLogoEmpresaNuvem(logoDataUrl) {
    var sessao = await obterSessaonuvem();
    var fsMod = sessao.fsMod;
    var dbFs = sessao.dbFs;
    if (logoDataUrl && String(logoDataUrl).startsWith('data:')) {
        await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_midia', 'logo_empresa'), {
            data: logoDataUrl,
            atualizadoEm: new Date().toISOString()
        });
        return true;
    }
    try {
        await fsMod.deleteDoc(fsMod.doc(dbFs, 'joninha_suspensoes_midia', 'logo_empresa'));
    } catch (e) { /* ok se não existir */ }
    return false;
}

async function hidratarLogoEmpresa(emp) {
    var e = Object.assign(empresaPadrao(), emp || {});
    if (e.logo && String(e.logo).startsWith('data:')) return e;
    if (e.logo && /^https?:\/\//i.test(e.logo)) return e;
    if (!e.logoNaMidia && e.logo) return e;
    try {
        var sessao = await obterSessaonuvem();
        var snap = await sessao.fsMod.getDoc(
            sessao.fsMod.doc(sessao.dbFs, 'joninha_suspensoes_midia', 'logo_empresa')
        );
        if (snap.exists()) {
            var d = snap.data() || {};
            if (d.data) {
                e.logo = d.data;
                e.logoNaMidia = true;
            }
        }
    } catch (err) { /* segue sem logo */ }
    return e;
}

function empresaParaBaseNuvem(emp) {
    var out = Object.assign(empresaPadrao(), emp || {});
    if (out.logo && String(out.logo).startsWith('data:')) {
        out.logoNaMidia = true;
        out.logo = '';
    }
    return out;
}

var _envioEmpTimer = null;
function agendarEnvioEmpresaNuvem(emp) {
    clearTimeout(_envioEmpTimer);
    _envioEmpTimer = setTimeout(function () {
        enviarEmpresaNuvem(emp).then(function (ok) {
            if (ok) {
                atualizarStatusNuvemUI();
                toast('Configuração da empresa na nuvem OK.');
            }
        }).catch(function () { /* sem login / offline: fica só local */ });
    }, 350);
}

async function enviarEmpresaNuvem(emp) {
    if (!_fbSessao || !_fbSessao.auth || !_fbSessao.auth.currentUser) return false;
    var sessao = await obterSessaonuvem();
    var fsMod = sessao.fsMod;
    var dbFs = sessao.dbFs;
    var empLocal = Object.assign(empresaPadrao(), emp || getEmpresa());
    await enviarLogoEmpresaNuvem(empLocal.logo);
    var empNuv = empresaParaBaseNuvem(empLocal);
    /* merge:true — só atualiza empresa; NÃO regrava produtos/clientes antigos */
    await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_base', 'principal'), {
        empresa: empNuv,
        atualizadoEm: new Date().toISOString()
    }, { merge: true });
    return true;
}

async function puxarConfigEmpresaNuvemSilencioso() {
    try {
        if (!_fbSessao || !_fbSessao.auth || !_fbSessao.auth.currentUser) return false;
        var baseNuv = await baixarBaseNuvemSilencioso();
        if (!baseNuv || !baseNuv.empresa) {
            /* Nada na nuvem ainda: sobe o que estiver no PC */
            var local = carregarMain().empresa;
            if (local && !empresaEstaPadrao(local)) {
                await enviarEmpresaNuvem(local);
                return true;
            }
            return false;
        }
        var db = carregarMain();
        var empAntes = db.empresa;
        var tL = new Date((empAntes && empAntes.atualizadoEm) || 0).getTime();
        var tN = new Date((baseNuv.empresa && baseNuv.empresa.atualizadoEm) || baseNuv.atualizadoEm || 0).getTime();
        var mesclada = mesclarEmpresa(db.empresa, baseNuv.empresa, baseNuv.atualizadoEm);
        mesclada = await hidratarLogoEmpresa(mesclada);
        db.empresa = mesclada;
        salvarMain(db);
        aplicarIdentidadeVisual();
        preencherFormEmpresa();
        if (tL > tN && !empresaEstaPadrao(empAntes)) {
            await enviarEmpresaNuvem(mesclada);
        }
        return true;
    } catch (e) {
        return false;
    }
}

async function enviarBaseNuvem(db) {
    var sessao = await obterSessaonuvem();
    var fsMod = sessao.fsMod;
    var dbFs = sessao.dbFs;
    var empLocal = Object.assign(empresaPadrao(), db.empresa || empresaPadrao());
    await enviarLogoEmpresaNuvem(empLocal.logo);
    var base = {
        empresa: empresaParaBaseNuvem(empLocal),
        clientes: db.clientes || [],
        produtos: db.produtos || [],
        orcamentos: db.orcamentos || [],
        caixa: db.caixa || [],
        caixaBanco: db.caixaBanco || [],
        pendentes: db.pendentes || [],
        caixaConfig: db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
        excluidos: garantirExcluidos(db),
        funcionarios: listarFuncionariosInterno(),
        atualizadoEm: new Date().toISOString()
    };
    await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_base', 'principal'), base);
    try { await enviarLoginsFuncNuvem(); } catch (eLog) { /* ok */ }
    return base;
}

async function baixarBaseNuvemSilencioso(sessao) {
    try {
        var s = sessao || await obterSessaonuvem();
        var snap = await s.fsMod.getDoc(s.fsMod.doc(s.dbFs, 'joninha_suspensoes_base', 'principal'));
        if (!snap.exists()) return null;
        return snap.data() || null;
    } catch (e) {
        return null;
    }
}

async function baixarBaseNuvem() {
    var sessao = await obterSessaonuvem();
    var fsMod = sessao.fsMod;
    var dbFs = sessao.dbFs;
    var snap = await fsMod.getDoc(fsMod.doc(dbFs, 'joninha_suspensoes_base', 'principal'));
    if (!snap.exists()) return null;
    return snap.data() || null;
}

/* Sync seguro p/ funcionário (e Admin no celular): OS + fotos + clientes. Não empurra caixa. */
async function sincronizarOficinaNuvem(opts) {
    opts = opts || {};
    var silencioso = !!opts.silencioso;
    var mostrarToast = opts.mostrarToast != null ? !!opts.mostrarToast : !silencioso;
    if (_syncEmAndamento) {
        if (!silencioso) toast('Sincronização já em andamento…');
        return;
    }
    var cfg = carregarConfigNuvem();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
        if (!silencioso) toast('Modo local — nuvem desativada.');
        return;
    }
    if (!usuarioNuvemLogado()) {
        var okA = await garantirSessaoNuvemQualquer();
        if (!okA) {
            if (!silencioso) toast('Ative Authentication → Anônimo no Firebase (Blindagem).');
            return;
        }
    }

    _syncEmAndamento = true;
    atualizarStatusNuvemUI();
    if (!silencioso) toast('Sincronizando oficina (OS + fotos)…');

    try {
        await obterSessaonuvem();
        var canalAntes = canalVendas;
        canalVendas = 'normal';
        var db = carregar();
        var ok = 0, falha = 0;

        try {
            var baseNuv = await baixarBaseNuvem();
            if (baseNuv) {
                db.excluidos = mesclarExcluidos(db.excluidos, baseNuv.excluidos);
                var ex = garantirExcluidos(db);
                db.clientes = mesclarListaPorId(db.clientes, baseNuv.clientes, ex.clientes);
                if (baseNuv.funcionarios) aplicarFuncionariosDaNuvem(baseNuv.funcionarios);
            }
        } catch (eBase) { /* offline parcial */ }

        var nuvemLista = await baixarAtendimentosNuvem();
        var exAt = garantirExcluidos(db).atendimentos;
        db.atendimentos = mesclarAtendimentosComExcluidos(db.atendimentos, nuvemLista, exAt);

        for (var i = 0; i < (db.atendimentos || []).length; i++) {
            var at = db.atendimentos[i];
            if (!at || !at.id) continue;
            /* Comprime fotos locais antes do upload */
            if (at.fotos && at.fotos.length) {
                for (var fi = 0; fi < at.fotos.length; fi++) {
                    if (at.fotos[fi] && at.fotos[fi].data) {
                        at.fotos[fi].data = await garantirFotoComprimida(at.fotos[fi].data);
                    }
                }
            }
            var r = await enviarAtendimentoNuvem(at);
            if (r.ok) {
                ok++;
                if (r.atendimento) {
                    var locais = at.fotos || [];
                    var nuvFotos = r.atendimento.fotos || [];
                    db.atendimentos[i].syncNuvemEm = new Date().toISOString();
                    db.atendimentos[i].fotos = nuvFotos.map(function (fn, idx) {
                        var fl = locais.find(function (x) { return x && fn && x.id === fn.id; }) || locais[idx] || {};
                        return {
                            id: (fn && fn.id) || fl.id || uid(),
                            data: fl.data || null,
                            url: fl.url || (fn && fn.url) || null
                        };
                    });
                    if (!db.atendimentos[i].fotos.length && locais.length) {
                        db.atendimentos[i].fotos = locais;
                    }
                }
            } else falha++;
        }

        /* Sobe só clientes (merge), sem reescrever caixa */
        try {
            var sessao = await obterSessaonuvem();
            await sessao.fsMod.setDoc(
                sessao.fsMod.doc(sessao.dbFs, 'joninha_suspensoes_base', 'principal'),
                {
                    clientes: db.clientes || [],
                    atualizadoEm: new Date().toISOString()
                },
                { merge: true }
            );
        } catch (eCli) { /* ok */ }

        salvar(db);
        canalVendas = canalAntes;
        _syncUltimaOkEm = Date.now();
        try { localStorage.setItem(SYNC_ULTIMA_KEY, String(_syncUltimaOkEm)); } catch (eUlt) { /* ok */ }

        try {
            if (typeof sincronizarAssinaturasDaNuvem === 'function') {
                await sincronizarAssinaturasDaNuvem();
            }
        } catch (eAss) { /* ok */ }

        if (mostrarToast) {
            toast('Oficina nuvem: ' + ok + ' OS' + (falha ? ' · ' + falha + ' falha(s)' : '') + '.');
        }
        try { renderHistorico(); } catch (eH) { /* ok */ }
        try { renderTudo(); } catch (eR) { /* ok */ }
    } finally {
        _syncEmAndamento = false;
        atualizarStatusNuvemUI();
    }
}

async function sincronizarTodosNuvem(opts) {
    opts = opts || {};
    var silencioso = !!opts.silencioso;
    var mostrarToast = opts.mostrarToast != null ? !!opts.mostrarToast : !silencioso;
    if (_syncEmAndamento) {
        if (!silencioso) toast('Sincronização já em andamento…');
        return;
    }
    var cfg = carregarConfigNuvem();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
        if (!silencioso) toast('Modo local — nuvem desativada.');
        return;
    }
    if (!usuarioNuvemLogado()) {
        if (!silencioso) toast('Faça login para sincronizar.');
        return;
    }

    _syncEmAndamento = true;
    atualizarStatusNuvemUI();
    if (!silencioso) toast('Entrando na nuvem e sincronizando…');

    try {
        await obterSessaonuvem();

        var canalAntes = canalVendas;
        canalVendas = 'normal';
        var db = carregar();
        var ok = 0, falha = 0;

        /* 1) Baixa e mescla base (empresa, clientes, estoque, caixa…) */
        var baseNuv = await baixarBaseNuvem();
        if (baseNuv) {
            db.excluidos = mesclarExcluidos(db.excluidos, baseNuv.excluidos);
            var ex = garantirExcluidos(db);
            db.empresa = mesclarEmpresa(db.empresa, baseNuv.empresa, baseNuv.atualizadoEm);
            db.empresa = await hidratarLogoEmpresa(db.empresa);
            db.clientes = mesclarListaPorId(db.clientes, baseNuv.clientes, ex.clientes);
            db.produtos = mesclarListaPorId(db.produtos, baseNuv.produtos, ex.produtos);
            db.orcamentos = mesclarListaPorId(db.orcamentos, baseNuv.orcamentos, ex.orcamentos);
            db.caixa = mesclarListaPorId(db.caixa, baseNuv.caixa, ex.caixa);
            db.caixaBanco = mesclarListaPorId(db.caixaBanco, baseNuv.caixaBanco, ex.caixaBanco);
            db.pendentes = mesclarListaPorId(db.pendentes, baseNuv.pendentes, ex.pendentes);
            db.caixaConfig = mesclarCaixaConfig(db.caixaConfig, baseNuv.caixaConfig);
            if (baseNuv.funcionarios) {
                aplicarFuncionariosDaNuvem(baseNuv.funcionarios);
            }
            /* Remove da nuvem qualquer OS que o usuário já excluiu do caixa */
            var bloq = (db.caixaConfig && db.caixaConfig.osBloqueadasCaixa) || {};
            if (Object.keys(bloq).length) {
                db.caixa = (db.caixa || []).filter(function (x) {
                    if (!x || !x.atendimentoId) return true;
                    if (!bloq[x.atendimentoId] && !bloq[String(x.atendimentoId)]) return true;
                    marcarExcluido(db, 'caixa', x.id);
                    return false;
                });
                db.caixaBanco = (db.caixaBanco || []).filter(function (x) {
                    if (!x || !x.atendimentoId) return true;
                    if (!bloq[x.atendimentoId] && !bloq[String(x.atendimentoId)]) return true;
                    marcarExcluido(db, 'caixaBanco', x.id);
                    return false;
                });
            }
        } else {
            db.excluidos = garantirExcluidos(db);
            db.empresa = await hidratarLogoEmpresa(db.empresa);
        }

        /* 2) Baixa e mescla OS + fotos (respeitando exclusões) */
        var nuvemLista = await baixarAtendimentosNuvem();
        var exAt = garantirExcluidos(db).atendimentos;
        db.atendimentos = mesclarAtendimentosComExcluidos(db.atendimentos, nuvemLista, exAt);

        /* 2b) Apaga na nuvem OS que foram excluídas */
        try {
            var sessaoDel = await obterSessaonuvem();
            var idsEx = Object.keys(exAt || {});
            for (var di = 0; di < idsEx.length; di++) {
                try {
                    await sessaoDel.fsMod.deleteDoc(
                        sessaoDel.fsMod.doc(sessaoDel.dbFs, 'joninha_suspensoes_atendimentos', idsEx[di])
                    );
                } catch (delErr) { /* ok */ }
            }
        } catch (eDel) { /* ok */ }

        /* 3) Envia o resultado mesclado de volta */
        await enviarBaseNuvem(db);
        for (var i = 0; i < (db.atendimentos || []).length; i++) {
            var r = await enviarAtendimentoNuvem(db.atendimentos[i]);
            if (r.ok) {
                ok++;
                if (r.atendimento) {
                    var locais = db.atendimentos[i].fotos || [];
                    var nuvFotos = r.atendimento.fotos || [];
                    db.atendimentos[i].syncNuvemEm = new Date().toISOString();
                    db.atendimentos[i].fotos = nuvFotos.map(function (fn, idx) {
                        var fl = locais.find(function (x) { return x && fn && x.id === fn.id; }) || locais[idx] || {};
                        return {
                            id: (fn && fn.id) || fl.id || uid(),
                            data: fl.data || null,
                            url: fl.url || (fn && fn.url) || null
                        };
                    });
                    if (!db.atendimentos[i].fotos.length && locais.length) {
                        db.atendimentos[i].fotos = locais;
                    }
                }
            } else falha++;
        }

        salvar(db);
        try { blindarCaixaContraOsBloqueadas(db); salvar(db); } catch (eBl) { /* ok */ }
        canalVendas = canalAntes;
        _syncUltimaOkEm = Date.now();
        try { localStorage.setItem(SYNC_ULTIMA_KEY, String(_syncUltimaOkEm)); } catch (eUlt) { /* ok */ }

        try {
            if (typeof sincronizarAssinaturasDaNuvem === 'function') {
                await sincronizarAssinaturasDaNuvem();
            }
        } catch (eAss2) { /* ok */ }

        if (mostrarToast) {
            if (silencioso) {
                toast('Sincronizado na nuvem.');
            } else {
                toast('Nuvem OK: ' + ok + ' OS · ' + (db.clientes || []).length + ' cliente(s)' +
                    (falha ? ' · ' + falha + ' falha(s)' : '') + '.');
            }
        }
        preencherFormEmpresa();
        renderTudo();
    } finally {
        _syncEmAndamento = false;
        atualizarStatusNuvemUI();
    }
}


document.getElementById('btnSyncNuvem').addEventListener('click', function () {
    sincronizarTodosNuvem({ silencioso: false, mostrarToast: true }).catch(function (err) {
        toast('Erro na nuvem: ' + (err.message || err.code || 'verifique login e regras'));
    });
});
