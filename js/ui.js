'use strict';
/* Joninha — UI: toast, menus, painéis, renderTudo (etapa 2.2) */

/* Altura real da tela no Android/iPhone (barra de endereço muda o 100vh) */
function atualizarVhFallback() {
    try {
        var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        if (!(h > 0)) h = window.innerHeight;
        document.documentElement.style.setProperty('--vh-fallback', (h * 0.01) + 'px');
    } catch (e) { /* ok */ }
}
atualizarVhFallback();
window.addEventListener('resize', atualizarVhFallback);
window.addEventListener('orientationchange', function () {
    setTimeout(atualizarVhFallback, 180);
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', atualizarVhFallback);
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

function abrirPainel(id, btn) {
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
        else if (gNome === 'vendas' || gNome === 'caixa' || gNome === 'caixaRelatorio') canalVendas = 'normal';
        else canalVendas = 'normal';
    }
    if (canalAntes !== canalVendas) {
        carrinhoVenda = [];
        produtoVendaSelecionado = null;
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
    renderTudo();
    if (id === 'painelProdutos') {
        setTimeout(focarLeitor, 80);
    }
    if (id === 'painelOrcamento') {
        prepararVendaForm();
        renderCarrinhoVenda();
    }
    if (id === 'painelRelatorioCaixa') renderRelatorioCaixa();
    if (id === 'painelRelatorioOficina') renderRelatorioOficina();
    if (id === 'painelComissoes') renderComissoes();
    if (id === 'painelVeiculo') preencherSelectMaoFunc();
    if (id === 'painelFuncionarios') {
        canalVendas = 'interno';
        atualizarBadgeCanal();
        renderCadastroFuncionarios();
    }
    if (id === 'painelListaFuncionarios') {
        canalVendas = 'interno';
        atualizarBadgeCanal();
        renderListaFuncionarios();
    }
    if (id === 'painelPagFuncionarios') {
        canalVendas = 'interno';
        atualizarBadgeCanal();
        var pfData = document.getElementById('pfData');
        if (pfData && !pfData.value) pfData.value = hojeISO();
        renderPagFuncionarios();
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
}

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
    if (e.key === 'Escape') fecharMenuMobile();
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

atualizarMarcacaoGrupos();


function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderTudo() {
    var db = carregar();
    if (!db.empresa) {
        db.empresa = empresaPadrao();
        salvar(db);
    }
    atualizarKPIs(db);
    preencherSelectsCliente(db);
    renderClientes();
    renderHistorico();
    renderProdutos();
    renderOrcamentos();
    renderCaixa();
    renderCaixaBanco();
    renderPendentes();
    renderRelatorioCaixa();
    if (document.getElementById('painelListaFuncionarios') &&
        document.getElementById('painelListaFuncionarios').classList.contains('active')) {
        renderListaFuncionarios();
    }
    if (document.getElementById('painelFuncionarios') &&
        document.getElementById('painelFuncionarios').classList.contains('active')) {
        renderCadastroFuncionarios();
    }
    if (document.getElementById('painelPagFuncionarios') &&
        document.getElementById('painelPagFuncionarios').classList.contains('active')) {
        renderPagFuncionarios();
    }
    if (document.getElementById('painelOrcamento') &&
        document.getElementById('painelOrcamento').classList.contains('active')) {
        atualizarUIVendaPorCanal();
    }
    aplicarIdentidadeVisual();
}

