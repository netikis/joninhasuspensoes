'use strict';
/* Joninha — OS / atendimento / fotos (etapa 2.2) */

function placaDeTextoLivre(txt) {
    var u = String(txt || '').toUpperCase();
    var m = u.match(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/) || u.match(/\b([A-Z]{3}\d{4})\b/);
    return m ? m[1] : '';
}

function acharAtendimentoPorId(id, placaHint) {
    var hit = acharAtendimentoComDb(id, placaHint);
    return hit ? hit.a : null;
}

function acharAtendimentoComDb(id, placaHint) {
    function buscar(db) {
        if (!db) return null;
        var lista = db.atendimentos || [];
        var alvo = String(id || '').trim();
        var a = alvo ? lista.find(function (x) { return x && String(x.id) === alvo; }) : null;
        if (!a) {
            var pl = placaDeTextoLivre(placaHint);
            if (pl) {
                var hits = lista.filter(function (x) {
                    return x && placaDeTextoLivre(x.placa) === pl;
                });
                if (hits.length) {
                    hits.sort(function (x, y) {
                        var tx = 0;
                        var ty = 0;
                        try {
                            if (typeof valorTotalAtendimentoOs === 'function') {
                                tx = valorTotalAtendimentoOs(x);
                                ty = valorTotalAtendimentoOs(y);
                            } else {
                                tx = Number(x.total) || 0;
                                ty = Number(y.total) || 0;
                            }
                        } catch (eT) { /* ok */ }
                        if (ty !== tx) return ty - tx;
                        return String(y.atualizadoEm || y.criadoEm || '').localeCompare(String(x.atualizadoEm || x.criadoEm || ''));
                    });
                    a = hits[0];
                }
            }
        }
        return a ? { a: a, db: db } : null;
    }
    function maisCompleto(r1, r2) {
        if (!r1) return r2;
        if (!r2) return r1;
        var t1 = Number(r1.a && r1.a.total) || 0;
        var t2 = Number(r2.a && r2.a.total) || 0;
        var n1 = ((r1.a && r1.a.itens) || []).length;
        var n2 = ((r2.a && r2.a.itens) || []).length;
        if (n2 > n1) return r2;
        if (n1 > n2) return r1;
        if (t2 > t1 + 0.05) return r2;
        return r1;
    }
    var rLocal = buscar(typeof carregar === 'function' ? carregar() : null);
    var rMain = null;
    try {
        if (typeof carregarMain === 'function') rMain = buscar(carregarMain());
    } catch (eMain) { rMain = null; }
    return maisCompleto(rLocal, rMain);
}

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
    recalcularComissaoItemOs(it);
    renderItens();
}

var osItemEditIdx = null;

function cancelarEdicaoItemOs() {
    osItemEditIdx = null;
    var bP = document.getElementById('btnAddItem');
    var bM = document.getElementById('btnAddMao');
    if (bP) bP.textContent = '+ Peça';
    if (bM) bM.textContent = '+ Mão de obra';
}

function iniciarEdicaoItemOs(idx) {
    var it = itensTemp[idx];
    if (!it) return;
    if (osItemEditIdx === idx) {
        cancelarEdicaoItemOs();
        renderItens();
        return;
    }
    osItemEditIdx = idx;
    if ((it.tipo || 'peca') === 'mao') {
        document.getElementById('maoDesc').value = it.desc || '';
        document.getElementById('maoValor').value = fmtNumOs(it.valor);
        var selF = document.getElementById('maoFuncId');
        if (selF) selF.value = it.funcionarioId || '';
        var selT = document.getElementById('maoTipoComissao');
        if (selT) selT.value = it.tipoMao || 'servico';
        document.getElementById('btnAddMao').textContent = 'Salvar mão de obra';
        document.getElementById('btnAddItem').textContent = '+ Peça';
        if (typeof atualizarPreviewComissaoMao === 'function') atualizarPreviewComissaoMao();
        try {
            document.getElementById('maoValor').scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById('maoValor').focus();
            document.getElementById('maoValor').select();
        } catch (eF) { /* ok */ }
    } else {
        normalizarPecaItem(it);
        document.getElementById('itemDesc').value = it.desc || '';
        document.getElementById('itemCusto').value = fmtNumOs(it.custoUnit);
        document.getElementById('itemValor').value = fmtNumOs(it.valorUnit);
        if (document.getElementById('itemQtd')) document.getElementById('itemQtd').value = String(it.qtd || 1);
        var selPF = document.getElementById('pecaFuncId');
        if (selPF) selPF.value = it.funcionarioId || '';
        var selPT = document.getElementById('pecaTipoComissao');
        if (selPT) selPT.value = it.tipoMao || '';
        document.getElementById('btnAddItem').textContent = 'Salvar peça';
        document.getElementById('btnAddMao').textContent = '+ Mão de obra';
        if (typeof atualizarPreviewComissaoPeca === 'function') atualizarPreviewComissaoPeca();
        try {
            document.getElementById('itemValor').scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById('itemValor').focus();
            document.getElementById('itemValor').select();
        } catch (eF2) { /* ok */ }
    }
    toast('Altere o valor e clique em Salvar na linha de cima.');
    renderItens();
}

function aplicarValorLinhaPeca(idx, campo, raw) {
    var it = itensTemp[idx];
    if (!it || (it.tipo || 'peca') === 'mao') return;
    normalizarPecaItem(it);
    var n = parseMoeda(raw);
    if (n < 0) n = 0;
    if (campo === 'custo')     it.custoUnit = n;
    else it.valorUnit = n;
    normalizarPecaItem(it);
    recalcularComissaoItemOs(it);
    renderItens();
}

function aplicarValorLinhaMao(idx, raw) {
    var it = itensTemp[idx];
    if (!it || it.tipo !== 'mao') return;
    it.valor = parseMoeda(raw);
    if (it.valor < 0) it.valor = 0;
    var dados = it.funcionarioId ? obterDadosComissaoFuncionario(it.funcionarioId, it.tipoMao || 'servico') : { pct: 0, valorFixo: 0 };
    it.comissaoValor = valorComissaoDoItemMao(it, dados);
    renderItens();
}

function htmlLinhaItemOs(it, idx) {
    var tipo = it.tipo || 'peca';
    var editando = osItemEditIdx === idx;
    var clsEdit = editando ? ' os-item-editando' : '';
    var btnEditTxt = editando ? 'Cancelar' : 'Editar';
    if (tipo === 'peca') {
        normalizarPecaItem(it);
        var extraP = '<div class="os-item-edit-row">' +
            '<label>Custo un. <input class="os-edit-val" inputmode="decimal" data-edit-custo="' + idx + '" value="' +
            esc(fmtNumOs(it.custoUnit)) + '" title="Custo unitário"></label>' +
            '<label>Venda un. <input class="os-edit-val" inputmode="decimal" data-edit-venda="' + idx + '" value="' +
            esc(fmtNumOs(it.valorUnit)) + '" title="Venda unitária"></label>' +
            '<span>Total custo ' + moeda(it.custo) +
            ' · Ganho <span class="ganho-linha">' + moeda(ganhoItem(it)) + '</span></span></div>';
        if (it.funcionarioId && it.tipoMao) {
            var tipoPecaLbl = rotuloTipoMaoComissao(it.tipoMao);
            var nomePecaF = it.funcionarioNome || 'Funcionário';
            extraP += '<div class="muted" style="font-size:0.8rem;margin-top:2px">' +
                esc(nomePecaF) + ' · ' + esc(tipoPecaLbl);
            if (Number(it.comissaoValor) > 0.009) {
                extraP += ' · Comissão <span class="ganho-linha" style="font-weight:800">' + moeda(it.comissaoValor) + '</span>';
            }
            extraP += '</div>';
        }
        return '<div class="row os-item-linha' + clsEdit + '" style="margin-bottom:8px;align-items:center;gap:6px">' +
            '<div class="col" style="flex:2"><span class="os-tag os-tag-peca">PEÇA</span>' +
            esc(it.desc) + extraP + '</div>' +
            '<div class="col" style="flex:1.1;display:flex;align-items:center;gap:4px">' +
            '<button type="button" class="btn btn-secondary" data-qtd-menos="' + idx + '" style="padding:4px 10px;min-width:36px">−</button>' +
            '<input type="number" min="1" step="1" value="' + esc(String(it.qtd)) + '" data-qtd-input="' + idx + '" ' +
            'style="width:64px;text-align:center;padding:6px;font-weight:700" title="Quantidade">' +
            '<button type="button" class="btn btn-secondary" data-qtd-mais="' + idx + '" style="padding:4px 10px;min-width:36px">+</button>' +
            '</div>' +
            '<div class="col os-item-valor" style="flex:0.9">' + moeda(it.valor) + '</div>' +
            '<div class="col os-item-acoes">' +
            '<button type="button" class="btn btn-secondary btn-os-editar" data-edit-item="' + idx + '">' + btnEditTxt + '</button>' +
            '<button type="button" class="btn btn-danger" data-rm="' + idx + '">×</button></div>' +
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
            extraM += ' · Comissão <strong class="os-item-comissao">' + esc(String(pctLinha)) + '%</strong>' +
                ' = <span class="ganho-linha" style="font-weight:800">' + moeda(comVal) + '</span>';
        } else {
            extraM += ' · <span style="color:#ffb4b4">sem % cadastrada neste tipo</span>';
        }
    }
    extraM += '</div>';
    return '<div class="row os-item-linha' + clsEdit + '" style="margin-bottom:8px;align-items:center">' +
        '<div class="col" style="flex:2"><span class="os-tag os-tag-mao">MÃO DE OBRA</span>' +
        esc(it.desc) + extraM + '</div>' +
        '<div class="col os-item-valor" style="flex:1.1">' +
        '<label class="os-item-edit-row">Valor <input class="os-edit-val" inputmode="decimal" data-edit-mao="' + idx +
        '" value="' + esc(fmtNumOs(it.valor)) + '" title="Valor da mão de obra"></label></div>' +
        '<div class="col os-item-acoes">' +
        '<button type="button" class="btn btn-secondary btn-os-editar" data-edit-item="' + idx + '">' + btnEditTxt + '</button>' +
        '<button type="button" class="btn btn-danger" data-rm="' + idx + '">×</button></div>' +
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
    html += '<div class="os-sec-tit os-sec-pecas">PEÇAS</div>';
    if (!idxsPeca.length) {
        html += '<p class="muted" style="margin:0 0 10px;font-size:0.85rem">Nenhuma peça nesta OS.</p>';
    } else {
        html += idxsPeca.map(function (idx) { return htmlLinhaItemOs(itensTemp[idx], idx); }).join('');
    }
    html += '<div class="os-sec-tit os-sec-mao">MÃO DE OBRA</div>';
    if (!idxsMao.length) {
        html += '<p class="muted" style="margin:0;font-size:0.85rem">Nenhuma mão de obra nesta OS.</p>';
    } else {
        html += idxsMao.map(function (idx) { return htmlLinhaItemOs(itensTemp[idx], idx); }).join('');
    }
    var tot = totaisItens(itensTemp);
    html += '<div class="os-itens-total">' +
        '<div class="os-itens-total-linha"><span>Peças</span><strong>' + moeda(tot.pecas) + '</strong></div>' +
        '<div class="os-itens-total-linha"><span>Mão de obra</span><strong>' + moeda(tot.mao) + '</strong></div>' +
        '<div class="os-itens-total-final"><span>TOTAL</span><strong>' + moeda(tot.total) + '</strong></div>' +
        htmlResumoPagamentoOsForm() +
        '</div>';
    box.innerHTML = html;

    box.querySelectorAll('[data-rm]').forEach(function (b) {
        b.addEventListener('click', function () {
            var i = Number(b.getAttribute('data-rm'));
            if (osItemEditIdx === i) cancelarEdicaoItemOs();
            else if (osItemEditIdx != null && osItemEditIdx > i) osItemEditIdx -= 1;
            itensTemp.splice(i, 1);
            renderItens();
        });
    });
    box.querySelectorAll('[data-edit-item]').forEach(function (b) {
        b.addEventListener('click', function () {
            iniciarEdicaoItemOs(Number(b.getAttribute('data-edit-item')));
        });
    });
    box.querySelectorAll('[data-edit-venda]').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); inp.blur(); }
        });
        inp.addEventListener('change', function () {
            aplicarValorLinhaPeca(Number(inp.getAttribute('data-edit-venda')), 'venda', inp.value);
        });
    });
    box.querySelectorAll('[data-edit-custo]').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); inp.blur(); }
        });
        inp.addEventListener('change', function () {
            aplicarValorLinhaPeca(Number(inp.getAttribute('data-edit-custo')), 'custo', inp.value);
        });
    });
    box.querySelectorAll('[data-edit-mao]').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); inp.blur(); }
        });
        inp.addEventListener('change', function () {
            aplicarValorLinhaMao(Number(inp.getAttribute('data-edit-mao')), inp.value);
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

function aplicarComissaoCamposPecaOs(item) {
    var selF = document.getElementById('pecaFuncId');
    var selT = document.getElementById('pecaTipoComissao');
    var fid = selF && selF.value ? selF.value : '';
    var tipoMao = selT && selT.value ? selT.value : '';
    item.funcionarioId = '';
    item.tipoMao = '';
    item.funcionarioNome = '';
    item.comissaoPct = 0;
    item.comissaoValor = 0;
    if (!fid || !tipoMao) return item;
    item.funcionarioId = fid;
    item.tipoMao = tipoMao;
    var dados = obterDadosComissaoFuncionario(fid, tipoMao);
    var nomeSel = '';
    if (selF && selF.selectedIndex >= 0 && selF.options[selF.selectedIndex]) {
        nomeSel = selF.options[selF.selectedIndex].text || '';
        if (nomeSel.indexOf('sem comissão') >= 0) nomeSel = '';
    }
    item.funcionarioNome = dados.nome || nomeSel || '';
    item.comissaoPct = ehTipoMaoAmortOriginal(tipoMao) ? 0 : (dados.pct || 0);
    item.comissaoValor = valorComissaoDoItemMao(item, dados);
    return item;
}

function recalcularComissaoItemOs(it) {
    if (!it || (it.tipo || 'peca') === 'mao') return;
    if (!it.funcionarioId || !it.tipoMao) {
        it.comissaoPct = 0;
        it.comissaoValor = 0;
        return;
    }
    var dados = obterDadosComissaoFuncionario(it.funcionarioId, it.tipoMao);
    if (!it.funcionarioNome) it.funcionarioNome = dados.nome;
    it.comissaoPct = ehTipoMaoAmortOriginal(it.tipoMao) ? 0 : (dados.pct || it.comissaoPct || 0);
    it.comissaoValor = valorComissaoDoItemMao(it, dados);
}

function atualizarPreviewComissaoPeca() {
    if (typeof atualizarRotulosTipoMaoOriginal === 'function') atualizarRotulosTipoMaoOriginal();
    var el = document.getElementById('pecaComissaoPreview');
    if (!el) return;
    var fid = document.getElementById('pecaFuncId') && document.getElementById('pecaFuncId').value;
    var tipo = document.getElementById('pecaTipoComissao') && document.getElementById('pecaTipoComissao').value;
    if (!fid || !tipo) {
        el.textContent = 'Sem comissão nesta peça — escolha funcionário e tipo (ex.: Amortecedor) se ele fez o serviço.';
        el.style.color = '#64748b';
        return;
    }
    var dados = obterDadosComissaoFuncionario(fid, tipo);
    var tipoLbl = rotuloTipoMaoComissao(tipo);
    var qtd = Math.max(1, Math.round(Number(String((document.getElementById('itemQtd') && document.getElementById('itemQtd').value) || '1').replace(',', '.')) || 1));
    if (ehTipoMaoAmortOriginal(tipo)) {
        var fixo = Number(dados.valorFixo) || 0;
        if (!(fixo > 0)) {
            el.textContent = (dados.nome || 'Funcionário') + ' — sem R$ de ' + tipoLbl.toLowerCase() + ' no cadastro.';
            el.style.color = '#b91c1c';
            return;
        }
        el.style.color = '#14532d';
        el.textContent = (dados.nome || 'Funcionário') + ' · ' + tipoLbl + ': ' + moeda(fixo) +
            (qtd > 1 ? ' × ' + qtd + ' = ' + moeda(fixo * qtd) : ' (fixo)');
        return;
    }
    var vendaUnit = parseMoeda(document.getElementById('itemValor') && document.getElementById('itemValor').value);
    var base = qtd * vendaUnit;
    var com = calcularValorComissaoMao(base, dados.pct || 0);
    if (!(dados.pct > 0)) {
        el.textContent = (dados.nome || 'Funcionário') + ' — sem % de ' + tipoLbl + ' no cadastro.';
        el.style.color = '#b91c1c';
        return;
    }
    el.style.color = '#14532d';
    el.textContent = (dados.nome || 'Funcionário') + ' · ' + tipoLbl + ': ' + (dados.pct || 0) + '%' +
        (base > 0 ? ' → ' + moeda(com) : '');
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

    var editandoPeca = osItemEditIdx != null && itensTemp[osItemEditIdx] &&
        (itensTemp[osItemEditIdx].tipo || 'peca') !== 'mao';
    if (editandoPeca) {
        var itemEd = itensTemp[osItemEditIdx];
        itemEd.desc = desc;
        itemEd.qtd = qtd;
        itemEd.custoUnit = custoUnit;
        itemEd.valorUnit = valorUnit;
        itemEd.custo = +(custoUnit * qtd).toFixed(2);
        itemEd.valor = +(valorUnit * qtd).toFixed(2);
        aplicarComissaoCamposPecaOs(itemEd);
        cancelarEdicaoItemOs();
        document.getElementById('itemDesc').value = '';
        document.getElementById('itemCusto').value = '';
        document.getElementById('itemValor').value = '';
        if (document.getElementById('itemQtd')) document.getElementById('itemQtd').value = '1';
        if (typeof atualizarPreviewComissaoPeca === 'function') atualizarPreviewComissaoPeca();
        renderItens();
        toast(itemEd.comissaoValor > 0.009
            ? ('Peça atualizada. Comissão ' + moeda(itemEd.comissaoValor) + '.')
            : 'Peça atualizada.');
        return;
    }

    /* Se já existe a mesma peça (mesmo nome + unitários), só soma a quantidade */
    var selPF = document.getElementById('pecaFuncId');
    var selPT = document.getElementById('pecaTipoComissao');
    var fidAdd = selPF && selPF.value ? selPF.value : '';
    var tipoAdd = selPT && selPT.value ? selPT.value : '';
    var iExist = itensTemp.findIndex(function (x) {
        if (!x || (x.tipo || 'peca') === 'mao') return false;
        if (String(x.desc || '').toLowerCase() !== desc.toLowerCase()) return false;
        if (String(x.funcionarioId || '') !== String(fidAdd || '')) return false;
        if (String(x.tipoMao || '') !== String(tipoAdd || '')) return false;
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
    aplicarComissaoCamposPecaOs(item);
    itensTemp.push(item);
    document.getElementById('itemDesc').value = '';
    document.getElementById('itemCusto').value = '';
    document.getElementById('itemValor').value = '';
    if (document.getElementById('itemQtd')) document.getElementById('itemQtd').value = '1';
    if (typeof atualizarPreviewComissaoPeca === 'function') atualizarPreviewComissaoPeca();
    renderItens();
    if (Number(item.comissaoValor) > 0.009) {
        toast('Peça adicionada. Comissão ' + moeda(item.comissaoValor) +
            ' para ' + (item.funcionarioNome || 'funcionário') + '.');
    }
});

function faixaAmortecedorOriginal(tipo) {
    if (tipo === 'amortecedor-original-2' || tipo === 'amortecedorOriginal2') return 2;
    if (tipo === 'amortecedor-original' || tipo === 'amortecedorOriginal') return 1;
    return 0;
}

function rotuloTipoMaoComissao(tipo) {
    if (tipo === 'alinhamento') return 'Alinhamento';
    var faixaOrig = faixaAmortecedorOriginal(tipo);
    if (faixaOrig === 2) return 'Rebaixados';
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
        var q = Math.max(1, Number(it && it.qtd) || 1);
        if (dados && Number(dados.valorFixo) > 0) return +((Number(dados.valorFixo) * q).toFixed(2));
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
    var fid = (document.getElementById('maoFuncId') && document.getElementById('maoFuncId').value) ||
        (document.getElementById('vdMaoFuncId') && document.getElementById('vdMaoFuncId').value) ||
        (document.getElementById('vdMecanicoId') && document.getElementById('vdMecanicoId').value) || '';
    var d1 = fid ? obterDadosComissaoFuncionario(fid, 'amortecedor-original') : { valorFixo: 0 };
    var d2 = fid ? obterDadosComissaoFuncionario(fid, 'amortecedor-original-2') : { valorFixo: 0 };
    function setOpt(sel, val, base, v) {
        if (!sel) return;
        var o = sel.querySelector('option[value="' + val + '"]');
        if (!o) return;
        o.textContent = (v > 0) ? (base + ' (' + moeda(v) + ')') : base;
    }
    var sel = document.getElementById('maoTipoComissao');
    setOpt(sel, 'amortecedor-original', 'Mão de obra — Amortecedor original 1', d1.valorFixo);
    setOpt(sel, 'amortecedor-original-2', 'Mão de obra — Rebaixados', d2.valorFixo);
    var selVd = document.getElementById('vdMaoTipoComissao');
    setOpt(selVd, 'amortecedor-original', 'Amortecedor original 1 (R$)', d1.valorFixo);
    setOpt(selVd, 'amortecedor-original-2', 'Rebaixados (R$)', d2.valorFixo);
    function rotulosPorSelect(funcId, tipoId) {
        var fidL = document.getElementById(funcId) && document.getElementById(funcId).value;
        var dL1 = fidL ? obterDadosComissaoFuncionario(fidL, 'amortecedor-original') : { valorFixo: 0 };
        var dL2 = fidL ? obterDadosComissaoFuncionario(fidL, 'amortecedor-original-2') : { valorFixo: 0 };
        var selL = document.getElementById(tipoId);
        setOpt(selL, 'amortecedor-original', 'Amortecedor original 1 (R$)', dL1.valorFixo);
        setOpt(selL, 'amortecedor-original-2', 'Rebaixados (R$)', dL2.valorFixo);
    }
    rotulosPorSelect('vdProdFuncId', 'vdProdTipoComissao');
    rotulosPorSelect('vdAvFuncId', 'vdAvTipoComissao');
    rotulosPorSelect('pecaFuncId', 'pecaTipoComissao');
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
            el.style.color = '#b91c1c';
            return;
        }
        el.style.color = '#14532d';
        el.textContent = (dados.nome || 'Funcionário') + ' · ' + faixaLbl + ' — recebe ' +
            moeda(dados.valorFixo) + ' (valor fixo do cadastro)';
        return;
    }
    var com = calcularValorComissaoMao(valor, dados.pct);
    if (!dados.pct) {
        el.textContent = (dados.nome || 'Funcionário') + ' — sem % de ' + rotuloTipoMaoComissao(tipo) + ' no cadastro.';
        el.style.color = '#b91c1c';
        return;
    }
    el.style.color = '#14532d';
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
    var itemMao = {
        tipo: 'mao',
        tipoMao: tipoMao,
        desc: desc,
        valor: valor,
        funcionarioId: fid || '',
        funcionarioNome: dados.nome || '',
        comissaoPct: comissaoPct,
        comissaoValor: comissaoValor
    };
    var editandoMao = osItemEditIdx != null && itensTemp[osItemEditIdx] && itensTemp[osItemEditIdx].tipo === 'mao';
    if (editandoMao) {
        itensTemp[osItemEditIdx] = itemMao;
        cancelarEdicaoItemOs();
        toast('Mão de obra atualizada.');
    } else {
        itensTemp.push(itemMao);
    }
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
    pecaFuncId: 'btnAddItem',
    pecaTipoComissao: 'btnAddItem',
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
        if (typeof window.selecionarPrimeiraSugestaoCatalogo === 'function' &&
            window.selecionarPrimeiraSugestaoCatalogo(t.id)) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        var botaoId = window._mapaEnterOs[t.id];
        if (!botaoId) return;
        e.preventDefault();
        e.stopPropagation();
        clicarAdd(botaoId, e);
    }, true);
    if (typeof window.enterClicaBotao === 'function') {
        window.enterClicaBotao(['itemDesc', 'itemCusto', 'itemValor', 'itemQtd', 'pecaFuncId', 'pecaTipoComissao'], 'btnAddItem');
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
    var pf = document.getElementById('pecaFuncId');
    var pt = document.getElementById('pecaTipoComissao');
    var pq = document.getElementById('itemQtd');
    var pv = document.getElementById('itemValor');
    if (pf) pf.addEventListener('change', atualizarPreviewComissaoPeca);
    if (pt) pt.addEventListener('change', atualizarPreviewComissaoPeca);
    if (pq) pq.addEventListener('input', atualizarPreviewComissaoPeca);
    if (pv) {
        pv.addEventListener('input', atualizarPreviewComissaoPeca);
        pv.addEventListener('change', atualizarPreviewComissaoPeca);
    }
})();

function limparAtendimento() {
    cancelarEdicaoItemOs();
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
    var existente = id ? (db.atendimentos || []).find(function (a) { return a && String(a.id) === String(id); }) : null;
    var dataEntrada = dataISODia(document.getElementById('atEntrada').value)
        || dataISODia(existente && existente.entrada)
        || (typeof hojeISO === 'function' ? hojeISO() : dataISODia(new Date().toISOString()));
    itensTemp.forEach(function (it) {
        if (!it) return;
        if ((it.tipo || 'peca') !== 'mao') {
            normalizarPecaItem(it);
            recalcularComissaoItemOs(it);
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
        entrada: dataEntrada,
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
        atualizadoEm: new Date().toISOString(),
        criadoEm: isoComDataLocal(dataEntrada)
    };
    payload = preservarFinanceiroOs(payload, existente);

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

function editarAtendimento(id, placaHint) {
    var hit = acharAtendimentoComDb(id, placaHint);
    if (!hit || !hit.a) {
        toast('OS não encontrada.');
        return;
    }
    var a = hit.a;
    var db = hit.db;
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
    document.getElementById('atPlaca').value = a.placa || placaDeTextoLivre(placaHint) || '';
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
    cancelarEdicaoItemOs();
    itensTemp = (a.itens || []).map(function (it) {
        var fid = it.funcionarioId || '';
        var ehMao = (it.tipo || '') === 'mao';
        var tipoMao = it.tipoMao || (ehMao ? 'servico' : '');
        var pct = it.comissaoPct != null ? Number(it.comissaoPct) : NaN;
        var nome = it.funcionarioNome || '';
        if (fid && (ehMao || tipoMao)) {
            var dados = obterDadosComissaoFuncionario(fid, tipoMao || 'servico');
            if (!nome) nome = dados.nome;
            if (ehTipoMaoAmortOriginal(tipoMao)) {
                pct = 0;
            } else if (isNaN(pct) || pct <= 0) pct = dados.pct;
        }
        if (isNaN(pct)) pct = 0;
        var valorMo = Number(it.valor) || 0;
        var comVal = (ehMao || tipoMao)
            ? (ehTipoMaoAmortOriginal(tipoMao)
                ? valorComissaoDoItemMao({ tipoMao: tipoMao, valor: valorMo, qtd: it.qtd, comissaoValor: it.comissaoValor }, fid ? obterDadosComissaoFuncionario(fid, tipoMao) : { valorFixo: 0, tipo: tipoMao })
                : (it.comissaoValor != null
                    ? Number(it.comissaoValor)
                    : calcularValorComissaoMao(valorMo, pct)))
            : 0;
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
    var totItens = typeof totaisItens === 'function' ? totaisItens(itensTemp).total : 0;
    var totDoc = Math.max(Number(a.total) || 0, Number(a.totalBruto) || 0);
    if (totDoc > totItens + 0.05) {
        var falta = +(totDoc - totItens).toFixed(2);
        itensTemp.push({
            tipo: 'peca',
            desc: 'Demais itens da nota',
            qtd: 1,
            valorUnit: falta,
            valor: falta,
            custoUnit: 0,
            custo: 0
        });
    }
    renderItens();
    carregarFotosNoForm(a.fotos);
    atualizarPlaca();
    setTimeout(function () {
        var alvo = document.getElementById('listaItens');
        if (alvo && itensTemp && itensTemp.length) {
            try { alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (eScr) { /* ok */ }
        }
    }, 80);
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

function somarDiasISO(iso, dias) {
    var base = String(iso || (typeof hojeISO === 'function' ? hojeISO() : new Date().toISOString().slice(0, 10))).slice(0, 10);
    var d = new Date(base + 'T12:00:00');
    if (isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() + (Number(dias) || 0));
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return y + '-' + m + '-' + day;
}

function totalAposDescontoOs(bruto, descR, descP) {
    descR = Number(descR) || 0;
    descP = Number(descP) || 0;
    if (descR < 0) descR = 0;
    if (descP < 0) descP = 0;
    var apos = Math.max(0, (Number(bruto) || 0) - descR);
    var descPercValor = +(apos * descP / 100).toFixed(2);
    return Math.max(0, +(apos - descPercValor).toFixed(2));
}

function preservarFinanceiroOs(payload, existente) {
    if (!payload) return payload;
    var bruto = Number(payload.total) || 0;
    payload.totalBruto = bruto;
    if (!existente) return payload;
    var temPg = !!(existente.statusPagamento ||
        (existente.recebimentos && existente.recebimentos.length) ||
        Number(existente.valorRecebido) > 0 ||
        Number(existente.descontoReais) > 0 ||
        Number(existente.descontoPerc) > 0);
    if (!temPg) return payload;
    payload.descontoReais = Number(existente.descontoReais) || 0;
    payload.descontoPerc = Number(existente.descontoPerc) || 0;
    payload.total = totalAposDescontoOs(bruto, payload.descontoReais, payload.descontoPerc);
    payload.valorRecebido = Number(existente.valorRecebido) || 0;
    payload.recebimentos = existente.recebimentos || [];
    payload.formaPagamento = existente.formaPagamento || '';
    payload.canalRecebimento = existente.canalRecebimento;
    payload.dataVencimento = existente.dataVencimento;
    payload.ehBoleto = existente.ehBoleto;
    payload.boletoDias = existente.boletoDias;
    payload.recebidoEm = existente.recebidoEm;
    payload.saldoAberto = Math.max(0, +(payload.total - payload.valorRecebido).toFixed(2));
    if (payload.saldoAberto < 0.01 && payload.valorRecebido > 0.009) payload.statusPagamento = 'PAGO';
    else if (payload.valorRecebido > 0.009) payload.statusPagamento = 'PARCIAL';
    else payload.statusPagamento = existente.statusPagamento || 'PENDENTE';
    return payload;
}

function htmlResumoPagamentoOsForm() {
    var idEl = document.getElementById('atId');
    var id = idEl && idEl.value;
    if (!id || typeof carregar !== 'function') return '';
    var db = carregar();
    var a = (db.atendimentos || []).find(function (x) { return x && String(x.id) === String(id); });
    if (!a) return '';
    return htmlResumoPagamentoOs(a);
}

function htmlResumoPagamentoOs(a) {
    if (!a) return '';
    var recs = a.recebimentos || [];
    var descR = Number(a.descontoReais) || 0;
    var descP = Number(a.descontoPerc) || 0;
    var recebido = Number(a.valorRecebido) || 0;
    var aberto = a.saldoAberto != null
        ? Number(a.saldoAberto)
        : Math.max(0, (Number(a.total) || 0) - recebido);
    var st = String(a.statusPagamento || '').toUpperCase();
    if (!recs.length && !(descR > 0) && !(descP > 0) && !(recebido > 0) && !st) return '';
    var linhas = [];
    if (descR > 0) linhas.push('Desconto R$: − ' + moeda(descR));
    if (descP > 0) linhas.push('Desconto ' + descP + '%');
    recs.forEach(function (r) {
        linhas.push((r.forma || '—') + ': ' + moeda(r.valor));
    });
    if (recebido > 0) linhas.push('Total recebido: ' + moeda(recebido));
    if (aberto > 0.009) linhas.push('Em aberto: ' + moeda(aberto));
    if (st) linhas.push('Status: ' + st + (a.formaPagamento ? ' · ' + a.formaPagamento : ''));
    if (!linhas.length) return '';
    return '<div class="os-pgto-resumo">' + linhas.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div>';
}

function textoBuscaNormCat(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function combinaBuscaCatalogo(haystack, query) {
    var h = textoBuscaNormCat(haystack);
    var tokens = textoBuscaNormCat(query).split(' ').filter(function (t) { return t.length >= 1; });
    if (!tokens.length || !h) return false;
    return tokens.every(function (t) { return h.indexOf(t) >= 0; });
}

function scoreBuscaCatalogo(haystack, query) {
    var h = textoBuscaNormCat(haystack);
    var q = textoBuscaNormCat(query);
    if (!h || !q) return 99;
    if (h === q) return 0;
    if (h.indexOf(q) === 0) return 1;
    var i = h.indexOf(q);
    if (i > 0) return 2 + Math.min(i, 20);
    return 40;
}

function inferirTipoMaoDesc(desc) {
    var t = textoBuscaNormCat(desc);
    if (t.indexOf('rebaix') >= 0) return 'amortecedor-original-2';
    if (t.indexOf('original') >= 0) return 'amortecedor-original';
    if (t.indexOf('alinh') >= 0 || t.indexOf('balance') >= 0) return 'alinhamento';
    if (t.indexOf('amort') >= 0) return 'amortecedor';
    return 'servico';
}

function listarProdutosParaCatalogo(db) {
    db = db || (typeof carregarMain === 'function'
        ? carregarMain()
        : (typeof carregar === 'function' ? carregar() : { produtos: [] }));
    return (db.produtos || []).filter(function (p) {
        return p && p.id && String(p.nome || '').trim();
    });
}

function produtoQueryEhExata(query, p) {
    if (!p) return false;
    var q = textoBuscaNormCat(query);
    if (!q) return false;
    var nome = textoBuscaNormCat(p.nome);
    var cod = textoBuscaNormCat(p.codigo);
    var peca = textoBuscaNormCat(typeof codigoPecaDe === 'function' ? codigoPecaDe(p) : p.codigoPeca);
    var semCol = q.replace(/\s*\[.*$/, '').trim();
    if (nome && (q === nome || semCol === nome)) return true;
    if (cod && (q === cod || semCol === cod)) return true;
    if (peca && (q === peca || semCol === peca)) return true;
    var soDigQ = String(query || '').replace(/\D/g, '');
    var soDigC = String(p.codigo || '').replace(/\D/g, '');
    var soDigP = String((typeof codigoPecaDe === 'function' ? codigoPecaDe(p) : p.codigoPeca) || '').replace(/\D/g, '');
    if (soDigQ.length >= 4 && soDigC && soDigQ === soDigC) return true;
    if (soDigQ.length >= 4 && soDigP && soDigQ === soDigP) return true;
    return false;
}

function buscarProdutosCatalogo(query, limite) {
    var q = String(query || '').trim();
    if (q.length < 1) return [];
    var lista = listarProdutosParaCatalogo();
    return lista.filter(function (p) {
        var blob = [p.nome, p.codigo, (typeof codigoPecaDe === 'function' ? codigoPecaDe(p) : p.codigoPeca)].join(' ');
        return combinaBuscaCatalogo(blob, q);
    }).sort(function (a, b) {
        var ea = produtoQueryEhExata(q, a) ? 0 : 1;
        var eb = produtoQueryEhExata(q, b) ? 0 : 1;
        if (ea !== eb) return ea - eb;
        var sa = scoreBuscaCatalogo(a.nome, q);
        var sb = scoreBuscaCatalogo(b.nome, q);
        if (sa !== sb) return sa - sb;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    }).slice(0, limite || 12);
}

function catalogoServicosMaoObra(db) {
    db = db || (typeof carregar === 'function' ? carregar() : {});
    var mapa = {};
    function add(desc, tipo, valor) {
        desc = String(desc || '').trim();
        if (!desc) return;
        var k = textoBuscaNormCat(desc);
        if (!k) return;
        var cur = mapa[k];
        var tipoMao = tipo || inferirTipoMaoDesc(desc);
        var v = Number(valor) || 0;
        if (!cur) {
            mapa[k] = { desc: desc, tipoMao: tipoMao, valor: v };
            return;
        }
        if (v > 0) cur.valor = v;
        if (tipoMao && tipoMao !== 'servico') cur.tipoMao = tipoMao;
    }
    [
        { desc: 'Alinhamento', tipoMao: 'alinhamento' },
        { desc: 'Alinhamento e balanceamento', tipoMao: 'alinhamento' },
        { desc: 'Mão de obra — Amortecedor', tipoMao: 'amortecedor' },
        { desc: 'Troca de amortecedor', tipoMao: 'amortecedor' },
        { desc: 'Mão de obra — Amortecedor original 1', tipoMao: 'amortecedor-original' },
        { desc: 'Mão de obra — Rebaixados', tipoMao: 'amortecedor-original-2' },
        { desc: 'Mão de obra — Serviço', tipoMao: 'servico' }
    ].forEach(function (s) { add(s.desc, s.tipoMao, 0); });
    (db.atendimentos || []).forEach(function (a) {
        (a.itens || []).forEach(function (it) {
            if (!it || (it.tipo || '') !== 'mao') return;
            add(it.desc, it.tipoMao, it.valor);
        });
    });
    (db.orcamentos || []).forEach(function (o) {
        (o.itens || []).forEach(function (it) {
            if (!it) return;
            if (it.origem !== 'mao' && it.tipo !== 'mao') return;
            add(it.desc, it.tipoMao, it.venda || it.valor);
        });
    });
    return Object.keys(mapa).map(function (k) { return mapa[k]; });
}

function buscarServicosMaoCatalogo(query, limite) {
    var q = String(query || '').trim();
    if (q.length < 1) return [];
    return catalogoServicosMaoObra().filter(function (s) {
        return combinaBuscaCatalogo(s.desc, q);
    }).sort(function (a, b) {
        var sa = scoreBuscaCatalogo(a.desc, q);
        var sb = scoreBuscaCatalogo(b.desc, q);
        if (sa !== sb) return sa - sb;
        return String(a.desc || '').localeCompare(String(b.desc || ''), 'pt-BR');
    }).slice(0, limite || 12);
}

function aplicarProdutoNoOrcamentoOs(p) {
    if (!p) return;
    var desc = document.getElementById('itemDesc');
    var custo = document.getElementById('itemCusto');
    var venda = document.getElementById('itemValor');
    if (desc) {
        var peca = typeof codigoPecaDe === 'function' ? codigoPecaDe(p) : (p.codigoPeca || '');
        desc.value = (p.nome || '') + (peca ? ' [' + peca + ']' : '');
    }
    if (custo) custo.value = typeof fmtNumOs === 'function' ? fmtNumOs(p.custo) : String(p.custo || '');
    if (venda) venda.value = typeof fmtNumOs === 'function' ? fmtNumOs(p.venda) : String(p.venda || '');
    if (venda) {
        try { venda.focus(); venda.select(); } catch (eF) { /* ok */ }
    }
    if (typeof atualizarPreviewComissaoPeca === 'function') atualizarPreviewComissaoPeca();
    toast('Produto selecionado: ' + (p.nome || ''));
}

function aplicarServicoMaoNoOs(s) {
    if (!s) return;
    var desc = document.getElementById('maoDesc');
    var tipo = document.getElementById('maoTipoComissao');
    var valor = document.getElementById('maoValor');
    if (desc) desc.value = s.desc || '';
    if (tipo) tipo.value = s.tipoMao || inferirTipoMaoDesc(s.desc);
    if (valor && Number(s.valor) > 0) {
        valor.value = typeof fmtNumOs === 'function' ? fmtNumOs(s.valor) : String(s.valor);
    }
    if (typeof atualizarPreviewComissaoMao === 'function') atualizarPreviewComissaoMao();
    if (valor) {
        try { valor.focus(); valor.select(); } catch (eF) { /* ok */ }
    }
    toast('Serviço selecionado: ' + (s.desc || ''));
}

function aplicarProdutoNoOrcamentoVenda(p, destino) {
    if (!p) return;
    if (destino === 'avulso') {
        var nome = document.getElementById('vdAvNome');
        var custo = document.getElementById('vdAvCusto');
        var venda = document.getElementById('vdAvVenda');
        if (nome) nome.value = p.nome || '';
        if (custo) custo.value = p.custo || 0;
        if (venda) venda.value = p.venda || 0;
        if (typeof atualizarTotalLinhaAvulso === 'function') atualizarTotalLinhaAvulso();
        if (typeof recalcMargemDeVenda === 'function') {
            recalcMargemDeVenda('vdAvCusto', 'vdAvMargem', 'vdAvVenda', atualizarTotalLinhaAvulso);
        }
        toast('Produto selecionado: ' + (p.nome || ''));
        return;
    }
    produtoVendaSelecionado = p;
    var busca = document.getElementById('vdProdBusca');
    if (busca) {
        var pecaVd = typeof codigoPecaDe === 'function' ? codigoPecaDe(p) : (p.codigoPeca || '');
        busca.value = (p.nome || '') + (pecaVd ? ' [' + pecaVd + ']' : (p.codigo ? ' [' + p.codigo + ']' : ''));
    }
    var elC = document.getElementById('vdProdCusto');
    var elV = document.getElementById('vdProdVenda');
    var elM = document.getElementById('vdProdMargem');
    var elU = document.getElementById('vdProdUn');
    if (elC) elC.value = p.custo || 0;
    if (elV) elV.value = p.venda || 0;
    var margem = (Number(p.custo) > 0) ? (((Number(p.venda) / Number(p.custo)) - 1) * 100) : 0;
    if (elM) elM.value = margem.toFixed(1);
    if (elU) elU.value = p.unidade || '';
    if (typeof atualizarTotalLinhaEstoque === 'function') atualizarTotalLinhaEstoque();
    if (typeof atualizarResumoEstoqueVenda === 'function') atualizarResumoEstoqueVenda();
    toast('Produto selecionado: ' + (p.nome || ''));
}

function aplicarServicoMaoNaVenda(s) {
    if (!s) return;
    var desc = document.getElementById('vdMaoDesc');
    var tipo = document.getElementById('vdMaoTipoComissao');
    var valor = document.getElementById('vdMaoValor');
    if (desc) desc.value = s.desc || '';
    if (tipo) tipo.value = s.tipoMao || inferirTipoMaoDesc(s.desc);
    if (valor && Number(s.valor) > 0) {
        valor.value = typeof fmtNumOs === 'function' ? fmtNumOs(s.valor) : String(s.valor);
    }
    if (typeof atualizarPreviewComissaoVd === 'function') atualizarPreviewComissaoVd();
    toast('Serviço selecionado: ' + (s.desc || ''));
}

window._mapaBoxCatalogo = {
    itemDesc: 'sugestoesItemDesc',
    maoDesc: 'sugestoesMaoDesc',
    vdProdBusca: 'sugestoesVdProd',
    vdMaoDesc: 'sugestoesVdMao'
};

function selecionarPrimeiraSugestaoCatalogo(inputId) {
    var boxId = window._mapaBoxCatalogo[inputId];
    if (!boxId) return false;
    var box = document.getElementById(boxId);
    if (!box || box.hidden) return false;
    var somenteExato = inputId === 'vdProdBusca' || inputId === 'itemDesc';
    var btn = somenteExato
        ? box.querySelector('button[data-cat-exato="1"]')
        : box.querySelector('button.ativo, button[data-cat-idx]');
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    return true;
}
window.selecionarPrimeiraSugestaoCatalogo = selecionarPrimeiraSugestaoCatalogo;

function ligarAutocompleteCampoCatalogo(opts) {
    var input = document.getElementById(opts.inputId);
    var box = document.getElementById(opts.boxId);
    if (!input || !box || input.getAttribute('data-auto-cat')) return;
    input.setAttribute('data-auto-cat', '1');
    input.setAttribute('autocomplete', 'off');
    input.removeAttribute('list');

    function esconder() {
        box.innerHTML = '';
        box.hidden = true;
    }

    function mostrar(itens) {
        if (!itens.length) {
            if (opts.vazioTxt) {
                box.innerHTML = '<div class="sugestoes-catalogo-vazio">' + esc(opts.vazioTxt) + '</div>';
                box.hidden = false;
                return;
            }
            esconder();
            return;
        }
        box.innerHTML = itens.map(function (it, i) {
            return '<button type="button" data-cat-idx="' + i + '"' +
                (it.exato ? ' data-cat-exato="1"' : '') +
                (i === 0 ? ' class="ativo"' : '') + '>' +
                '<strong>' + esc(it.titulo) + '</strong>' +
                (it.sub ? '<span>' + esc(it.sub) + '</span>' : '') +
                '</button>';
        }).join('');
        box.hidden = false;
        box.querySelectorAll('[data-cat-idx]').forEach(function (b) {
            b.addEventListener('mousedown', function (e) {
                e.preventDefault();
                var it = itens[Number(b.getAttribute('data-cat-idx'))];
                if (it && opts.onSelect) opts.onSelect(it.raw);
                esconder();
            });
        });
    }

    function atualizar() {
        var q = input.value.trim();
        if (q.length < 1) { esconder(); return; }
        mostrar(opts.buscar(q) || []);
    }

    input.addEventListener('input', atualizar);
    input.addEventListener('focus', atualizar);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            esconder();
            return;
        }
        if ((e.key === 'Enter' || e.key === 'NumpadEnter' || e.keyCode === 13) && !box.hidden) {
            var btn = box.querySelector('button.ativo, button[data-cat-idx]');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            }
        }
    }, true);
    document.addEventListener('mousedown', function (e) {
        if (box.hidden) return;
        if (e.target === input || box.contains(e.target)) return;
        esconder();
    });
}

function rotuloPrecoCatalogo(custo, venda) {
    var partes = [];
    if (Number(venda) > 0 && typeof moeda === 'function') partes.push('venda ' + moeda(venda));
    if (Number(custo) > 0 && typeof moeda === 'function') partes.push('custo ' + moeda(custo));
    return partes.join(' · ');
}

(function ligarAutocompleteOrcamento() {
    function itensProdutoCadastro(q) {
        return buscarProdutosCatalogo(q).map(function (p) {
            var qtd = (p.qtd != null && Number(p.qtd) === Number(p.qtd)) ? Number(p.qtd) : null;
            var extra = [
                (typeof codigoPecaDe === 'function' && codigoPecaDe(p)) ? 'peça ' + codigoPecaDe(p) : '',
                p.codigo ? 'barras ' + p.codigo : '',
                (typeof produtoEhServico === 'function' && produtoEhServico(p))
                    ? 'tipo de serviço'
                    : (qtd != null ? 'estoque ' + qtd : ''),
                rotuloPrecoCatalogo(p.custo, p.venda)
            ].filter(Boolean).join(' · ');
            return {
                titulo: p.nome,
                sub: extra || 'Cadastro de Produtos',
                raw: p,
                exato: produtoQueryEhExata(q, p)
            };
        });
    }
    var vazioProd = 'Nenhum produto cadastrado com esse nome. Use Cadastro de Produtos.';
    ligarAutocompleteCampoCatalogo({
        inputId: 'itemDesc',
        boxId: 'sugestoesItemDesc',
        vazioTxt: vazioProd,
        buscar: itensProdutoCadastro,
        onSelect: aplicarProdutoNoOrcamentoOs
    });
    ligarAutocompleteCampoCatalogo({
        inputId: 'maoDesc',
        boxId: 'sugestoesMaoDesc',
        buscar: function (q) {
            return buscarServicosMaoCatalogo(q).map(function (s) {
                var tipo = (typeof rotuloTipoMaoComissao === 'function')
                    ? rotuloTipoMaoComissao(s.tipoMao)
                    : (s.tipoMao || '');
                var sub = [tipo, Number(s.valor) > 0 && typeof moeda === 'function' ? 'último valor ' + moeda(s.valor) : '']
                    .filter(Boolean).join(' · ');
                return { titulo: s.desc, sub: sub, raw: s };
            });
        },
        onSelect: aplicarServicoMaoNoOs
    });
    ligarAutocompleteCampoCatalogo({
        inputId: 'vdProdBusca',
        boxId: 'sugestoesVdProd',
        vazioTxt: vazioProd,
        buscar: itensProdutoCadastro,
        onSelect: function (p) { aplicarProdutoNoOrcamentoVenda(p, 'estoque'); }
    });
    ligarAutocompleteCampoCatalogo({
        inputId: 'vdMaoDesc',
        boxId: 'sugestoesVdMao',
        buscar: function (q) {
            return buscarServicosMaoCatalogo(q).map(function (s) {
                var tipo = (typeof rotuloTipoMaoComissao === 'function')
                    ? rotuloTipoMaoComissao(s.tipoMao)
                    : (s.tipoMao || '');
                var sub = [tipo, Number(s.valor) > 0 && typeof moeda === 'function' ? 'último valor ' + moeda(s.valor) : '']
                    .filter(Boolean).join(' · ');
                return { titulo: s.desc, sub: sub, raw: s };
            });
        },
        onSelect: aplicarServicoMaoNaVenda
    });
})();

