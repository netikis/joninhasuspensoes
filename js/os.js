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

    var tipoMaoLinha = it.tipoMao || 'servico';
    var dadosLinha = it.funcionarioId ? obterDadosComissaoFuncionario(it.funcionarioId, tipoMaoLinha) : { pct: 0, valorFixo: 0, nome: '' };
    var pctLinha = Number(it.comissaoPct);
    if (isNaN(pctLinha)) pctLinha = 0;
    if (!ehTipoMaoAmortOriginal(tipoMaoLinha) && it.funcionarioId && pctLinha <= 0 && dadosLinha.pct > 0) {
        pctLinha = dadosLinha.pct;
        it.comissaoPct = pctLinha;
        if (!it.funcionarioNome) it.funcionarioNome = dadosLinha.nome;
    }
    var comVal = valorComissaoDoItemMao(it, dadosLinha);
    it.comissaoValor = comVal;
    var tipoLbl = it.tipoMao ? rotuloTipoMaoComissao(it.tipoMao) : 'Serviço';
    var nomeF = it.funcionarioNome || (it.funcionarioId ? 'Funcionário' : 'sem funcionário');
    var extraM = '<div class="muted" style="font-size:0.8rem;margin-top:2px">' +
        esc(tipoLbl) + ' · ' + esc(nomeF);
    if (it.funcionarioId) {
        if (ehTipoMaoAmortOriginal(tipoMaoLinha)) {
            if (comVal > 0) {
                extraM += ' · Pagamento fixo <span class="ganho-linha" style="font-weight:800">' + moeda(comVal) + '</span>';
            } else {
                extraM += ' · <span style="color:#ffb4b4">sem R$ cadastrado neste tipo</span>';
            }
        } else if (pctLinha > 0) {
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

function faixaAmortecedorOriginal(tipo) {
    if (tipo === 'amortecedor-original-2' || tipo === 'amortecedorOriginal2') return 2;
    if (tipo === 'amortecedor-original' || tipo === 'amortecedorOriginal') return 1;
    return 0;
}

function rotuloTipoMaoComissao(tipo) {
    if (tipo === 'alinhamento') return 'Alinhamento';
    var faixaOrig = faixaAmortecedorOriginal(tipo);
    if (faixaOrig === 2) return 'Amortecedor original 2';
    if (faixaOrig === 1) return 'Amortecedor original 1';
    if (tipo === 'amortecedor') return 'Amortecedor';
    return 'Serviço';
}

function ehTipoMaoAmortOriginal(tipo) {
    return faixaAmortecedorOriginal(tipo) > 0;
}

function valorFixoAmortecedorOriginal(f, tipo) {
    if (!f) return 0;
    var faixa = faixaAmortecedorOriginal(tipo || 'amortecedor-original');
    var v = faixa === 2
        ? Number(f.comissaoAmortecedorOriginalValor2)
        : Number(f.comissaoAmortecedorOriginalValor);
    if (isNaN(v) || v < 0) v = 0;
    return +v.toFixed(2);
}

function pctComissaoPorTipo(f, tipo) {
    if (!f) return 0;
    var t = tipo || 'servico';
    if (ehTipoMaoAmortOriginal(t)) return 0;
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
    var out = { nome: '', pct: 0, valorFixo: 0, tipo: tipoMao || 'servico' };
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
        if (ehTipoMaoAmortOriginal(out.tipo)) {
            out.valorFixo = valorFixoAmortecedorOriginal(f, out.tipo);
            out.pct = 0;
        } else {
            out.pct = pctComissaoPorTipo(f, out.tipo);
        }
    }
    return out;
}

function valorComissaoDoItemMao(it, dados) {
    var tipo = (it && it.tipoMao) || (dados && dados.tipo) || 'servico';
    if (ehTipoMaoAmortOriginal(tipo)) {
        if (dados && Number(dados.valorFixo) > 0) return +Number(dados.valorFixo).toFixed(2);
        var vFix = it && it.comissaoValor != null ? Number(it.comissaoValor) : 0;
        return vFix > 0 ? +vFix.toFixed(2) : 0;
    }
    var pct = (dados && Number(dados.pct) > 0) ? Number(dados.pct) : (it && Number(it.comissaoPct)) || 0;
    return calcularValorComissaoMao(it && it.valor, pct);
}

function calcularValorComissaoMao(valorMo, pct) {
    var base = Number(valorMo) || 0;
    var p = Number(pct) || 0;
    if (base <= 0 || p <= 0) return 0;
    return +(base * p / 100).toFixed(2);
}

function atualizarRotulosTipoMaoOriginal() {
    var sel = document.getElementById('maoTipoComissao');
    if (!sel) return;
    var fid = document.getElementById('maoFuncId') && document.getElementById('maoFuncId').value;
    var d1 = fid ? obterDadosComissaoFuncionario(fid, 'amortecedor-original') : { valorFixo: 0 };
    var d2 = fid ? obterDadosComissaoFuncionario(fid, 'amortecedor-original-2') : { valorFixo: 0 };
    function setOpt(val, base, v) {
        var o = sel.querySelector('option[value="' + val + '"]');
        if (!o) return;
        o.textContent = (v > 0) ? (base + ' (' + moeda(v) + ')') : base;
    }
    setOpt('amortecedor-original', 'Mão de obra — Amortecedor original 1', d1.valorFixo);
    setOpt('amortecedor-original-2', 'Mão de obra — Amortecedor original 2', d2.valorFixo);
}

function atualizarPreviewComissaoMao() {
    atualizarRotulosTipoMaoOriginal();
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
    if (ehTipoMaoAmortOriginal(tipo)) {
        var faixaLbl = rotuloTipoMaoComissao(tipo);
        if (!(dados.valorFixo > 0)) {
            el.textContent = (dados.nome || 'Funcionário') + ' — sem R$ de ' + faixaLbl.toLowerCase() + ' no cadastro.';
            el.style.color = '#ffb4b4';
            return;
        }
        el.style.color = '#8fe0b8';
        el.textContent = (dados.nome || 'Funcionário') + ' · ' + faixaLbl + ' — recebe ' +
            moeda(dados.valorFixo) + ' (valor fixo do cadastro)';
        return;
    }
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
    var comissaoPct = ehTipoMaoAmortOriginal(tipoMao) ? 0 : dados.pct;
    var comissaoValor = valorComissaoDoItemMao({ tipoMao: tipoMao, valor: valor, comissaoPct: comissaoPct }, dados);
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

window._mapaEnterOs = {
    itemDesc: 'btnAddItem',
    itemCusto: 'btnAddItem',
    itemValor: 'btnAddItem',
    itemQtd: 'btnAddItem',
    maoDesc: 'btnAddMao',
    maoValor: 'btnAddMao',
    maoTipoComissao: 'btnAddMao',
    maoFuncId: 'btnAddMao'
};
window._osEnterLock = 0;
window._osSalvando = false;

(function ligarEnterPecaMaoOs() {
    function tecla(e) {
        if (typeof teclaEhEnter === 'function') return teclaEhEnter(e);
        return !!(e && (e.key === 'Enter' || e.key === 'NumpadEnter' || e.keyCode === 13) && !e.isComposing);
    }
    function clicarAdd(botaoId, ev) {
        var ts = ev && ev.timeStamp;
        if (ts && ts === window._osEnterLock) return;
        window._osEnterLock = ts || Date.now();
        var btnAdd = document.getElementById(botaoId);
        if (btnAdd) btnAdd.click();
    }
    document.addEventListener('keydown', function (e) {
        if (!tecla(e)) return;
        var t = e.target;
        if (!t || t.tagName === 'TEXTAREA') return;
        var botaoId = window._mapaEnterOs[t.id];
        if (!botaoId) return;
        e.preventDefault();
        e.stopPropagation();
        clicarAdd(botaoId, e);
    }, true);
    if (typeof window.enterClicaBotao === 'function') {
        window.enterClicaBotao(['itemDesc', 'itemCusto', 'itemValor', 'itemQtd'], 'btnAddItem');
        window.enterClicaBotao(['maoDesc', 'maoValor', 'maoTipoComissao', 'maoFuncId'], 'btnAddMao');
    }
    var btnS = document.getElementById('btnSalvarAt');
    if (btnS && !btnS.getAttribute('data-os-save')) {
        btnS.setAttribute('data-os-save', '1');
        btnS.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof salvarAtendimentoAtual === 'function') salvarAtendimentoAtual();
        });
    }
    var formS = document.getElementById('formAtendimento');
    if (formS && !formS.getAttribute('data-os-save')) {
        formS.setAttribute('data-os-save', '1');
        formS.addEventListener('submit', function (e) {
            e.preventDefault();
            if (typeof salvarAtendimentoAtual === 'function') salvarAtendimentoAtual();
        });
    }
})();

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
    var card = document.getElementById('atClienteCard');
    if (card) {
        card.style.display = 'none';
        card.innerHTML = '';
    }
    if (typeof esconderSugestoesClienteAt === 'function') esconderSugestoesClienteAt();
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
        if (typeof esconderSugestoesClienteAt === 'function') esconderSugestoesClienteAt();
        return;
    }
    if (e.key === 'Enter' || e.key === 'NumpadEnter' || e.keyCode === 13) {
        if (typeof selecionarPrimeiraSugestaoClienteAt === 'function' && selecionarPrimeiraSugestaoClienteAt()) {
            e.preventDefault();
        }
    }
});
(function ligarCliqueSugestaoClienteAt() {
    var box = document.getElementById('sugestoesClienteAt');
    if (!box || box.getAttribute('data-cli-sug')) return;
    box.setAttribute('data-cli-sug', '1');
    box.addEventListener('mousedown', function (e) {
        var btn = e.target.closest('[data-cli-id]');
        if (!btn || !box.contains(btn)) return;
        e.preventDefault();
        var db = carregar();
        var c = (db.clientes || []).find(function (x) { return String(x.id) === String(btn.getAttribute('data-cli-id')); });
        if (c && typeof selecionarClienteAtendimento === 'function') selecionarClienteAtendimento(c);
    });
    document.addEventListener('mousedown', function (e) {
        if (!box.hidden && !box.contains(e.target) && e.target.id !== 'atClienteBusca') {
            if (typeof esconderSugestoesClienteAt === 'function') esconderSugestoesClienteAt();
        }
    });
})();

function teclaEnterOs(e) {
    if (typeof teclaEhEnter === 'function') return teclaEhEnter(e);
    return !!(e && (e.key === 'Enter' || e.key === 'NumpadEnter' || e.keyCode === 13) && !e.isComposing);
}

function mostrarErroSalvarOs(msg, focusId) {
    var errEl = document.getElementById('atSalvarErro');
    if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
    }
    toast(msg);
    var foco = focusId ? document.getElementById(focusId) : null;
    if (foco) {
        try { foco.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (eScr) { /* ok */ }
        try { foco.focus(); } catch (eFoco) { /* ok */ }
    }
}

function aplicarFotosNuvemNoAtendimento(payload, nuvAt) {
    if (!payload || !nuvAt) return;
    var dbX = carregar();
    var ix = dbX.atendimentos.findIndex(function (a) { return a.id === payload.id; });
    if (ix < 0) return;
    var locais = dbX.atendimentos[ix].fotos || payload.fotos || [];
    var nuvFotos = nuvAt.fotos || [];
    if (nuvFotos.length) {
        dbX.atendimentos[ix].fotos = nuvFotos.map(function (fn, idx) {
            var fl = locais.find(function (x) { return x && fn && x.id === fn.id; }) || locais[idx] || {};
            return {
                id: (fn && fn.id) || fl.id || uid(),
                data: fl.data || null,
                url: fl.url || (fn && fn.url) || null
            };
        });
        if (!dbX.atendimentos[ix].fotos.length && locais.length) {
            dbX.atendimentos[ix].fotos = locais;
        }
    }
    dbX.atendimentos[ix].syncNuvemEm = new Date().toISOString();
    salvar(dbX);
}

async function extrasPosSalvarAtendimento(payload, resolvido) {
    var extras = [];
    try {
        if (typeof salvarAtendimentoNaPastaPC === 'function') {
            var pasta = await salvarAtendimentoNaPastaPC(payload, resolvido.clienteNome);
            if (pasta && pasta.ok) extras.push('PC: ' + pasta.pasta);
        }
    } catch (errPasta) { /* opcional — não pode travar a tela */ }

    var cfgN = typeof carregarConfigNuvem === 'function' ? carregarConfigNuvem() : null;
    if (!(cfgN && cfgN.apiKey && cfgN.projectId)) return extras;
    try {
        var okSess = (typeof usuarioNuvemLogado === 'function' && usuarioNuvemLogado()) ||
            (typeof garantirSessaoNuvemQualquer === 'function' && await garantirSessaoNuvemQualquer());
        if (!okSess) {
            extras.push('nuvem: sem auth');
            return extras;
        }
        if (sessaoFuncionarioId) {
            var nuvF = await enviarAtendimentoNuvem(payload);
            if (nuvF && nuvF.ok) {
                extras.push('nuvem OK');
                aplicarFotosNuvemNoAtendimento(payload, nuvF.atendimento);
            } else extras.push('nuvem: ' + ((nuvF && nuvF.motivo) || 'falhou'));
        } else {
            if (typeof enviarBaseNuvem === 'function') await enviarBaseNuvem(carregar());
            var nuv = await enviarAtendimentoNuvem(payload);
            if (nuv && nuv.ok) {
                extras.push('nuvem OK');
                aplicarFotosNuvemNoAtendimento(payload, nuv.atendimento);
            } else extras.push('nuvem: ' + ((nuv && nuv.motivo) || 'falhou'));
        }
    } catch (errN) {
        extras.push('nuvem: erro');
    }
    return extras;
}

async function salvarAtendimentoAtual() {
    if (window._osSalvando) return;
    var errEl = document.getElementById('atSalvarErro');
    if (errEl) {
        errEl.style.display = 'none';
        errEl.textContent = '';
    }
    var db = carregar();
    var resolvido = resolverClienteAtendimento(db, document.getElementById('atClienteBusca').value);
    if (!resolvido.ok) {
        mostrarErroSalvarOs('Informe o nome do cliente (cadastrado ou avulso).', 'atClienteBusca');
        return;
    }
    var st = document.getElementById('atStatus').value;
    var agData = document.getElementById('atAgendadoPara').value;
    if (st === 'Agendado' && !agData) {
        mostrarErroSalvarOs('Informe a data agendada.', 'atAgendadoPara');
        return;
    }
    var id = document.getElementById('atId').value;
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
            if (ehTipoMaoAmortOriginal(it.tipoMao)) {
                it.comissaoPct = 0;
                it.comissaoValor = valorComissaoDoItemMao(it, dCom);
                return;
            }
            if (!(Number(it.comissaoPct) > 0) && dCom.pct > 0) it.comissaoPct = dCom.pct;
        }
        if (ehTipoMaoAmortOriginal(it.tipoMao)) {
            it.comissaoPct = 0;
            it.comissaoValor = Number(it.comissaoValor) || 0;
            return;
        }
        var pctSave = Number(it.comissaoPct) || 0;
        it.comissaoPct = pctSave;
        it.comissaoValor = calcularValorComissaoMao(it.valor, pctSave);
    });
    var tots = totaisItens(itensTemp);
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
        maoObra: tots.mao,
        totalPecas: tots.pecas,
        custoPecas: tots.custoPecas,
        ganhoPecas: tots.ganhoPecas,
        total: tots.total,
        atualizadoEm: new Date().toISOString()
    };

    var btn = document.getElementById('btnSalvarAt');
    var txtBtn = btn ? btn.textContent : '';
    window._osSalvando = true;
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
    }
    try {
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
            else db.atendimentos.push(payload);
        } else {
            payload.criadoEm = new Date().toISOString();
            db.atendimentos.push(payload);
        }
        limparExcluido(db, 'atendimentos', payload.id);
        salvar(db);

        toast(
            (id ? 'Atendimento atualizado' : 'Atendimento salvo') +
            (resolvido.clienteAvulso ? ' (cliente avulso). ' : '. ') +
            'Pode começar outra OS.'
        );
        limparAtendimento();
        renderHistorico();
        atualizarKPIs(carregar());
        if (typeof abrirPainel === 'function') abrirPainel('painelVeiculo');
        try { window.scrollTo(0, 0); } catch (eScr) { /* ok */ }
        setTimeout(function () {
            limparAtendimento();
            var buscaNova = document.getElementById('atClienteBusca');
            if (buscaNova) buscaNova.value = '';
            if (typeof atualizarStatusClienteAt === 'function') atualizarStatusClienteAt();
        }, 40);

        extrasPosSalvarAtendimento(payload, resolvido).then(function (extras) {
            if (extras && extras.length) toast('Sync: ' + extras.join(' · '));
        }).catch(function () { /* ok */ });
    } catch (errSave) {
        console.warn('salvarAtendimentoAtual', errSave);
        mostrarErroSalvarOs('Não deu para salvar. Tente de novo.', null);
    } finally {
        window._osSalvando = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = txtBtn || 'Salvar Atendimento';
        }
    }
}

(function ligarSalvarAtendimentoOs() {
    var btn = document.getElementById('btnSalvarAt');
    if (btn && !btn.getAttribute('data-os-save')) {
        btn.setAttribute('data-os-save', '1');
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            salvarAtendimentoAtual();
        });
    }
    var form = document.getElementById('formAtendimento');
    if (form && !form.getAttribute('data-os-save')) {
        form.setAttribute('data-os-save', '1');
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            salvarAtendimentoAtual();
        });
    }
})();

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
            if (ehTipoMaoAmortOriginal(tipoMao)) {
                pct = 0;
            } else if (isNaN(pct) || pct <= 0) pct = dados.pct;
        }
        if (isNaN(pct)) pct = 0;
        var valorMo = Number(it.valor) || 0;
        var comVal = ehTipoMaoAmortOriginal(tipoMao)
            ? valorComissaoDoItemMao({ tipoMao: tipoMao, valor: valorMo, comissaoValor: it.comissaoValor }, fid ? obterDadosComissaoFuncionario(fid, tipoMao) : { valorFixo: 0, tipo: tipoMao })
            : (it.comissaoValor != null
                ? Number(it.comissaoValor)
                : calcularValorComissaoMao(valorMo, pct));
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

