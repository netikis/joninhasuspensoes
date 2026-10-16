'use strict';
/* Joninha — UI: toast, menus, painéis, renderTudo (etapa 2.2) */

/* Altura/largura reais no Android e iPhone (barra de endereço, notch, teclado) */
function classificarTelaCelular(largura) {
    var lista = (typeof TELAS_CELULAR !== 'undefined' && TELAS_CELULAR.length) ? TELAS_CELULAR : [];
    if (!lista.length) {
        return { id: 'gen', marca: 'gen', nome: 'Tela', cssW: Math.round(largura) };
    }
    var melhor = lista[0];
    var dist = Math.abs((Number(melhor.cssW) || 0) - largura);
    lista.forEach(function (t) {
        var d = Math.abs((Number(t.cssW) || 0) - largura);
        if (d < dist) {
            dist = d;
            melhor = t;
        }
    });
    return melhor;
}

function sincronizarTela() {
    try {
        var vv = window.visualViewport;
        var w = vv && vv.width > 0 ? vv.width : window.innerWidth;
        var h = vv && vv.height > 0 ? vv.height : window.innerHeight;
        if (!(w > 0)) w = window.innerWidth;
        if (!(h > 0)) h = window.innerHeight;
        var root = document.documentElement;
        root.style.setProperty('--vh-fallback', (h * 0.01) + 'px');
        root.style.setProperty('--vw', w + 'px');
        root.style.setProperty('--vh-real', h + 'px');
        var teclado = 0;
        if (vv) {
            teclado = Math.max(0, window.innerHeight - vv.height - (Number(vv.offsetTop) || 0));
        }
        root.style.setProperty('--kb-inset', teclado + 'px');
        var hit = classificarTelaCelular(w);
        root.setAttribute('data-tela', hit.id || '');
        root.setAttribute('data-tela-marca', hit.marca || '');
        root.setAttribute('data-tela-w', String(Math.round(w)));
        var celular = w <= 900 || (h <= 560 && w <= 1100);
        root.classList.toggle('tela-celular', celular);
        root.classList.toggle('tela-estreita', w <= 390);
        if (document.body) {
            document.body.classList.toggle('tela-celular', celular);
            document.body.classList.toggle('tela-estreita', w <= 390);
        }
    } catch (e) { /* ok */ }
}
function atualizarVhFallback() { sincronizarTela(); }
sincronizarTela();
window.addEventListener('resize', sincronizarTela);
window.addEventListener('orientationchange', function () {
    setTimeout(sincronizarTela, 180);
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', sincronizarTela);
}

function atualizarBadgeCanal() {
    var badge = document.getElementById('badgeDb');
    var interno = canalVendas === 'interno';
    document.body.classList.toggle('canal-interno', interno);
    if (!badge) return;
    badge.classList.toggle('interno', interno);
    badge.textContent = interno
        ? 'INTERNO · joninha_suspensoes_interno_v1'
        : 'DB isolado · joninha_suspensoes_v1';
}


function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.classList || !el.classList.contains('cad-maiusculo')) return;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    var start = el.selectionStart;
    var end = el.selectionEnd;
    var up = typeof textoMaiusculoCadastro === 'function'
        ? textoMaiusculoCadastro(el.value)
        : String(el.value || '').toLocaleUpperCase('pt-BR');
    if (el.value === up) return;
    el.value = up;
    if (typeof start === 'number') {
        try { el.setSelectionRange(start, end); } catch (err) { /* ok */ }
    }
});


/* ---------- Navegação ---------- */
function abrirGrupoMenu(nomeGrupo, exclusivo) {
    document.querySelectorAll('.menu-grupo').forEach(function (g) {
        if (g.classList.contains('inicio-compacto')) return;
        var nome = g.getAttribute('data-grupo');
        if (nome === nomeGrupo) g.classList.add('aberto');
        else if (exclusivo !== false) g.classList.remove('aberto');
    });
}

function grupoDoPainel(panelId) {
    var btn = document.querySelector('.nav-btn[data-panel="' + panelId + '"]');
    if (!btn) return null;
    var grupo = btn.closest('.menu-grupo');
    return grupo ? grupo.getAttribute('data-grupo') : null;
}

function atualizarMarcacaoGrupos() {
    document.querySelectorAll('.menu-grupo').forEach(function (g) {
        var temAtivo = !!g.querySelector('.nav-btn.active');
        g.classList.toggle('tem-ativo', temAtivo);
    });
}

function abrirPainel(id, btn, opcoes) {
    opcoes = opcoes || {};
    var estadoAntes = (!opcoes.skipNav && typeof window._navGetEstado === 'function')
        ? window._navGetEstado()
        : null;
    if (sessaoFuncionarioId) {
        if (id !== 'painelVeiculo' && id !== 'painelHistorico') {
            id = 'painelVeiculo';
            btn = document.querySelector('.menu-grupo[data-grupo="oficina"] .nav-btn[data-panel="painelVeiculo"]') || btn;
        }
    }
    var canalAntes = canalVendas;
    if (btn && btn.getAttribute('data-canal')) {
        canalVendas = btn.getAttribute('data-canal');
    } else if (!btn) {
        /* atalhos do painel / data-goto → canal normal */
        canalVendas = 'normal';
    } else {
        var gBtn = btn.closest('.menu-grupo');
        var gNome = gBtn ? gBtn.getAttribute('data-grupo') : '';
        if (gNome === 'funcionario') canalVendas = 'interno';
        else if (gNome === 'vendas' || gNome === 'oficina' || gNome === 'caixa' || gNome === 'caixaRelatorio') canalVendas = 'normal';
        else canalVendas = 'normal';
    }
    if (!opcoes.skipNav && canalAntes !== canalVendas) {
        carrinhoVenda = [];
        produtoVendaSelecionado = null;
        if (typeof cancelarEdicaoItemVd === 'function') cancelarEdicaoItemVd();
    }
    atualizarBadgeCanal();

    document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.add('active');
    if (btn && btn.classList.contains('nav-btn')) {
        btn.classList.add('active');
        var gClick = btn.closest('.menu-grupo');
        if (gClick) abrirGrupoMenu(gClick.getAttribute('data-grupo'), true);
    } else {
        var match = document.querySelector('.nav-btn[data-panel="' + id + '"][data-canal="' + canalVendas + '"]') ||
            document.querySelector('.nav-btn[data-panel="' + id + '"]');
        if (match) {
            match.classList.add('active');
            var gMatch = match.closest('.menu-grupo');
            if (gMatch) abrirGrupoMenu(gMatch.getAttribute('data-grupo'), true);
        }
    }
    document.querySelectorAll('.nav-btn[data-panel="' + id + '"]').forEach(function (b) {
        var c = b.getAttribute('data-canal');
        if (!c || c === canalVendas) b.classList.add('active');
        else b.classList.remove('active');
    });
    atualizarMarcacaoGrupos();
    var t = TITULOS[id] || ['HM', ''];
    var sufixo = canalVendas === 'interno' ? ' · INTERNO' : '';
    document.getElementById('tituloPainel').textContent = t[0] + (PAINEIS_CANAL[id] ? sufixo : '');
    document.getElementById('subtituloPainel').textContent = canalVendas === 'interno' && PAINEIS_CANAL[id]
        ? 'Uso interno — vendas/caixa separados · estoque de produtos unificado'
        : t[1];
    if (id === 'painelFuncionarios' || id === 'painelListaFuncionarios' || id === 'painelPagFuncionarios') {
        canalVendas = 'interno';
        atualizarBadgeCanal();
    }
    renderTudo();
    if (id === 'painelProdutos') {
        setTimeout(focarLeitor, 80);
    }
    if (id === 'painelOrcamento') {
        if (!(typeof vendaEmEdicaoId !== 'undefined' && vendaEmEdicaoId)) {
            prepararVendaForm();
        }
        renderCarrinhoVenda();
    }
    if (id === 'painelRelatorioCaixa') renderRelatorioCaixa();
    if (id === 'painelRelatorioOficina') renderRelatorioOficina();
    if (id === 'painelComissoes') renderComissoes();
    if (id === 'painelVeiculo') preencherSelectMaoFunc();
    if (id === 'painelFuncionarios') renderCadastroFuncionarios();
    if (id === 'painelListaFuncionarios') renderListaFuncionarios();
    if (id === 'painelPagFuncionarios') {
        var pfData = document.getElementById('pfData');
        if (pfData && !pfData.value) pfData.value = hojeISO();
        renderPagFuncionarios();
    }
    if (id === 'painelComissoes' || id === 'painelListaFuncionarios' ||
        id === 'painelPagFuncionarios' || id === 'painelFuncionarios' || id === 'painelVeiculo') {
        if (typeof agendarAtualizarTelasFuncionarios === 'function') agendarAtualizarTelasFuncionarios();
    }
    if (id === 'painelConfigEmpresa' || id === 'painelConfigLogo') {
        preencherFormEmpresa();
    }
    if (id === 'painelConfigSync') {
        atualizarStatusNuvemUI();
    }
    if (id === 'painelConfigPasta') {
        atualizarStatusPastaUI();
    }
    if (id === 'painelConfigLoginFunc') {
        renderLoginsFuncCfg();
    }
    fecharMenuMobile();
    try {
        var sc = document.querySelector('.conteudo');
        if (sc) sc.scrollTop = 0;
        var mn = document.querySelector('.main');
        if (mn) mn.scrollTop = 0;
        window.scrollTo(0, 0);
    } catch (eScr) { /* ok */ }
    if (estadoAntes && typeof window._navRegistrarDepoisNavegacao === 'function') {
        window._navRegistrarDepoisNavegacao(estadoAntes);
    }
}
window.abrirPainel = abrirPainel;

var PAINEIS_CANAL = {
    painelFuncionarios: true,
    painelListaFuncionarios: true,
    painelPagFuncionarios: true,
    painelProdutos: true,
    painelOrcamento: true,
    painelCaixa: true,
    painelCaixaBanco: true,
    painelPendentes: true,
    painelRelatorioCaixa: true
};

function abrirMenuMobile() {
    document.body.classList.add('menu-aberto');
}

function fecharMenuMobile() {
    document.body.classList.remove('menu-aberto');
}

document.getElementById('btnAbrirMenu').addEventListener('click', abrirMenuMobile);
document.getElementById('btnFecharMenu').addEventListener('click', fecharMenuMobile);
document.getElementById('sidebarOverlay').addEventListener('click', fecharMenuMobile);
window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('menu-aberto')) {
        fecharMenuMobile();
        e.preventDefault();
        return;
    }
    if (typeof window._navTratarEscape === 'function' && window._navTratarEscape()) {
        e.preventDefault();
    }
});

document.querySelectorAll('[data-toggle-grupo]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var nome = btn.getAttribute('data-toggle-grupo');
        var grupo = document.querySelector('.menu-grupo[data-grupo="' + nome + '"]');
        if (!grupo || grupo.classList.contains('inicio-compacto')) return;
        var jaAberto = grupo.classList.contains('aberto');
        document.querySelectorAll('.menu-grupo:not(.inicio-compacto)').forEach(function (g) { g.classList.remove('aberto'); });
        if (!jaAberto) grupo.classList.add('aberto');
    });
});

document.querySelectorAll('.menu-grupo-btn[data-panel]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        abrirPainel(btn.getAttribute('data-panel'), document.querySelector('.nav-btn[data-panel="' + btn.getAttribute('data-panel') + '"]') || btn);
    });
});

document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
        abrirPainel(btn.getAttribute('data-panel'), btn);
    });
});

document.querySelectorAll('[data-goto]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        abrirPainel(btn.getAttribute('data-goto'));
    });
});

document.querySelectorAll('[data-atalho-pasta]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        if (typeof irParaPastaInicio === 'function') {
            irParaPastaInicio(btn.getAttribute('data-atalho-pasta'));
        }
    });
});

document.querySelectorAll('[data-relatorio-servicos]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        if (typeof abrirRelatorioServicos === 'function') {
            abrirRelatorioServicos(btn.getAttribute('data-relatorio-servicos'));
        }
    });
});

document.querySelectorAll('[data-atend-mes]').forEach(function (btn) {
    btn.addEventListener('click', function () {
        if (typeof abrirModalAtendimentosMes === 'function') abrirModalAtendimentosMes();
    });
});

atualizarMarcacaoGrupos();


function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* SPA: Enter em <form> dispara submit nativo e recarrega o index → volta ao Início.
   Só cancela o reload da página. O listener de cada form (e o clique do botão) continua valendo. */
document.addEventListener('submit', function (e) {
    e.preventDefault();
}, true);

function teclaEhEnter(e) {
    if (!e) return false;
    if (e.isComposing || e.keyCode === 229) return false;
    return e.key === 'Enter' || e.key === 'NumpadEnter' || e.keyCode === 13;
}

/* Enter no campo clica o botão de adicionar (peça, produto, MO), sem enviar o form. */
window.enterClicaBotao = function (campoIds, botaoId) {
    (campoIds || []).forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', function (e) {
            if (!teclaEhEnter(e)) return;
            e.preventDefault();
            e.stopPropagation();
            var btn = document.getElementById(botaoId);
            if (btn) btn.click();
        }, true);
    });
};

function rolarParaTopoTela() {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e1) { window.scrollTo(0, 0); }
    ['.main', '.conteudo'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el && el.scrollTop > 0) {
            try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e2) { el.scrollTop = 0; }
        }
    });
    var painel = document.querySelector('.painel.active, section.active');
    if (painel && painel.scrollTop > 0) painel.scrollTop = 0;
}
window.rolarParaTopoTela = rolarParaTopoTela;

function envolverTabelasRolagem(raiz) {
    (raiz || document).querySelectorAll('table').forEach(function (t) {
        var pai = t.parentElement;
        if (!pai || t.closest('td, th')) return;
        if (pai.classList.contains('table-wrap') || pai.classList.contains('tbl-wrap')) return;
        var w = document.createElement('div');
        w.className = 'table-wrap tbl-rolagem';
        pai.insertBefore(w, t);
        w.appendChild(t);
    });
    (raiz || document).querySelectorAll('.table-wrap, .tbl-wrap').forEach(ligarArrasteLateral);
}

function atualizarSetasTabela(w) {
    var barra = w._setas;
    if (!barra) return;
    var sobra = w.scrollWidth - w.clientWidth;
    var celular = document.body.classList.contains('tela-celular');
    barra.style.display = (celular && sobra > 4 && w.offsetParent) ? '' : 'none';
    barra.querySelector('[data-seta="-1"]').disabled = w.scrollLeft <= 2;
    barra.querySelector('[data-seta="1"]').disabled = w.scrollLeft >= sobra - 2;
}

/* Arraste lateral feito no JS: alguns celulares não rolam a tabela para o lado sozinhos */
function ligarArrasteLateral(w) {
    if (!w || w._arrasteLigado) return;
    w._arrasteLigado = true;
    var barra = document.createElement('div');
    barra.className = 'tbl-setas';
    barra.innerHTML = '<button type="button" class="btn btn-secondary" data-seta="-1" aria-label="Rolar tabela para a esquerda">◀</button>' +
        '<span>arraste a tabela para o lado</span>' +
        '<button type="button" class="btn btn-secondary" data-seta="1" aria-label="Rolar tabela para a direita">▶</button>';
    w.parentNode.insertBefore(barra, w);
    w._setas = barra;
    barra.addEventListener('click', function (e) {
        var b = e.target.closest('[data-seta]');
        if (!b) return;
        var passo = Math.max(120, Math.round(w.clientWidth * 0.8)) * Number(b.getAttribute('data-seta'));
        try { w.scrollBy({ left: passo, behavior: 'smooth' }); } catch (e1) { w.scrollLeft += passo; }
    });
    w.addEventListener('scroll', function () { atualizarSetasTabela(w); }, { passive: true });
    if (window.ResizeObserver) {
        var ro = new ResizeObserver(function () { atualizarSetasTabela(w); });
        ro.observe(w);
        var t = w.querySelector('table');
        if (t) ro.observe(t);
    }
    atualizarSetasTabela(w);

    var x0 = 0, y0 = 0, s0 = 0, modo = '';
    w.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) { modo = 'x'; return; }
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
        s0 = w.scrollLeft;
        modo = '';
    }, { passive: true });
    w.addEventListener('touchmove', function (e) {
        if (modo === 'x' || e.touches.length !== 1) return;
        var dx = e.touches[0].clientX - x0;
        var dy = e.touches[0].clientY - y0;
        if (!modo) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            modo = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        }
        if (modo !== 'h') return;
        if (e.cancelable) e.preventDefault();
        w.scrollLeft = s0 - dx;
    }, { passive: false });
}
window.envolverTabelasRolagem = envolverTabelasRolagem;
window.atualizarSetasTabelas = function () {
    document.querySelectorAll('.table-wrap, .tbl-wrap').forEach(atualizarSetasTabela);
};
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { envolverTabelasRolagem(); });
} else {
    envolverTabelasRolagem();
}

function campoAceitaFoco(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.type === 'hidden') return false;
    return el.offsetParent !== null || el.getClientRects().length > 0;
}

/* Foca o próximo campo visível depois de atualId. Retorna false se não há próximo. */
window.focarProximoCampo = function (ids, atualId) {
    var ix = (ids || []).indexOf(atualId);
    if (ix < 0) return false;
    for (var i = ix + 1; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (!campoAceitaFoco(el)) continue;
        try {
            el.focus();
            if (el.tagName === 'INPUT' && typeof el.select === 'function') el.select();
        } catch (eF) { /* ok */ }
        return true;
    }
    return false;
};

/* Enter pula para o próximo campo; no último, clica o botão. */
window.enterProximoCampo = function (campoIds, botaoId) {
    (campoIds || []).forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', function (e) {
            if (!teclaEhEnter(e)) return;
            if (el.tagName === 'TEXTAREA') return;
            e.preventDefault();
            e.stopPropagation();
            if (window.focarProximoCampo(campoIds, id)) return;
            var btn = document.getElementById(botaoId);
            if (btn) btn.click();
        }, true);
    });
};

function renderTudo() {
    var db = carregar();
    if (!db.empresa) {
        db.empresa = empresaPadrao();
        salvar(db);
    }
    function tenta(fn) {
        try { fn(); } catch (eR) { console.warn(eR); }
    }
    tenta(function () { atualizarKPIs(db); });
    tenta(function () { preencherSelectsCliente(db); });
    tenta(function () { renderClientes(); });
    tenta(function () { renderHistorico(); });
    tenta(function () { renderProdutos(); });
    tenta(function () { renderOrcamentos(); });
    tenta(function () { renderCaixa(); });
    tenta(function () { renderCaixaBanco(); });
    tenta(function () { renderPendentes(); });
    tenta(function () { renderRelatorioCaixa(); });
    tenta(function () {
        if (typeof atualizarTelasFuncionarios === 'function') atualizarTelasFuncionarios();
    });
    if (document.getElementById('painelOrcamento') &&
        document.getElementById('painelOrcamento').classList.contains('active')) {
        tenta(function () { atualizarUIVendaPorCanal(); });
    }
    tenta(function () { aplicarIdentidadeVisual(); });
}

