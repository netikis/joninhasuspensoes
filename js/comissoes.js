'use strict';
/* Joninha — funcionários / comissões / pagamentos (etapa 2.2) */

/* ---------- Pagamento funcionários (Modo Interno) ---------- */
function inicioFimSemana(isoDate) {
    var d = new Date((isoDate || hojeISO()) + 'T12:00:00');
    if (isNaN(d.getTime())) d = new Date();
    var dia = d.getDay(); /* 0=dom */
    var diffSeg = dia === 0 ? -6 : 1 - dia;
    var seg = new Date(d);
    seg.setDate(d.getDate() + diffSeg);
    var dom = new Date(seg);
    dom.setDate(seg.getDate() + 6);
    function ymd(x) {
        return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    }
    return { inicio: ymd(seg), fim: ymd(dom) };
}

function rotuloSemana(isoDate) {
    var s = inicioFimSemana(isoDate);
    function ddmm(iso) {
        var p = String(iso).split('-');
        return (p[2] || '') + '/' + (p[1] || '');
    }
    return ddmm(s.inicio) + ' a ' + ddmm(s.fim);
}

function comCanalInterno(fn) {
    var antes = canalVendas;
    canalVendas = 'interno';
    atualizarBadgeCanal();
    try {
        return fn();
    } finally {
        canalVendas = antes;
        atualizarBadgeCanal();
    }
}

function lerPctsComissaoFormFunc() {
    function n(id, fallback) {
        var el = document.getElementById(id);
        var v = el ? Number(el.value) : NaN;
        if (isNaN(v) || v < 0) v = fallback;
        return v;
    }
    var alin = n('pfComissaoAlinhamento', 0);
    var serv = n('pfComissaoServico', 0);
    var amort = n('pfComissaoAmortecedor', 0);
    return {
        comissaoAlinhamentoPct: alin,
        comissaoServicoPct: serv,
        comissaoAmortecedorPct: amort,
        comissaoPct: serv
    };
}

function limparFormFuncionario() {
    document.getElementById('formFuncionario').reset();
    document.getElementById('pfFuncEditId').value = '';
    document.getElementById('pfAtivoFunc').checked = true;
    var a = document.getElementById('pfComissaoAlinhamento');
    var s = document.getElementById('pfComissaoServico');
    var m = document.getElementById('pfComissaoAmortecedor');
    if (a) a.value = 30;
    if (s) s.value = 40;
    if (m) m.value = 50;
    var pctEl = document.getElementById('pfComissaoPct');
    if (pctEl) pctEl.value = 40;
    var pinEl = document.getElementById('pfPinFunc');
    if (pinEl) { pinEl.value = ''; pinEl.placeholder = 'Ex: 1234'; }
    document.getElementById('btnCancelarFunc').style.display = 'none';
    document.getElementById('btnSalvarFunc').textContent = 'Salvar funcionário';
}

function preencherFormFuncionario(f) {
    if (!f) return;
    document.getElementById('pfFuncEditId').value = f.id;
    document.getElementById('pfNomeFunc').value = f.nome || '';
    document.getElementById('pfTelFunc').value = f.telefone || '';
    document.getElementById('pfCargoFunc').value = f.cargo || '';
    document.getElementById('pfObsFunc').value = f.obs || '';
    document.getElementById('pfAtivoFunc').checked = f.ativo !== false;
    var leg = f.comissaoPct != null ? Number(f.comissaoPct) : 40;
    if (isNaN(leg)) leg = 40;
    var a = document.getElementById('pfComissaoAlinhamento');
    var s = document.getElementById('pfComissaoServico');
    var m = document.getElementById('pfComissaoAmortecedor');
    if (a) a.value = f.comissaoAlinhamentoPct != null ? f.comissaoAlinhamentoPct : leg;
    if (s) s.value = f.comissaoServicoPct != null ? f.comissaoServicoPct : leg;
    if (m) m.value = f.comissaoAmortecedorPct != null ? f.comissaoAmortecedorPct : leg;
    var pctEl = document.getElementById('pfComissaoPct');
    if (pctEl) pctEl.value = f.comissaoServicoPct != null ? f.comissaoServicoPct : leg;
    var pinEl = document.getElementById('pfPinFunc');
    if (pinEl) pinEl.value = '';
    if (pinEl) pinEl.placeholder = f.pin ? 'PIN já definido (deixe em branco para manter)' : 'Ex: 1234';
    document.getElementById('btnCancelarFunc').style.display = '';
    document.getElementById('btnSalvarFunc').textContent = 'Salvar alterações';
}

function abrirEdicaoFuncionario(id) {
    comCanalInterno(function () {
        var db = carregar();
        var f = (db.funcionarios || []).find(function (x) { return x.id === id; });
        if (!f) { toast('Funcionário não encontrado.'); return; }
        preencherFormFuncionario(f);
    });
    abrirPainel('painelFuncionarios', document.querySelector('.nav-btn[data-panel="painelFuncionarios"]'));
    setTimeout(function () {
        var el = document.getElementById('pfNomeFunc');
        if (el) el.focus();
    }, 80);
}

function excluirFuncionarioPorId(id) {
    if (!id) return;
    if (!confirm('Excluir este funcionário? Histórico de pagamentos e vendas permanece.')) return;
    var idStr = String(id);
    comCanalInterno(function () {
        var db = carregar();
        marcarExcluido(db, 'funcionarios', idStr);
        db.funcionarios = (db.funcionarios || []).filter(function (f) {
            return f && String(f.id) !== idStr;
        });
        salvar(db);
        toast('Funcionário removido.');
        var editEl = document.getElementById('pfFuncEditId');
        if (editEl && String(editEl.value) === idStr) limparFormFuncionario();
    });
    /* Garante também no STORAGE_INTERNO direto (fonte dos logins/sync) */
    try {
        var lista = listarFuncionariosInterno().filter(function (f) {
            return f && String(f.id) !== idStr;
        });
        salvarFuncionariosInterno(lista);
        if (typeof sincronizarMapaLoginsFuncLimpo === 'function') sincronizarMapaLoginsFuncLimpo();
    } catch (eLimpa) { /* ok */ }
    /* Marca exclusão no banco oficial para o sync não ressuscitar */
    try {
        var main = carregarMain();
        marcarExcluido(main, 'funcionarios', idStr);
        salvarMain(main);
    } catch (eMain) { /* ok */ }

    fecharModalVerFuncionario();
    renderListaFuncionarios();
    renderPagFuncionarios();
    if (typeof preencherSelectFuncionariosVenda === 'function') preencherSelectFuncionariosVenda();
    if (typeof preencherSelectMaoFunc === 'function') preencherSelectMaoFunc();

    /* Empurra lista sem o excluído + mapa de exclusões para a nuvem */
    if (typeof agendarSyncAutomatico === 'function') agendarSyncAutomatico('excluir-funcionario');
    if (typeof enviarLoginsFuncNuvem === 'function') {
        enviarLoginsFuncNuvem({ permitirVazio: true }).catch(function () { /* offline */ });
    }
}

var _verFuncIdAtual = null;

function fecharModalVerFuncionario() {
    var m = document.getElementById('modalVerFuncionario');
    if (m) m.classList.remove('aberto');
    _verFuncIdAtual = null;
}

function abrirModalVerFuncionario(id) {
    comCanalInterno(function () {
        var db = carregar();
        var f = (db.funcionarios || []).find(function (x) { return x.id === id; });
        if (!f) { toast('Funcionário não encontrado.'); return; }
        _verFuncIdAtual = f.id;
        var leg = f.comissaoPct != null ? Number(f.comissaoPct) : 0;
        var alin = f.comissaoAlinhamentoPct != null ? Number(f.comissaoAlinhamentoPct) : leg;
        var serv = f.comissaoServicoPct != null ? Number(f.comissaoServicoPct) : leg;
        var amort = f.comissaoAmortecedorPct != null ? Number(f.comissaoAmortecedorPct) : leg;
        var ativo = f.ativo !== false;
        document.getElementById('modalVerFuncTitulo').textContent = f.nome || 'Funcionário';
        document.getElementById('modalVerFuncCorpo').innerHTML =
            '<div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">NOME</span><div>' + esc(f.nome || '—') + '</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">TELEFONE</span><div>' + esc(f.telefone || '—') + '</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">CARGO</span><div>' + esc(f.cargo || '—') + '</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">MO ALINHAMENTO</span><div>' + esc(String(alin)) + '%</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">MO SERVIÇO</span><div>' + esc(String(serv)) + '%</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">MO AMORTECEDOR</span><div>' + esc(String(amort)) + '%</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">STATUS</span><div style="color:' + (ativo ? '#2ecc71' : '#e74c3c') + '">' + (ativo ? 'Ativo' : 'Inativo') + '</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">PIN</span><div>' + (f.pin ? 'Definido' : 'Não definido') + '</div></div>' +
            '<div style="grid-column:1/-1"><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">OBSERVAÇÃO</span><div>' + esc(f.obs || '—') + '</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">CADASTRADO EM</span><div>' + esc(fmtData(f.criadoEm) || '—') + '</div></div>' +
            '<div><span class="lbl" style="color:#9a9aa3;font-size:0.7rem">ATUALIZADO EM</span><div>' + esc(fmtData(f.atualizadoEm) || '—') + '</div></div>' +
            '</div>';
        document.getElementById('modalVerFuncionario').classList.add('aberto');
    });
}

function renderCadastroFuncionarios() {
    /* painel só do formulário — lista fica em Funcionários Cadastrados */
}

function renderListaFuncionarios() {
    var panel = document.getElementById('painelListaFuncionarios');
    if (!panel) return;
    comCanalInterno(function () {
        var db = carregar();
        var q = ((document.getElementById('buscaFuncionario') && document.getElementById('buscaFuncionario').value) || '').trim().toLowerCase();
        var funcs = listarFuncionariosOrdenados(db, false).filter(function (f) {
            if (!q) return true;
            return [f.nome, f.telefone, f.cargo, f.obs].join(' ').toLowerCase().indexOf(q) >= 0;
        });
        var tb = document.getElementById('tabelaFuncionarios');
        var vaz = document.getElementById('listaFuncionariosVazia');
        if (!tb) return;
        if (!funcs.length) {
            tb.innerHTML = '';
            if (vaz) vaz.style.display = 'block';
        } else {
            if (vaz) vaz.style.display = 'none';
            tb.innerHTML = funcs.map(function (f) {
                var ativo = f.ativo !== false;
                var leg = f.comissaoPct != null ? Number(f.comissaoPct) : 0;
                var alin = f.comissaoAlinhamentoPct != null ? Number(f.comissaoAlinhamentoPct) : leg;
                var serv = f.comissaoServicoPct != null ? Number(f.comissaoServicoPct) : leg;
                var amort = f.comissaoAmortecedorPct != null ? Number(f.comissaoAmortecedorPct) : leg;
                return '<tr>' +
                    '<td style="color:#fff;font-weight:800">' + esc(f.nome || '—') + '</td>' +
                    '<td style="color:#fff;font-weight:700">' + esc(f.telefone || '—') + '</td>' +
                    '<td style="color:#fff;font-weight:700">' + esc(f.cargo || '—') + '</td>' +
                    '<td style="color:#fff;font-weight:800">' + esc(String(alin)) + '%</td>' +
                    '<td style="color:#fff;font-weight:800">' + esc(String(serv)) + '%</td>' +
                    '<td style="color:#fff;font-weight:800">' + esc(String(amort)) + '%</td>' +
                    '<td>' + (ativo
                        ? '<span style="color:#2ecc71;font-weight:700">Ativo</span>'
                        : '<span style="color:#e74c3c;font-weight:700">Inativo</span>') + '</td>' +
                    '<td class="actions" style="white-space:nowrap">' +
                    '<button type="button" class="btn btn-ver" data-ver-func="' + esc(f.id) + '" style="padding:4px 8px;font-size:0.78rem">Ver</button> ' +
                    '<button type="button" class="btn btn-secondary" data-ed-func="' + esc(f.id) + '" style="padding:4px 8px;font-size:0.78rem">Editar</button> ' +
                    '<button type="button" class="btn btn-danger" data-excluir-func="' + esc(f.id) + '" style="padding:4px 8px;font-size:0.78rem">Excluir</button>' +
                    '</td></tr>';
            }).join('');
        }
    });
}

function renderPagFuncionarios() {
    var panel = document.getElementById('painelPagFuncionarios');
    if (!panel) return;
    comCanalInterno(function () {
        var db = carregar();
        var funcs = listarFuncionariosOrdenados(db, false);
        var pags = (db.pagamentosFuncionarios || []).slice().sort(function (a, b) {
            return String(b.data || b.criadoEm || '').localeCompare(String(a.data || a.criadoEm || ''));
        });

        var sem = inicioFimSemana(hojeISO());
        var mesAtual = hojeISO().slice(0, 7);
        var totSemana = 0;
        var totMes = 0;
        var totGeral = 0;
        pags.forEach(function (p) {
            var v = Number(p.valor) || 0;
            totGeral += v;
            var d = (p.data || '').slice(0, 10);
            if (d >= sem.inicio && d <= sem.fim) totSemana += v;
            if (d.slice(0, 7) === mesAtual) totMes += v;
        });

        document.getElementById('pfQtdFunc').textContent = String(funcs.length);
        document.getElementById('pfSemana').textContent = moeda(totSemana);
        document.getElementById('pfMes').textContent = moeda(totMes);
        document.getElementById('pfTotal').textContent = moeda(totGeral);

        var sel = document.getElementById('pfFuncId');
        var selVal = sel.value;
        sel.innerHTML = '<option value="">Selecione...</option>' + funcs.map(function (f) {
            var st = f.ativo === false ? ' (inativo)' : '';
            return '<option value="' + esc(f.id) + '">' + esc((f.nome || '') + st) + '</option>';
        }).join('');
        if (selVal && funcs.some(function (f) { return f.id === selVal; })) sel.value = selVal;

        var tbF = document.getElementById('tabelaFuncionariosPag');
        var vazF = document.getElementById('listaFuncionariosPagVazia');
        if (tbF && vazF) {
            if (!funcs.length) {
                tbF.innerHTML = '';
                vazF.style.display = 'block';
            } else {
                vazF.style.display = 'none';
                tbF.innerHTML = funcs.map(function (f) {
                    return '<tr><td>' + esc(f.nome || '—') + '</td><td>' + esc(f.cargo || '—') + '</td><td>' +
                        (f.ativo !== false
                            ? '<span style="color:#2ecc71;font-weight:700">Ativo</span>'
                            : '<span style="color:#e74c3c;font-weight:700">Inativo</span>') +
                        '</td></tr>';
                }).join('');
            }
        }

        var q = (document.getElementById('buscaPagFunc').value || '').trim().toLowerCase();
        var filtrados = pags.filter(function (p) {
            if (!q) return true;
            var nome = String(p.funcionarioNome || '').toLowerCase();
            var obs = String(p.obs || '').toLowerCase();
            return nome.indexOf(q) >= 0 || obs.indexOf(q) >= 0;
        });
        var tbP = document.getElementById('tabelaPagFuncionarios');
        var vazP = document.getElementById('listaPagFuncVazia');
        if (!filtrados.length) {
            tbP.innerHTML = '';
            vazP.style.display = 'block';
        } else {
            vazP.style.display = 'none';
            tbP.innerHTML = filtrados.map(function (p) {
                return '<tr>' +
                    '<td>' + esc(fmtData(p.data || p.criadoEm)) + '</td>' +
                    '<td>' + esc(rotuloSemana(p.data || hojeISO())) + '</td>' +
                    '<td>' + esc(p.funcionarioNome || '—') + '</td>' +
                    '<td>' + esc(p.forma || '—') + '</td>' +
                    '<td>' + esc(p.obs || '—') + '</td>' +
                    '<td>' + moeda(p.valor) + '</td>' +
                    '<td><button type="button" class="btn btn-secondary" data-excluir-pag-func="' + esc(p.id) + '" style="padding:4px 8px;font-size:0.8rem">Excluir</button></td>' +
                    '</tr>';
            }).join('');
        }

        var pfData = document.getElementById('pfData');
        if (pfData && !pfData.value) pfData.value = hojeISO();
    });
}

document.getElementById('formFuncionario').addEventListener('submit', function (e) {
    e.preventDefault();
    var nome = document.getElementById('pfNomeFunc').value.trim();
    var telefone = document.getElementById('pfTelFunc').value.trim();
    var cargo = document.getElementById('pfCargoFunc').value.trim();
    var obs = document.getElementById('pfObsFunc').value.trim();
    var ativo = document.getElementById('pfAtivoFunc').checked;
    var pcts = lerPctsComissaoFormFunc();
    var pin = (document.getElementById('pfPinFunc').value || '').trim();
    var editId = document.getElementById('pfFuncEditId').value;
    if (!nome) { toast('Informe o nome do funcionário.'); return; }
    comCanalInterno(function () {
        var db = carregar();
        if (!db.funcionarios) db.funcionarios = [];
        var existe = db.funcionarios.some(function (f) {
            return String(f.nome || '').toLowerCase() === nome.toLowerCase() && f.id !== editId;
        });
        if (existe) { toast('Já existe funcionário com esse nome.'); return; }
        var agora = new Date().toISOString();
        if (editId) {
            var i = db.funcionarios.findIndex(function (f) { return f.id === editId; });
            if (i < 0) { toast('Funcionário não encontrado.'); return; }
            var prevPin = db.funcionarios[i].pin || '';
            db.funcionarios[i] = Object.assign({}, db.funcionarios[i], {
                nome: nome,
                telefone: telefone,
                cargo: cargo,
                obs: obs,
                ativo: ativo,
                comissaoAlinhamentoPct: pcts.comissaoAlinhamentoPct,
                comissaoServicoPct: pcts.comissaoServicoPct,
                comissaoAmortecedorPct: pcts.comissaoAmortecedorPct,
                comissaoPct: pcts.comissaoPct,
                pin: pin || prevPin,
                atualizadoEm: agora
            });
            toast('Funcionário atualizado — Alinh. ' + pcts.comissaoAlinhamentoPct + '% · Serv. ' + pcts.comissaoServicoPct + '% · Amort. ' + pcts.comissaoAmortecedorPct + '%.');
        } else {
            db.funcionarios.push({
                id: uid(),
                nome: nome,
                telefone: telefone,
                cargo: cargo,
                obs: obs,
                ativo: ativo,
                comissaoAlinhamentoPct: pcts.comissaoAlinhamentoPct,
                comissaoServicoPct: pcts.comissaoServicoPct,
                comissaoAmortecedorPct: pcts.comissaoAmortecedorPct,
                comissaoPct: pcts.comissaoPct,
                pin: pin,
                criadoEm: agora,
                atualizadoEm: agora
            });
            toast('Funcionário cadastrado — % por tipo de mão de obra salvas.');
        }
        salvar(db);
        limparFormFuncionario();
    });
    renderListaFuncionarios();
    renderPagFuncionarios();
    preencherSelectFuncionariosVenda();
});

document.getElementById('btnCancelarFunc').addEventListener('click', limparFormFuncionario);
var buscaFuncEl = document.getElementById('buscaFuncionario');
if (buscaFuncEl) buscaFuncEl.addEventListener('input', renderListaFuncionarios);
document.getElementById('btnPagIrCadFunc').addEventListener('click', function () {
    abrirPainel('painelFuncionarios', document.querySelector('.nav-btn[data-panel="painelFuncionarios"]'));
});
document.getElementById('btnVdIrFuncionarios').addEventListener('click', function () {
    abrirPainel('painelFuncionarios', document.querySelector('.nav-btn[data-panel="painelFuncionarios"]'));
});
var btnIrLista = document.getElementById('btnIrListaFunc');
if (btnIrLista) btnIrLista.addEventListener('click', function () {
    abrirPainel('painelListaFuncionarios', document.querySelector('.nav-btn[data-panel="painelListaFuncionarios"]'));
});
var btnListaCad = document.getElementById('btnListaIrCadFunc');
if (btnListaCad) btnListaCad.addEventListener('click', function () {
    limparFormFuncionario();
    abrirPainel('painelFuncionarios', document.querySelector('.nav-btn[data-panel="painelFuncionarios"]'));
});
var btnAtuLista = document.getElementById('btnAtualizarListaFunc');
if (btnAtuLista) btnAtuLista.addEventListener('click', renderListaFuncionarios);

document.getElementById('btnFecharVerFunc').addEventListener('click', fecharModalVerFuncionario);
document.getElementById('modalVerFuncionario').addEventListener('click', function (e) {
    if (e.target === this) fecharModalVerFuncionario();
});
document.getElementById('btnVerFuncEditar').addEventListener('click', function () {
    var id = _verFuncIdAtual;
    fecharModalVerFuncionario();
    if (id) abrirEdicaoFuncionario(id);
});
document.getElementById('btnVerFuncExcluir').addEventListener('click', function () {
    if (_verFuncIdAtual) excluirFuncionarioPorId(_verFuncIdAtual);
});

document.getElementById('formPagFuncionario').addEventListener('submit', function (e) {
    e.preventDefault();
    var funcId = document.getElementById('pfFuncId').value;
    var data = document.getElementById('pfData').value || hojeISO();
    var valor = parseMoeda(document.getElementById('pfValor').value);
    var forma = document.getElementById('pfForma').value;
    var obs = document.getElementById('pfObs').value.trim();
    if (!funcId) { toast('Selecione o funcionário.'); return; }
    if (!(valor > 0)) { toast('Informe um valor válido.'); return; }

    comCanalInterno(function () {
        var db = carregar();
        var func = (db.funcionarios || []).find(function (f) { return f.id === funcId; });
        if (!func) { toast('Funcionário não encontrado.'); return; }
        if (!db.pagamentosFuncionarios) db.pagamentosFuncionarios = [];
        if (!db.caixa) db.caixa = [];
        if (!db.caixaBanco) db.caixaBanco = [];

        var pagId = uid();
        var caixaId = uid();
        var desc = 'Pag. funcionário: ' + func.nome + ' · semana ' + rotuloSemana(data) + (obs ? ' — ' + obs : '');
        var ehDinheiro = String(forma).toLowerCase() === 'dinheiro';
        var lanc = {
            id: caixaId,
            tipo: 'saida',
            descricao: desc,
            valor: valor,
            forma: forma,
            conta: ehDinheiro ? 'balcao' : 'banco',
            funcionarioId: func.id,
            pagamentoFuncionarioId: pagId,
            criadoEm: new Date(data + 'T12:00:00').toISOString()
        };
        if (ehDinheiro) db.caixa.push(lanc);
        else db.caixaBanco.push(lanc);

        db.pagamentosFuncionarios.push({
            id: pagId,
            funcionarioId: func.id,
            funcionarioNome: func.nome,
            data: data,
            valor: valor,
            forma: forma,
            obs: obs,
            caixaId: caixaId,
            conta: ehDinheiro ? 'balcao' : 'banco',
            criadoEm: new Date().toISOString()
        });
        salvar(db);
        document.getElementById('formPagFuncionario').reset();
        document.getElementById('pfData').value = hojeISO();
        toast('Pagamento de ' + func.nome + ' registrado.');
    });
    renderPagFuncionarios();
    renderCaixa();
    renderCaixaBanco();
    renderRelatorioCaixa();
});

document.getElementById('tabelaFuncionarios').addEventListener('click', function (e) {
    var btnVer = e.target.closest('[data-ver-func]');
    if (btnVer) {
        abrirModalVerFuncionario(btnVer.getAttribute('data-ver-func'));
        return;
    }
    var btnEd = e.target.closest('[data-ed-func]');
    if (btnEd) {
        abrirEdicaoFuncionario(btnEd.getAttribute('data-ed-func'));
        return;
    }
    var btn = e.target.closest('[data-excluir-func]');
    if (!btn) return;
    excluirFuncionarioPorId(btn.getAttribute('data-excluir-func'));
});

document.getElementById('tabelaPagFuncionarios').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-excluir-pag-func]');
    if (!btn) return;
    var id = btn.getAttribute('data-excluir-pag-func');
    if (!confirm('Excluir este pagamento e a saída no caixa interno?')) return;
    comCanalInterno(function () {
        var db = carregar();
        var pag = (db.pagamentosFuncionarios || []).find(function (p) { return p.id === id; });
        db.pagamentosFuncionarios = (db.pagamentosFuncionarios || []).filter(function (p) { return p.id !== id; });
        if (pag) {
            var cid = pag.caixaId;
            if (pag.conta === 'banco') {
                db.caixaBanco = (db.caixaBanco || []).filter(function (x) {
                    return x.id !== cid && x.pagamentoFuncionarioId !== id;
                });
            } else {
                db.caixa = (db.caixa || []).filter(function (x) {
                    return x.id !== cid && x.pagamentoFuncionarioId !== id;
                });
            }
        }
        salvar(db);
        toast('Pagamento excluído.');
    });
    renderPagFuncionarios();
    renderCaixa();
    renderCaixaBanco();
    renderRelatorioCaixa();
});

document.getElementById('btnAtualizarPagFunc').addEventListener('click', function () {
    renderPagFuncionarios();
    toast('Lista atualizada.');
});
document.getElementById('buscaPagFunc').addEventListener('input', renderPagFuncionarios);

/* caixa: ver js/caixa.js */


function preencherSelectMaoFunc() {
    var sel = document.getElementById('maoFuncId');
    if (!sel) return;
    var cur = sel.value;
    var funcs = [];
    try {
        comCanalInterno(function () {
            funcs = listarFuncionariosOrdenados(carregar(), true);
        });
    } catch (e) {
        var db = carregar();
        /* fallback: lê interno */
        try {
            var raw = localStorage.getItem(STORAGE_INTERNO);
            var int = raw ? JSON.parse(raw) : {};
            funcs = (int.funcionarios || []).filter(function (f) { return f.ativo !== false; });
        } catch (e2) { funcs = []; }
    }
    sel.innerHTML = '<option value="">— sem funcionário —</option>' + funcs.map(function (f) {
        return '<option value="' + esc(f.id) + '">' + esc(f.nome || '') + '</option>';
    }).join('');
    if (cur) sel.value = cur;
}


function listarComissoes(filtroFuncId, mesYYYYMM) {
    var db = (typeof carregarMain === 'function') ? carregarMain() : carregar();
    var funcsMap = {};
    function registrarFunc(f) {
        if (!f || !f.id) return;
        funcsMap[String(f.id)] = f;
    }
    try {
        if (typeof listarFuncionariosInterno === 'function') {
            listarFuncionariosInterno().forEach(registrarFunc);
        }
    } catch (e0) { /* ok */ }
    try {
        comCanalInterno(function () {
            (carregar().funcionarios || []).forEach(registrarFunc);
        });
    } catch (e) {
        try {
            var raw = localStorage.getItem(STORAGE_INTERNO);
            var int = raw ? JSON.parse(raw) : {};
            (int.funcionarios || []).forEach(registrarFunc);
        } catch (e2) {}
    }
    var out = [];
    (db.atendimentos || []).forEach(function (a) {
        var d = dataAtendimentoISO(a);
        if (!d) return;
        if (mesYYYYMM && d.slice(0, 7) !== mesYYYYMM) return;
        (a.itens || []).forEach(function (it) {
            if ((it.tipo || '') !== 'mao') return;
            var fid = it.funcionarioId ? String(it.funcionarioId) : '';
            if (!fid) return;
            if (filtroFuncId && fid !== String(filtroFuncId)) return;
            var f = funcsMap[fid] || {};
            var tipoMao = it.tipoMao || 'servico';
            var pct = it.comissaoPct != null ? Number(it.comissaoPct) : NaN;
            if (isNaN(pct) || pct <= 0) {
                /* OS antiga / salva com 0% → usa % atual do cadastro */
                pct = typeof pctComissaoPorTipo === 'function'
                    ? pctComissaoPorTipo(f, tipoMao)
                    : (Number(f.comissaoServicoPct != null ? f.comissaoServicoPct : f.comissaoPct) || 0);
            }
            if (isNaN(pct) || pct < 0) pct = 0;
            var base = Number(it.valor) || 0;
            var valorSalvo = it.comissaoValor != null ? Number(it.comissaoValor) : NaN;
            var valor = (!isNaN(valorSalvo) && valorSalvo > 0)
                ? +valorSalvo.toFixed(2)
                : +(base * pct / 100).toFixed(2);
            /* Se tinha valor 0 com % agora > 0, recalcula */
            if (!(valor > 0) && pct > 0 && base > 0) {
                valor = +(base * pct / 100).toFixed(2);
            }
            var descMo = it.desc || 'Mão de obra';
            if (it.tipoMao) descMo = '[' + rotuloTipoMaoComissao(tipoMao) + '] ' + descMo;
            out.push({
                data: d,
                cliente: a.clienteNome || nomeAtendimento(db, a),
                placa: a.placa || '',
                desc: descMo,
                base: base,
                pct: pct,
                valor: valor,
                funcionarioId: fid,
                funcionarioNome: f.nome || it.funcionarioNome || '—'
            });
        });
    });
    out.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    return out;
}

function renderComissoes() {
    var panel = document.getElementById('painelComissoes');
    if (!panel) return;
    var mesEl = document.getElementById('comMes');
    if (mesEl && !mesEl.value) mesEl.value = hojeISO().slice(0, 7);
    var mes = mesEl ? mesEl.value : hojeISO().slice(0, 7);
    var filtro = sessaoFuncionarioId || (document.getElementById('comFuncFiltro') && document.getElementById('comFuncFiltro').value) || '';
    var lista = listarComissoes(filtro, mes);
    var tot = 0, base = 0;
    lista.forEach(function (c) { tot += c.valor; base += c.base; });
    document.getElementById('comTotalPeriodo').textContent = moeda(tot);
    document.getElementById('comBasePeriodo').textContent = moeda(base);
    document.getElementById('comQtd').textContent = String(lista.length);
    var hint = document.getElementById('comHint');
    if (sessaoFuncionarioId) {
        var nomeFuncSessao = '';
        try {
            var ff = listarFuncionariosInterno().find(function (x) {
                return x && String(x.id) === String(sessaoFuncionarioId);
            });
            if (ff) nomeFuncSessao = ff.nome || '';
        } catch (eN) { /* ok */ }
        hint.textContent = 'Só as suas comissões' +
            (nomeFuncSessao ? ' (' + nomeFuncSessao + ')' : '') +
            ' neste mês. Outros funcionários não aparecem.';
        var fa = document.getElementById('comFiltrosAdmin');
        if (fa) fa.style.display = 'none';
        filtro = sessaoFuncionarioId;
    } else {
        hint.textContent = 'Balanço do mês: escolha o mês abaixo. Soma a comissão de cada OS (mão de obra vinculada ao funcionário). A % fica só no cadastro do funcionário.';
        var fa2 = document.getElementById('comFiltrosAdmin');
        if (fa2) fa2.style.display = '';
        var sel = document.getElementById('comFuncFiltro');
        if (sel) {
            var cur = sel.value;
            var opts = '<option value="">Todos</option>';
            try {
                comCanalInterno(function () {
                    listarFuncionariosOrdenados(carregar(), false).forEach(function (f) {
                        opts += '<option value="' + esc(f.id) + '">' + esc(f.nome || '') + '</option>';
                    });
                });
            } catch (e) {}
            sel.innerHTML = opts;
            if (cur) sel.value = cur;
        }
    }
    var tb = document.getElementById('tabelaComissoes');
    var vaz = document.getElementById('listaComVazia');
    if (!lista.length) {
        tb.innerHTML = '';
        vaz.style.display = 'block';
    } else {
        vaz.style.display = 'none';
        tb.innerHTML = lista.map(function (c) {
            return '<tr><td>' + esc(fmtData(c.data)) + '</td><td>' + esc(c.cliente) + (c.placa ? ' · ' + esc(c.placa) : '') +
                (sessaoFuncionarioId ? '' : ' <span class="muted">(' + esc(c.funcionarioNome) + ')</span>') +
                '</td><td>' + esc(c.desc) + '</td><td>' + moeda(c.base) + '</td><td>' + esc(String(c.pct)) + '%</td><td class="ganho-linha">' + moeda(c.valor) + '</td></tr>';
        }).join('');
    }
}

