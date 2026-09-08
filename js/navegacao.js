'use strict';
/* Joninha — histórico de telas (seta do mouse / Alt+← / botão Voltar), sem perder o que já estava preenchido */

window._navHistorico = window._navHistorico || [];
window._navIgnorarHistorico = false;
window._navProfundidade = 0;

function _navLogado() {
    return !document.body.classList.contains('aguardando-login');
}

window._navGetEstado = function () {
    var panel = document.querySelector('.panel.active');
    return {
        panelId: panel ? panel.id : 'painelInicio',
        canal: typeof canalVendas === 'string' ? canalVendas : 'normal'
    };
};

window._navEstadosIguais = function (a, b) {
    if (!a || !b) return false;
    return a.panelId === b.panelId && (a.canal || 'normal') === (b.canal || 'normal');
};

window._navLabelEstado = function (est) {
    if (!est || !est.panelId) return 'tela anterior';
    var t = (typeof TITULOS === 'object' && TITULOS[est.panelId]) ? TITULOS[est.panelId][0] : est.panelId;
    if (est.canal === 'interno') t += ' (interno)';
    return t;
};

window._navHashEstado = function (est) {
    if (!est || !est.panelId) return '#inicio';
    var h = '#p=' + encodeURIComponent(est.panelId);
    if (est.canal && est.canal !== 'normal') h += '&c=' + encodeURIComponent(est.canal);
    return h;
};

window._navAplicarEstado = function (est) {
    if (!est || !est.panelId) return;
    window._navIgnorarHistorico = true;
    try {
        if (est.canal) canalVendas = est.canal;
        var btn = document.querySelector('.nav-btn[data-panel="' + est.panelId + '"][data-canal="' + (est.canal || 'normal') + '"]') ||
            document.querySelector('.nav-btn[data-panel="' + est.panelId + '"]');
        if (typeof window.abrirPainel === 'function') {
            window.abrirPainel(est.panelId, btn, { skipNav: true });
        }
    } finally {
        window._navIgnorarHistorico = false;
    }
    try { window.scrollTo(0, 0); } catch (e) { /* ok */ }
    window._atualizarBarraVoltar();
};

window._navPushHistorico = function (estadoDestino) {
    if (!estadoDestino || !estadoDestino.panelId) return;
    try {
        window._navProfundidade++;
        history.pushState(
            { joninhaNav: estadoDestino, navDepth: window._navProfundidade },
            '',
            window._navHashEstado(estadoDestino)
        );
    } catch (e) { /* file:// */ }
};

window._navRegistrarDepoisNavegacao = function (estadoAntes) {
    if (window._navIgnorarHistorico) return;
    var depois = window._navGetEstado();
    if (!depois.panelId || window._navEstadosIguais(estadoAntes, depois)) return;
    window._navHistorico.push(estadoAntes);
    if (window._navHistorico.length > 50) window._navHistorico.shift();
    window._navPushHistorico(depois);
    window._atualizarBarraVoltar();
};

window._atualizarBarraVoltar = function () {
    /* Comandos de voltar ficam só na seta do mouse, Alt+← e ESC — sem balões na tela */
};

window._navIrInicio = function () {
    window._navIgnorarHistorico = true;
    window._navAplicarEstado({ panelId: 'painelInicio', canal: 'normal' });
    try {
        history.replaceState(
            { joninhaNav: { panelId: 'painelInicio', canal: 'normal' }, navDepth: 0, seguro: true },
            '',
            window._navHashEstado({ panelId: 'painelInicio', canal: 'normal' })
        );
    } catch (e) { /* ok */ }
    window._navHistorico = [];
    window._navProfundidade = 0;
    window._navIgnorarHistorico = false;
    window._atualizarBarraVoltar();
};

window._navPodeVoltarHistorico = function () {
    return window._navHistorico.length > 0 || window._navProfundidade > 0;
};

window.voltarPaginaAnterior = function () {
    if (!_navLogado()) return;
    if (window._navPodeVoltarHistorico()) {
        window._navIgnorarHistorico = true;
        try {
            history.back();
        } catch (e) {
            window._navVoltarPilhaInterna();
        }
        setTimeout(function () { window._navIgnorarHistorico = false; }, 120);
        return;
    }
    window._navIrInicio();
};

window._navVoltarPilhaInterna = function () {
    if (!window._navHistorico.length) {
        window._navIrInicio();
        return;
    }
    var est = window._navHistorico.pop();
    window._navProfundidade = Math.max(0, window._navProfundidade - 1);
    window._navAplicarEstado(est);
    window._atualizarBarraVoltar();
};

window._navIniciarSessao = function () {
    window._navHistorico = [];
    window._navProfundidade = 0;
    var est = window._navGetEstado();
    try {
        history.replaceState({ joninhaNav: est, navDepth: 0, seguro: true }, '', window._navHashEstado(est));
        history.pushState({ joninhaNav: est, navDepth: 0, seguro: true, anchor: true }, '', window._navHashEstado(est));
    } catch (e) { /* ok */ }
    window._atualizarBarraVoltar();
};

window._navLimparHistorico = function () {
    window._navHistorico = [];
    window._navProfundidade = 0;
    window._atualizarBarraVoltar();
};

window._navTratarEscape = function () {
    if (!_navLogado()) return false;
    var overlay = document.querySelector('.modal-overlay.aberto, .modal-overlay[style*="flex"]');
    if (overlay && overlay.classList.contains('aberto')) {
        overlay.classList.remove('aberto');
        return true;
    }
    if (window._navPodeVoltarHistorico()) {
        window.voltarPaginaAnterior();
        return true;
    }
    window._navIrInicio();
    return true;
};

window.addEventListener('popstate', function (e) {
    if (!_navLogado()) return;
    if (window._navIgnorarHistorico) return;
    if (e.state && e.state.joninhaNav) {
        window._navProfundidade = e.state.navDepth || 0;
        if (window._navHistorico.length) window._navHistorico.pop();
        window._navAplicarEstado(e.state.joninhaNav);
        return;
    }
    if (window._navHistorico.length) {
        window._navVoltarPilhaInterna();
        return;
    }
    window._navIrInicio();
});

window.addEventListener('keydown', function (e) {
    if (!_navLogado()) return;
    if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        window.voltarPaginaAnterior();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        if (_navLogado()) window._navIniciarSessao();
    });
} else if (_navLogado()) {
    window._navIniciarSessao();
}
