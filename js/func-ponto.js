'use strict';
/* Joninha — anotações do funcionário (falta, chegada, vale, despesa, bônus) + fechamento para pagamento */

var TIPOS_ANOTACAO_FUNC = {
    chegada: { rot: '⏰ Chegada', sigla: '⏰' },
    falta: { rot: '❌ Falta', sigla: 'F' },
    vale: { rot: '💵 Vale / adiantamento', sigla: 'V' },
    despesa: { rot: '🧾 Despesa', sigla: 'D' },
    bonus: { rot: '➕ Bônus / extra', sigla: '+' },
    obs: { rot: '📝 Anotação', sigla: '📝' }
};

var _anDiaSelecionado = '';
var _fchUltimo = null;

function fpFuncionarios() {
    try {
        return typeof listarFuncionariosParaSelect === 'function' ? listarFuncionariosParaSelect(false) : [];
    } catch (e) {
        return [];
    }
}

function fpFuncPorId(id) {
    if (!id) return null;
    return fpFuncionarios().find(function (f) { return f && String(f.id) === String(id); }) || null;
}

function fpUltimoDiaMes(ym) {
    var p = String(ym || '').split('-');
    var y = Number(p[0]) || new Date().getFullYear();
    var m = Number(p[1]) || 1;
    return new Date(y, m, 0).getDate();
}

function fpYmd(y, m, d) {
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function fpSomarMes(ym, delta) {
    var p = String(ym).split('-');
    var dt = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
}

function fpSomarDias(ymd, dias) {
    var dt = new Date(ymd + 'T12:00:00');
    dt.setDate(dt.getDate() + dias);
    return fpYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/** Dia do pagamento dentro do mês (dia 31 vira 30, 29 ou 28 conforme o mês). */
function fpDiaPagamentoNoMes(f, ym) {
    var dia = Number(f && f.diaPagamento) || 0;
    if (!(dia >= 1)) return '';
    var p = String(ym).split('-');
    return fpYmd(p[0], Number(p[1]), Math.min(dia, fpUltimoDiaMes(ym)));
}

function fpSalario(f) {
    return Number(f && f.salario) || 0;
}

function fpValorFalta(f) {
    var v = Number(f && f.descontoFalta) || 0;
    if (v > 0) return v;
    return +(fpSalario(f) / 30).toFixed(2);
}

function fpValorHoraAtraso(f) {
    var v = Number(f && f.descontoAtrasoHora) || 0;
    if (v > 0) return v;
    return +(fpSalario(f) / 220).toFixed(2);
}

function fpMinutos(hhmm) {
    var p = String(hhmm || '').split(':');
    if (p.length < 2) return NaN;
    return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0);
}

function fpMinutosAtraso(f, hora) {
    var ent = fpMinutos((f && f.horaEntrada) || '08:00');
    var che = fpMinutos(hora);
    if (isNaN(ent) || isNaN(che)) return 0;
    var dif = che - ent;
    var tol = Number(f && f.toleranciaMin);
    if (isNaN(tol) || tol < 0) tol = 0;
    return dif > tol ? dif : 0;
}

/** Quanto a anotação soma (+) ou desconta (−) no fechamento. */
function fpEfeitoAnotacao(f, an) {
    var tipo = an && an.tipo;
    var valorDigitado = Number(an && an.valor) || 0;
    if (tipo === 'falta') {
        var vf = valorDigitado > 0 ? valorDigitado : fpValorFalta(f);
        return { valor: -vf, detalhe: 'Falta no dia' };
    }
    if (tipo === 'chegada') {
        var min = fpMinutosAtraso(f, an.hora);
        if (!min) return { valor: 0, detalhe: 'Chegou ' + (an.hora || '—') + ' · no horário', atrasoMin: 0 };
        var va = valorDigitado > 0 ? valorDigitado : +((min / 60) * fpValorHoraAtraso(f)).toFixed(2);
        return { valor: -va, detalhe: 'Chegou ' + an.hora + ' · ' + min + ' min de atraso', atrasoMin: min };
    }
    if (tipo === 'vale') return { valor: -valorDigitado, detalhe: 'Vale / adiantamento' };
    if (tipo === 'despesa') return { valor: -valorDigitado, detalhe: 'Despesa' };
    if (tipo === 'bonus') return { valor: valorDigitado, detalhe: 'Bônus / extra' };
    return { valor: 0, detalhe: 'Anotação' };
}

function fpListarAnotacoes(funcId, ini, fim) {
    var lista = [];
    comCanalInterno(function () {
        lista = (carregar().anotacoesFuncionarios || []).slice();
    });
    return lista.filter(function (a) {
        if (!a) return false;
        if (funcId && String(a.funcionarioId) !== String(funcId)) return false;
        var d = String(a.data || '').slice(0, 10);
        if (ini && d < ini) return false;
        if (fim && d > fim) return false;
        return true;
    }).sort(function (a, b) {
        return String(a.data || '').localeCompare(String(b.data || '')) ||
            String(a.hora || '').localeCompare(String(b.hora || ''));
    });
}

function fpPreencherSelects() {
    var funcs = fpFuncionarios();
    var opts = '<option value="">Selecione...</option>' + funcs.map(function (f) {
        return '<option value="' + esc(f.id) + '">' + esc((f.nome || '') + (f.ativo === false ? ' (inativo)' : '')) + '</option>';
    }).join('');
    ['anFuncId', 'fchFuncId'].forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var cur = sel.value;
        sel.innerHTML = opts;
        if (cur && funcs.some(function (f) { return String(f.id) === String(cur); })) sel.value = cur;
        else if (funcs.length === 1) sel.value = funcs[0].id;
    });
}

function fpAtualizarCamposTipo() {
    var tipo = (document.getElementById('anTipo') || {}).value || 'chegada';
    var wh = document.getElementById('anWrapHora');
    var wv = document.getElementById('anWrapValor');
    if (wh) wh.style.display = tipo === 'chegada' ? '' : 'none';
    if (wv) wv.style.display = tipo === 'obs' ? 'none' : '';
    var val = document.getElementById('anValor');
    if (val) {
        val.placeholder = (tipo === 'falta' || tipo === 'chegada') ? 'Em branco = automático' : '0,00';
    }
    fpAtualizarPrevia();
}

function fpAtualizarPrevia() {
    var el = document.getElementById('anPrevia');
    if (!el) return;
    var f = fpFuncPorId((document.getElementById('anFuncId') || {}).value);
    if (!f) { el.textContent = ''; return; }
    var an = {
        tipo: (document.getElementById('anTipo') || {}).value,
        hora: (document.getElementById('anHora') || {}).value,
        valor: parseMoeda((document.getElementById('anValor') || {}).value)
    };
    if (an.tipo === 'chegada' && !an.hora) {
        el.textContent = 'Entrada no cadastro: ' + (f.horaEntrada || '08:00') + ' · tolerância ' + (f.toleranciaMin != null ? f.toleranciaMin : 10) + ' min.';
        return;
    }
    var ef = fpEfeitoAnotacao(f, an);
    el.textContent = ef.detalhe + (ef.valor ? ' → ' + (ef.valor > 0 ? 'soma ' : 'desconta ') + moeda(Math.abs(ef.valor)) : '');
}

function renderCalendarioFunc() {
    var box = document.getElementById('anCalendario');
    if (!box) return;
    var mesEl = document.getElementById('anMes');
    if (mesEl && !mesEl.value) mesEl.value = hojeISO().slice(0, 7);
    var ym = (mesEl && mesEl.value) || hojeISO().slice(0, 7);
    var f = fpFuncPorId((document.getElementById('anFuncId') || {}).value);
    var ultimo = fpUltimoDiaMes(ym);
    var ini = ym + '-01';
    var fim = ym + '-' + String(ultimo).padStart(2, '0');
    var ans = f ? fpListarAnotacoes(f.id, ini, fim) : [];
    var porDia = {};
    ans.forEach(function (a) {
        var d = String(a.data).slice(0, 10);
        (porDia[d] = porDia[d] || []).push(a);
    });
    var diaPag = f ? fpDiaPagamentoNoMes(f, ym) : '';
    var p = ym.split('-');
    var primeiroSemana = new Date(Number(p[0]), Number(p[1]) - 1, 1).getDay();
    var hoje = hojeISO();
    var h = '<div class="func-cal-grid">';
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(function (n) {
        h += '<div class="func-cal-cab">' + n + '</div>';
    });
    for (var v = 0; v < primeiroSemana; v++) h += '<div class="func-cal-vazio"></div>';
    for (var d = 1; d <= ultimo; d++) {
        var ymd = fpYmd(p[0], Number(p[1]), d);
        var lista = porDia[ymd] || [];
        var cls = 'func-cal-dia';
        if (ymd === diaPag) cls += ' pag';
        if (ymd === hoje) cls += ' hoje';
        if (ymd === _anDiaSelecionado) cls += ' sel';
        if (lista.some(function (a) { return a.tipo === 'falta'; })) cls += ' falta';
        else if (lista.some(function (a) { return a.tipo === 'chegada' && f && fpMinutosAtraso(f, a.hora) > 0; })) cls += ' atraso';
        var marcas = lista.map(function (a) {
            return (TIPOS_ANOTACAO_FUNC[a.tipo] || TIPOS_ANOTACAO_FUNC.obs).sigla;
        }).join(' ');
        h += '<button type="button" class="' + cls + '" data-an-dia="' + ymd + '" title="' +
            esc(fmtData(ymd) + (ymd === diaPag ? ' · dia do pagamento' : '')) + '">' +
            '<span class="n">' + d + (ymd === diaPag ? ' 💰' : '') + '</span>' +
            (marcas ? '<span class="m">' + esc(marcas) + '</span>' : '') + '</button>';
    }
    h += '</div>';
    if (f && !diaPag) h += '<p class="hint" style="margin:6px 0 0">Defina o <strong>dia do pagamento</strong> no cadastro do funcionário para marcar no calendário.</p>';
    box.innerHTML = h;
    box.querySelectorAll('[data-an-dia]').forEach(function (b) {
        b.addEventListener('click', function () {
            _anDiaSelecionado = b.getAttribute('data-an-dia');
            var dt = document.getElementById('anData');
            if (dt) dt.value = _anDiaSelecionado;
            renderCalendarioFunc();
            var tipo = document.getElementById('anTipo');
            if (tipo) tipo.focus();
        });
    });
}

function renderTabelaAnotacoesFunc() {
    var tb = document.getElementById('tabelaAnotacoesFunc');
    var vaz = document.getElementById('listaAnotacoesFuncVazia');
    if (!tb) return;
    var f = fpFuncPorId((document.getElementById('anFuncId') || {}).value);
    var ym = (document.getElementById('anMes') || {}).value || hojeISO().slice(0, 7);
    var ans = f ? fpListarAnotacoes(f.id, ym + '-01', ym + '-' + String(fpUltimoDiaMes(ym)).padStart(2, '0')) : [];
    if (!ans.length) {
        tb.innerHTML = '';
        if (vaz) {
            vaz.style.display = 'block';
            vaz.textContent = f ? 'Nenhuma anotação neste mês.' : 'Escolha o funcionário para ver as anotações.';
        }
        return;
    }
    if (vaz) vaz.style.display = 'none';
    tb.innerHTML = ans.map(function (a) {
        var ef = fpEfeitoAnotacao(f, a);
        var cor = ef.valor < 0 ? '#e74c3c' : (ef.valor > 0 ? '#2ecc71' : '#9a9aa3');
        return '<tr><td>' + esc(fmtData(a.data)) + '</td><td>' + esc((TIPOS_ANOTACAO_FUNC[a.tipo] || TIPOS_ANOTACAO_FUNC.obs).rot) +
            '</td><td>' + esc(ef.detalhe) + '</td><td style="color:' + cor + ';font-weight:800">' +
            (ef.valor ? (ef.valor > 0 ? '+ ' : '− ') + moeda(Math.abs(ef.valor)) : '—') +
            '</td><td>' + esc(a.obs || '—') + '</td><td><button type="button" class="btn btn-danger" data-an-ex="' + esc(a.id) +
            '" style="padding:4px 8px;font-size:0.78rem">Excluir</button></td></tr>';
    }).join('');
}

function renderAnotacoesFunc() {
    if (!document.getElementById('anCalendario')) return;
    fpPreencherSelects();
    var dt = document.getElementById('anData');
    if (dt && !dt.value) dt.value = hojeISO();
    fpAtualizarCamposTipo();
    renderCalendarioFunc();
    renderTabelaAnotacoesFunc();
    if (!_fchUltimo) fpPeriodoPadraoFechamento();
}
window.renderAnotacoesFunc = renderAnotacoesFunc;

function lancarAnotacaoFunc() {
    var funcId = (document.getElementById('anFuncId') || {}).value;
    var f = fpFuncPorId(funcId);
    if (!f) { toast('Escolha o funcionário.'); return; }
    var tipo = document.getElementById('anTipo').value;
    var data = dataISODia(document.getElementById('anData').value) || hojeISO();
    var hora = document.getElementById('anHora').value || '';
    var valor = parseMoeda(document.getElementById('anValor').value) || 0;
    var obs = document.getElementById('anObs').value.trim();
    if (tipo === 'chegada' && !hora) { toast('Informe o horário que chegou.'); document.getElementById('anHora').focus(); return; }
    if ((tipo === 'vale' || tipo === 'despesa' || tipo === 'bonus') && !(valor > 0)) {
        toast('Informe o valor.');
        document.getElementById('anValor').focus();
        return;
    }
    if (tipo === 'obs' && !obs) { toast('Escreva a anotação.'); document.getElementById('anObs').focus(); return; }
    var agora = new Date().toISOString();
    comCanalInterno(function () {
        var db = carregar();
        if (!db.anotacoesFuncionarios) db.anotacoesFuncionarios = [];
        db.anotacoesFuncionarios.push({
            id: uid(),
            funcionarioId: f.id,
            funcionarioNome: f.nome || '',
            tipo: tipo,
            data: data,
            hora: tipo === 'chegada' ? hora : '',
            valor: valor > 0 ? +valor.toFixed(2) : 0,
            obs: obs,
            criadoEm: agora,
            atualizadoEm: agora
        });
        salvar(db);
    });
    document.getElementById('anValor').value = '';
    document.getElementById('anObs').value = '';
    document.getElementById('anHora').value = '';
    var mesEl = document.getElementById('anMes');
    if (mesEl) mesEl.value = data.slice(0, 7);
    _anDiaSelecionado = data;
    toast('Anotação lançada para ' + (f.nome || 'funcionário') + ' em ' + fmtData(data) + '.');
    renderCalendarioFunc();
    renderTabelaAnotacoesFunc();
    if (_fchUltimo && String(_fchUltimo.funcId) === String(f.id)) calcularFechamentoFunc();
}

function excluirAnotacaoFunc(id) {
    if (!id || !confirm('Excluir esta anotação?')) return;
    comCanalInterno(function () {
        var db = carregar();
        db.anotacoesFuncionarios = (db.anotacoesFuncionarios || []).filter(function (a) { return String(a.id) !== String(id); });
        salvar(db);
    });
    renderCalendarioFunc();
    renderTabelaAnotacoesFunc();
    if (_fchUltimo) calcularFechamentoFunc();
}

/** Período padrão: do dia seguinte ao último pagamento até o próximo dia de pagamento (ou o mês atual). */
function fpPeriodoPadraoFechamento() {
    var f = fpFuncPorId((document.getElementById('fchFuncId') || {}).value);
    var hoje = hojeISO();
    var ym = hoje.slice(0, 7);
    var ini, fim;
    if (f && Number(f.diaPagamento) >= 1) {
        var pagEste = fpDiaPagamentoNoMes(f, ym);
        if (hoje <= pagEste) {
            fim = pagEste;
            ini = fpSomarDias(fpDiaPagamentoNoMes(f, fpSomarMes(ym, -1)), 1);
        } else {
            fim = fpDiaPagamentoNoMes(f, fpSomarMes(ym, 1));
            ini = fpSomarDias(pagEste, 1);
        }
    } else {
        ini = ym + '-01';
        fim = ym + '-' + String(fpUltimoDiaMes(ym)).padStart(2, '0');
    }
    var elI = document.getElementById('fchIni');
    var elF = document.getElementById('fchFim');
    var elS = document.getElementById('fchSalario');
    if (elI) elI.value = ini;
    if (elF) elF.value = fim;
    if (elS) elS.value = f && fpSalario(f) > 0 ? fpSalario(f).toFixed(2).replace('.', ',') : '';
}

function calcularFechamentoFunc() {
    var out = document.getElementById('fchResultado');
    var f = fpFuncPorId((document.getElementById('fchFuncId') || {}).value);
    if (!f) {
        _fchUltimo = null;
        if (out) out.innerHTML = '<div class="empty">Escolha o funcionário.</div>';
        return null;
    }
    var ini = dataISODia(document.getElementById('fchIni').value);
    var fim = dataISODia(document.getElementById('fchFim').value);
    if (!ini || !fim || ini > fim) {
        if (out) out.innerHTML = '<div class="empty">Informe o período (De / Até).</div>';
        return null;
    }
    var salario = parseMoeda(document.getElementById('fchSalario').value) || 0;
    var descPagos = !!(document.getElementById('fchDescPagos') || {}).checked;

    var coms = typeof listarComissoes === 'function' ? listarComissoes(f.id, null, ini, fim) : [];
    var totCom = coms.reduce(function (s, c) { return s + (Number(c.valor) || 0); }, 0);

    var ans = fpListarAnotacoes(f.id, ini, fim);
    var grupos = { falta: [], chegada: [], vale: [], despesa: [], bonus: [] };
    var totFaltas = 0, totAtraso = 0, totVales = 0, totDesp = 0, totBonus = 0, minAtraso = 0;
    ans.forEach(function (a) {
        var ef = fpEfeitoAnotacao(f, a);
        var linha = { data: a.data, detalhe: ef.detalhe, valor: ef.valor, obs: a.obs || '' };
        if (a.tipo === 'falta') { grupos.falta.push(linha); totFaltas += -ef.valor; }
        else if (a.tipo === 'chegada' && ef.valor) { grupos.chegada.push(linha); totAtraso += -ef.valor; minAtraso += ef.atrasoMin || 0; }
        else if (a.tipo === 'vale') { grupos.vale.push(linha); totVales += -ef.valor; }
        else if (a.tipo === 'despesa') { grupos.despesa.push(linha); totDesp += -ef.valor; }
        else if (a.tipo === 'bonus') { grupos.bonus.push(linha); totBonus += ef.valor; }
    });

    var pagos = [];
    comCanalInterno(function () {
        pagos = (carregar().pagamentosFuncionarios || []).filter(function (p) {
            if (!p || String(p.funcionarioId) !== String(f.id)) return false;
            var d = String(p.data || '').slice(0, 10);
            return d >= ini && d <= fim;
        });
    });
    var totPagos = descPagos ? pagos.reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0) : 0;

    var somas = salario + totCom + totBonus;
    var descontos = totFaltas + totAtraso + totVales + totDesp + totPagos;
    var liquido = +(somas - descontos).toFixed(2);
    _fchUltimo = {
        funcId: f.id,
        funcNome: f.nome || '',
        ini: ini,
        fim: fim,
        salario: salario,
        comissao: +totCom.toFixed(2),
        comissoes: coms,
        bonus: +totBonus.toFixed(2),
        faltas: +totFaltas.toFixed(2),
        qtdFaltas: grupos.falta.length,
        atrasos: +totAtraso.toFixed(2),
        minAtraso: minAtraso,
        vales: +totVales.toFixed(2),
        despesas: +totDesp.toFixed(2),
        pagos: +totPagos.toFixed(2),
        pagamentos: descPagos ? pagos : [],
        grupos: grupos,
        liquido: liquido
    };
    if (out) out.innerHTML = htmlFechamentoFunc(_fchUltimo, false);
    return _fchUltimo;
}

function htmlFechamentoFunc(r, paraImprimir) {
    if (!r) return '';
    var corTxt = paraImprimir ? '#111' : '#fff';
    function linha(rot, val, sinal, forte) {
        var cor = paraImprimir ? '#111' : (sinal < 0 ? '#ff8a80' : (sinal > 0 ? '#8fe0b8' : '#fff'));
        return '<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid rgba(127,127,127,0.25);' +
            (forte ? 'font-weight:900;font-size:1.08em;' : '') + '"><span>' + rot + '</span><b style="color:' + cor + '">' +
            (sinal < 0 ? '− ' : (sinal > 0 ? '+ ' : '')) + moeda(Math.abs(val)) + '</b></div>';
    }
    function detalhe(tit, lista) {
        if (!lista.length) return '';
        return '<div style="margin-top:10px"><b>' + tit + '</b>' + lista.map(function (l) {
            return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:0.86em;padding:2px 0">' +
                '<span>' + esc(fmtData(l.data)) + ' · ' + esc(l.detalhe) + (l.obs ? ' — ' + esc(l.obs) : '') + '</span>' +
                '<span>' + (l.valor < 0 ? '− ' : '+ ') + moeda(Math.abs(l.valor)) + '</span></div>';
        }).join('') + '</div>';
    }
    var h = '<div style="color:' + corTxt + '">';
    h += '<p style="margin:0 0 8px"><b>' + esc(r.funcNome) + '</b> · período <b>' + esc(fmtData(r.ini)) + '</b> a <b>' + esc(fmtData(r.fim)) + '</b></p>';
    h += linha('Salário do período', r.salario, 1);
    h += linha('Comissão de mão de obra (' + r.comissoes.length + ' lançamento(s))', r.comissao, 1);
    if (r.bonus) h += linha('Bônus / extras', r.bonus, 1);
    h += linha('Faltas (' + r.qtdFaltas + ')', r.faltas, -1);
    h += linha('Atrasos (' + r.minAtraso + ' min)', r.atrasos, -1);
    h += linha('Vales / adiantamentos', r.vales, -1);
    h += linha('Despesas', r.despesas, -1);
    if (r.pagos) h += linha('Pagamentos já feitos no período', r.pagos, -1);
    h += linha(r.liquido >= 0 ? 'LÍQUIDO A PAGAR' : 'SALDO NEGATIVO (funcionário deve)', r.liquido, 0, true);
    if (r.comissoes.length) {
        h += '<div style="margin-top:10px"><b>Comissões</b>' + r.comissoes.map(function (c) {
            return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:0.86em;padding:2px 0">' +
                '<span>' + esc(fmtData(c.data)) + ' · ' + esc(c.cliente || '') + (c.placa ? ' · ' + esc(c.placa) : '') + ' · ' + esc(c.desc || '') + '</span>' +
                '<span>+ ' + moeda(c.valor) + '</span></div>';
        }).join('') + '</div>';
    }
    h += detalhe('Faltas', r.grupos.falta);
    h += detalhe('Atrasos', r.grupos.chegada);
    h += detalhe('Vales / adiantamentos', r.grupos.vale);
    h += detalhe('Despesas', r.grupos.despesa);
    h += detalhe('Bônus / extras', r.grupos.bonus);
    if (r.pagamentos.length) {
        h += '<div style="margin-top:10px"><b>Pagamentos já feitos</b>' + r.pagamentos.map(function (p) {
            return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:0.86em;padding:2px 0">' +
                '<span>' + esc(fmtData(p.data)) + ' · ' + esc(p.forma || '') + (p.obs ? ' — ' + esc(p.obs) : '') + '</span>' +
                '<span>− ' + moeda(p.valor) + '</span></div>';
        }).join('') + '</div>';
    }
    if (paraImprimir) {
        h += '<div style="margin-top:40px;display:flex;justify-content:space-between;gap:30px">' +
            '<div style="flex:1;border-top:1px solid #111;text-align:center;padding-top:4px">Assinatura do funcionário</div>' +
            '<div style="flex:1;border-top:1px solid #111;text-align:center;padding-top:4px">Responsável</div></div>';
    }
    return h + '</div>';
}

function imprimirFechamentoFunc() {
    var r = calcularFechamentoFunc();
    if (!r) { toast('Escolha o funcionário e o período.'); return; }
    var emp = typeof getEmpresa === 'function' ? getEmpresa(carregarMain()) : {};
    var cab = typeof htmlCabecalhoNotaEmpresa === 'function'
        ? htmlCabecalhoNotaEmpresa(emp, '<div class="nota-sub nota-titulo-espelho">Fechamento de funcionário · ' + esc(fmtData(r.ini)) + ' a ' + esc(fmtData(r.fim)) + '</div>')
        : '';
    if (typeof executarImpressaoHtml === 'function') {
        executarImpressaoHtml('<div class="nota-espelho">' + cab + htmlFechamentoFunc(r, true) + '</div>');
    }
}

function registrarPagamentoFechamentoFunc() {
    var r = calcularFechamentoFunc();
    if (!r) { toast('Escolha o funcionário e o período.'); return; }
    var forma = (document.getElementById('pfForma') || {}).value || 'Dinheiro';
    var dataPag = hojeISO();
    var msg = 'Fechamento de ' + r.funcNome + ' (' + fmtData(r.ini) + ' a ' + fmtData(r.fim) + ')\n\n' +
        'Líquido: ' + moeda(r.liquido) + '\n';
    if (r.liquido > 0.009) {
        msg += '\nRegistrar o pagamento de ' + moeda(r.liquido) + ' em ' + forma + ' hoje (' + fmtData(dataPag) + ')?\n' +
            'Entra no histórico de pagamentos e como saída no caixa interno.';
    } else {
        msg += '\nNão há valor a pagar. Quer só gravar o fechamento?';
    }
    if (!confirm(msg)) return;
    comCanalInterno(function () {
        var db = carregar();
        if (!db.fechamentosFuncionarios) db.fechamentosFuncionarios = [];
        db.fechamentosFuncionarios.push(Object.assign({}, r, {
            id: uid(),
            comissoes: undefined,
            pagamentos: undefined,
            dataPagamento: dataPag,
            forma: forma,
            criadoEm: new Date().toISOString()
        }));
        salvar(db);
    });
    if (r.liquido > 0.009) {
        document.getElementById('pfFuncId').value = r.funcId;
        document.getElementById('pfData').value = dataPag;
        document.getElementById('pfValor').value = r.liquido.toFixed(2).replace('.', ',');
        document.getElementById('pfForma').value = forma;
        document.getElementById('pfObs').value = 'Fechamento ' + fmtData(r.ini) + ' a ' + fmtData(r.fim);
        document.getElementById('formPagFuncionario').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    } else {
        toast('Fechamento gravado.');
    }
    calcularFechamentoFunc();
}

(function ligarPontoFuncionario() {
    if (!document.getElementById('anCalendario')) return;
    var on = function (id, ev, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(ev, fn);
    };
    on('anFuncId', 'change', function () {
        var fch = document.getElementById('fchFuncId');
        if (fch && !fch.value) {
            fch.value = this.value;
            fpPeriodoPadraoFechamento();
            calcularFechamentoFunc();
        }
        fpAtualizarPrevia();
        renderCalendarioFunc();
        renderTabelaAnotacoesFunc();
    });
    on('anMes', 'change', function () { renderCalendarioFunc(); renderTabelaAnotacoesFunc(); });
    on('anTipo', 'change', fpAtualizarCamposTipo);
    on('anHora', 'input', fpAtualizarPrevia);
    on('anValor', 'input', fpAtualizarPrevia);
    on('anData', 'change', function () {
        _anDiaSelecionado = dataISODia(this.value);
        var mesEl = document.getElementById('anMes');
        if (mesEl && _anDiaSelecionado) mesEl.value = _anDiaSelecionado.slice(0, 7);
        renderCalendarioFunc();
        renderTabelaAnotacoesFunc();
    });
    on('btnAnLancar', 'click', lancarAnotacaoFunc);
    var tb = document.getElementById('tabelaAnotacoesFunc');
    if (tb) tb.addEventListener('click', function (e) {
        var b = e.target.closest('[data-an-ex]');
        if (b) excluirAnotacaoFunc(b.getAttribute('data-an-ex'));
    });
    on('fchFuncId', 'change', function () { fpPeriodoPadraoFechamento(); calcularFechamentoFunc(); });
    ['fchIni', 'fchFim', 'fchDescPagos'].forEach(function (id) { on(id, 'change', calcularFechamentoFunc); });
    on('fchSalario', 'input', calcularFechamentoFunc);
    on('btnFchCalcular', 'click', calcularFechamentoFunc);
    on('btnFchImprimir', 'click', imprimirFechamentoFunc);
    on('btnFchPagar', 'click', registrarPagamentoFechamentoFunc);
    if (typeof window.enterProximoCampo === 'function') {
        window.enterProximoCampo(['anTipo', 'anData', 'anHora', 'anValor', 'anObs'], 'btnAnLancar');
    }
    renderAnotacoesFunc();
})();
