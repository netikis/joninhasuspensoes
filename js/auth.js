'use strict';
/* Joninha — auth / sessão / logins funcionário (etapa 2.2) */

/* ---------- Login local (sem Firebase / Vercel / GitHub) ---------- */
var SENHA_LOCAL_KEY = 'joninha_suspensoes_senha_local';
var SESS_LOCAL_KEY = 'joninha_suspensoes_sessao_ok';

function liberarApp(opts) {
    opts = opts || {};
    try {
if (opts.funcionarioId) {
    sessaoFuncionarioId = opts.funcionarioId;
} else if (!opts.manterFuncionario) {
    sessaoFuncionarioId = null;
}

document.body.classList.remove('aguardando-login');
var tela = document.getElementById('telaLogin');
if (tela) tela.classList.add('oculto');
var errEl = document.getElementById('loginErro');
if (errEl) errEl.style.display = 'none';

if (sessaoFuncionarioId) {
    localStorage.setItem(SESS_LOCAL_KEY, 'func:' + sessaoFuncionarioId);
    aplicarModoFuncionario(sessaoFuncionarioId);
    atualizarStatusNuvemUI();
    garantirSessaoNuvemQualquer().then(function (ok) {
        iniciarSyncAutomatico();
        if (!ok) {
            toast('Fotos/OS ficam só neste celular até ativar Auth Anônimo no Firebase.');
            atualizarStatusNuvemUI();
            return;
        }
        sincronizarOficinaNuvem({ silencioso: true, mostrarToast: true }).catch(function () { /* offline */ });
        atualizarStatusNuvemUI();
    });
    return;
}

localStorage.setItem(SESS_LOCAL_KEY, '1');
aplicarModoFuncionario(null);
atualizarStatusNuvemUI();
iniciarSyncAutomatico();
sincronizarTodosNuvem({ silencioso: true, mostrarToast: true }).catch(function () {
    if (typeof puxarConfigEmpresaNuvemSilencioso === 'function') {
        puxarConfigEmpresaNuvemSilencioso().then(function (ok) {
            if (ok) renderTudo();
        });
    }
});
    } catch (err) {
console.error(err);
mostrarErroLogin('Erro ao liberar o painel. Tente novamente.');
    }
}

function bloquearApp() {
    document.body.classList.add('aguardando-login');
    document.getElementById('telaLogin').classList.remove('oculto');
    localStorage.removeItem(SESS_LOCAL_KEY);
    sessaoFuncionarioId = null;
    aplicarModoFuncionario(null);
    prepararTelaLogin();
    preencherSelectLoginFunc();
    pararSyncAutomatico();
    atualizarStatusNuvemUI();
    try {
        var em = document.getElementById('loginEmail');
        var se = document.getElementById('loginSenha');
        var fu = document.getElementById('loginFuncUser');
        var fs = document.getElementById('loginFuncSenha');
        if (em) em.value = '';
        if (se) se.value = '';
        if (fu) fu.value = '';
        if (fs) fs.value = '';
    } catch (eLimpa) { /* ok */ }
}

/** Sai da sessão (Admin ou Funcionário) para trocar usuário — especialmente no celular */
async function sairDoSistema(opts) {
    opts = opts || {};
    if (!opts.semConfirm && !confirm('Sair do sistema para trocar de usuário?')) return;
    try {
        if (typeof fecharMenuMobile === 'function') fecharMenuMobile();
    } catch (eM) { /* ok */ }
    try {
        if (typeof logoutFirebase === 'function') await logoutFirebase();
    } catch (eL) { /* ok */ }
    bloquearApp();
    toast('Saiu. Escolha Oficina/Admin ou Funcionário para entrar de novo.');
    try {
        var tabA = document.getElementById('tabLoginAdmin');
        if (tabA) tabA.click();
    } catch (eT) { /* ok */ }
}

function restaurarSessaoFuncionarioSalva() {
    var sess = localStorage.getItem(SESS_LOCAL_KEY) || '';
    if (sess.indexOf('func:') !== 0) return false;
    var fid = sess.slice(5);
    var f = listarFuncionariosInterno().find(function (x) {
return x && x.id === fid && x.ativo !== false && String(x.loginUsuario || '').trim();
    });
    if (!f) {
localStorage.removeItem(SESS_LOCAL_KEY);
return false;
    }
    liberarApp({ funcionarioId: f.id });
    return true;
}

function mostrarErroLogin(msg) {
    var el = document.getElementById('loginErro');
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
}

function mensagemErroFirebase(err) {
    var c = (err && (err.code || err.message)) || '';
    if (String(c).indexOf('auth/invalid-credential') >= 0 || String(c).indexOf('auth/wrong-password') >= 0) {
return 'E-mail ou senha incorretos.';
    }
    if (String(c).indexOf('auth/user-not-found') >= 0) return 'Usuário não encontrado no Firebase.';
    if (String(c).indexOf('auth/too-many-requests') >= 0) return 'Muitas tentativas. Aguarde e tente de novo.';
    if (String(c).indexOf('auth/invalid-email') >= 0) return 'E-mail inválido.';
    if (String(c).indexOf('chaves') >= 0 || String(c).indexOf('.env') >= 0 || String(c).indexOf('Nuvem') >= 0) {
return String(err.message || c);
    }
    return err.message || err.code || 'Falha no login.';
}

function mensagemErronuvem(err) { return mensagemErroFirebase(err); }

function prepararTelaLogin() {
    document.getElementById('loginTitulo').textContent = 'Entrar no sistema';
    var elVer = document.getElementById('loginAppVersion');
    if (elVer) elVer.textContent = 'Build ' + APP_VERSION;
    var badgeVer = document.getElementById('badgeAppVersion');
    if (badgeVer) badgeVer.textContent = APP_VERSION;
    var cfg = carregarConfigNuvem();
    if (cfg && cfg.apiKey && cfg.projectId) {
document.getElementById('loginHint').textContent = 'Use o e-mail e a senha do Firebase Authentication (nuvem Joninha).';
document.getElementById('loginEmail').placeholder = 'seu@email.com';
document.getElementById('loginSenha').placeholder = 'Senha do Firebase';
    } else {
document.getElementById('loginHint').textContent = 'Sem chaves Firebase — acesso local. Rode npm run build com o .env.';
document.getElementById('loginEmail').placeholder = 'Operador (opcional)';
document.getElementById('loginSenha').placeholder = 'Senha local';
    }
    mostrarErroLogin('');
    document.getElementById('loginEmail').value = localStorage.getItem(LOGIN_EMAIL_KEY) || '';
    document.getElementById('loginSenha').value = '';
    setTimeout(function () {
var email = document.getElementById('loginEmail');
var senha = document.getElementById('loginSenha');
if (email && email.value) senha.focus();
else if (email) email.focus();
    }, 80);
}

async function iniciarLoginApp() {
    if (restaurarSessaoFuncionarioSalva()) return;

    var cfg = carregarConfigNuvem();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
if (localStorage.getItem(SESS_LOCAL_KEY) === '1') {
    liberarApp();
    return;
}
prepararTelaLogin();
return;
    }
    document.getElementById('loginHint').textContent = 'Conectando à nuvem…';
    try {
var sessao = await initFirebaseApp();
await new Promise(function (resolve) {
    var done = false;
    var unsub = sessao.authMod.onAuthStateChanged(sessao.auth, function (user) {
        if (done) return;
        done = true;
        try { unsub(); } catch (e) { /* ok */ }
        if (user) {
            if (user.email) localStorage.setItem(LOGIN_EMAIL_KEY, user.email);
            liberarApp();
        } else if (!restaurarSessaoFuncionarioSalva()) {
            prepararTelaLogin();
        }
        resolve();
    });
    setTimeout(function () {
        if (!done) {
            done = true;
            try { unsub(); } catch (e) { /* ok */ }
            if (sessao.auth.currentUser) {
                liberarApp();
            } else if (!restaurarSessaoFuncionarioSalva()) {
                prepararTelaLogin();
            }
            resolve();
        }
    }, 4000);
});
    } catch (err) {
if (!restaurarSessaoFuncionarioSalva()) {
    prepararTelaLogin();
    mostrarErroLogin(mensagemErroFirebase(err));
}
    }
}

document.getElementById('btnLoginEntrar').addEventListener('click', async function () {
    var email = document.getElementById('loginEmail').value.trim();
    var senha = document.getElementById('loginSenha').value;
    var cfg = carregarConfigNuvem();
    mostrarErroLogin('');

    if (!cfg || !cfg.apiKey || !cfg.projectId) {
if (!senha) { mostrarErroLogin('Informe a senha local.'); return; }
var salva = localStorage.getItem(SENHA_LOCAL_KEY);
if (!salva) {
    localStorage.setItem(SENHA_LOCAL_KEY, senha);
    if (email) localStorage.setItem(LOGIN_EMAIL_KEY, email);
    sessaoFuncionarioId = null;
    liberarApp();
    toast('Senha local criada (sem nuvem).');
    return;
}
if (senha !== salva) { mostrarErroLogin('Senha incorreta.'); return; }
if (email) localStorage.setItem(LOGIN_EMAIL_KEY, email);
sessaoFuncionarioId = null;
liberarApp();
toast('Acesso local liberado.');
return;
    }

    if (!email || !senha) { mostrarErroLogin('Informe e-mail e senha do Firebase.'); return; }
    document.getElementById('loginHint').textContent = 'Entrando na nuvem…';
    try {
var user = await loginComFirebase(email, senha);
if (user && user.email) localStorage.setItem(LOGIN_EMAIL_KEY, user.email);
sessaoFuncionarioId = null;
liberarApp();
toast('Login OK — ' + (user.email || 'conectado') + '.');
    } catch (err) {
document.getElementById('loginHint').textContent = 'Use o e-mail e a senha do Firebase Authentication.';
mostrarErroLogin(mensagemErroFirebase(err));
    }
});

document.getElementById('loginSenha').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('btnLoginEntrar').click();
});
document.getElementById('loginEmail').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('loginSenha').focus();
});

document.getElementById('btnAppSair').addEventListener('click', async function () {
    try { await logoutFirebase(); } catch (e) { /* ok */ }
    bloquearApp();
    toast('Saiu da conta.');
});


function listarFuncionariosInterno() {
    try {
var raw = localStorage.getItem(STORAGE_INTERNO);
var int = raw ? JSON.parse(raw) : {};
return int.funcionarios || [];
    } catch (e) {
return [];
    }
}

function salvarFuncionariosInterno(lista) {
    try {
var raw = localStorage.getItem(STORAGE_INTERNO);
var int = raw ? JSON.parse(raw) : {};
int.funcionarios = lista || [];
localStorage.setItem(STORAGE_INTERNO, JSON.stringify(int));
    } catch (e) {
toast('Não foi possível salvar o login.');
    }
}

function aplicarFuncionariosDaNuvem(remotos) {
    var logins = forcarAplicarFuncionariosNuvem(remotos || []);
    return logins.length > 0;
}

function payloadLoginsFuncNuvemSyncFromLista(funcsReady) {
    return {
tipo: 'logins_funcionarios',
token: DOC_LOGINS_FUNC_NUVEM,
versaoApp: APP_VERSION,
funcionarios: funcsReady || [],
atualizadoEm: new Date().toISOString()
    };
}

async function payloadLoginsFuncNuvem() {
    var funcs = [];
    var lista = listarFuncionariosInterno();
    for (var i = 0; i < lista.length; i++) {
var f = lista[i];
if (!f || !f.id || f.ativo === false) continue;
var u = normalizarLoginFunc(f.loginUsuario);
var s = normalizarSenhaFunc(f.loginSenha);
var h = f.loginSenhaHash || '';
if (!u) continue;
if (!h && s) {
    h = await hashSenhaFunc(u, s);
    lista[i].loginSenhaHash = h;
}
if (!h) continue;
funcs.push({
    id: f.id,
    nome: f.nome || '',
    ativo: true,
    loginUsuario: u,
    loginSenhaHash: h,
    atualizadoEm: f.atualizadoEm || new Date().toISOString()
});
    }
    salvarFuncionariosInterno(lista);
    sincronizarMapaLoginsFuncLimpo();
    return payloadLoginsFuncNuvemSyncFromLista(funcs);
}

async function enviarLoginsFuncNuvem(opts) {
    opts = opts || {};
    var cfg = carregarConfigNuvem();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
return { ok: false, erro: 'Nuvem sem configuração Firebase.' };
    }
    var pack = await payloadLoginsFuncNuvem();
    if (!(pack.funcionarios || []).length && !opts.permitirVazio) {
return { ok: false, erro: 'Nenhum login de funcionário para enviar.' };
    }
    try {
var sessao = await initFirebaseApp();
await sessao.fsMod.setDoc(
    sessao.fsMod.doc(sessao.dbFs, COL_LOGINS_FUNC_NUVEM, DOC_LOGINS_FUNC_NUVEM),
    pack
);
    } catch (e1) {
console.warn('enviar logins_func:', e1);
try {
    if (!usuarioNuvemLogado()) {
        return { ok: false, erro: (e1 && (e1.message || e1.code)) || 'Falha ao enviar. Atualize as regras Firebase (Blindagem).' };
    }
    var sAuth = await obterSessaonuvem();
    await sAuth.fsMod.setDoc(
        sAuth.fsMod.doc(sAuth.dbFs, COL_LOGINS_FUNC_NUVEM, DOC_LOGINS_FUNC_NUVEM),
        pack
    );
} catch (eAuth) {
    return { ok: false, erro: (eAuth && (eAuth.message || eAuth.code)) || 'Falha ao enviar. Veja Blindagem → regras.' };
}
    }
    if (usuarioNuvemLogado()) {
try {
    var s2 = await obterSessaonuvem();
    var mainPush = (typeof carregarMain === 'function') ? carregarMain() : null;
    var excluidosPush = mainPush ? garantirExcluidos(mainPush) : null;
    await s2.fsMod.setDoc(
        s2.fsMod.doc(s2.dbFs, 'joninha_suspensoes_base', 'principal'),
        {
            funcionarios: listarFuncionariosInterno().map(function (f) {
                return {
                    id: f.id,
                    nome: f.nome,
                    ativo: f.ativo !== false,
                    loginUsuario: f.loginUsuario || '',
                    loginSenhaHash: f.loginSenhaHash || '',
                    atualizadoEm: f.atualizadoEm || null
                };
            }),
            excluidos: excluidosPush || undefined,
            atualizadoEm: pack.atualizadoEm
        },
        { merge: true }
    );
} catch (e2) { /* ok */ }
    }
    return {
ok: true,
qtd: pack.funcionarios.length,
logins: pack.funcionarios.map(function (f) { return f.loginUsuario; })
    };
}

function mapaExcluidosFuncionarios() {
    try {
        var main = (typeof carregarMain === 'function') ? carregarMain() : null;
        if (!main) return {};
        var ex = garantirExcluidos(main);
        return ex.funcionarios || {};
    } catch (e) {
        return {};
    }
}

function funcionarioEstaExcluido(id, mapaEx, atualizadoEmRemoto) {
    if (!id) return false;
    var mapa = mapaEx || {};
    var chave = mapa[id] != null ? id : (mapa[String(id)] != null ? String(id) : null);
    if (chave == null) return false;
    var tEx = new Date(mapa[chave] || 0).getTime();
    var tR = new Date(atualizadoEmRemoto || 0).getTime();
    /* Só “volta” se o remoto for mais novo que a exclusão (recadastro) */
    return !(tR > tEx);
}

function forcarAplicarFuncionariosNuvem(remotos) {
    if (!Array.isArray(remotos) || !remotos.length) return [];
    var mapaEx = mapaExcluidosFuncionarios();
    var lista = listarFuncionariosInterno();
    var byId = {};
    lista.forEach(function (f) {
        if (!f || !f.id) return;
        if (funcionarioEstaExcluido(f.id, mapaEx, f.atualizadoEm || f.criadoEm)) return;
        byId[String(f.id)] = Object.assign({}, f, { id: f.id });
    });
    remotos.forEach(function (r) {
        if (!r || !r.id) return;
        var rid = String(r.id);
        if (funcionarioEstaExcluido(rid, mapaEx, r.atualizadoEm)) return;
        var cur = byId[rid] || { id: r.id, criadoEm: r.atualizadoEm || new Date().toISOString() };
        var u = normalizarLoginFunc(r.loginUsuario);
        byId[rid] = Object.assign({}, cur, {
            id: r.id,
            nome: r.nome || cur.nome || u || 'Funcionário',
            ativo: r.ativo !== false,
            loginUsuario: u || cur.loginUsuario || '',
            loginSenhaHash: r.loginSenhaHash || cur.loginSenhaHash || '',
            atualizadoEm: r.atualizadoEm || new Date().toISOString()
        });
        /* Nuvem não manda senha em texto — preserva local se existir */
        if (r.loginSenha && !byId[rid].loginSenha) {
            byId[rid].loginSenha = normalizarSenhaFunc(r.loginSenha);
        }
    });
    salvarFuncionariosInterno(Object.keys(byId).map(function (k) { return byId[k]; }));
    return Object.keys(sincronizarMapaLoginsFuncLimpo());
}

/* Lê logins na nuvem sem login admin */
async function puxarLoginsFuncNuvem() {
    var cfg = carregarConfigNuvem();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
return { ok: false, erro: 'Nuvem sem configuração Firebase.' };
    }
    try {
var sessao = await initFirebaseApp();
var snap = await sessao.fsMod.getDoc(
    sessao.fsMod.doc(sessao.dbFs, COL_LOGINS_FUNC_NUVEM, DOC_LOGINS_FUNC_NUVEM)
);
if (snap.exists()) {
    var data = snap.data() || {};
    var remotos = data.funcionarios || [];
    if (!remotos.length) {
        return { ok: false, erro: 'Documento na nuvem está vazio. No PC, envie os logins de novo.' };
    }
    var logins = forcarAplicarFuncionariosNuvem(remotos);
    return { ok: true, logins: logins, qtd: logins.length };
}
    } catch (e1) {
console.warn('puxar logins_func:', e1);
var msg = (e1 && (e1.message || e1.code)) || 'erro';
if (String(msg).indexOf('permission') >= 0 || String(msg).indexOf('Permission') >= 0) {
    msg = 'Sem permissão na coleção joninha_logins_func. Cole as regras em Sistema → Blindagem.';
}
try {
    if (usuarioNuvemLogado()) {
        var base = await baixarBaseNuvemSilencioso();
        if (base && base.funcionarios && base.funcionarios.length) {
            var logins2 = forcarAplicarFuncionariosNuvem(base.funcionarios);
            if (logins2.length) return { ok: true, logins: logins2, qtd: logins2.length };
        }
    }
} catch (e2) { /* ok */ }
return { ok: false, erro: msg };
    }
    return { ok: false, erro: 'Ainda não há logins na nuvem. No PC: Enviar logins ao celular (e atualize regras Firebase).' };
}

function normalizarLoginFunc(s) {
    var t = String(s == null ? '' : s);
    try { t = t.normalize('NFKC'); } catch (e) { /* ok */ }
    return t
.replace(/[\u200B-\u200D\uFEFF]/g, '')
.replace(/\s+/g, '')
.trim()
.toLowerCase();
}

function normalizarSenhaFunc(s) {
    var t = String(s == null ? '' : s);
    try { t = t.normalize('NFKC'); } catch (e) { /* ok */ }
    return t
.replace(/[\u200B-\u200D\uFEFF]/g, '')
.trim();
}

async function hashSenhaFunc(login, senha) {
    var u = normalizarLoginFunc(login);
    var s = normalizarSenhaFunc(senha);
    var raw = SENHA_FUNC_SALT + '|' + u + '|' + s;
    try {
if (window.crypto && crypto.subtle) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, '0');
    }).join('');
}
    } catch (e) { /* fallback abaixo */ }
    var h = 2166136261;
    for (var i = 0; i < raw.length; i++) {
h ^= raw.charCodeAt(i);
h = Math.imul(h, 16777619);
    }
    return 'fb_' + (h >>> 0).toString(16);
}

function funcionarioTemCredencial(f) {
    if (!f) return false;
    if (!normalizarLoginFunc(f.loginUsuario)) return false;
    return !!(normalizarSenhaFunc(f.loginSenha) || f.loginSenhaHash);
}

/* Mapa limpo só com o que está nos funcionários agora (sem login antigo preso) */
function sincronizarMapaLoginsFuncLimpo() {
    var map = {};
    listarFuncionariosInterno().forEach(function (f) {
if (!f || !f.id || f.ativo === false) return;
if (!funcionarioTemCredencial(f)) return;
var u = normalizarLoginFunc(f.loginUsuario);
map[u] = {
    funcionarioId: f.id,
    senha: normalizarSenhaFunc(f.loginSenha),
    senhaHash: f.loginSenhaHash || '',
    nome: f.nome || '',
    atualizadoEm: f.atualizadoEm || new Date().toISOString()
};
    });
    persistirMapaLoginsFunc(map);
    return map;
}

function carregarMapaLoginsFunc() {
    return sincronizarMapaLoginsFuncLimpo();
}

function persistirMapaLoginsFunc(map) {
    try {
localStorage.setItem(STORAGE_LOGINS_FUNC, JSON.stringify(map || {}));
    } catch (e) {
toast('Não foi possível gravar o login do funcionário neste navegador.');
    }
}

function listarLoginsFuncDisponiveis() {
    return Object.keys(sincronizarMapaLoginsFuncLimpo()).sort();
}

async function salvarCredencialLoginFunc(funcionario, usuario, senha) {
    var u = normalizarLoginFunc(usuario);
    var s = normalizarSenhaFunc(senha);
    if (!funcionario || !funcionario.id || !u || !s) return false;

    var lista = listarFuncionariosInterno();
    var i = lista.findIndex(function (x) { return x.id === funcionario.id; });
    if (i < 0) return false;
    var h = await hashSenhaFunc(u, s);
    lista[i].loginUsuario = u;
    lista[i].loginSenha = s;
    lista[i].loginSenhaHash = h;
    lista[i].atualizadoEm = new Date().toISOString();
    salvarFuncionariosInterno(lista);
    sincronizarMapaLoginsFuncLimpo();
    enviarLoginsFuncNuvem().catch(function () { /* offline */ });
    return true;
}

async function autenticarFuncionarioLogin(usuario, senha) {
    var u = normalizarLoginFunc(usuario);
    var s = normalizarSenhaFunc(senha);
    if (!u || !s) return null;
    var h = await hashSenhaFunc(u, s);

    var lista = listarFuncionariosInterno();
    var hit = null;
    for (var i = 0; i < lista.length; i++) {
var x = lista[i];
if (!x || x.ativo === false) continue;
if (normalizarLoginFunc(x.loginUsuario) !== u) continue;
if (x.loginSenhaHash && x.loginSenhaHash === h) {
    hit = x;
    break;
}
if (normalizarSenhaFunc(x.loginSenha) === s) {
    lista[i].loginSenhaHash = h;
    lista[i].atualizadoEm = new Date().toISOString();
    salvarFuncionariosInterno(lista);
    sincronizarMapaLoginsFuncLimpo();
    hit = lista[i];
    break;
}
    }
    if (hit) return hit;

    var map = sincronizarMapaLoginsFuncLimpo();
    var cred = map[u];
    if (cred && ((cred.senhaHash && cred.senhaHash === h) || (cred.senha && cred.senha === s))) {
return {
    id: cred.funcionarioId,
    nome: cred.nome || u,
    ativo: true,
    loginUsuario: u,
    loginSenha: s,
    loginSenhaHash: h
};
    }
    return null;
}

function renderLoginsFuncCfg() {
    var sel = document.getElementById('cfgLoginFuncId');
    var tb = document.getElementById('tabelaLoginsFunc');
    var vaz = document.getElementById('listaLoginsFuncVazia');
    if (!sel || !tb) return;
    var funcs = listarFuncionariosInterno().filter(function (f) { return f.ativo !== false; })
.sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });
    var cur = sel.value;
    sel.innerHTML = '<option value="">Selecione...</option>' + funcs.map(function (f) {
return '<option value="' + esc(f.id) + '">' + esc(f.nome || '') + '</option>';
    }).join('');
    if (cur) sel.value = cur;

    var comLogin = listarFuncionariosInterno().filter(function (f) {
return f && f.ativo !== false && funcionarioTemCredencial(f);
    }).sort(function (a, b) {
return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
    tb.innerHTML = '';
    if (!comLogin.length) {
if (vaz) vaz.style.display = '';
return;
    }
    if (vaz) vaz.style.display = 'none';
    comLogin.forEach(function (f) {
var senha = f.loginSenha ? String(f.loginSenha) : '';
var loginVisivel = normalizarLoginFunc(f.loginUsuario);
var senhaCell = senha
    ? '<code class="senha-login-func" data-senha="' + esc(senha) + '" style="color:#ffe08a;font-size:0.95rem">••••••••</code> ' +
      '<button type="button" class="btn btn-secondary" data-ver-senha-func="' + esc(f.id) + '" style="padding:3px 8px;font-size:0.72rem">Mostrar</button>'
    : (f.loginSenhaHash
        ? '<span style="color:#8fe0b8">hash na nuvem</span> <span class="hint">(redefina p/ ver)</span>'
        : '—');
var tr = document.createElement('tr');
tr.innerHTML =
    '<td style="color:#fff;font-weight:800">' + esc(f.nome || '—') + '</td>' +
    '<td style="color:#fff;font-weight:700">' + esc(loginVisivel || '—') + '</td>' +
    '<td style="color:#fff;font-weight:700;white-space:nowrap">' + senhaCell + '</td>' +
    '<td style="color:#fff;font-weight:700">Ativo</td>' +
    '<td class="actions">' +
    '<button type="button" class="btn btn-ok" data-testar-login-func="' + esc(f.id) + '" style="padding:3px 8px;font-size:0.72rem">Testar entrada</button> ' +
    '<button type="button" class="btn btn-secondary" data-ed-login-func="' + esc(f.id) + '">Editar</button> ' +
    '<button type="button" class="btn btn-danger" data-rm-login-func="' + esc(f.id) + '">Remover acesso</button>' +
    '</td>';
tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-ver-senha-func]').forEach(function (b) {
b.addEventListener('click', function () {
    var cell = b.closest('td');
    var code = cell ? cell.querySelector('.senha-login-func') : null;
    if (!code) return;
    var senhaReal = code.getAttribute('data-senha') || '';
    var oculto = code.getAttribute('data-oculto') !== '0';
    if (oculto) {
        code.textContent = senhaReal;
        code.setAttribute('data-oculto', '0');
        b.textContent = 'Ocultar';
    } else {
        code.textContent = '••••••••';
        code.setAttribute('data-oculto', '1');
        b.textContent = 'Mostrar';
    }
});
    });
    tb.querySelectorAll('[data-testar-login-func]').forEach(function (b) {
b.addEventListener('click', async function () {
    var id = b.getAttribute('data-testar-login-func');
    var f = listarFuncionariosInterno().find(function (x) { return x && String(x.id) === String(id); });
    if (!f) { toast('Funcionário não encontrado.'); return; }
    if (!f.loginSenha) {
        toast('Neste PC só há hash. Digite a senha em Editar, salve, e teste de novo.');
        return;
    }
    var ok = await autenticarFuncionarioLogin(f.loginUsuario, f.loginSenha);
    if (!ok) {
        toast('Falha no teste. Salve de novo o login/senha deste funcionário.');
        return;
    }
    if (!confirm('Login OK. Entrar agora como ' + (f.nome || 'funcionário') + '?')) return;
    liberarApp({ funcionarioId: f.id });
    toast('Entrou como ' + (f.nome || 'funcionário') + '.');
});
    });
    tb.querySelectorAll('[data-ed-login-func]').forEach(function (b) {
b.addEventListener('click', function () {
    var id = b.getAttribute('data-ed-login-func');
    var f = listarFuncionariosInterno().find(function (x) { return x.id === id; });
    if (!f) return;
    document.getElementById('cfgLoginFuncId').value = f.id;
    document.getElementById('cfgLoginUsuario').value = normalizarLoginFunc(f.loginUsuario) || '';
    document.getElementById('cfgLoginSenha').value = f.loginSenha || '';
    document.getElementById('cfgLoginUsuario').focus();
});
    });
    tb.querySelectorAll('[data-rm-login-func]').forEach(function (b) {
b.addEventListener('click', function () {
    var id = b.getAttribute('data-rm-login-func');
    if (!confirm('Remover login/senha deste funcionário?')) return;
    var lista = listarFuncionariosInterno();
    var i = lista.findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    delete lista[i].loginUsuario;
    delete lista[i].loginSenha;
    delete lista[i].loginSenhaHash;
    salvarFuncionariosInterno(lista);
    sincronizarMapaLoginsFuncLimpo();
    enviarLoginsFuncNuvem().catch(function () { /* ok */ });
    toast('Acesso removido.');
    renderLoginsFuncCfg();
});
    });
    sincronizarMapaLoginsFuncLimpo();
}

function preencherSelectLoginFunc() {
    /* mantido por compatibilidade — login agora usa usuário/senha */
    renderLoginsFuncCfg();
}

function aplicarModoFuncionario(fid) {
    sessaoFuncionarioId = fid || null;
    if (fid) {
document.body.classList.add('modo-funcionario');
canalVendas = 'normal';
atualizarBadgeCanal();
abrirGrupoMenu('oficina', true);
var btnOs = document.querySelector('.menu-grupo[data-grupo="oficina"] .nav-btn[data-panel="painelVeiculo"]');
try {
    abrirPainel('painelVeiculo', btnOs || undefined);
} catch (err) {
    console.error(err);
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
    var pv = document.getElementById('painelVeiculo');
    if (pv) pv.classList.add('active');
}
var tit = document.getElementById('tituloPainel');
var sub = document.getElementById('subtituloPainel');
if (tit) tit.textContent = 'Oficina';
if (sub) sub.textContent = 'Ordem de Serviço e Histórico';
    } else {
document.body.classList.remove('modo-funcionario');
    }
}

/* listeners Joninha extras */
