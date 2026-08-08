'use strict';
/* Joninha — OS / atendimento / fotos (etapa 2.2) */

/* ---------- Atendimento / veículo ---------- */
function atualizarPlaca() {
    var placa = (document.getElementById('atPlaca').value || 'PLACA').toUpperCase();
    var cidade = document.getElementById('atCidadePlaca').value || 'CIDADE / UF';
    document.getElementById('plateNum').textContent = placa || 'PLACA';
    document.getElementById('plateLoc').textContent = (cidade || 'CIDADE / UF').toUpperCase();
}

document.getElementById('atPlaca').addEventListener('input', atualizarPlaca);
document.getElementById('atCidadePlaca').addEventListener('input', atualizarPlaca);

/* ---------- Fotos do veículo (chegada) ---------- */
function srcFoto(f) {
    return (f && (f.url || f.data)) || '';
}

function renderGaleriaFotos() {
    var box = document.getElementById('fotosGaleria');
    var cont = document.getElementById('fotosContador');
    var btnLimpar = document.getElementById('btnLimparFotos');
    var n = fotosAtuais.length;
    cont.textContent = n ? (n + ' foto' + (n > 1 ? 's' : '') + ' (internas)') : 'Nenhuma foto';
    btnLimpar.style.display = n ? '' : 'none';
    var btnExp = document.getElementById('btnExportarFotosForm');
    if (btnExp) btnExp.style.display = n ? '' : 'none';
    if (!n) {
        box.innerHTML = '';
        return;
    }
    box.innerHTML = fotosAtuais.map(function (f, idx) {
        var src = srcFoto(f);
        return '<div class="foto-thumb">' +
            '<img src="' + src + '" alt="Foto ' + (idx + 1) + '" data-foto-zoom="' + idx + '">' +
            '<button type="button" title="Remover" data-foto-rm="' + idx + '">×</button>' +
            '</div>';
    }).join('');
    box.querySelectorAll('[data-foto-rm]').forEach(function (b) {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            fotosAtuais.splice(Number(b.getAttribute('data-foto-rm')), 1);
            renderGaleriaFotos();
        });
    });
    box.querySelectorAll('[data-foto-zoom]').forEach(function (img) {
        img.addEventListener('click', function () {
            document.getElementById('fotoZoomImg').src = img.src;
            document.getElementById('modalFotoZoom').classList.add('aberto');
        });
    });
}

document.getElementById('btnFecharFotoZoom').addEventListener('click', function () {
    document.getElementById('modalFotoZoom').classList.remove('aberto');
});
document.getElementById('modalFotoZoom').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('aberto');
});

function desenharFotoCanvas(img, maxLado, qualidade) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    var max = maxLado || FOTO_MAX_LADO;
    if (w > max || h > max) {
        if (w > h) { h = (h * max) / w; w = max; }
        else { w = (w * max) / h; h = max; }
    }
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', qualidade != null ? qualidade : FOTO_JPEG_QUALIDADE);
}

function carregarImagemDeSrc(src) {
    return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () { resolve(img); };
        img.src = src;
    });
}

/* Recomprime até caber no limite (nuvem / Firestore) */
async function garantirFotoComprimida(dataUrl) {
    if (!dataUrl || String(dataUrl).indexOf('data:image') !== 0) return dataUrl || null;
    if (String(dataUrl).length <= FOTO_MAX_CHARS) {
        /* Mesmo abaixo do limite, normaliza para JPEG compacto */
        try {
            var img0 = await carregarImagemDeSrc(dataUrl);
            var n0 = desenharFotoCanvas(img0, FOTO_MAX_LADO, FOTO_JPEG_QUALIDADE);
            if (n0 && n0.length <= String(dataUrl).length) return n0;
            if (n0 && String(dataUrl).length > FOTO_MAX_CHARS) return n0;
            return n0 || dataUrl;
        } catch (e) {
            return dataUrl;
        }
    }
    var lados = [FOTO_MAX_LADO, 640, 540, 480, 400];
    var quals = [FOTO_JPEG_QUALIDADE, 0.6, 0.52, 0.45, 0.38];
    var atual = dataUrl;
    try {
        var img = await carregarImagemDeSrc(dataUrl);
        for (var i = 0; i < lados.length; i++) {
            for (var q = 0; q < quals.length; q++) {
                var out = desenharFotoCanvas(img, lados[i], quals[q]);
                if (!out) continue;
                atual = out;
                if (out.length <= FOTO_MAX_CHARS) return out;
            }
        }
    } catch (e2) { /* mantém atual */ }
    return atual;
}

function comprimirImagemArquivo(file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function () {
            var img = new Image();
            img.onerror = reject;
            img.onload = async function () {
                try {
                    var base = desenharFotoCanvas(img, FOTO_MAX_LADO, FOTO_JPEG_QUALIDADE);
                    if (!base) { reject(new Error('imagem inválida')); return; }
                    var final = await garantirFotoComprimida(base);
                    resolve(final);
                } catch (err) {
                    reject(err);
                }
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

async function processarArquivosFoto(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var erros = 0;
    for (var i = 0; i < files.length; i++) {
        if (fotosAtuais.length >= FOTOS_MAX) {
            toast('Máximo de ' + FOTOS_MAX + ' fotos por atendimento.');
            break;
        }
        var file = files[i];
        if (!file) continue;
        var tipo = (file.type || '').toLowerCase();
        if (!tipo.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) continue;
        try {
            var data = await comprimirImagemArquivo(file);
            if (data) fotosAtuais.push({ id: uid(), data: data, url: null });
            else erros++;
        } catch (err) {
            erros++;
        }
    }
    renderGaleriaFotos();
    if (erros) toast('Algumas imagens não puderam ser processadas.');
}

document.getElementById('btnTirarFoto').addEventListener('click', function () {
    document.getElementById('inFotoCamera').click();
});
document.getElementById('btnGaleriaFoto').addEventListener('click', function () {
    document.getElementById('inFotoGaleria').click();
});
document.getElementById('inFotoCamera').addEventListener('change', function () {
    processarArquivosFoto(this.files);
    this.value = '';
});
document.getElementById('inFotoGaleria').addEventListener('change', function () {
    processarArquivosFoto(this.files);
    this.value = '';
});
document.getElementById('btnLimparFotos').addEventListener('click', function () {
    if (!fotosAtuais.length) return;
    if (!confirm('Remover todas as fotos deste atendimento?')) return;
    fotosAtuais = [];
    renderGaleriaFotos();
});

function carregarFotosNoForm(lista) {
    fotosAtuais = (lista || []).map(function (f) {
        return { id: f.id || uid(), data: f.data || null, url: f.url || null };
    }).filter(function (f) { return f.data || f.url; });
    renderGaleriaFotos();
}


function somaPorTipo(tipo) {
    return itensTemp.reduce(function (s, it) {
        return s + ((it.tipo || 'peca') === tipo ? (Number(it.valor) || 0) : 0);
    }, 0);
}

function normalizarPecaItem(it) {
    if (!it || (it.tipo || 'peca') === 'mao') return it;
    var qtd = Math.max(1, Math.round(Number(it.qtd) || 1));
    var valorUnit = it.valorUnit != null ? Number(it.valorUnit) : NaN;
    var custoUnit = it.custoUnit != null ? Number(it.custoUnit) : NaN;
    if (isNaN(valorUnit) || valorUnit < 0) {
        valorUnit = qtd > 0 ? (Number(it.valor) || 0) / qtd : (Number(it.valor) || 0);
    }
    if (isNaN(custoUnit) || custoUnit < 0) {
        custoUnit = qtd > 0 ? (Number(it.custo) || 0) / qtd : (Number(it.custo) || 0);
    }
    it.qtd = qtd;
    it.valorUnit = +valorUnit.toFixed(2);
    it.custoUnit = +custoUnit.toFixed(2);
    it.valor = +(it.valorUnit * qtd).toFixed(2);
    it.custo = +(it.custoUnit * qtd).toFixed(2);
    return it;
}

function aplicarQtdPeca(idx, novaQtd) {
    var it = itensTemp[idx];
    if (!it || (it.tipo || 'peca') === 'mao') return;
    normalizarPecaItem(it);
    it.qtd = Math.max(1, Math.round(Number(novaQtd) || 1));
    it.valor = +(it.valorUnit * it.qtd).toFixed(2);
    it.custo = +(it.custoUnit * it.qtd).toFixed(2);
    renderItens();
}

function htmlLinhaItemOs(it, idx) {
    var tipo = it.tipo || 'peca';
    if (tipo === 'peca') {
        normalizarPecaItem(it);
        var extraP = '<div class="muted" style="font-size:0.78rem">Unit. custo ' + moeda(it.custoUnit) +
            ' · venda ' + moeda(it.valorUnit) +
            ' · Total custo ' + moeda(it.custo) +
            ' · Ganho <span class="ganho-linha">' + moeda(ganhoItem(it)) + '</span></div>';
        return '<div class="row" style="margin-bottom:8px;align-items:center;gap:6px">' +
            '<div class="col" style="flex:2"><span style="display:inline-block;margin-right:8px;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:700;background:rgba(61,160,232,0.15);color:#9fd3ff;border:1px solid rgba(61,160,232,0.4)">PEÇA</span>' +
            esc(it.desc) + extraP + '</div>' +
            '<div class="col" style="flex:1.1;display:flex;align-items:center;gap:4px">' +
            '<button type="button" class="btn btn-secondary" data-qtd-menos="' + idx + '" style="padding:4px 10px;min-width:36px">−</button>' +
            '<input type="number" min="1" step="1" value="' + esc(String(it.qtd)) + '" data-qtd-input="' + idx + '" ' +
            'style="width:64px;text-align:center;padding:6px;font-weight:700" title="Quantidade">' +
            '<button type="button" class="btn btn-secondary" data-qtd-mais="' + idx + '" style="padding:4px 10px;min-width:36px">+</button>' +
            '</div>' +
            '<div class="col" style="flex:0.9;font-weight:800">' + moeda(it.valor) + '</div>' +
            '<div class="col" style="flex:0.4"><button type="button" class="btn btn-danger" data-rm="' + idx + '">×</button></div>' +
            '</div>';
    }

    var pctLinha = Number(it.comissaoPct);
    if (isNaN(pctLinha)) pctLinha = 0;
    if (it.funcionarioId && pctLinha <= 0) {
        var dRecalc = obterDadosComissaoFuncionario(it.funcionarioId, it.tipoMao || 'servico');
        if (dRecalc.pct > 0) {
            pctLinha = dRecalc.pct;
            it.comissaoPct = pctLinha;
            if (!it.funcionarioNome) it.funcionarioNome = dRecalc.nome;
        }
    }
    var comVal = calcularValorComissaoMao(it.valor, pctLinha);
    it.comissaoValor = comVal;
    var tipoLbl = it.tipoMao ? rotuloTipoMaoComissao(it.tipoMao) : 'Serviço';
    var nomeF = it.funcionarioNome || (it.funcionarioId ? 'Funcionário' : 'sem funcionário');
    var extraM = '<div class="muted" style="font-size:0.8rem;margin-top:2px">' +
        esc(tipoLbl) + ' · ' + esc(nomeF);
    if (it.funcionarioId) {
        if (pctLinha > 0) {
            extraM += ' · Comissão <strong style="color:#8fe0b8">' + esc(String(pctLinha)) + '%</strong>' +
                ' = <span class="ganho-linha" style="font-weight:800">' + moeda(comVal) + '</span>';
        } else {
            extraM += ' · <span style="color:#ffb4b4">sem % cadastrada neste tipo</span>';
        }
    }
    extraM += '</div>';
    return '<div class="row" style="margin-bottom:8px;align-items:center">' +
        '<div class="col" style="flex:2"><span style="display:inline-block;margin-right:8px;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:700;background:rgba(47,158,107,0.2);color:#8fe0b8;border:1px solid rgba(47,158,107,0.45)">MÃO DE OBRA</span>' +
        esc(it.desc) + extraM + '</div>' +
        '<div class="col" style="font-weight:800">' + moeda(it.valor) + '</div>' +
        '<div class="col" style="flex:0.5"><button type="button" class="btn btn-danger" data-rm="' + idx + '">×</button></div>' +
        '</div>';
}

function renderItens() {
    var box = document.getElementById('listaItens');
    if (!itensTemp.length) {
        box.innerHTML = '<p class="muted">Nenhuma peça ou mão de obra adicionada.</p>';
        calcTotal();
        return;
    }

    var idxsPeca = [];
    var idxsMao = [];
    itensTemp.forEach(function (it, idx) {
        if ((it.tipo || 'peca') === 'mao') idxsMao.push(idx);
        else idxsPeca.push(idx);
    });

    var html = '';
    html += '<div style="margin:10px 0 6px;padding:6px 0;border-bottom:1px solid rgba(61,160,232,0.45);color:#9fd3ff;font-weight:800;letter-spacing:.04em;font-size:0.82rem">PEÇAS</div>';
    if (!idxsPeca.length) {
        html += '<p class="muted" style="margin:0 0 10px;font-size:0.85rem">Nenhuma peça nesta OS.</p>';
    } else {
        html += idxsPeca.map(function (idx) { return htmlLinhaItemOs(itensTemp[idx], idx); }).join('');
    }
    html += '<div style="margin:16px 0 6px;padding:6px 0;border-bottom:1px solid rgba(47,158,107,0.45);color:#8fe0b8;font-weight:800;letter-spacing:.04em;font-size:0.82rem">MÃO DE OBRA</div>';
    if (!idxsMao.length) {
        html += '<p class="muted" style="margin:0;font-size:0.85rem">Nenhuma mão de obra nesta OS.</p>';
    } else {
        html += idxsMao.map(function (idx) { return htmlLinhaItemOs(itensTemp[idx], idx); }).join('');
    }
    box.innerHTML = html;

    box.querySelectorAll('[data-rm]').forEach(function (b) {
        b.addEventListener('click', function () {
            itensTemp.splice(Number(b.getAttribute('data-rm')), 1);
            renderItens();
        });
    });
    box.querySelectorAll('[data-qtd-mais]').forEach(function (b) {
        b.addEventListener('click', function () {
            var i = Number(b.getAttribute('data-qtd-mais'));
            var it = itensTemp[i];
            if (!it) return;
            aplicarQtdPeca(i, (Number(it.qtd) || 1) + 1);
        });
    });
    box.querySelectorAll('[data-qtd-menos]').forEach(function (b) {
        b.addEventListener('click', function () {
            var i = Number(b.getAttribute('data-qtd-menos'));
            var it = itensTemp[i];
            if (!it) return;
            aplicarQtdPeca(i, Math.max(1, (Number(it.qtd) || 1) - 1));
        });
    });
    box.querySelectorAll('[data-qtd-input]').forEach(function (inp) {
        inp.addEventListener('change', function () {
            aplicarQtdPeca(Number(inp.getAttribute('data-qtd-input')), inp.value);
        });
    });
    calcTotal();
}

function calcTotal() {
    var t = totaisItens(itensTemp);
    document.getElementById('atSubPecas').textContent = moeda(t.pecas);
    var gEl = document.getElementById('atGanhoPecas');
    if (gEl) gEl.textContent = moeda(t.ganhoPecas);
    document.getElementById('atSubMao').textContent = moeda(t.mao);
    document.getElementById('atTotal').textContent = moeda(t.total);
}

function addLinhaValor(tipo, descId, valorId, msgVazio) {
    var desc = document.getElementById(descId).value.trim();
    var valor = parseMoeda(document.getElementById(valorId).value);
    if (!desc) { toast(msgVazio); return; }
    itensTemp.push({ tipo: tipo, desc: desc, valor: valor });
    document.getElementById(descId).value = '';
    document.getElementById(valorId).value = '';
    renderItens();
}

document.getElementById('btnAddItem').addEventListener('click', function () {
    var desc = document.getElementById('itemDesc').value.trim();
    var custoUnit = parseMoeda(document.getElementById('itemCusto').value);
    var valorUnit = parseMoeda(document.getElementById('itemValor').value);
    var qtdRaw = document.getElementById('itemQtd') ? document.getElementById('itemQtd').value : '1';
    var qtd = Math.max(1, Math.round(Number(String(qtdRaw).replace(',', '.')) || 1));
    if (!desc) { toast('Informe a descrição da peça/item.'); return; }
    if (!(valorUnit > 0) && !(custoUnit > 0)) { toast('Informe o valor de venda da peça.'); return; }
    if (!(valorUnit > 0)) valorUnit = custoUnit;

    /* Se já existe a mesma peça (mesmo nome + unitários), só soma a quantidade */
    var iExist = itensTemp.findIndex(function (x) {
        if (!x || (x.tipo || 'peca') === 'mao') return false;
        if (String(x.desc || '').toLowerCase() !== desc.toLowerCase()) return false;
        normalizarPecaItem(x);
        return Number(x.valorUnit) === valorUnit && Number(x.custoUnit) === custoUnit;
    });
    if (iExist >= 0) {
        normalizarPecaItem(itensTemp[iExist]);
        aplicarQtdPeca(iExist, (Number(itensTemp[iExist].qtd) || 1) + qtd);
        document.getElementById('itemDesc').value = '';
        document.getElementById('itemCusto').value = '';
        document.getElementById('itemValor').value = '';
        if (document.getElementById('itemQtd')) document.getElementById('itemQtd').value = '1';
        toast('Quantidade da peça atualizada.');
        return;
    }

    var item = {
        tipo: 'peca',
        desc: desc,
        qtd: qtd,
        custoUnit: custoUnit,
        valorUnit: valorUnit,
        custo: +(custoUnit * qtd).toFixed(2),
        valor: +(valorUnit * qtd).toFixed(2)
    };
    itensTemp.push(item);
    document.getElementById('itemDesc').value = '';
    document.getElementById('itemCusto').value = '';
    document.getElementById('itemValor').value = '';
    if (document.getElementById('itemQtd')) document.getElementById('itemQtd').value = '1';
    renderItens();
});

function rotuloTipoMaoComissao(tipo) {
    if (tipo === 'alinhamento') return 'Alinhamento';
    if (tipo === 'amortecedor') return 'Amortecedor';
    return 'Serviço';
}

function pctComissaoPorTipo(f, tipo) {
    if (!f) return 0;
    var t = tipo || 'servico';
    var pct = 0;
    if (t === 'alinhamento') pct = Number(f.comissaoAlinhamentoPct);
    else if (t === 'amortecedor') pct = Number(f.comissaoAmortecedorPct);
    else pct = Number(f.comissaoServicoPct != null ? f.comissaoServicoPct : f.comissaoPct);
    if (isNaN(pct) || pct < 0) pct = 0;
    /* legado: só tinha comissaoPct */
    if (pct <= 0 && f.comissaoPct != null) {
        var leg = Number(f.comissaoPct);
        if (!isNaN(leg) && leg > 0) pct = leg;
    }
    return pct;
}

function obterDadosComissaoFuncionario(fid, tipoMao) {
    var out = { nome: '', pct: 0, tipo: tipoMao || 'servico' };
    if (!fid) return out;
    var f = null;
    try {
        f = listarFuncionariosInterno().find(function (x) { return x && String(x.id) === String(fid); }) || null;
    } catch (e0) { f = null; }
    if (!f) {
        try {
            comCanalInterno(function () {
                f = (carregar().funcionarios || []).find(function (x) { return x && String(x.id) === String(fid); }) || null;
            });
        } catch (e1) { /* ok */ }
    }
    if (f) {
        out.nome = f.nome || '';
        out.pct = pctComissaoPorTipo(f, out.tipo);
    }
    return out;
}

function calcularValorComissaoMao(valorMo, pct) {
    var base = Number(valorMo) || 0;
    var p = Number(pct) || 0;
    if (base <= 0 || p <= 0) return 0;
    return +(base * p / 100).toFixed(2);
}

function atualizarPreviewComissaoMao() {
    var el = document.getElementById('maoComissaoPreview');
    if (!el) return;
    var fid = document.getElementById('maoFuncId') && document.getElementById('maoFuncId').value;
    var tipo = (document.getElementById('maoTipoComissao') && document.getElementById('maoTipoComissao').value) || 'servico';
    var valor = parseMoeda(document.getElementById('maoValor') && document.getElementById('maoValor').value);
    if (!fid) {
        el.textContent = '';
        return;
    }
    var dados = obterDadosComissaoFuncionario(fid, tipo);
    var com = calcularValorComissaoMao(valor, dados.pct);
    if (!dados.pct) {
        el.textContent = (dados.nome || 'Funcionário') + ' — sem % de ' + rotuloTipoMaoComissao(tipo) + ' no cadastro.';
        el.style.color = '#ffb4b4';
        return;
    }
    el.style.color = '#8fe0b8';
    el.textContent = (dados.nome || 'Funcionário') + ' · ' + rotuloTipoMaoComissao(tipo) +
        ' — comissão agora: ' + moeda(com) + ' (salva no mês em Comissões)';
}

document.getElementById('btnAddMao').addEventListener('click', function () {
    var desc = document.getElementById('maoDesc').value.trim();
    var valor = parseMoeda(document.getElementById('maoValor').value);
    if (!desc) { toast('Informe a descrição da mão de obra.'); return; }
    var fid = document.getElementById('maoFuncId').value;
    var tipoMao = (document.getElementById('maoTipoComissao') && document.getElementById('maoTipoComissao').value) || 'servico';
    var dados = obterDadosComissaoFuncionario(fid, tipoMao);
    var comissaoPct = dados.pct;
    var comissaoValor = calcularValorComissaoMao(valor, comissaoPct);
    itensTemp.push({
        tipo: 'mao',
        tipoMao: tipoMao,
        desc: desc,
        valor: valor,
        funcionarioId: fid || '',
        funcionarioNome: dados.nome || '',
        comissaoPct: comissaoPct,
        comissaoValor: comissaoValor
    });
    document.getElementById('maoDesc').value = '';
    document.getElementById('maoValor').value = '';
    document.getElementById('maoFuncId').value = '';
    atualizarPreviewComissaoMao();
    renderItens();
    if (fid && comissaoValor > 0) {
        toast('MO ' + rotuloTipoMaoComissao(tipoMao) + ' · comissão ' + moeda(comissaoValor) + ' — vai para Comissões ao salvar.');
    }
});

(function ligarPreviewComissaoMao() {
    var v = document.getElementById('maoValor');
    var s = document.getElementById('maoFuncId');
    var t = document.getElementById('maoTipoComissao');
    if (v) {
        v.addEventListener('input', atualizarPreviewComissaoMao);
        v.addEventListener('change', atualizarPreviewComissaoMao);
    }
    if (s) s.addEventListener('change', atualizarPreviewComissaoMao);
    if (t) t.addEventListener('change', atualizarPreviewComissaoMao);
})();

function limparAtendimento() {
    document.getElementById('formAtendimento').reset();
    document.getElementById('atId').value = '';
    document.getElementById('atClienteId').value = '';
    document.getElementById('atClienteBusca').value = '';
    document.getElementById('atEntrada').value = hojeISO();
    document.getElementById('atStatus').value = 'Em andamento';
    document.getElementById('atAgendadoPara').value = '';
    var waTel = document.getElementById('atWaTel');
    if (waTel) waTel.value = '';
    itensTemp = [];
    fotosAtuais = [];
    aplicarChecklistUI({});
    var diag = document.getElementById('atDiagnostico');
    if (diag) diag.value = '';
    renderItens();
    renderGaleriaFotos();
    atualizarPlaca();
    atualizarStatusClienteAt();
    atualizarCampoAgendamentoUI();
    preencherSelectMaoFunc();
}

document.getElementById('btnLimparAt').addEventListener('click', limparAtendimento);
document.getElementById('atStatus').addEventListener('change', atualizarCampoAgendamentoUI);

document.getElementById('atClienteBusca').addEventListener('input', atualizarSugestoesClienteAt);
document.getElementById('atClienteBusca').addEventListener('change', atualizarStatusClienteAt);
document.getElementById('atClienteBusca').addEventListener('focus', function () {
    preencherListaClientesAt(carregar(), this.value);
});
document.getElementById('atClienteBusca').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        preencherListaClientesAt(carregar(), '');
    }
});

document.getElementById('formAtendimento').addEventListener('submit', async function (e) {
    e.preventDefault();
    var db = carregar();
    var resolvido = resolverClienteAtendimento(db, document.getElementById('atClienteBusca').value);
    if (!resolvido.ok) { toast('Informe o nome do cliente (cadastrado ou avulso).'); return; }
    var st = document.getElementById('atStatus').value;
    var agData = document.getElementById('atAgendadoPara').value;
    if (st === 'Agendado' && !agData) {
        toast('Informe a data agendada (ex.: segunda-feira).');
        document.getElementById('atAgendadoPara').focus();
        return;
    }
    var id = document.getElementById('atId').value;
    /* Garante qtd/totais nas peças e comissão gravada em cada mão de obra */
    itensTemp.forEach(function (it) {
        if (!it) return;
        if ((it.tipo || 'peca') !== 'mao') {
            normalizarPecaItem(it);
            return;
        }
        if (!it.tipoMao) it.tipoMao = 'servico';
        if (it.funcionarioId) {
            var dCom = obterDadosComissaoFuncionario(it.funcionarioId, it.tipoMao);
            if (!it.funcionarioNome) it.funcionarioNome = dCom.nome;
            if (!(Number(it.comissaoPct) > 0) && dCom.pct > 0) it.comissaoPct = dCom.pct;
        }
        var pctSave = Number(it.comissaoPct) || 0;
        it.comissaoPct = pctSave;
        it.comissaoValor = calcularValorComissaoMao(it.valor, pctSave);
    });
    var tots = totaisItens(itensTemp);
    var pecas = tots.pecas;
    var mao = tots.mao;
    var payload = {
        id: id || uid(),
        clienteId: resolvido.clienteId,
        clienteNome: resolvido.clienteNome,
        clienteAvulso: resolvido.clienteAvulso,
        clienteCadastro: snapshotClienteCadastro(db, resolvido),
        responsavel: document.getElementById('atResponsavel').value.trim(),
        carro: document.getElementById('atCarro').value.trim(),
        placa: (document.getElementById('atPlaca').value || '').toUpperCase().trim(),
        cidadePlaca: document.getElementById('atCidadePlaca').value.trim(),
        cor: document.getElementById('atCor').value.trim(),
        anoFabricacao: document.getElementById('atAnoFabricacao').value.trim(),
        anoModelo: document.getElementById('atAnoModelo').value.trim(),
        chassi: document.getElementById('atChassi').value.trim(),
        km: document.getElementById('atKm').value,
        entrada: document.getElementById('atEntrada').value,
        saida: document.getElementById('atSaida').value,
        status: document.getElementById('atStatus').value,
        agendadoPara: document.getElementById('atAgendadoPara').value || '',
        checklist: lerChecklistUI(),
        estado: document.getElementById('atEstado').value.trim(),
        diagnostico: (document.getElementById('atDiagnostico') && document.getElementById('atDiagnostico').value.trim()) || '',
        servicos: document.getElementById('atServicos').value.trim(),
        itens: itensTemp.slice(),
        fotos: fotosAtuais.map(function (f) {
            return { id: f.id || uid(), data: f.data || null, url: f.url || null };
        }).filter(function (f) { return f.data || f.url; }),
        maoObra: mao,
        totalPecas: pecas,
        custoPecas: tots.custoPecas,
        ganhoPecas: tots.ganhoPecas,
        total: tots.total,
        atualizadoEm: new Date().toISOString()
    };

    /* Comprime todas as fotos antes de gravar/subir */
    if (payload.fotos && payload.fotos.length) {
        for (var pf = 0; pf < payload.fotos.length; pf++) {
            if (payload.fotos[pf] && payload.fotos[pf].data) {
                payload.fotos[pf].data = await garantirFotoComprimida(payload.fotos[pf].data);
            }
        }
        fotosAtuais = payload.fotos.map(function (f) {
            return { id: f.id, data: f.data || null, url: f.url || null };
        });
    }

    if (id) {
        var i = db.atendimentos.findIndex(function (a) { return a.id === id; });
        if (i >= 0) db.atendimentos[i] = Object.assign({}, db.atendimentos[i], payload);
    } else {
        payload.criadoEm = new Date().toISOString();
        db.atendimentos.push(payload);
    }
    limparExcluido(db, 'atendimentos', payload.id);
    salvar(db);

    var extras = [];
    try {
        var pasta = await salvarAtendimentoNaPastaPC(payload, resolvido.clienteNome);
        if (pasta.ok) extras.push('PC: ' + pasta.pasta);
    } catch (errPasta) { /* opcional */ }

    var cfgN = carregarConfigNuvem();
    if (cfgN && cfgN.apiKey && cfgN.projectId) {
        try {
            var okSess = usuarioNuvemLogado() || await garantirSessaoNuvemQualquer();
            if (!okSess) {
                extras.push('nuvem: sem auth (ative Anônimo no Firebase)');
            } else if (sessaoFuncionarioId) {
                var nuvF = await enviarAtendimentoNuvem(payload);
                if (nuvF.ok) {
                    extras.push('nuvem OK (fotos comprimidas)');
                    var dbF = carregar();
                    var ixF = dbF.atendimentos.findIndex(function (a) { return a.id === payload.id; });
                    if (ixF >= 0 && nuvF.atendimento) {
                        var locF = dbF.atendimentos[ixF].fotos || payload.fotos || [];
                        var nuvFotosF = nuvF.atendimento.fotos || [];
                        dbF.atendimentos[ixF].fotos = nuvFotosF.map(function (fn, idx) {
                            var fl = locF.find(function (x) { return x && fn && x.id === fn.id; }) || locF[idx] || {};
                            return {
                                id: (fn && fn.id) || fl.id || uid(),
                                data: fl.data || null,
                                url: fl.url || (fn && fn.url) || null
                            };
                        });
                        dbF.atendimentos[ixF].syncNuvemEm = new Date().toISOString();
                        salvar(dbF);
                    }
                } else extras.push('nuvem: ' + (nuvF.motivo || 'falhou'));
            } else {
                await enviarBaseNuvem(carregar());
                var nuv = await enviarAtendimentoNuvem(payload);
                if (nuv.ok) {
                    extras.push('nuvem OK (fotos comprimidas)');
                    if (nuv.atendimento && nuv.atendimento.fotos) {
                        var db2 = carregar();
                        var ix = db2.atendimentos.findIndex(function (a) { return a.id === payload.id; });
                        if (ix >= 0) {
                            var locais = db2.atendimentos[ix].fotos || payload.fotos || [];
                            var nuvFotos = nuv.atendimento.fotos || [];
                            db2.atendimentos[ix].fotos = nuvFotos.map(function (fn, idx) {
                                var fl = locais.find(function (x) { return x && fn && x.id === fn.id; }) || locais[idx] || {};
                                return {
                                    id: (fn && fn.id) || fl.id || uid(),
                                    data: fl.data || null,
                                    url: fl.url || (fn && fn.url) || null
                                };
                            });
                            if (!db2.atendimentos[ix].fotos.length && locais.length) {
                                db2.atendimentos[ix].fotos = locais;
                            }
                            db2.atendimentos[ix].syncNuvemEm = new Date().toISOString();
                            salvar(db2);
                        }
                    }
                } else extras.push('nuvem: ' + (nuv.motivo || 'falhou'));
            }
        } catch (errN) {
            extras.push('nuvem: erro');
        }
    }

    toast(
        (id ? 'Atendimento atualizado' : 'Atendimento salvo') +
        (resolvido.clienteAvulso ? ' (cliente avulso)' : '') +
        (extras.length ? ' · ' + extras.join(' · ') : '.')
    );
    limparAtendimento();
    renderHistorico();
    atualizarKPIs(carregar());
});

function editarAtendimento(id) {
    var db = carregar();
    var a = db.atendimentos.find(function (x) { return x.id === id; });
    if (!a) return;
    abrirPainel('painelVeiculo');
    document.getElementById('atId').value = a.id;
    document.getElementById('atClienteId').value = a.clienteId || '';
    document.getElementById('atClienteBusca').value = a.clienteAvulso
        ? (a.clienteNome || '')
        : (a.clienteNome || nomeCliente(db, a.clienteId));
    atualizarStatusClienteAt();
    var waTel = document.getElementById('atWaTel');
    if (waTel) {
        waTel.value = telefoneDoAtendimento(db, a) || waTel.value || '';
    }
    document.getElementById('atResponsavel').value = a.responsavel || '';
    document.getElementById('atCarro').value = a.carro || '';
    document.getElementById('atPlaca').value = a.placa || '';
    document.getElementById('atCidadePlaca').value = a.cidadePlaca || '';
    document.getElementById('atCor').value = a.cor || '';
    document.getElementById('atAnoFabricacao').value = a.anoFabricacao || '';
    document.getElementById('atAnoModelo').value = a.anoModelo || '';
    document.getElementById('atChassi').value = a.chassi || '';
    document.getElementById('atKm').value = a.km || '';
    document.getElementById('atEntrada').value = a.entrada || '';
    document.getElementById('atSaida').value = a.saida || '';
    document.getElementById('atStatus').value = a.status || 'Em andamento';
    document.getElementById('atAgendadoPara').value = a.agendadoPara || '';
    atualizarCampoAgendamentoUI();
    document.getElementById('atEstado').value = a.estado || '';
    aplicarChecklistUI(a.checklist || {});
    var diagEl = document.getElementById('atDiagnostico');
    if (diagEl) diagEl.value = a.diagnostico || '';
    document.getElementById('atServicos').value = a.servicos || '';
    preencherSelectMaoFunc();
    itensTemp = (a.itens || []).map(function (it) {
        var fid = it.funcionarioId || '';
        var tipoMao = it.tipoMao || 'servico';
        var pct = it.comissaoPct != null ? Number(it.comissaoPct) : NaN;
        var nome = it.funcionarioNome || '';
        if (fid && ((it.tipo || '') === 'mao')) {
            var dados = obterDadosComissaoFuncionario(fid, tipoMao);
            if (!nome) nome = dados.nome;
            if (isNaN(pct) || pct <= 0) pct = dados.pct;
        }
        if (isNaN(pct)) pct = 0;
        var valorMo = Number(it.valor) || 0;
        var comVal = it.comissaoValor != null
            ? Number(it.comissaoValor)
            : calcularValorComissaoMao(valorMo, pct);
        var row = {
            tipo: it.tipo || 'peca',
            tipoMao: tipoMao,
            desc: it.desc || '',
            valor: valorMo,
            custo: Number(it.custo) || 0,
            qtd: it.qtd != null ? Number(it.qtd) : 1,
            valorUnit: it.valorUnit != null ? Number(it.valorUnit) : null,
            custoUnit: it.custoUnit != null ? Number(it.custoUnit) : null,
            funcionarioId: fid,
            funcionarioNome: nome,
            comissaoPct: pct,
            comissaoValor: comVal
        };
        if ((row.tipo || 'peca') !== 'mao') normalizarPecaItem(row);
        return row;
    });
    /* Compatibilidade: valor único antigo de mão de obra vira um item */
    var temMaoNaLista = itensTemp.some(function (it) { return it.tipo === 'mao'; });
    if (!temMaoNaLista && Number(a.maoObra) > 0) {
        itensTemp.push({ tipo: 'mao', desc: 'Mão de obra', valor: Number(a.maoObra) || 0 });
    }
    renderItens();
    carregarFotosNoForm(a.fotos);
    atualizarPlaca();
}

function excluirAtendimento(id) {
    if (!confirm('Excluir este atendimento?')) return;
    var db = carregar();
    marcarExcluido(db, 'atendimentos', id);
    db.atendimentos = db.atendimentos.filter(function (a) { return a.id !== id; });
    salvar(db);
    toast('Atendimento excluído.');
    renderHistorico();
    atualizarKPIs(db);
}

function opcoesStatusAt(atual) {
    var opts = ['Agendado', 'Em andamento', 'Aguardando peça', 'Pronto', 'Entregue'];
    return opts.map(function (s) {
        var label = s === 'Agendado' ? '📅 Agendado' : s;
        return '<option value="' + s + '"' + (s === atual ? ' selected' : '') + '>' + label + '</option>';
    }).join('');
}

function atualizarCampoAgendamentoUI() {
    var st = document.getElementById('atStatus');
    var wrap = document.getElementById('wrapAgendadoPara');
    var hint = document.getElementById('hintAgendado');
    var ag = document.getElementById('atAgendadoPara');
    if (!st || !wrap) return;
    var ehAg = st.value === 'Agendado';
    wrap.style.display = '';
    if (hint) hint.style.display = ehAg ? '' : 'none';
    if (ehAg && ag && !ag.value) ag.value = hojeISO();
}

function alterarStatusAtendimento(id, novoStatus) {
    var db = carregar();
    var i = db.atendimentos.findIndex(function (a) { return a.id === id; });
    if (i < 0) return;
    var a = db.atendimentos[i];
    if (novoStatus === 'Agendado') {
        var sugestao = a.agendadoPara || hojeISO();
        var d = prompt('Data do agendamento (ex.: segunda-feira).\nDigite no formato AAAA-MM-DD:', sugestao);
        if (d === null) {
            renderHistorico();
            return;
        }
        d = String(d || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            toast('Data inválida. Use AAAA-MM-DD (ex.: 2026-08-03).');
            renderHistorico();
            return;
        }
        a.agendadoPara = d;
    }
    a.status = novoStatus;
    a.atualizadoEm = new Date().toISOString();
    salvar(db);
    toast(novoStatus === 'Agendado'
        ? 'Agendado para ' + fmtData(a.agendadoPara)
        : 'Status: ' + novoStatus);
    renderHistorico();
}

