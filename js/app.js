'use strict';
/* Joninha — app (resto do sistema) — etapa 2.2 */

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

function getEmpresa(db) {
    var base = empresaPadrao();
    var emp = (db && db.empresa) ? db.empresa : (carregar().empresa || {});
    return Object.assign(base, emp || {});
}

function logoSrc(emp) {
    var e = emp || getEmpresa();
    return (e.logo && String(e.logo).trim()) ? e.logo : LOGO_PADRAO;
}

function enderecoCompleto(emp) {
    var e = emp || getEmpresa();
    var partes = [];
    var linha1 = [e.rua, e.numero].filter(Boolean).join(', ');
    if (e.complemento) linha1 += (linha1 ? ' — ' : '') + e.complemento;
    if (linha1) partes.push(linha1);
    if (e.bairro) partes.push(e.bairro);
    var cid = [e.cidade, e.estado].filter(Boolean).join('/');
    if (cid) partes.push(cid);
    if (e.cep) partes.push('CEP ' + e.cep);
    return partes.join(' · ') || '';
}

function htmlDadosEmpresaCabecalho(emp) {
    var e = emp || getEmpresa();
    var linhas = [];
    var stLinha = 'display:block;overflow:visible;line-height:1.3;color:#222;';

    /* 1) Endereço completo em UMA linha (no desktop; no celular quebra via CSS) */
    var endParts = [];
    var ruaNum = [e.rua, e.numero].filter(Boolean).join(', ');
    if (e.complemento) ruaNum += (ruaNum ? ' — ' : '') + e.complemento;
    if (ruaNum) endParts.push(ruaNum);
    if (e.bairro) endParts.push(e.bairro);
    var cidUf = [e.cidade, e.estado].filter(Boolean).join('/');
    if (cidUf) endParts.push(cidUf);
    if (e.cep) endParts.push('CEP ' + e.cep);
    if (endParts.length) {
        linhas.push('<span class="linha linha-end" style="' + stLinha + 'font-size:9pt;">' + esc(endParts.join(' - ')) + '</span>');
    }

    /* 2) CNPJ + Inscrição Estadual na mesma linha */
    var docs = [];
    if (e.cnpj) docs.push('CNPJ: ' + e.cnpj);
    if (e.ie) docs.push('Inscrição Estadual: ' + e.ie);
    if (docs.length) {
        linhas.push('<span class="linha linha-docs" style="' + stLinha + 'font-size:9.5pt;">' + esc(docs.join(' / ')) + '</span>');
    }

    /* 3) Telefone */
    if (e.telefone) {
        linhas.push('<span class="linha linha-tel" style="' + stLinha + 'font-size:9.5pt;font-weight:600;">Tel: ' + esc(e.telefone) + '</span>');
    }

    /* 4) E-mail */
    if (e.email) {
        linhas.push('<span class="linha linha-email" style="' + stLinha + 'font-size:9.5pt;">' + esc(e.email) + '</span>');
    }

    return linhas.join('');
}

function htmlCabecalhoNotaEmpresa(emp, extrasHtml) {
    var dados = htmlDadosEmpresaCabecalho(emp);
    return '<div class="nota-topo">' +
        '<table class="nota-topo-linha" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0;padding:0;">' +
        '<tr>' +
        '<td class="nota-topo-logo" style="width:42%;vertical-align:middle;padding:0 10px 0 0;">' +
        '<img src="' + esc(logoSrc(emp)) + '" alt="' + esc((emp && emp.nome) || 'Joninha Suspensões') + '" ' +
        'style="display:block;width:100%;max-width:100%;max-height:140px;height:auto;object-fit:contain;object-position:left center;">' +
        '</td>' +
        '<td class="nota-topo-dados" style="width:58%;vertical-align:middle;padding:0;margin:0;text-align:left;' +
        'font-family:Arial,Helvetica,sans-serif;color:#333;font-size:9.5pt;line-height:1.3;">' +
        (dados || '') +
        '</td>' +
        '</tr></table>' +
        (extrasHtml || '') +
        '</div>';
}

function aplicarIdentidadeVisual() {
    var emp = getEmpresa();
    var src = logoSrc(emp);
    var alt = (emp.nome || 'Joninha Suspensões') + ' — Suspensões e Auto Peças';
    ['logoSidebar', 'logoHero', 'previewLogoEmpresa'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.src = src;
        el.alt = alt;
        el.onerror = function () { el.src = LOGO_PADRAO; };
    });
    document.title = (emp.nome || 'Joninha Suspensões');
}

function preencherFormEmpresa() {
    var emp = getEmpresa();
    document.getElementById('empNome').value = emp.nome || '';
    document.getElementById('empCnpj').value = emp.cnpj || '';
    document.getElementById('empIe').value = emp.ie || '';
    document.getElementById('empTelefone').value = emp.telefone || '';
    document.getElementById('empEmail').value = emp.email || '';
    document.getElementById('empCep').value = emp.cep || '';
    document.getElementById('empRua').value = emp.rua || '';
    document.getElementById('empNumero').value = emp.numero || '';
    document.getElementById('empBairro').value = emp.bairro || '';
    document.getElementById('empCidade').value = emp.cidade || '';
    document.getElementById('empEstado').value = emp.estado || '';
    document.getElementById('empComplemento').value = emp.complemento || '';
    document.getElementById('empLogoUrl').value = (emp.logo && /^https?:\/\//i.test(emp.logo)) ? emp.logo : '';
    document.getElementById('previewLogoEmpresa').src = logoSrc(emp);
}

function lerEmpresaDoForm(logoAtual) {
    var atual = getEmpresa();
    var logo = logoAtual != null ? logoAtual : (atual.logo || '');
    return {
        nome: document.getElementById('empNome').value.trim() || 'Joninha Suspensões',
        cnpj: document.getElementById('empCnpj').value.trim(),
        ie: document.getElementById('empIe').value.trim(),
        telefone: document.getElementById('empTelefone').value.trim(),
        email: document.getElementById('empEmail').value.trim(),
        cep: document.getElementById('empCep').value.trim(),
        rua: document.getElementById('empRua').value.trim(),
        numero: document.getElementById('empNumero').value.trim(),
        bairro: document.getElementById('empBairro').value.trim(),
        cidade: document.getElementById('empCidade').value.trim(),
        estado: (document.getElementById('empEstado').value || '').trim().toUpperCase(),
        complemento: document.getElementById('empComplemento').value.trim(),
        logo: logo,
        logoNaMidia: !!(logo && String(logo).startsWith('data:')),
        atualizadoEm: atual.atualizadoEm || ''
    };
}

function salvarEmpresaObj(emp, opts) {
    opts = opts || {};
    emp = Object.assign(empresaPadrao(), emp || {});
    emp.atualizadoEm = new Date().toISOString();
    emp.logoNaMidia = !!(emp.logo && String(emp.logo).startsWith('data:'));
    var db = carregarMain();
    db.empresa = emp;
    salvarMain(db);
    aplicarIdentidadeVisual();
    preencherFormEmpresa();
    if (!opts.semNuvem) agendarEnvioEmpresaNuvem(emp);
}

function uid() {
    return 'hm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/* Impressão limpa via iframe (evita tela branca no Android / iOS) */
var _printCleanupTimer = null;
var _htmlNotaImpressaoAtual = '';
var _tituloNotaImpressao = 'Espelho de Atendimento';

function ehCelular() {
    try {
        if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) return true;
    } catch (e) { /* ignore */ }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

function cssDocumentoImpressao() {
    return 'html,body{margin:0;padding:0;background:#fff;color:#000;}' +
        'body{padding:10mm;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.25;}' +
        '.nota-espelho{background:#fff;color:#111;}' +
        '.nota-topo{text-align:center;border-bottom:3px solid #e61e25;padding-bottom:8pt;margin-bottom:10pt;}' +
        '.nota-topo-linha{width:100%;border-collapse:collapse;table-layout:fixed;}' +
        '.nota-topo-logo{width:42%;vertical-align:middle;padding:0 8pt 0 0;}' +
        '.nota-topo-logo img{display:block;width:100%;max-width:100%;max-height:32mm;height:auto;object-fit:contain;object-position:left center;}' +
        '.nota-topo-dados{width:58%;vertical-align:middle;text-align:left;font-size:9.5pt;line-height:1.3;color:#000;}' +
        '.nota-topo-dados .linha{display:block;white-space:nowrap;overflow:visible;color:#000;}' +
        '.nota-topo-dados .linha-end{font-size:9pt;}' +
        '.nota-topo-dados .linha-tel{font-weight:600;}' +
        '.nota-titulo-espelho{margin-top:8pt;margin-bottom:0;font-size:12pt;font-weight:800;color:#e61e25;letter-spacing:.06em;text-align:center;}' +
        '.nota-registro{margin-top:4pt;text-align:center;font-size:9pt;}' +
        '.nota-bloco{margin-bottom:8pt;border:1px solid #ccc;border-radius:4px;overflow:visible;page-break-inside:avoid;}' +
        '.nota-bloco .tit{padding:4pt 6pt;font-size:9pt;font-weight:800;text-transform:uppercase;color:#000;background:#fff;border-bottom:1.5pt solid #000;}' +
        '.nota-grid{display:grid;grid-template-columns:1fr 1fr;gap:4pt 8pt;padding:6pt;}' +
        '.nota-campo.full{grid-column:1/-1;}' +
        '.nota-grid-compacta{gap:2pt 8pt;padding:4pt 6pt;}' +
        '.nota-grid-compacta .nota-campo{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 4pt;min-width:0;}' +
        '.nota-grid-compacta .nota-label{display:inline;font-size:7.5pt;font-weight:800;text-transform:uppercase;margin:0;}' +
        '.nota-grid-compacta .nota-label::after{content:":";}' +
        '.nota-grid-compacta .nota-valor{display:inline;font-size:9pt;margin:0;overflow-wrap:anywhere;word-break:break-word;min-width:0;flex:1 1 auto;}' +
        '.nota-chassi{font-family:Consolas,Courier New,monospace;word-break:break-all;}' +
        '.nota-itens{width:100%;border-collapse:collapse;font-size:9pt;}' +
        '.nota-itens th,.nota-itens td{border-bottom:1px solid #ddd;padding:3pt;text-align:left;}' +
        '.nota-itens th{font-weight:800;}' +
        '.nota-valores-pad{padding:6pt;}' +
        '.nota-subtotais{margin-top:4pt;font-size:9pt;}' +
        '.nota-total{text-align:right;font-size:11pt;font-weight:800;margin-top:4pt;}' +
        '.nota-sigs{display:grid;grid-template-columns:1fr 1fr;gap:16pt;margin-top:14pt;}' +
        '.nota-sig{text-align:center;font-size:9pt;}' +
        '.nota-sig-espaco{min-height:18mm;border-bottom:1px solid #000;}' +
        '.nota-sig-base{padding-top:4pt;font-weight:700;}' +
        '.nota-sig img{max-height:18mm;max-width:100%;}' +
        '.nota-fotos{display:flex;flex-wrap:wrap;gap:6pt;padding:6pt;}' +
        '.nota-fotos img{width:45mm;height:34mm;object-fit:cover;}' +
        '@page{size:A4;margin:10mm;}' +
        '@media print{body{padding:0;}}';
}

function montarHtmlDocumentoImpressao(htmlCorpo) {
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<title>Joninha Suspensões</title>' +
        '<style>' + cssDocumentoImpressao() + '</style></head><body>' +
        (htmlCorpo || '') +
        '</body></html>';
}

function limparAposImpressao() {
    document.body.classList.remove('imprimindo');
    var el = document.getElementById('printNota');
    if (el) el.innerHTML = '';
    if (_printCleanupTimer) {
        clearTimeout(_printCleanupTimer);
        _printCleanupTimer = null;
    }
}

function aguardarImagensDoc(doc, cb) {
    var imgs = doc.images ? Array.prototype.slice.call(doc.images) : [];
    if (!imgs.length) {
        setTimeout(cb, 120);
        return;
    }
    var faltam = imgs.length;
    var feito = false;
    function tick() {
        faltam--;
        if (faltam <= 0 && !feito) {
            feito = true;
            setTimeout(cb, 180);
        }
    }
    imgs.forEach(function (img) {
        if (img.complete) tick();
        else {
            img.onload = tick;
            img.onerror = tick;
        }
    });
    setTimeout(function () {
        if (!feito) {
            feito = true;
            cb();
        }
    }, 4000);
}

function executarImpressaoHtml(html) {
    _htmlNotaImpressaoAtual = html || '';
    var docHtml = montarHtmlDocumentoImpressao(html);

    /* Celular: nova aba/janela evita tela branca no Android/iOS */
    if (ehCelular()) {
        var w = window.open('', '_blank');
        if (!w) {
            toast('Permita pop-ups para gerar o PDF.');
            return;
        }
        w.document.open();
        w.document.write(docHtml);
        w.document.close();
        aguardarImagensDoc(w.document, function () {
            try {
                w.focus();
                w.print();
            } catch (e) {
                toast('Toque em Compartilhar / Imprimir na barra do navegador.');
            }
        });
        return;
    }

    var iframe = document.getElementById('printFrame');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'printFrame';
        iframe.title = 'Impressão';
        document.body.appendChild(iframe);
    }
    /* Precisa ter tamanho real — iframe 0×0 gera PDF em branco no Chrome */
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;border:0;z-index:-1;opacity:0;pointer-events:none;';

    var idoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
    if (!idoc) {
        var w2 = window.open('', '_blank');
        if (!w2) {
            toast('Permita pop-ups para gerar o PDF.');
            return;
        }
        w2.document.open();
        w2.document.write(docHtml);
        w2.document.close();
        aguardarImagensDoc(w2.document, function () {
            try { w2.focus(); w2.print(); } catch (e) { /* ignore */ }
        });
        return;
    }

    idoc.open();
    idoc.write(docHtml);
    idoc.close();

    aguardarImagensDoc(idoc, function () {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            toast('Não foi possível abrir a impressão. Tente novamente.');
        }
    });
}

function abrirViewerPdf(html, titulo) {
    _htmlNotaImpressaoAtual = html || '';
    _tituloNotaImpressao = titulo || 'Espelho de Atendimento';
    var corpo = document.getElementById('viewerPdfCorpo');
    if (corpo) corpo.innerHTML = html || '';
    var viewer = document.getElementById('viewerPdfNota');
    if (viewer) {
        viewer.classList.add('aberto');
        viewer.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
}

function fecharViewerPdf() {
    var viewer = document.getElementById('viewerPdfNota');
    if (viewer) {
        viewer.classList.remove('aberto');
        viewer.setAttribute('aria-hidden', 'true');
    }
    var corpo = document.getElementById('viewerPdfCorpo');
    if (corpo) corpo.innerHTML = '';
    document.body.style.overflow = '';
}

async function encaminharNotaAtual() {
    var html = obterHtmlNotaAtual();
    if (!html) {
        toast('Abra a nota antes de encaminhar.');
        return;
    }
    _htmlNotaImpressaoAtual = html;
    var nomeArq = await perguntarNomeArquivoPdfAsync();
    if (!nomeArq) return;
    var titulo = nomeArq.replace(/\.pdf$/i, '');
    toast('Gerando PDF…');

    try {
        var blob = await gerarPdfBlobDaNota(html, nomeArq);
        if (!blob || blob.size < 800) throw new Error('PDF vazio');
        var arquivo = new File([blob], nomeArq, { type: 'application/pdf' });

        if (navigator.share && navigator.canShare) {
            try {
                if (navigator.canShare({ files: [arquivo] })) {
                    await navigator.share({ title: titulo, text: titulo, files: [arquivo] });
                    toast('PDF encaminhado: ' + nomeArq);
                    return;
                }
            } catch (errShare) {
                if (errShare && errShare.name === 'AbortError') return;
            }
        }

        /* iOS: não abrir blob em aba (fica branca). Tenta share sem canShare. */
        if (ehCelular() && navigator.share) {
            try {
                await navigator.share({ title: titulo, text: titulo, files: [arquivo] });
                toast('PDF encaminhado: ' + nomeArq);
                return;
            } catch (e2) {
                if (e2 && e2.name === 'AbortError') return;
            }
        }

        if (!ehCelular()) {
            baixarBlobComoArquivo(blob, nomeArq);
            toast('PDF salvo como ' + nomeArq);
            return;
        }
        toast('Use Salvar PDF e depois anexe no WhatsApp.');
    } catch (err) {
        console.error(err);
        toast('Falha ao gerar PDF. Tente de novo.');
    }
}

async function salvarNotaPdfArquivo() {
    var html = obterHtmlNotaAtual();
    if (!html) {
        toast('Abra a nota antes de salvar.');
        return;
    }
    _htmlNotaImpressaoAtual = html;
    var nomeArq = await perguntarNomeArquivoPdfAsync();
    if (!nomeArq) return;
    toast('Gerando PDF…');
    try {
        var blob = await gerarPdfBlobDaNota(html, nomeArq);
        if (!blob || blob.size < 800) throw new Error('PDF vazio');
        var arquivo = new File([blob], nomeArq, { type: 'application/pdf' });

        /* No celular, share = Salvar em Arquivos / Apps (evita tela branca) */
        if (ehCelular() && navigator.share) {
            try {
                await navigator.share({ title: nomeArq, files: [arquivo] });
                toast('PDF pronto: ' + nomeArq);
                return;
            } catch (errShare) {
                if (errShare && errShare.name === 'AbortError') return;
            }
        }

        baixarBlobComoArquivo(blob, nomeArq);
        toast('PDF salvo: ' + nomeArq);
    } catch (err) {
        console.error(err);
        toast('Não foi possível salvar o PDF.');
    }
}

function obterHtmlNotaAtual() {
    var noViewer = document.querySelector('#viewerPdfCorpo .nota-espelho');
    if (noViewer) return noViewer.outerHTML;
    var noModal = document.querySelector('#modalNotaCorpo .nota-espelho');
    if (noModal) return noModal.outerHTML;
    return _htmlNotaImpressaoAtual || '';
}

function nomeCurtoVeiculo(carro) {
    var p = String(carro || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    if (p.length === 1) return p[0].toUpperCase();
    return (p[0] + ' ' + p[1]).toUpperCase();
}

function nomeCurtoCliente(nome) {
    var p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return 'CLIENTE';
    return p[0].toUpperCase();
}

function nomeArquivoOrcamentoPdfPadrao(atendimento) {
    var db = carregar();
    var a = atendimento || atendimentoNotaAtual;
    var veiculo = a ? nomeCurtoVeiculo(a.carro) : '';
    var cliente = a ? nomeCurtoCliente(nomeAtendimento(db, a)) : 'CLIENTE';
    var partes = ['ORÇAMENTO'];
    if (veiculo) partes.push(veiculo);
    if (cliente) partes.push(cliente);
    return partes.join(' ');
}

function limparNomeArquivo(nome, ext) {
    var e = String(ext || 'pdf').replace(/^\./, '').toLowerCase() || 'pdf';
    var n = String(nome || '').trim();
    if (!n) n = 'ORÇAMENTO';
    n = n.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    n = n.replace(/\.(pdf|jpe?g|png)$/i, '');
    return n + '.' + e;
}

function limparNomeArquivoPdf(nome) {
    return limparNomeArquivo(nome, 'pdf');
}

var _nomePdfResolver = null;
var _nomeArquivoExt = 'pdf';
function perguntarNomeArquivoAsync(ext, tituloModal) {
    var e = String(ext || 'pdf').replace(/^\./, '').toLowerCase() || 'pdf';
    _nomeArquivoExt = e;
    return new Promise(function (resolve) {
        var input = document.getElementById('inputNomePdf');
        var modal = document.getElementById('modalNomePdf');
        var h3 = modal ? modal.querySelector('h3') : null;
        var hint = modal ? modal.querySelector('.hint') : null;
        if (h3) h3.textContent = tituloModal || ('Nome do ' + e.toUpperCase());
        if (hint) hint.textContent = 'Pode alterar antes de salvar ou enviar.';
        if (!input || !modal) {
            resolve(limparNomeArquivo(nomeArquivoOrcamentoPdfPadrao(), e));
            return;
        }
        _nomePdfResolver = resolve;
        input.value = nomeArquivoOrcamentoPdfPadrao().replace(/\.(pdf|jpe?g|png)$/i, '');
        modal.classList.add('aberto');
        setTimeout(function () {
            try {
                input.focus();
                input.select();
            } catch (err) { /* ignore */ }
        }, 80);
    });
}

function perguntarNomeArquivoPdfAsync() {
    return perguntarNomeArquivoAsync('pdf', 'Nome do PDF');
}

function fecharModalNomePdf(valor) {
    var modal = document.getElementById('modalNomePdf');
    if (modal) modal.classList.remove('aberto');
    var resolver = _nomePdfResolver;
    _nomePdfResolver = null;
    if (resolver) {
        if (valor == null) resolver(null);
        else resolver(limparNomeArquivo(valor, _nomeArquivoExt || 'pdf'));
    }
}

function nomeArquivoOrcamentoPdf(atendimento) {
    return limparNomeArquivoPdf(nomeArquivoOrcamentoPdfPadrao(atendimento));
}

function carregarHtml2Pdf() {
    return new Promise(function (resolve, reject) {
        if (typeof html2pdf !== 'undefined') {
            resolve();
            return;
        }
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        s.onload = function () { resolve(); };
        s.onerror = function () { reject(new Error('html2pdf')); };
        document.head.appendChild(s);
    });
}

function baixarBlobComoArquivo(blob, nomeArq) {
    /* Evita abrir aba em branco no iPhone */
    if (ehCelular()) {
        toast('No celular use Encaminhar PDF / compartilhar.');
        return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomeArq || 'ORCAMENTO.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        URL.revokeObjectURL(url);
        a.remove();
    }, 1500);
}

function aguardarImagensElemento(el) {
    return new Promise(function (resolve) {
        if (!el) {
            resolve();
            return;
        }
        var imgs = el.querySelectorAll ? el.querySelectorAll('img') : [];
        imgs = Array.prototype.slice.call(imgs);
        if (!imgs.length) {
            setTimeout(resolve, 60);
            return;
        }
        var faltam = imgs.length;
        var done = false;
        function tick() {
            faltam--;
            if (faltam <= 0 && !done) {
                done = true;
                setTimeout(resolve, 100);
            }
        }
        imgs.forEach(function (img) {
            if (img.complete) tick();
            else {
                img.onload = tick;
                img.onerror = tick;
            }
        });
        setTimeout(function () {
            if (!done) {
                done = true;
                resolve();
            }
        }, 3500);
    });
}

async function montarElementoRenderNota(html) {
    await carregarHtml2Pdf();
    var htmlFonte = html || obterHtmlNotaAtual();
    var wrap = document.createElement('div');
    wrap.id = 'hmPdfRenderTemp';
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1;';
    wrap.innerHTML = htmlFonte;
    document.body.appendChild(wrap);
    var alvo = wrap.querySelector('.nota-espelho') || wrap;

    var tabela = wrap.querySelector('.nota-topo-linha');
    if (tabela) {
        tabela.style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed;display:table;';
        var logoTd = wrap.querySelector('.nota-topo-logo');
        var dadosTd = wrap.querySelector('.nota-topo-dados');
        if (logoTd) logoTd.style.cssText = 'width:42%;vertical-align:middle;padding:0 10px 0 0;display:table-cell;';
        if (dadosTd) dadosTd.style.cssText = 'width:58%;vertical-align:middle;padding:0;display:table-cell;text-align:left;font-size:9.5pt;line-height:1.3;color:#222;';
        var img = wrap.querySelector('.nota-topo-logo img');
        if (img) img.style.cssText = 'display:block;width:100%;max-height:110px;height:auto;object-fit:contain;object-position:left center;';
        wrap.querySelectorAll('.nota-topo-dados .linha').forEach(function (ln) {
            ln.style.whiteSpace = 'nowrap';
            ln.style.display = 'block';
            ln.style.fontSize = '9pt';
            ln.style.lineHeight = '1.3';
        });
    }

    await aguardarImagensElemento(alvo);
    return { wrap: wrap, alvo: alvo };
}

function optHtml2CanvasNota() {
    return {
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794
    };
}

async function gerarPdfBlobDaNota(html, nomeArq) {
    var prep = await montarElementoRenderNota(html);
    var opt = {
        margin: [8, 8, 8, 8],
        filename: nomeArq || 'ORCAMENTO.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: optHtml2CanvasNota(),
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
        enableLinks: false
    };

    try {
        return await html2pdf().set(opt).from(prep.alvo).outputPdf('blob');
    } finally {
        if (prep.wrap && prep.wrap.parentNode) prep.wrap.parentNode.removeChild(prep.wrap);
    }
}

async function gerarJpegBlobDaNota(html) {
    var prep = await montarElementoRenderNota(html);
    try {
        var canvas = await html2pdf().set({
            html2canvas: optHtml2CanvasNota(),
            image: { type: 'jpeg', quality: 0.92 }
        }).from(prep.alvo).toCanvas();
        return await new Promise(function (resolve, reject) {
            if (!canvas || !canvas.toBlob) {
                reject(new Error('canvas'));
                return;
            }
            canvas.toBlob(function (b) {
                if (b && b.size > 200) resolve(b);
                else reject(new Error('jpeg vazio'));
            }, 'image/jpeg', 0.92);
        });
    } finally {
        if (prep.wrap && prep.wrap.parentNode) prep.wrap.parentNode.removeChild(prep.wrap);
    }
}

async function compartilharArquivoCliente(blob, nomeArq, mime, telefone, textoWa) {
    var arquivo = new File([blob], nomeArq, { type: mime || blob.type || 'application/octet-stream' });
    if (navigator.share) {
        try {
            if (!navigator.canShare || navigator.canShare({ files: [arquivo] })) {
                await navigator.share({
                    title: nomeArq.replace(/\.(pdf|jpe?g|png)$/i, ''),
                    text: textoWa || nomeArq,
                    files: [arquivo]
                });
                return 'shared';
            }
        } catch (errShare) {
            if (errShare && errShare.name === 'AbortError') return 'abort';
        }
    }
    if (!ehCelular()) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = nomeArq;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            URL.revokeObjectURL(url);
            a.remove();
        }, 1500);
        if (telefone || textoWa) {
            var msg = (textoWa || '') + '\n\n(Anexe o arquivo *' + nomeArq + '* que acabou de baixar.)';
            abrirWhatsApp(telefone || '', msg.trim());
        }
        return 'download';
    }
    toast('Seu celular não compartilhou o arquivo. Use Salvar e anexe no WhatsApp.');
    return 'fail';
}

function moeda(n) {
    var v = Number(n) || 0;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseMoeda(str) {
    if (typeof str === 'number') return str;
    var s = String(str || '').trim().replace(/[^\d,.-]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

function hojeISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
}

function fmtData(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
}

function docCliente(c) {
    return c.cpf || c.cnpj || '—';
}

function nomeCliente(db, id) {
    var c = db.clientes.find(function (x) { return x.id === id; });
    return c ? c.nome : '—';
}

function nomeAtendimento(db, a) {
    if (a.clienteAvulso || (!a.clienteId && a.clienteNome)) {
        return a.clienteNome || 'Avulso';
    }
    return nomeCliente(db, a.clienteId);
}

function resolverClienteAtendimento(db, texto) {
    var nome = String(texto || '').trim();
    if (!nome) return { ok: false };
    var lower = nome.toLowerCase();
    var exato = db.clientes.find(function (c) {
        return String(c.nome || '').trim().toLowerCase() === lower;
    });
    if (exato) {
        return { ok: true, clienteId: exato.id, clienteNome: exato.nome, clienteAvulso: false };
    }
    return { ok: true, clienteId: null, clienteNome: nome, clienteAvulso: true };
}

function snapshotClienteCadastro(db, resolvido) {
    if (!resolvido || !resolvido.ok) return null;
    if (resolvido.clienteAvulso) {
        return {
            nome: resolvido.clienteNome || '',
            avulso: true,
            cpf: '',
            cnpj: '',
            telefone: '',
            email: '',
            cidade: '',
            cep: '',
            endereco: '',
            numero: ''
        };
    }
    var c = db.clientes.find(function (x) { return x.id === resolvido.clienteId; });
    if (!c) {
        return { nome: resolvido.clienteNome || '', avulso: false };
    }
    return {
        nome: c.nome || '',
        avulso: false,
        cpf: c.cpf || '',
        cnpj: c.cnpj || '',
        telefone: c.telefone || c.tel || '',
        email: c.email || '',
        cidade: c.cidade || '',
        cep: c.cep || '',
        endereco: c.endereco || '',
        numero: c.numero || ''
    };
}

function dadosClienteDoAtendimento(db, a) {
    if (a && a.clienteCadastro) return a.clienteCadastro;
    if (a && a.clienteId) {
        return snapshotClienteCadastro(db, {
            ok: true,
            clienteId: a.clienteId,
            clienteNome: a.clienteNome,
            clienteAvulso: false
        });
    }
    return {
        nome: (a && a.clienteNome) || nomeAtendimento(db, a),
        avulso: !!(a && a.clienteAvulso),
        cpf: '', cnpj: '', telefone: '', email: '', cidade: '', cep: '', endereco: '', numero: ''
    };
}

function htmlCardClienteOs(cad) {
    if (!cad) return '';
    var linhas = [];
    if (cad.cpf) linhas.push('<div class="linha"><strong>CPF:</strong> ' + esc(cad.cpf) + '</div>');
    if (cad.cnpj) linhas.push('<div class="linha"><strong>CNPJ:</strong> ' + esc(cad.cnpj) + '</div>');
    if (cad.telefone) linhas.push('<div class="linha"><strong>Telefone:</strong> ' + esc(cad.telefone) + '</div>');
    if (cad.email) linhas.push('<div class="linha"><strong>E-mail:</strong> ' + esc(cad.email) + '</div>');
    var end = [cad.endereco, cad.numero].filter(Boolean).join(', ');
    if (end) linhas.push('<div class="linha"><strong>Endereço:</strong> ' + esc(end) + '</div>');
    if (cad.cep) linhas.push('<div class="linha"><strong>CEP:</strong> ' + esc(cad.cep) + '</div>');
    if (cad.cidade) linhas.push('<div class="linha"><strong>Cidade:</strong> ' + esc(cad.cidade) + '</div>');
    return '<div style="font-weight:700;margin-bottom:6px;color:#8fe0b8">Cadastro: ' + esc(cad.nome || '—') + '</div>' +
        (linhas.length ? linhas.join('') : '<div class="linha muted">Sem CPF/telefone no cadastro — complete em Clientes.</div>');
}

function atualizarStatusClienteAt() {
    var db = carregar();
    var texto = document.getElementById('atClienteBusca').value.trim();
    var status = document.getElementById('atClienteStatus');
    var hid = document.getElementById('atClienteId');
    var card = document.getElementById('atClienteCard');
    var waTel = document.getElementById('atWaTel');
    if (!texto) {
        hid.value = '';
        status.innerHTML = 'Digite as primeiras letras do nome para buscar no cadastro; se não existir, fica como cliente avulso.';
        card.style.display = 'none';
        card.innerHTML = '';
        return;
    }
    var r = resolverClienteAtendimento(db, texto);
    if (!r.clienteAvulso) {
        hid.value = r.clienteId;
        status.innerHTML = '<span style="color:#8fe0b8;font-weight:700">Cliente cadastrado</span> — dados do cadastro carregados abaixo.';
        var snap = snapshotClienteCadastro(db, r);
        card.innerHTML = htmlCardClienteOs(snap);
        card.style.display = '';
        if (waTel && snap && snap.telefone) waTel.value = snap.telefone;
    } else {
        hid.value = '';
        status.innerHTML = '<span style="color:#9fd3ff;font-weight:700">Cliente avulso</span> — informe o WhatsApp abaixo para enviar.';
        card.style.display = 'none';
        card.innerHTML = '';
    }
}

function preencherListaClientesAt(db, filtroTexto) {
    var lista = document.getElementById('listaClientesAt');
    var busca = document.getElementById('atClienteBusca');
    if (!lista) return;
    lista.innerHTML = '';
    var q = String(
        filtroTexto != null
            ? filtroTexto
            : (busca ? busca.value : '')
    ).trim().toLowerCase();
    /* Só sugere depois de digitar ao menos 1 letra — evita abrir a lista inteira ao clicar vazio */
    if (q.length < 1) {
        if (busca) busca.removeAttribute('list');
        return;
    }
    if (busca) busca.setAttribute('list', 'listaClientesAt');
    db.clientes.slice()
        .filter(function (c) {
            var nome = String(c.nome || '').toLowerCase();
            return nome.indexOf(q) === 0;
        })
        .sort(function (a, b) {
            return a.nome.localeCompare(b.nome, 'pt-BR');
        })
        .forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.nome;
            lista.appendChild(opt);
        });
}

function atualizarSugestoesClienteAt() {
    preencherListaClientesAt(carregar(), document.getElementById('atClienteBusca').value);
    atualizarStatusClienteAt();
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
    if (id === 'painelRelatorioDespesas') renderRelatorioDespesas();
    if (id === 'painelRelatorioOficina') renderRelatorioOficina();
    if (id === 'painelComissoes') renderComissoes();
    if (id === 'painelVeiculo') preencherSelectMaoFunc();
    if (id === 'painelDespesasOs') {
        canalVendas = 'interno';
        atualizarBadgeCanal();
        fecharBoxDespesaOs();
        renderDespesasOs();
    }
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
    painelDespesasOs: true,
    painelFuncionarios: true,
    painelListaFuncionarios: true,
    painelPagFuncionarios: true,
    painelProdutos: true,
    painelOrcamento: true,
    painelCaixa: true,
    painelCaixaBanco: true,
    painelPendentes: true,
    painelRelatorioCaixa: true,
    painelRelatorioDespesas: true
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

/* ---------- KPIs / selects ---------- */
function atualizarKPIs(db) {
    /* KPIs do painel sempre do balcão oficial (não misturar com interno) */
    db = carregarMain();
    document.getElementById('kpiClientes').textContent = db.clientes.length;
    document.getElementById('kpiAtend').textContent = db.atendimentos.length;
    document.getElementById('kpiProd').textContent = db.produtos.length;
    var cfg = db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 };
    var entradas = (db.caixa || []).filter(function (x) { return x.tipo === 'entrada'; })
        .reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
    var entBanco = (db.caixaBanco || []).filter(function (x) { return x.tipo === 'entrada'; })
        .reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
    document.getElementById('kpiCaixa').textContent = moeda((Number(cfg.inicialBalcao) || 0) + entradas + (Number(cfg.inicialBanco) || 0) + entBanco);
}

function preencherSelectsCliente(db) {
    preencherListaClientesAt(db);
    var listaCli = document.getElementById('listaClientesVenda');
    if (listaCli) {
        listaCli.innerHTML = '';
        db.clientes.slice().sort(function (a, b) {
            return a.nome.localeCompare(b.nome, 'pt-BR');
        }).forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.nome;
            listaCli.appendChild(opt);
        });
    }
    preencherListaProdutosVenda(db);
}

function preencherListaProdutosVenda(db) {
    var lista = document.getElementById('listaProdutosVenda');
    if (!lista) return;
    lista.innerHTML = '';
    (db.produtos || []).forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.nome + (p.codigo ? ' [' + p.codigo + ']' : '');
        lista.appendChild(opt);
    });
}

/* ---------- Clientes ---------- */
document.getElementById('formCliente').addEventListener('submit', function (e) {
    e.preventDefault();
    var db = carregar();
    var id = document.getElementById('cliId').value;
    var payload = {
        id: id || uid(),
        nome: document.getElementById('cliNome').value.trim(),
        cpf: document.getElementById('cliCpf').value.trim(),
        cnpj: document.getElementById('cliCnpj').value.trim(),
        telefone: document.getElementById('cliTel').value.trim(),
        email: document.getElementById('cliEmail').value.trim(),
        cidade: document.getElementById('cliCidade').value.trim(),
        cep: document.getElementById('cliCep').value.trim(),
        endereco: document.getElementById('cliEndereco').value.trim(),
        numero: document.getElementById('cliNumero').value.trim(),
        atualizadoEm: new Date().toISOString()
    };
    if (id) {
        var i = db.clientes.findIndex(function (c) { return c.id === id; });
        if (i >= 0) db.clientes[i] = Object.assign({}, db.clientes[i], payload);
    } else {
        payload.criadoEm = new Date().toISOString();
        db.clientes.push(payload);
    }
    limparExcluido(db, 'clientes', payload.id);
    salvar(db);
    limparFormCliente();
    toast(id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
    renderClientes();
    preencherSelectsCliente(db);
    atualizarKPIs(db);
});

function limparFormCliente() {
    document.getElementById('formCliente').reset();
    document.getElementById('cliId').value = '';
    document.getElementById('tituloFormCliente').textContent = 'Cadastro de Cliente';
    document.getElementById('btnCancelarCli').style.display = 'none';
}

document.getElementById('btnCancelarCli').addEventListener('click', limparFormCliente);

function editarCliente(id) {
    var db = carregar();
    var c = db.clientes.find(function (x) { return x.id === id; });
    if (!c) return;
    document.getElementById('cliId').value = c.id;
    document.getElementById('cliNome').value = c.nome || '';
    document.getElementById('cliCpf').value = c.cpf || '';
    document.getElementById('cliCnpj').value = c.cnpj || '';
    document.getElementById('cliTel').value = c.telefone || '';
    document.getElementById('cliEmail').value = c.email || '';
    document.getElementById('cliCidade').value = c.cidade || '';
    document.getElementById('cliCep').value = c.cep || '';
    document.getElementById('cliEndereco').value = c.endereco || '';
    document.getElementById('cliNumero').value = c.numero || '';
    document.getElementById('tituloFormCliente').textContent = 'Editar Cliente';
    document.getElementById('btnCancelarCli').style.display = '';
    abrirPainel('painelClientes');
}

function excluirCliente(id) {
    if (!confirm('Excluir este cliente do banco HM?')) return;
    var db = carregar();
    marcarExcluido(db, 'clientes', id);
    db.clientes = db.clientes.filter(function (c) { return c.id !== id; });
    salvar(db);
    toast('Cliente excluído.');
    renderTudo();
}

function renderClientes() {
    var db = carregar();
    var q = (document.getElementById('buscaCliente').value || '').toLowerCase().trim();
    var lista = db.clientes.filter(function (c) {
        if (!q) return true;
        return [c.nome, c.cpf, c.cnpj, c.telefone, c.cidade].join(' ').toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

    var tb = document.getElementById('tabelaClientes');
    var vazio = document.getElementById('listaClientesVazia');
    tb.innerHTML = '';
    if (!lista.length) {
        vazio.style.display = '';
        return;
    }
    vazio.style.display = 'none';
    lista.forEach(function (c) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td style="color:#fff;font-weight:800">' + esc(c.nome) + '</td>' +
            '<td style="color:#fff;font-weight:600">' + esc(docCliente(c)) + '</td>' +
            '<td style="color:#fff;font-weight:600">' + esc(c.telefone || '—') + '</td>' +
            '<td style="color:#fff;font-weight:600">' + esc(c.cidade || '—') + '</td>' +
            '<td class="actions">' +
            '<button type="button" class="btn btn-secondary" data-ed="' + c.id + '">Editar</button>' +
            '<button type="button" class="btn btn-primary" data-at="' + c.id + '">Atendimento</button>' +
            '<button type="button" class="btn btn-danger" data-ex="' + c.id + '">Excluir</button>' +
            '</td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-ed]').forEach(function (b) {
        b.addEventListener('click', function () { editarCliente(b.getAttribute('data-ed')); });
    });
    tb.querySelectorAll('[data-ex]').forEach(function (b) {
        b.addEventListener('click', function () { excluirCliente(b.getAttribute('data-ex')); });
    });
    tb.querySelectorAll('[data-at]').forEach(function (b) {
        b.addEventListener('click', function () {
            var db2 = carregar();
            var cid = b.getAttribute('data-at');
            var c = db2.clientes.find(function (x) { return x.id === cid; });
            abrirPainel('painelVeiculo');
            document.getElementById('atClienteId').value = cid;
            document.getElementById('atClienteBusca').value = c ? c.nome : '';
            atualizarStatusClienteAt();
        });
    });
}

document.getElementById('buscaCliente').addEventListener('input', renderClientes);

/* os: ver js/os.js (placa/fotos) */

function slugPasta(nome) {
    return String(nome || 'cliente')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 60) || 'cliente';
}

function dataUrlParaBlob(dataUrl) {
    var parts = String(dataUrl).split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(parts[1] || '');
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

function abrirDbPasta() {
    return new Promise(function (resolve, reject) {
        var req = indexedDB.open(PASTA_IDB, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('handles'); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
    });
}

async function salvarHandlePastaRaiz(handle) {
    var dbp = await abrirDbPasta();
    return new Promise(function (resolve, reject) {
        var tx = dbp.transaction('handles', 'readwrite');
        tx.objectStore('handles').put(handle, 'root');
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
    });
}

async function carregarHandlePastaRaiz() {
    try {
        var dbp = await abrirDbPasta();
        return await new Promise(function (resolve, reject) {
            var tx = dbp.transaction('handles', 'readonly');
            var req = tx.objectStore('handles').get('root');
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function () { reject(req.error); };
        });
    } catch (e) {
        return null;
    }
}

async function solicitarPermissaoPasta(handle) {
    if (!handle) return false;
    var perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'readwrite' });
    return perm === 'granted';
}

async function atualizarStatusPastaUI() {
    var el = document.getElementById('pastaStatusTexto');
    if (!el) return;
    if (!('showDirectoryPicker' in window)) {
        el.className = 'config-status aviso';
        el.innerHTML = '<strong>Pasta PC:</strong> disponível só no Chrome/Edge no computador. No celular use a sincronização da nuvem.';
        return;
    }
    var handle = await carregarHandlePastaRaiz();
    if (handle) {
        el.className = 'config-status';
        el.innerHTML = '<strong>Pasta PC:</strong> ' + esc(handle.name) + ' — ao salvar a OS, cria a subpasta do cliente e grava as fotos.';
    } else {
        el.className = 'config-status aviso';
        el.innerHTML = '<strong>Pasta PC:</strong> clique em "Escolher pasta no PC" (só na 1ª vez).';
    }
}

async function configurarPastaRaiz() {
    if (!('showDirectoryPicker' in window)) {
        toast('Para salvar na pasta do PC, use Chrome ou Edge no computador.');
        return;
    }
    try {
        var handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await salvarHandlePastaRaiz(handle);
        await atualizarStatusPastaUI();
        toast('Pasta configurada: ' + handle.name);
    } catch (err) {
        if (err && err.name !== 'AbortError') toast('Não foi possível configurar a pasta.');
    }
}

async function salvarAtendimentoNaPastaPC(atendimento, clienteNome) {
    var root = await carregarHandlePastaRaiz();
    if (!root) return { ok: false, motivo: 'pasta não configurada' };
    if (!(await solicitarPermissaoPasta(root))) return { ok: false, motivo: 'sem permissão na pasta' };
    var pastaCliente = await root.getDirectoryHandle(slugPasta(clienteNome), { create: true });
    var base = slugPasta((atendimento.placa || 'placa') + '_' + String(atendimento.id || '').slice(-6));
    var copia = JSON.parse(JSON.stringify(atendimento));
    var fotos = copia.fotos || [];
    for (var i = 0; i < fotos.length; i++) {
        var f = fotos[i];
        var src = f.data || f.url;
        if (!src) continue;
        var nomeFoto = base + '_foto_' + (i + 1) + '.jpg';
        try {
            var blob = src.indexOf('data:') === 0 ? dataUrlParaBlob(src) : await (await fetch(src)).blob();
            var fh = await pastaCliente.getFileHandle(nomeFoto, { create: true });
            var w = await fh.createWritable();
            await w.write(blob);
            await w.close();
            f.arquivo = nomeFoto;
            delete f.data;
        } catch (e) { /* segue */ }
    }
    var fhJson = await pastaCliente.getFileHandle(base + '.json', { create: true });
    var wj = await fhJson.createWritable();
    await wj.write(JSON.stringify(copia, null, 2));
    await wj.close();
    return { ok: true, pasta: root.name + '/' + slugPasta(clienteNome) };
}

/* nuvem: ver js/nuvem.js */

document.getElementById('btnConfigPasta').addEventListener('click', configurarPastaRaiz);
document.getElementById('btnAtualizarPasta').addEventListener('click', atualizarStatusPastaUI);

/* auth: ver js/auth.js */

/* os: ver js/os.js (itens/salvar/editar) */

/* ---------- Nota / PDF / Assinatura (base do relatório de veículos) ---------- */
function carregarAssinaturas() {
    try {
        return JSON.parse(localStorage.getItem(ASSIN_KEY) || '{}') || {};
    } catch (e) { return {}; }
}

function salvarAssinaturas(mapa) {
    localStorage.setItem(ASSIN_KEY, JSON.stringify(mapa));
}

function sincronizarAssinaturasNoDb() {
    var mapa = carregarAssinaturas();
    var db = carregar();
    var mudou = false;
    db.atendimentos.forEach(function (a) {
        if (!a.tokenAssinatura) return;
        var pack = mapa[a.tokenAssinatura];
        if (!pack || !pack.assinaturaCliente) return;
        if (a.assinaturaCliente !== pack.assinaturaCliente) {
            a.assinaturaCliente = pack.assinaturaCliente;
            a.assinadoEm = pack.assinadoEm || null;
            mudou = true;
        }
    });
    if (mudou) salvar(db);
    return mudou;
}

async function sincronizarAssinaturasDaNuvem() {
    if (!usuarioNuvemLogado()) return false;
    var db = carregar();
    var mapa = carregarAssinaturas();
    var mudou = false;
    var pendentes = (db.atendimentos || []).filter(function (a) {
        return a.tokenAssinatura && !a.assinaturaCliente;
    });
    for (var i = 0; i < pendentes.length; i++) {
        var a = pendentes[i];
        var pack = await puxarAssinaturaNuvem(a.tokenAssinatura);
        if (!pack || !pack.assinaturaCliente) continue;
        mapa[a.tokenAssinatura] = Object.assign({}, mapa[a.tokenAssinatura] || {}, pack);
        a.assinaturaCliente = pack.assinaturaCliente;
        a.assinadoEm = pack.assinadoEm || null;
        mudou = true;
    }
    if (mudou) {
        salvarAssinaturas(mapa);
        salvar(db);
    }
    return mudou;
}

function gerarTokenAssinatura() {
    return 'joninha_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

function urlBasePasta() {
    return (location.href || '').split('#')[0].split('?')[0].replace(/[^/\\]+$/, '');
}

function urlLinkAssinatura(token) {
    return urlBasePasta() + 'assinar-joninha.html?t=' + encodeURIComponent(token);
}

async function enviarPackAssinaturaNuvem(pack) {
    if (!pack || !pack.token) return { ok: false };
    try {
        var sessao = await obterSessaoFirebase();
        var fsMod = sessao.fsMod;
        var dbFs = sessao.dbFs;
        await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_assinaturas', pack.token), pack, { merge: true });
        return { ok: true };
    } catch (e) {
        return { ok: false, motivo: (e && (e.message || e.code)) || 'falha' };
    }
}

async function puxarAssinaturaNuvem(token) {
    if (!token) return null;
    try {
        var sessao = await obterSessaoFirebase();
        var snap = await sessao.fsMod.getDoc(sessao.fsMod.doc(sessao.dbFs, 'joninha_assinaturas', token));
        if (!snap.exists()) return null;
        return snap.data() || null;
    } catch (e) {
        return null;
    }
}

function badgeAssinatura(a) {
    if (a.assinaturaCliente) return '<span class="badge-assinado">Assinado</span>';
    if (a.tokenAssinatura) return '<span class="badge-pendente">Aguardando assinatura</span>';
    return '';
}

function htmlItensNota(itens) {
    var lista = itens || [];
    if (!lista.length) return '<p style="color:#000;font-size:0.85rem;">Sem itens lançados.</p>';
    var rows = lista.map(function (it) {
        var tipo = (it.tipo === 'mao') ? 'Mão de obra' : 'Peça';
        return '<tr><td>' + esc(tipo) + '</td><td>' + esc(it.desc || '') + '</td><td style="text-align:right">' + moeda(it.valor) + '</td></tr>';
    }).join('');
    var pecas = lista.reduce(function (s, it) { return s + ((it.tipo || 'peca') === 'peca' ? (Number(it.valor) || 0) : 0); }, 0);
    var mao = lista.reduce(function (s, it) { return s + (it.tipo === 'mao' ? (Number(it.valor) || 0) : 0); }, 0);
    return '<table class="nota-itens compacta"><thead><tr><th>Tipo</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead><tbody>' +
        rows + '</tbody></table>' +
        '<div class="nota-subtotais compacto">Peças: <strong>' + moeda(pecas) +
        '</strong> · Mão de obra: <strong>' + moeda(mao) + '</strong></div>' +
        '<div class="nota-total compacto">Total: ' + moeda(pecas + mao) + '</div>';
}

function htmlBlocoChecklistNota(mapa) {
    if (!mapa) return '';
    var linhas = [];
    Object.keys(CHECKLIST_LABELS).forEach(function (k) {
        if (mapa[k]) linhas.push('<li>☑ ' + esc(CHECKLIST_LABELS[k]) + '</li>');
    });
    if (!linhas.length) return '';
    return '<div class="nota-bloco compacto"><div class="tit vermelho">Checklist de chegada</div>' +
        '<ul style="margin:0;padding-left:18px;font-size:0.92rem;line-height:1.45">' + linhas.join('') + '</ul></div>';
}

function textoChecklistLinhas(mapa) {
    var linhas = [];
    Object.keys(CHECKLIST_LABELS).forEach(function (k) {
        if (mapa && mapa[k]) linhas.push('☑ ' + CHECKLIST_LABELS[k]);
    });
    return linhas;
}

function htmlNotaEspelho(db, a, opts) {
    opts = opts || {};
    var incluirFotos = !!opts.incluirFotos;
    var tituloDoc = opts.tituloDoc || 'ESPELHO DE ATENDIMENTO';
    var emp = getEmpresa(db);
    var cad = dadosClienteDoAtendimento(db, a);
    var nome = cad.nome || nomeAtendimento(db, a);
    var sigEspaco = '';
    var sigBase = 'Assinatura do Cliente';
    if (a.assinaturaCliente) {
        sigEspaco = '<img src="' + a.assinaturaCliente + '" alt="Assinatura">';
        sigBase = 'Assinado em ' + esc(fmtData(a.assinadoEm) + (a.assinadoEm && a.assinadoEm.length > 10 ? ' ' + String(a.assinadoEm).slice(11, 16) : ''));
    }
    var endCli = [cad.endereco, cad.numero].filter(Boolean).join(', ');
    var blocoFotos = '';
    if (incluirFotos && a.fotos && a.fotos.length) {
        blocoFotos =
            '<div class="nota-bloco compacto"><div class="tit azul">Fotos do veículo</div><div class="nota-fotos">' +
            a.fotos.map(function (f) {
                var s = f.url || f.data;
                return s ? '<img src="' + s + '" alt="Foto">' : '';
            }).join('') +
            '</div></div>';
    }
    var blocoChecklist = htmlBlocoChecklistNota(a.checklist);
    return '<div class="nota-espelho" id="notaEspelhoHtml">' +
        htmlCabecalhoNotaEmpresa(emp,
            '<div class="nota-sub nota-titulo-espelho">' + esc(tituloDoc) + '</div>' +
            '<div class="nota-sub nota-registro">Registro ' + esc(fmtData(a.entrada || a.criadoEm)) +
            (a.id ? ' · ID ' + esc(String(a.id).slice(-6)) : '') + '</div>'
        ) +
        '<div class="nota-bloco compacto"><div class="tit azul">Cliente</div><div class="nota-grid nota-grid-compacta">' +
        '<div class="nota-campo full"><span class="nota-label">Cliente</span><span class="nota-valor">' + esc(nome) + (cad.avulso || a.clienteAvulso ? ' (avulso)' : '') + '</span></div>' +
        (cad.cpf ? '<div class="nota-campo"><span class="nota-label">CPF</span><span class="nota-valor">' + esc(cad.cpf) + '</span></div>' : '') +
        (cad.cnpj ? '<div class="nota-campo"><span class="nota-label">CNPJ</span><span class="nota-valor">' + esc(cad.cnpj) + '</span></div>' : '') +
        (cad.telefone ? '<div class="nota-campo"><span class="nota-label">Telefone</span><span class="nota-valor">' + esc(cad.telefone) + '</span></div>' : '') +
        (cad.email ? '<div class="nota-campo full"><span class="nota-label">E-mail</span><span class="nota-valor">' + esc(cad.email) + '</span></div>' : '') +
        (endCli ? '<div class="nota-campo full"><span class="nota-label">Endereço</span><span class="nota-valor">' + esc(endCli) + (cad.cidade ? ' — ' + esc(cad.cidade) : '') + '</span></div>' : '') +
        '</div></div>' +
        '<div class="nota-bloco compacto"><div class="tit vermelho">Veículo</div><div class="nota-grid nota-grid-compacta">' +
        '<div class="nota-campo"><span class="nota-label">Modelo</span><span class="nota-valor">' + esc(a.carro || '—') + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Placa</span><span class="nota-valor" style="letter-spacing:2px;font-weight:700">' + esc((a.placa || '—').toUpperCase()) + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Cidade / UF</span><span class="nota-valor">' + esc(a.cidadePlaca || '—') + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Km</span><span class="nota-valor">' + esc(a.km ? a.km + ' Km' : '—') + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Cor</span><span class="nota-valor">' + esc(a.cor || '—') + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Ano fab.</span><span class="nota-valor">' + esc(a.anoFabricacao || '—') + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Ano modelo</span><span class="nota-valor">' + esc(a.anoModelo || '—') + '</span></div>' +
        '<div class="nota-campo full"><span class="nota-label">Chassi</span><span class="nota-valor nota-chassi">' + esc((a.chassi || '—').toUpperCase()) + '</span></div>' +
        '</div></div>' +
        blocoChecklist +
        '<div class="nota-bloco compacto"><div class="tit escuro">Oficina, Chegada &amp; Serviços</div><div class="nota-grid nota-grid-compacta">' +
        '<div class="nota-campo"><span class="nota-label">Responsável</span><span class="nota-valor">' + esc(a.responsavel || '—') + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Status</span><span class="nota-valor">' + esc(a.status || '—') +
        (a.status === 'Agendado' && a.agendadoPara ? ' · ' + esc(fmtData(a.agendadoPara)) : '') + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Entrada</span><span class="nota-valor">' + esc(fmtData(a.entrada)) + '</span></div>' +
        '<div class="nota-campo"><span class="nota-label">Saída</span><span class="nota-valor">' + esc(fmtData(a.saida)) + '</span></div>' +
        (a.agendadoPara ? '<div class="nota-campo full"><span class="nota-label">Agendado para</span><span class="nota-valor">' + esc(fmtData(a.agendadoPara)) + '</span></div>' : '') +
        '<div class="nota-campo full"><span class="nota-label">Estado de chegada</span><span class="nota-valor">' + esc(a.estado || 'Sem observações.') + '</span></div>' +
        '<div class="nota-campo full"><span class="nota-label">Serviços</span><span class="nota-valor" style="color:#000;font-weight:800">' + esc(a.servicos || '—') + '</span></div>' +
        '</div></div>' +
        blocoFotos +
        '<div class="nota-bloco compacto"><div class="tit verde">Valores</div><div class="nota-valores-pad compacto">' + htmlItensNota(a.itens) + '</div></div>' +
        '<div class="nota-sigs compacto">' +
        '<div class="nota-sig"><div class="nota-sig-espaco"></div><div class="nota-sig-base">Assinatura do Responsável</div></div>' +
        '<div class="nota-sig"><div class="nota-sig-espaco">' + sigEspaco + '</div><div class="nota-sig-base">' + sigBase + '</div></div>' +
        '</div></div>';
}

function atendimentoTemFotos(a) {
    return !!(a && a.fotos && a.fotos.some(function (f) {
        return f && (f.data || f.url || f.id || f.arquivo);
    }));
}

function contarFotosVisiveis(a) {
    if (!a || !a.fotos) return 0;
    return a.fotos.filter(function (f) {
        return f && (f.data || f.url || f.id || f.arquivo);
    }).length;
}

var _fotosClienteResolve = null;
function perguntarEnviarComFotos(a, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
        var tem = atendimentoTemFotos(a);
        var n = contarFotosVisiveis(a);
        var btnCom = document.getElementById('btnFotosSim');
        var msg = document.getElementById('modalFotosClienteMsg');
        if (!tem && !opts.forcarPergunta) {
            resolve(false);
            return;
        }
        _fotosClienteResolve = resolve;
        /* Sempre mostra as duas opções */
        btnCom.style.display = '';
        btnCom.disabled = false;
        if (tem) {
            msg.textContent = 'Há ' + n + ' foto(s) na ficha (uso interno). Escolha como enviar a nota ao cliente:';
        } else {
            msg.textContent = 'Não há fotos neste atendimento ainda. Você pode enviar SEM FOTOS, ou editar a OS e anexar fotos antes.';
        }
        document.getElementById('modalFotosCliente').classList.add('aberto');
    });
}
function fecharModalFotosCliente(resposta) {
    document.getElementById('modalFotosCliente').classList.remove('aberto');
    var btnCom = document.getElementById('btnFotosSim');
    if (btnCom) { btnCom.style.display = ''; btnCom.disabled = false; }
    if (_fotosClienteResolve) {
        var r = _fotosClienteResolve;
        _fotosClienteResolve = null;
        r(resposta);
    }
}

document.getElementById('btnFotosSim').addEventListener('click', function () { fecharModalFotosCliente(true); });
document.getElementById('btnFotosNao').addEventListener('click', function () { fecharModalFotosCliente(false); });
document.getElementById('btnFotosCancelar').addEventListener('click', function () { fecharModalFotosCliente(null); });
document.getElementById('modalFotosCliente').addEventListener('click', function (e) {
    if (e.target.id === 'modalFotosCliente') fecharModalFotosCliente(null);
});

var _exportFotosCtx = null; /* { atendimento } ou { lista: fotosAtuais } */
function abrirModalExportFotos(ctx) {
    var fotos = (ctx && ctx.atendimento && ctx.atendimento.fotos) || (ctx && ctx.lista) || [];
    if (!fotos.length) { toast('Não há fotos para exportar.'); return; }
    _exportFotosCtx = ctx;
    document.getElementById('modalExportFotos').classList.add('aberto');
}
function fecharModalExportFotos() {
    document.getElementById('modalExportFotos').classList.remove('aberto');
    _exportFotosCtx = null;
}

function listaFotosExport() {
    if (!_exportFotosCtx) return [];
    if (_exportFotosCtx.atendimento) return _exportFotosCtx.atendimento.fotos || [];
    return _exportFotosCtx.lista || [];
}

function baixarDataUrl(dataUrl, nomeArquivo) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function dataUrlParaFormato(dataUrl, mime) {
    return new Promise(function (resolve, reject) {
        if (!dataUrl) { reject(new Error('sem imagem')); return; }
        if (mime === 'image/jpeg' && String(dataUrl).indexOf('data:image/jpeg') === 0) {
            resolve(dataUrl);
            return;
        }
        var img = new Image();
        img.onload = function () {
            var canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            var ctx = canvas.getContext('2d');
            if (mime === 'image/jpeg') {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.92 : undefined));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

async function exportarFotosFormato(formato) {
    var fotos = listaFotosExport().filter(function (f) { return f && (f.data || f.url); });
    if (!fotos.length) { toast('Não há fotos para exportar.'); return; }
    var baseNome = 'hm_fotos';
    if (_exportFotosCtx && _exportFotosCtx.atendimento) {
        var at = _exportFotosCtx.atendimento;
        baseNome = slugPasta((at.clienteNome || 'cliente') + '_' + (at.placa || 'placa') + '_' + String(at.id || '').slice(-6));
    } else if (_exportFotosCtx && _exportFotosCtx.lista) {
        var placaForm = (document.getElementById('atPlaca') && document.getElementById('atPlaca').value) || 'placa';
        var cliForm = (document.getElementById('atClienteBusca') && document.getElementById('atClienteBusca').value) || 'cliente';
        baseNome = slugPasta(cliForm + '_' + placaForm);
    }
    if (formato === 'pdf') {
        var html = '<div class="nota-espelho"><div class="nota-topo"><h1>Fotos do veículo (interno)</h1>' +
            '<div class="nota-sub">' + esc(baseNome) + ' · ' + fotos.length + ' foto(s)</div></div>' +
            '<div class="nota-fotos">' +
            fotos.map(function (f, i) {
                var s = f.data || f.url;
                return s ? '<div style="margin-bottom:12px;page-break-inside:avoid"><div class="nota-sub">Foto ' + (i + 1) + '</div><img src="' + s + '" style="max-width:100%;height:auto"></div>' : '';
            }).join('') +
            '</div></div>';
        fecharModalExportFotos();
        executarImpressaoHtml(html);
        return;
    }
    var mime = formato === 'png' ? 'image/png' : 'image/jpeg';
    var ext = formato === 'png' ? 'png' : 'jpg';
    for (var i = 0; i < fotos.length; i++) {
        try {
            var src = fotos[i].data || fotos[i].url;
            var out = await dataUrlParaFormato(src, mime);
            baixarDataUrl(out, baseNome + '_foto_' + (i + 1) + '.' + ext);
            await new Promise(function (r) { setTimeout(r, 350); });
        } catch (e) { /* segue */ }
    }
    fecharModalExportFotos();
    toast(fotos.length + ' arquivo(s) ' + ext.toUpperCase() + ' exportado(s).');
}

document.getElementById('btnExpJpeg').addEventListener('click', function () { exportarFotosFormato('jpeg'); });
document.getElementById('btnExpPng').addEventListener('click', function () { exportarFotosFormato('png'); });
document.getElementById('btnExpPdf').addEventListener('click', function () { exportarFotosFormato('pdf'); });
document.getElementById('btnExpFechar').addEventListener('click', fecharModalExportFotos);
document.getElementById('modalExportFotos').addEventListener('click', function (e) {
    if (e.target.id === 'modalExportFotos') fecharModalExportFotos();
});
document.getElementById('btnExportarFotosForm').addEventListener('click', function () {
    abrirModalExportFotos({ lista: fotosAtuais.slice() });
});

function abrirNota(id) {
    sincronizarAssinaturasNoDb();
    var db = carregar();
    var a = db.atendimentos.find(function (x) { return x.id === id; });
    if (!a) { toast('Atendimento não encontrado.'); return; }
    atendimentoNotaAtual = a;
    var titulo = 'Nota — ' + (a.placa || '').toUpperCase() + ' · ' + nomeAtendimento(db, a);
    var html = htmlNotaEspelho(db, a, { incluirFotos: true }) +
        (atendimentoTemFotos(a)
            ? '<p class="hint" style="margin-top:10px;color:#e61e25">Fotos acima são internas. Em <strong>Enviar nota ao cliente</strong> você escolhe COM FOTOS ou SEM FOTOS.</p>'
            : '');
    _htmlNotaImpressaoAtual = htmlNotaEspelho(db, a, { incluirFotos: true });
    _tituloNotaImpressao = titulo;

    if (ehCelular()) {
        abrirViewerPdf(_htmlNotaImpressaoAtual, titulo);
        return;
    }

    document.getElementById('modalNotaTitulo').textContent = titulo;
    document.getElementById('modalNotaCorpo').innerHTML = html;
    document.getElementById('btnNotaExportFotos').style.display = atendimentoTemFotos(a) ? '' : 'none';
    document.getElementById('modalNota').classList.add('aberto');
}

function fecharNota() {
    document.getElementById('modalNota').classList.remove('aberto');
    fecharViewerPdf();
}

async function imprimirNotaPdf(id) {
    sincronizarAssinaturasNoDb();
    var db = carregar();
    var a = id ? db.atendimentos.find(function (x) { return x.id === id; }) : atendimentoNotaAtual;
    if (!a) { toast('Selecione um atendimento.'); return; }
    atendimentoNotaAtual = a;
    var comFotos = await perguntarEnviarComFotos(a, { forcarPergunta: true });
    if (comFotos === null) return;
    if (comFotos) {
        a = await garantirFotosCarregadas(a);
        var okFoto = (a.fotos || []).some(function (f) { return f && (f.data || f.url); });
        if (!okFoto) {
            toast('Não há fotos disponíveis — imprimindo só o documento.');
            comFotos = false;
        }
    }
    var html = htmlNotaEspelho(db, a, { incluirFotos: !!comFotos });
    var titulo = 'Espelho — ' + (a.placa || '').toUpperCase() + ' · ' + nomeAtendimento(db, a);
    _htmlNotaImpressaoAtual = html;
    _tituloNotaImpressao = titulo;

    if (ehCelular()) {
        /* No celular: abre viewer legível; usuário escolhe Imprimir / Encaminhar / Fechar */
        fecharNota();
        abrirViewerPdf(html, titulo);
        return;
    }
    executarImpressaoHtml(html);
}

function documentoAssinatura(db, a, incluirFotos) {
    var emp = getEmpresa(db);
    var cad = dadosClienteDoAtendimento(db, a);
    var doc = {
        atendimentoId: a.id,
        nomeCliente: cad.nome || nomeAtendimento(db, a),
        clienteAvulso: !!(cad.avulso || a.clienteAvulso),
        clienteCadastro: cad,
        cpf: cad.cpf || '',
        cnpj: cad.cnpj || '',
        telefone: cad.telefone || '',
        email: cad.email || '',
        responsavel: a.responsavel || '',
        carro: a.carro || '',
        placa: a.placa || '',
        cidadePlaca: a.cidadePlaca || '',
        cor: a.cor || '',
        anoFabricacao: a.anoFabricacao || '',
        anoModelo: a.anoModelo || '',
        chassi: a.chassi || '',
        km: a.km || '',
        entrada: a.entrada || '',
        saida: a.saida || '',
        status: a.status || '',
        agendadoPara: a.agendadoPara || '',
        estado: a.estado || '',
        checklist: a.checklist || null,
        checklistTexto: textoChecklistLinhas(a.checklist || {}).join('\n'),
        diagnostico: a.diagnostico || '',
        servicos: a.servicos || '',
        itens: a.itens || [],
        total: a.total || 0,
        empresa: emp.nome || 'Joninha Suspensões',
        empresaEndereco: enderecoCompleto(emp),
        empresaTelefone: emp.telefone || '',
        empresaCnpj: emp.cnpj || '',
        empresaIe: emp.ie || '',
        empresaLogo: logoSrc(emp)
    };
    if (incluirFotos && a.fotos && a.fotos.length) {
        doc.fotos = a.fotos.map(function (f) {
            return { id: f.id, url: f.url || null, data: f.data || null };
        }).filter(function (f) { return f.data || f.url; });
    }
    return doc;
}

async function garantirFotosCarregadas(a) {
    if (!a || !a.fotos || !a.fotos.length) return a;
    var precisa = a.fotos.some(function (f) { return f && f.id && !f.data && !f.url; });
    if (!precisa) return a;
    var cfgN = carregarConfigNuvem();
    if (!cfgN || !cfgN.apiKey || !cfgN.projectId) return a;
    try {
        await hidratarFotosDaNuvem(a);
        var db = carregar();
        var ix = db.atendimentos.findIndex(function (x) { return x.id === a.id; });
        if (ix >= 0) {
            db.atendimentos[ix].fotos = a.fotos;
            salvar(db);
        }
    } catch (e) { /* segue */ }
    return a;
}

async function abrirLinkAssinatura(id) {
    var db = carregar();
    var a = db.atendimentos.find(function (x) { return x.id === id; });
    if (!a) { toast('Atendimento não encontrado.'); return; }
    var comFotos = await perguntarEnviarComFotos(a, { forcarPergunta: true });
    if (comFotos === null) return;
    if (comFotos) {
        a = await garantirFotosCarregadas(a);
        var okFoto = (a.fotos || []).some(function (f) { return f && (f.data || f.url); });
        if (!okFoto) {
            toast('Não há fotos disponíveis neste atendimento. Enviando só o documento.');
            comFotos = false;
        }
    }
    if (!a.tokenAssinatura) a.tokenAssinatura = gerarTokenAssinatura();

    var mapa = carregarAssinaturas();
    var prev = mapa[a.tokenAssinatura] || {};
    var pack = {
        token: a.tokenAssinatura,
        atendimentoId: a.id,
        documento: documentoAssinatura(db, a, !!comFotos),
        criadoEm: prev.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        assinaturaCliente: prev.assinaturaCliente || a.assinaturaCliente || null,
        assinadoEm: prev.assinadoEm || a.assinadoEm || null
    };
    mapa[a.tokenAssinatura] = pack;
    salvarAssinaturas(mapa);

    var i = db.atendimentos.findIndex(function (x) { return x.id === a.id; });
    if (i >= 0) {
        db.atendimentos[i].tokenAssinatura = a.tokenAssinatura;
        if (pack.assinaturaCliente) {
            db.atendimentos[i].assinaturaCliente = pack.assinaturaCliente;
            db.atendimentos[i].assinadoEm = pack.assinadoEm;
        }
        salvar(db);
    }

    var nuvMsg = '';
    var cfgN = carregarConfigNuvem();
    if (cfgN && cfgN.apiKey && cfgN.projectId && usuarioNuvemLogado()) {
        var up = await enviarPackAssinaturaNuvem(pack);
        nuvMsg = up.ok ? ' · nuvem OK (cliente assina no celular)' : ' · nuvem: ' + (up.motivo || 'falhou');
    } else {
        nuvMsg = ' · faça login na nuvem para o cliente assinar pelo WhatsApp no celular';
    }

    var link = urlLinkAssinatura(a.tokenAssinatura);
    document.getElementById('inputLinkAssinatura').value = link;
    document.getElementById('modalLinkAssinatura').classList.add('aberto');
    atendimentoNotaAtual = db.atendimentos[i] || a;
    toast(
        (pack.assinaturaCliente ? 'Cliente já assinou — link reenviado.' : 'Link pronto — envie ao cliente.') +
        (comFotos ? ' (com fotos)' : ' (sem fotos)') + nuvMsg
    );
    renderHistorico();
}

function fecharModalLink() {
    document.getElementById('modalLinkAssinatura').classList.remove('aberto');
}

function aplicarAssinaturaImportada(data) {
    if (!data || !data.token || !data.assinaturaCliente) {
        toast('Arquivo de assinatura inválido.');
        return;
    }
    var mapa = carregarAssinaturas();
    var pack = mapa[data.token] || { token: data.token, documento: data.documento || null };
    pack.assinaturaCliente = data.assinaturaCliente;
    pack.assinadoEm = data.assinadoEm || new Date().toISOString();
    pack.atualizadoEm = new Date().toISOString();
    if (data.atendimentoId) pack.atendimentoId = data.atendimentoId;
    mapa[data.token] = pack;
    salvarAssinaturas(mapa);

    var db = carregar();
    var alvo = db.atendimentos.find(function (a) {
        return a.tokenAssinatura === data.token || a.id === data.atendimentoId || a.id === pack.atendimentoId;
    });
    if (alvo) {
        alvo.assinaturaCliente = pack.assinaturaCliente;
        alvo.assinadoEm = pack.assinadoEm;
        alvo.tokenAssinatura = data.token;
        salvar(db);
    }
    toast('Assinatura importada com sucesso.');
    renderHistorico();
    if (atendimentoNotaAtual && (atendimentoNotaAtual.id === (alvo && alvo.id))) {
        abrirNota(atendimentoNotaAtual.id);
    }
}

function renderHistorico() {
    sincronizarAssinaturasNoDb();
    var db = carregar();
    var q = (document.getElementById('buscaAtend').value || '').toLowerCase().trim();
    var lista = db.atendimentos.slice().filter(function (a) {
        if (!q) return true;
        var nome = nomeAtendimento(db, a);
        return [nome, a.carro, a.placa, a.status, a.servicos, a.agendadoPara, fmtData(a.agendadoPara)]
            .join(' ').toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) {
        var aAg = (a.status || '') === 'Agendado' ? 0 : 1;
        var bAg = (b.status || '') === 'Agendado' ? 0 : 1;
        if (aAg !== bAg) return aAg - bAg;
        if (aAg === 0) {
            return String(a.agendadoPara || '9999').localeCompare(String(b.agendadoPara || '9999'));
        }
        return String(b.entrada || b.criadoEm || '').localeCompare(String(a.entrada || a.criadoEm || ''));
    });

    /* Destaque no topo: chips dos agendados */
    var boxAg = document.getElementById('boxAgendadosDestaque');
    var chips = document.getElementById('listaAgendadosChips');
    var agendados = lista.filter(function (a) { return (a.status || '') === 'Agendado'; });
    if (boxAg && chips) {
        if (!agendados.length) {
            boxAg.style.display = 'none';
            chips.innerHTML = '';
        } else {
            boxAg.style.display = '';
            chips.innerHTML = agendados.map(function (a) {
                var nome = nomeAtendimento(db, a);
                return '<button type="button" class="chip-agendado" data-ed-ag="' + esc(a.id) + '">' +
                    '<span class="chip-data">📅 ' + esc(fmtData(a.agendadoPara) || 'Sem data') + '</span>' +
                    '<span class="chip-info">' + esc((a.placa || '—').toUpperCase()) + ' · ' + esc(a.carro || '—') + '</span>' +
                    '<span class="chip-cli">' + esc(nome) + '</span>' +
                    '</button>';
            }).join('');
            chips.querySelectorAll('[data-ed-ag]').forEach(function (b) {
                b.addEventListener('click', function () {
                    editarAtendimento(b.getAttribute('data-ed-ag'));
                });
            });
        }
    }

    var tb = document.getElementById('tabelaAtend');
    var vazio = document.getElementById('listaAtendVazia');
    tb.innerHTML = '';
    if (!lista.length) { vazio.style.display = ''; return; }
    vazio.style.display = 'none';
    lista.forEach(function (a) {
        var nome = nomeAtendimento(db, a);
        var tagAvulso = a.clienteAvulso
            ? ' <span style="font-size:0.68rem;font-weight:700;color:#8fe0b8">AVULSO</span>'
            : '';
        var statusAtual = a.status || 'Em andamento';
        var ehAgendado = statusAtual === 'Agendado';
        var badgeAg = ehAgendado
            ? '<div class="badge-agendado">📅 Agendado' +
                (a.agendadoPara ? ' · ' + esc(fmtData(a.agendadoPara)) : '') + '</div>'
            : '';
        var jaPago = String(a.statusPagamento || '').toUpperCase() === 'PAGO';
        var badgePago = jaPago
            ? '<div class="badge-pago-os">PAGO · ' + esc(a.formaPagamento || '—') +
                (a.canalRecebimento === 'interno' ? ' · Interno' : ' · Oficial') + '</div>'
            : '';
        var btnReceber = jaPago
            ? ''
            : '<button type="button" class="btn btn-receber" data-rec="' + a.id + '">💰 Receber</button>';
        var tr = document.createElement('tr');
        if (ehAgendado) tr.className = 'linha-agendada';
        tr.innerHTML =
            '<td style="color:#fff;font-weight:600">' + esc(fmtData(ehAgendado && a.agendadoPara ? a.agendadoPara : (a.entrada || a.criadoEm))) +
            (ehAgendado ? '<div style="font-size:0.68rem;color:#f1c40f;font-weight:700">agendado</div>' : '') +
            '</td>' +
            '<td style="color:#fff;font-weight:800">' + badgeAg + esc(nome) + tagAvulso + badgeAssinatura(a) + badgePago + '</td>' +
            '<td style="color:#fff;font-weight:600">' + esc(a.carro || '—') + '</td>' +
            '<td style="color:#fff;font-weight:700">' + esc(a.placa || '—') + '</td>' +
            '<td style="color:#fff;font-weight:700">' + moeda(a.total) + '</td>' +
            '<td class="actions">' +
            '<select class="status-at-select' + (ehAgendado ? ' status-agendado' : '') +
            '" data-st="' + a.id + '" title="Alterar status" style="min-width:150px;padding:6px 8px;font-size:0.75rem;font-weight:700">' +
            opcoesStatusAt(statusAtual) +
            '</select>' +
            btnReceber +
            '<button type="button" class="btn btn-ver" data-ver="' + a.id + '">Ver nota</button>' +
            '<button type="button" class="btn btn-pdf" data-pdf="' + a.id + '">PDF</button>' +
            '<button type="button" class="btn btn-assinar" data-link="' + a.id + '">Enviar nota</button>' +
            '<button type="button" class="btn btn-ok" data-wa-checklist="' + a.id + '" title="Checklist no WhatsApp (texto/JPEG/PDF/assinar)">📱 Check</button>' +
            '<button type="button" class="btn btn-secondary" data-wa-orc="' + a.id + '" title="Orçamento no WhatsApp (texto/JPEG/PDF/assinar)">📱 Orç</button>' +
            (atendimentoTemFotos(a)
                ? '<button type="button" class="btn btn-secondary" data-expf="' + a.id + '">Exportar fotos</button>'
                : '') +
            '<button type="button" class="btn btn-secondary" data-ed="' + a.id + '">Editar</button>' +
            '<button type="button" class="btn btn-danger" data-ex="' + a.id + '">Excluir</button>' +
            '</td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-st]').forEach(function (sel) {
        sel.addEventListener('change', function () {
            alterarStatusAtendimento(sel.getAttribute('data-st'), sel.value);
        });
    });
    tb.querySelectorAll('[data-rec]').forEach(function (b) {
        b.addEventListener('click', function () { abrirModalReceberOs(b.getAttribute('data-rec')); });
    });
    tb.querySelectorAll('[data-ver]').forEach(function (b) {
        b.addEventListener('click', function () { abrirNota(b.getAttribute('data-ver')); });
    });
    tb.querySelectorAll('[data-pdf]').forEach(function (b) {
        b.addEventListener('click', function () { imprimirNotaPdf(b.getAttribute('data-pdf')); });
    });
    tb.querySelectorAll('[data-link]').forEach(function (b) {
        b.addEventListener('click', function () { abrirLinkAssinatura(b.getAttribute('data-link')); });
    });
    tb.querySelectorAll('[data-expf]').forEach(function (b) {
        b.addEventListener('click', function () {
            var dbx = carregar();
            var ax = dbx.atendimentos.find(function (x) { return x.id === b.getAttribute('data-expf'); });
            if (ax) abrirModalExportFotos({ atendimento: ax });
        });
    });
    tb.querySelectorAll('[data-ed]').forEach(function (b) {
        b.addEventListener('click', function () { editarAtendimento(b.getAttribute('data-ed')); });
    });
    tb.querySelectorAll('[data-ex]').forEach(function (b) {
        b.addEventListener('click', function () { excluirAtendimento(b.getAttribute('data-ex')); });
    });
}

/* ---------- Receber OS (Histórico → Caixa oficial ou Interno) ---------- */
var receberOsIdAtual = null;
var receberOsCanalDestino = null;

function fecharModalReceberOs() {
    receberOsIdAtual = null;
    receberOsCanalDestino = null;
    document.getElementById('modalReceberOs').classList.remove('aberto');
    document.getElementById('receberOsPasso1').style.display = '';
    document.getElementById('receberOsPasso2').style.display = 'none';
}

function abrirModalReceberOs(atendimentoId) {
    var main = carregarMain();
    var a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
    if (!a) {
        toast('OS não encontrada.');
        return;
    }
    if (String(a.statusPagamento || '').toUpperCase() === 'PAGO') {
        alert('Esta OS já está marcada como PAGA (' + (a.formaPagamento || '—') +
            (a.canalRecebimento === 'interno' ? ' · Modo Interno' : ' · Caixa oficial') + ').');
        return;
    }
    var valor = Number(a.total) || 0;
    if (!(valor > 0)) {
        toast('Esta OS está sem valor para receber.');
        return;
    }
    receberOsIdAtual = atendimentoId;
    receberOsCanalDestino = null;
    var nome = nomeAtendimento(main, a);
    document.getElementById('receberOsResumo').innerHTML =
        '<strong>' + esc(nome) + '</strong> — ' + esc(a.carro || '—') +
        ' · Placa <strong>' + esc((a.placa || '—').toUpperCase()) + '</strong>';
    document.getElementById('receberOsValor').textContent = 'Valor a receber: ' + moeda(valor);
    document.getElementById('receberOsPasso1').style.display = '';
    document.getElementById('receberOsPasso2').style.display = 'none';
    document.getElementById('modalReceberOs').classList.add('aberto');
}

function receberOsIrPassoForma(canalDestino) {
    receberOsCanalDestino = canalDestino;
    document.getElementById('receberOsDestinoTxt').innerHTML = canalDestino === 'interno'
        ? 'Destino: <strong style="color:#f1c40f">Modo Interno</strong> — o valor entra no caixa interno.'
        : 'Destino: <strong style="color:#7ec8ff">Caixa / Relatórios (oficial)</strong> — o valor entra no caixa oficial.';
    document.getElementById('receberOsPasso1').style.display = 'none';
    document.getElementById('receberOsPasso2').style.display = '';
}

function confirmarRecebimentoOs(forma) {
    if (!receberOsIdAtual || !receberOsCanalDestino) return;
    var main = carregarMain();
    var idx = (main.atendimentos || []).findIndex(function (x) { return x.id === receberOsIdAtual; });
    if (idx < 0) {
        toast('OS não encontrada.');
        fecharModalReceberOs();
        return;
    }
    var a = main.atendimentos[idx];
    if (String(a.statusPagamento || '').toUpperCase() === 'PAGO') {
        alert('Esta OS já foi recebida.');
        fecharModalReceberOs();
        renderHistorico();
        return;
    }
    var valor = Number(a.total) || 0;
    if (!(valor > 0)) {
        toast('OS sem valor.');
        return;
    }
    var nome = nomeAtendimento(main, a);
    var placa = (a.placa || '—').toUpperCase();
    var digital = formaPagamentoEhDigital(forma);
    var lancId = uid();
    var agora = new Date().toISOString();
    var lanc = {
        id: lancId,
        tipo: 'entrada',
        descricao: 'Recebimento OS ' + placa + ' — ' + nome,
        valor: valor,
        forma: forma,
        conta: digital ? 'banco' : 'balcao',
        atendimentoId: a.id,
        osResumo: {
            cliente: nome,
            placa: placa,
            carro: a.carro || '',
            totalOs: valor,
            entrada: a.entrada || a.criadoEm || ''
        },
        criadoEm: agora
    };

    var canalAntes = canalVendas;
    canalVendas = receberOsCanalDestino === 'interno' ? 'interno' : 'normal';
    var dbCx = carregar();
    if (digital) {
        if (!dbCx.caixaBanco) dbCx.caixaBanco = [];
        dbCx.caixaBanco.push(lanc);
    } else {
        if (!dbCx.caixa) dbCx.caixa = [];
        dbCx.caixa.push(lanc);
    }
    salvar(dbCx);
    canalVendas = canalAntes;
    atualizarBadgeCanal();

    a.statusPagamento = 'PAGO';
    a.formaPagamento = forma;
    a.canalRecebimento = receberOsCanalDestino === 'interno' ? 'interno' : 'oficial';
    a.recebidoEm = agora;
    a.lancamentoRecebimentoId = lancId;
    a.atualizadoEm = agora;
    main.atendimentos[idx] = a;
    salvarMain(main);

    var destinoTxt = receberOsCanalDestino === 'interno' ? 'Modo Interno' : 'Caixa / Relatórios (oficial)';
    var contaTxt = digital ? 'Caixa do Banco (PIX/cartão)' : 'Caixa / Balcão (dinheiro)';
    fecharModalReceberOs();
    sincronizarOficinaNoCaixaEmpresa();
    renderHistorico();
    renderCaixa();
    renderCaixaBanco();
    renderRelatorioCaixa();
    renderRelatorioOficina();
    atualizarKPIs(carregar());
    toast('Recebido: ' + moeda(valor) + ' · ' + forma + ' · oficina no caixa');
    alert(
        '✅ Pagamento registrado!\n\n' +
        'OS: ' + placa + ' — ' + nome + '\n' +
        'Valor: ' + moeda(valor) + '\n' +
        'Forma: ' + forma + '\n' +
        'Destino: ' + destinoTxt + '\n' +
        'Conta: ' + contaTxt
    );
}

document.getElementById('btnRecDestNormal').addEventListener('click', function () {
    receberOsIrPassoForma('normal');
});
document.getElementById('btnRecDestInterno').addEventListener('click', function () {
    receberOsIrPassoForma('interno');
});
document.getElementById('btnReceberOsVoltar').addEventListener('click', function () {
    receberOsCanalDestino = null;
    document.getElementById('receberOsPasso1').style.display = '';
    document.getElementById('receberOsPasso2').style.display = 'none';
});
document.getElementById('btnReceberOsFechar').addEventListener('click', fecharModalReceberOs);
document.getElementById('modalReceberOs').addEventListener('click', function (e) {
    if (e.target.id === 'modalReceberOs') fecharModalReceberOs();
});
document.querySelectorAll('[data-rec-forma]').forEach(function (b) {
    b.addEventListener('click', function () {
        confirmarRecebimentoOs(b.getAttribute('data-rec-forma'));
    });
});

document.getElementById('buscaAtend').addEventListener('input', renderHistorico);

document.getElementById('btnNotaFechar').addEventListener('click', fecharNota);
document.getElementById('modalNota').addEventListener('click', function (e) {
    if (e.target.id === 'modalNota') fecharNota();
});
document.getElementById('btnNotaPdf').addEventListener('click', function () {
    if (atendimentoNotaAtual) imprimirNotaPdf(atendimentoNotaAtual.id);
});
document.getElementById('btnNotaEncaminhar').addEventListener('click', function () {
    if (!atendimentoNotaAtual) {
        toast('Abra a nota antes.');
        return;
    }
    abrirModalWaEnvio({
        tipo: 'nota',
        atendimentoId: atendimentoNotaAtual.id,
        deFormulario: false
    });
});
document.getElementById('btnNotaSalvarPdf').addEventListener('click', function () {
    salvarNotaPdfArquivo();
});
document.getElementById('btnViewerFechar').addEventListener('click', fecharViewerPdf);
document.getElementById('btnViewerEncaminhar').addEventListener('click', function () {
    var id = atendimentoNotaAtual && atendimentoNotaAtual.id;
    abrirModalWaEnvio({
        tipo: 'nota',
        atendimentoId: id || null,
        deFormulario: false
    });
});
document.getElementById('btnViewerSalvarPdf').addEventListener('click', function () {
    salvarNotaPdfArquivo();
});
document.getElementById('btnViewerImprimir').addEventListener('click', function () {
    if (_htmlNotaImpressaoAtual) executarImpressaoHtml(_htmlNotaImpressaoAtual);
    else toast('Documento não encontrado.');
});
document.getElementById('btnNomePdfOk').addEventListener('click', function () {
    var v = document.getElementById('inputNomePdf').value;
    fecharModalNomePdf(v);
});
document.getElementById('btnNomePdfCancelar').addEventListener('click', function () {
    fecharModalNomePdf(null);
});
document.getElementById('modalNomePdf').addEventListener('click', function (e) {
    if (e.target.id === 'modalNomePdf') fecharModalNomePdf(null);
});
document.getElementById('inputNomePdf').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnNomePdfOk').click();
    }
});
document.getElementById('btnNotaLink').addEventListener('click', function () {
    if (atendimentoNotaAtual) abrirLinkAssinatura(atendimentoNotaAtual.id);
});
document.getElementById('btnNotaExportFotos').addEventListener('click', function () {
    if (atendimentoNotaAtual) abrirModalExportFotos({ atendimento: atendimentoNotaAtual });
});
document.getElementById('btnFecharLink').addEventListener('click', fecharModalLink);
document.getElementById('modalLinkAssinatura').addEventListener('click', function (e) {
    if (e.target.id === 'modalLinkAssinatura') fecharModalLink();
});
document.getElementById('btnCopiarLink').addEventListener('click', function () {
    var v = document.getElementById('inputLinkAssinatura');
    v.select();
    try {
        navigator.clipboard.writeText(v.value);
        toast('Link copiado.');
    } catch (err) {
        document.execCommand('copy');
        toast('Link copiado.');
    }
});
document.getElementById('btnWhatsappLink').addEventListener('click', function () {
    var link = document.getElementById('inputLinkAssinatura').value;
    var db = carregar();
    var a = atendimentoNotaAtual;
    var nome = a ? nomeAtendimento(db, a) : 'cliente';
    var texto = 'Olá ' + nome + '! A ' + (getEmpresa().nome || 'Joninha Suspensões') +
        ' enviou o documento do seu veículo para você *ler e assinar* (ficar de acordo):\n' + link;
    abrirWhatsApp(a ? telefoneDoAtendimento(db, a) : '', texto);
});
document.getElementById('btnImportarSig').addEventListener('click', function () {
    document.getElementById('fileImportSig').click();
});
document.getElementById('fileImportSig').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
        try {
            aplicarAssinaturaImportada(JSON.parse(reader.result));
        } catch (e) {
            toast('JSON de assinatura inválido.');
        }
    };
    reader.readAsText(file);
    this.value = '';
});

window.addEventListener('storage', function (e) {
    if (e.key === ASSIN_KEY || e.key === STORAGE_KEY) {
        if (sincronizarAssinaturasNoDb()) renderHistorico();
    }
});
setInterval(function () {
    if (document.getElementById('painelHistorico').classList.contains('active')) {
        var localOk = sincronizarAssinaturasNoDb();
        sincronizarAssinaturasDaNuvem().then(function (nuvOk) {
            if (localOk || nuvOk) renderHistorico();
        }).catch(function () {
            if (localOk) renderHistorico();
        });
    }
}, 4000);

/* ---------- Produtos (+ leitor de código de barras) ---------- */
function normalizarCodigo(cod) {
    return String(cod || '').trim();
}

function focarLeitor() {
    var el = document.getElementById('prodCod');
    el.focus();
    el.select();
}

function preencherFormProd(p, manterFocoNome) {
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodNome').value = p.nome || '';
    document.getElementById('prodCat').value = p.categoria || '';
    document.getElementById('prodCod').value = p.codigo || '';
    document.getElementById('prodCusto').value = p.custo || 0;
    document.getElementById('prodVenda').value = p.venda || 0;
    document.getElementById('prodQtd').value = p.qtd || 0;
    document.getElementById('prodUn').value = p.unidade || 'un';
    document.getElementById('tituloFormProd').textContent = 'Editar Produto';
    document.getElementById('btnCancelarProd').style.display = '';
    if (manterFocoNome) document.getElementById('prodNome').focus();
}

function processarCodigoBipado(codigo) {
    var cod = normalizarCodigo(codigo);
    if (!cod) return;
    document.getElementById('prodCod').value = cod;
    var db = carregar();
    var achado = db.produtos.find(function (p) {
        return normalizarCodigo(p.codigo).toLowerCase() === cod.toLowerCase();
    });
    if (achado) {
        preencherFormProd(achado, true);
        toast('Produto encontrado pelo código — pode editar e salvar.');
    } else {
        /* Novo cadastro: mantém o código bipado e vai para o nome */
        if (!document.getElementById('prodId').value) {
            document.getElementById('tituloFormProd').textContent = 'Novo produto (código bipado)';
        }
        document.getElementById('prodNome').focus();
        toast('Código lido. Complete o cadastro e salve.');
    }
}

document.getElementById('prodCod').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault(); /* evita enviar o formulário ao bipar */
    processarCodigoBipado(this.value);
});

document.getElementById('btnFocoLeitor').addEventListener('click', focarLeitor);

/* Busca da lista também aceita bipar + Enter */
document.getElementById('buscaProd').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var cod = normalizarCodigo(this.value);
    if (!cod) return;
    var db = carregar();
    var achado = db.produtos.find(function (p) {
        return normalizarCodigo(p.codigo).toLowerCase() === cod.toLowerCase();
    });
    if (achado) {
        e.preventDefault();
        preencherFormProd(achado, true);
        toast('Produto encontrado na busca pelo código.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

document.getElementById('formProduto').addEventListener('submit', function (e) {
    e.preventDefault();
    var db = carregar();
    var id = document.getElementById('prodId').value;
    var codigo = normalizarCodigo(document.getElementById('prodCod').value);
    if (codigo) {
        var duplicado = db.produtos.find(function (p) {
            return normalizarCodigo(p.codigo).toLowerCase() === codigo.toLowerCase() && p.id !== id;
        });
        if (duplicado) {
            toast('Já existe produto com este código de barras: ' + (duplicado.nome || ''));
            focarLeitor();
            return;
        }
    }
    var agora = new Date().toISOString();
    var payload = {
        id: id || uid(),
        nome: document.getElementById('prodNome').value.trim(),
        categoria: document.getElementById('prodCat').value.trim(),
        codigo: codigo,
        custo: Number(document.getElementById('prodCusto').value) || 0,
        venda: Number(document.getElementById('prodVenda').value) || 0,
        qtd: Number(document.getElementById('prodQtd').value) || 0,
        unidade: document.getElementById('prodUn').value,
        atualizadoEm: agora
    };
    if (id) {
        var i = db.produtos.findIndex(function (p) { return p.id === id; });
        if (i >= 0) {
            payload.criadoEm = db.produtos[i].criadoEm || agora;
            db.produtos[i] = Object.assign({}, db.produtos[i], payload);
        } else {
            payload.criadoEm = agora;
            db.produtos.push(payload);
        }
    } else {
        payload.criadoEm = agora;
        db.produtos.push(payload);
    }
    limparExcluido(db, 'produtos', payload.id);
    salvar(db);
    limparProd();
    toast('Produto salvo (estoque unificado — vale nos dois modos).');
    renderProdutos();
    atualizarKPIs(db);
    focarLeitor(); /* pronto para o próximo bip */
});

function limparProd() {
    document.getElementById('formProduto').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('tituloFormProd').textContent = 'Cadastro de Produto / Serviço';
    document.getElementById('btnCancelarProd').style.display = 'none';
}

document.getElementById('btnCancelarProd').addEventListener('click', function () {
    limparProd();
    focarLeitor();
});

function editarProd(id) {
    var db = carregar();
    var p = db.produtos.find(function (x) { return x.id === id; });
    if (!p) return;
    abrirPainel('painelProdutos');
    preencherFormProd(p, false);
}

function excluirProd(id) {
    if (!confirm('Excluir produto? (some nos dois modos — estoque unificado)')) return;
    var db = carregar();
    marcarExcluido(db, 'produtos', id);
    db.produtos = db.produtos.filter(function (p) { return p.id !== id; });
    salvar(db);
    toast('Produto excluído dos dois modos.');
    renderProdutos();
    atualizarKPIs(db);
}

var ordemProdutos = { campo: 'nome', dir: 'asc' }; /* nome | qtd */

function atualizarCabecalhosOrdemProd() {
    document.querySelectorAll('th[data-ordena-prod]').forEach(function (th) {
        var campo = th.getAttribute('data-ordena-prod');
        var ativa = ordemProdutos.campo === campo;
        th.classList.toggle('ativa', ativa);
        var seta = th.querySelector('.seta-ord');
        if (seta) seta.textContent = ativa ? (ordemProdutos.dir === 'asc' ? '▲' : '▼') : '';
    });
}

function renderProdutos() {
    var db = carregar();
    var q = (document.getElementById('buscaProd').value || '').toLowerCase().trim();
    var lista = db.produtos.filter(function (p) {
        if (!q) return true;
        return [p.nome, p.codigo, p.categoria].join(' ').toLowerCase().indexOf(q) > -1;
    });
    var dir = ordemProdutos.dir === 'desc' ? -1 : 1;
    lista.sort(function (a, b) {
        if (ordemProdutos.campo === 'qtd') {
            var qa = Number(a.qtd) || 0;
            var qb = Number(b.qtd) || 0;
            if (qa !== qb) return (qa - qb) * dir;
            return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        }
        var cmp = String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        return cmp * dir;
    });
    atualizarCabecalhosOrdemProd();
    var tb = document.getElementById('tabelaProd');
    var chkAll = document.getElementById('chkTodasEtiquetas');
    if (chkAll) chkAll.checked = false;
    tb.innerHTML = '';
    var qtdBaixo = lista.filter(function (p) { return (Number(p.qtd) || 0) < 2; }).length;
    var alertaEl = document.getElementById('alertaEstoqueBaixo');
    if (alertaEl) {
        if (qtdBaixo > 0) {
            alertaEl.style.display = '';
            alertaEl.textContent = '⚠ ' + qtdBaixo + ' produto(s) com estoque abaixo de 2 — repor o quanto antes.';
        } else {
            alertaEl.style.display = 'none';
            alertaEl.textContent = '';
        }
    }
    if (!lista.length) {
        tb.innerHTML = '<tr><td colspan="7" class="muted">Nenhum produto.</td></tr>';
        return;
    }
    lista.forEach(function (p) {
        var tr = document.createElement('tr');
        var cod = normalizarCodigo(p.codigo) || '';
        var vendaNum = Number(p.venda) || 0;
        var qtdNum = Number(p.qtd) || 0;
        var estoqueBaixo = qtdNum < 2;
        if (estoqueBaixo) tr.className = 'linha-estoque-baixo';
        tr.innerHTML =
            '<td style="text-align:center">' +
            '<input type="checkbox" class="check-etiqueta"' +
            ' data-nome="' + esc(p.nome || '') + '"' +
            ' data-codigo="' + esc(cod) + '"' +
            ' data-venda="' + esc(String(vendaNum)) + '">' +
            '</td>' +
            '<td>' + esc(p.codigo || '—') + '</td>' +
            '<td>' + esc(p.nome) +
            (estoqueBaixo ? ' <span class="badge-estoque-baixo">ESTOQUE BAIXO</span>' : '') +
            '</td>' +
            '<td>' + esc(p.categoria || '—') + '</td>' +
            '<td class="' + (estoqueBaixo ? 'qtd-estoque-baixo' : '') + '">' +
            esc(String(p.qtd) + ' ' + (p.unidade || '')) + '</td>' +
            '<td>' + moeda(p.venda) + '</td>' +
            '<td class="actions">' +
            '<button type="button" class="btn btn-secondary" data-ed="' + p.id + '">Editar</button>' +
            '<button type="button" class="btn btn-danger" data-ex="' + p.id + '">Excluir</button>' +
            '</td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-ed]').forEach(function (b) {
        b.addEventListener('click', function () { editarProd(b.getAttribute('data-ed')); });
    });
    tb.querySelectorAll('[data-ex]').forEach(function (b) {
        b.addEventListener('click', function () { excluirProd(b.getAttribute('data-ex')); });
    });
}

function toggleTodasEtiquetas(source) {
    var checkboxes = document.querySelectorAll('#tabelaProd .check-etiqueta');
    checkboxes.forEach(function (chk) { chk.checked = !!source.checked; });
}

function imprimirEtiquetasEstoque() {
    var checkboxes = document.querySelectorAll('#tabelaProd .check-etiqueta:checked');
    if (!checkboxes.length) {
        alert('Selecione pelo menos um produto marcando a caixinha na tabela para imprimir.');
        return;
    }

    var qtdCopias = prompt('Quantas cópias de CADA ETIQUETA você deseja imprimir?', '1');
    if (qtdCopias == null) return;
    qtdCopias = parseInt(qtdCopias, 10);
    if (!qtdCopias || qtdCopias <= 0 || isNaN(qtdCopias)) return;

    var htmlEtiquetas =
        '<html><head><title>Joninha Suspensões</title>' +
        '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>' +
        '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        '@page { size: 104mm 30mm; margin: 0mm !important; }' +
        'body { font-family: Arial, sans-serif; background: #fff; width: 104mm; height: 30mm; margin: 0; padding: 0; color: #000; overflow: hidden; }' +
        '.linha-etiquetas { display: flex; flex-direction: row; width: 104mm; height: 30mm; page-break-inside: avoid; page-break-after: always; justify-content: space-between; align-items: center; }' +
        '.etiqueta { width: 50mm; height: 30mm; padding: 1.5mm; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; }' +
        '.etq-nome { font-size: 7pt; font-weight: bold; line-height: 1.1; margin-bottom: 2px; text-align: center; width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; }' +
        '.etq-preco { font-size: 12pt; font-weight: 900; margin-bottom: 2px; text-align: center; }' +
        '.etq-barcode-container { width: 100%; text-align: center; }' +
        '.etq-barcode-container svg { max-width: 48mm; height: 42px !important; }' +
        '@media print { .btn-imprimir { display: none !important; } }' +
        '.btn-imprimir { position: fixed; bottom: 20px; right: 20px; background: #27ae60; color: white; border: none; padding: 15px 20px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 1000; }' +
        '</style></head><body>' +
        '<button class="btn-imprimir" onclick="window.print()">🖨️ IMPRIMIR NA ELGIN</button>';

    var arrayEtiquetas = [];
    checkboxes.forEach(function (chk) {
        var nome = chk.getAttribute('data-nome') || '';
        if (nome.length > 45) nome = nome.substring(0, 45) + '...';
        var cod = chk.getAttribute('data-codigo') || '00000000';
        if (!cod) cod = '00000000';
        var precoNum = Number(chk.getAttribute('data-venda')) || 0;
        var precoFmt = precoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        var i;
        for (i = 0; i < qtdCopias; i++) {
            arrayEtiquetas.push(
                '<div class="etiqueta">' +
                '<div class="etq-nome">' + esc(nome) + '</div>' +
                '<div class="etq-preco">R$ ' + esc(precoFmt) + '</div>' +
                '<div class="etq-barcode-container">' +
                '<svg class="barcode"' +
                ' jsbarcode-value="' + esc(cod) + '"' +
                ' jsbarcode-displayvalue="true"' +
                ' jsbarcode-width="2"' +
                ' jsbarcode-height="42"' +
                ' jsbarcode-fontSize="11"' +
                ' jsbarcode-textmargin="0"' +
                ' jsbarcode-margin="0"></svg>' +
                '</div></div>'
            );
        }
    });

    var j;
    for (j = 0; j < arrayEtiquetas.length; j += 2) {
        var etq1 = arrayEtiquetas[j];
        var etq2 = arrayEtiquetas[j + 1]
            ? arrayEtiquetas[j + 1]
            : '<div class="etiqueta" style="border:none;visibility:hidden"></div>';
        htmlEtiquetas +=
            '<div class="linha-etiquetas">' + etq1 + etq2 + '</div>';
    }

    htmlEtiquetas +=
        '<script>' +
        'window.onload = function () {' +
        '  function initBc() { if (typeof JsBarcode !== "undefined") JsBarcode(".barcode").init(); }' +
        '  initBc();' +
        '  setTimeout(initBc, 400);' +
        '};' +
        '<\/script></body></html>';

    var janela = window.open('', '', 'width=800,height=600');
    if (!janela) {
        alert('Permita pop-ups neste site para abrir a impressão de etiquetas.');
        return;
    }
    janela.document.write(htmlEtiquetas);
    janela.document.close();
}

document.getElementById('buscaProd').addEventListener('input', renderProdutos);
document.getElementById('chkTodasEtiquetas').addEventListener('change', function () {
    toggleTodasEtiquetas(this);
});
document.getElementById('btnImprimirEtiquetas').addEventListener('click', imprimirEtiquetasEstoque);
document.querySelectorAll('th[data-ordena-prod]').forEach(function (th) {
    th.addEventListener('click', function () {
        var campo = th.getAttribute('data-ordena-prod');
        if (ordemProdutos.campo === campo) {
            ordemProdutos.dir = ordemProdutos.dir === 'asc' ? 'desc' : 'asc';
        } else {
            ordemProdutos.campo = campo;
            ordemProdutos.dir = 'asc';
        }
        renderProdutos();
    });
});

/* ---------- Venda / Orçamento (modelo FH Control) ---------- */
function formaPagamentoEhDigital(formaPag) {
    var f = String(formaPag || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return f.indexOf('pix') > -1 || f.indexOf('cartao') > -1 || f.indexOf('debito') > -1 ||
        f.indexOf('credito') > -1 || f.indexOf('boleto') > -1 || f.indexOf('transfer') > -1;
}

function proximoNumeroVenda(db) {
    var max = 1000;
    (db.orcamentos || []).forEach(function (o) {
        var n = Number(o.numero) || 0;
        if (n > max) max = n;
    });
    return max + 1;
}

function prepararVendaForm() {
    var db = carregar();
    document.getElementById('vdNumero').value = proximoNumeroVenda(db);
    document.getElementById('vdEmissao').value = hojeISO();
    document.getElementById('vdVenc').value = hojeISO();
    preencherListaProdutosVenda(db);
    atualizarUIVendaPorCanal();
}

function atualizarUIVendaPorCanal() {
    var interno = canalVendas === 'interno';
    var wrapN = document.getElementById('wrapVdClienteNormal');
    var wrapI = document.getElementById('wrapVdClienteInterno');
    var titulo = document.querySelector('#painelOrcamento .venda-form .box h2');
    var hint = document.querySelector('#painelOrcamento .venda-form .box > .hint');
    if (wrapN) wrapN.style.display = interno ? 'none' : '';
    if (wrapI) wrapI.style.display = interno ? '' : 'none';
    if (titulo) {
        titulo.textContent = interno
            ? '🛒 Venda interna — somente para funcionário'
            : '🛒 Lançar venda — balcão / serviço imediato';
    }
    if (hint) {
        hint.innerHTML = interno
            ? 'No modo interno a venda é <strong>só para funcionário cadastrado</strong>. Baixa o estoque unificado; dinheiro → caixa interno; PIX/cartão → banco interno.'
            : 'Venda baixa estoque; <strong>Dinheiro</strong> → Caixa Balcão; <strong>PIX/Cartão/Boleto</strong> → Caixa do Banco; <strong>Pendente</strong> → Contas a Receber.';
    }
    if (interno) preencherSelectFuncionariosVenda();
}

function listarFuncionariosOrdenados(db, soAtivos) {
    return (db.funcionarios || []).slice().filter(function (f) {
        if (!f) return false;
        if (soAtivos && f.ativo === false) return false;
        return true;
    }).sort(function (a, b) {
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
}

function preencherSelectFuncionariosVenda() {
    var sel = document.getElementById('vdFuncionarioId');
    if (!sel) return;
    var db = carregar();
    var funcs = listarFuncionariosOrdenados(db, true);
    var atual = sel.value;
    sel.innerHTML = '<option value="">Selecione o funcionário...</option>' + funcs.map(function (f) {
        var extra = f.cargo ? ' · ' + f.cargo : '';
        return '<option value="' + esc(f.id) + '">' + esc(f.nome + extra) + '</option>';
    }).join('');
    if (atual && funcs.some(function (f) { return f.id === atual; })) sel.value = atual;
}

function encontrarProdutoPorBusca(texto) {
    var db = carregar();
    var t = String(texto || '').trim().toLowerCase();
    if (!t) return null;
    var cod = t.replace(/^.*\[/, '').replace(/\].*$/, '').trim();
    var porCod = db.produtos.find(function (p) {
        return p.codigo && String(p.codigo).toLowerCase() === cod;
    });
    if (porCod) return porCod;
    var nome = t.replace(/\s*\[.*$/, '').trim();
    return db.produtos.find(function (p) {
        return String(p.nome || '').toLowerCase() === nome ||
            String(p.nome || '').toLowerCase().indexOf(nome) === 0 ||
            (p.codigo && String(p.codigo).toLowerCase() === t);
    }) || null;
}

function atualizarTotalLinhaEstoque() {
    var qtd = parseMoeda(document.getElementById('vdProdQtd').value) || 0;
    var venda = Number(document.getElementById('vdProdVenda').value) || 0;
    document.getElementById('vdProdTotal').value = (qtd * venda).toFixed(2);
}

function atualizarTotalLinhaAvulso() {
    var qtd = parseMoeda(document.getElementById('vdAvQtd').value) || 0;
    var venda = Number(document.getElementById('vdAvVenda').value) || 0;
    document.getElementById('vdAvTotal').value = (qtd * venda).toFixed(2);
}

function recalcVendaDeCusto(custoId, margemId, vendaId, totalFn) {
    var custo = Number(document.getElementById(custoId).value) || 0;
    var margem = Number(document.getElementById(margemId).value) || 0;
    document.getElementById(vendaId).value = (custo * (1 + margem / 100)).toFixed(2);
    totalFn();
}

function recalcMargemDeVenda(custoId, margemId, vendaId, totalFn) {
    var custo = Number(document.getElementById(custoId).value) || 0;
    var venda = Number(document.getElementById(vendaId).value) || 0;
    if (custo > 0) document.getElementById(margemId).value = (((venda / custo) - 1) * 100).toFixed(1);
    totalFn();
}

function fmtQtdEstoque(n, un) {
    var v = Math.round((Number(n) || 0) * 1000) / 1000;
    var txt = (Math.abs(v - Math.round(v)) < 1e-9) ? String(Math.round(v)) : String(v);
    return txt + ' ' + (un || 'un');
}

function calcularDisponivelEstoqueVenda(p) {
    var cadastro = Number(p && p.qtd) || 0;
    var reservado = qtdReservadaCarrinho(p && p.id);
    var livre = Math.round((cadastro - reservado) * 1000) / 1000;
    return { cadastro: cadastro, reservado: reservado, livre: livre };
}

function qtdReservadaCarrinho(produtoId) {
    return carrinhoVenda.reduce(function (s, it) {
        return s + (it.produtoId === produtoId ? (Number(it.qtd) || 0) : 0);
    }, 0);
}

function atualizarResumoEstoqueVenda() {
    var info = document.getElementById('vdEstoqueInfo');
    if (!info) return;
    var p = produtoVendaSelecionado;
    if (!p) {
        info.style.display = 'none';
        info.className = 'estoque-resumo';
        info.innerHTML = '';
        return;
    }
    var tipoDoc = document.getElementById('vdTipo').value;
    var un = document.getElementById('vdProdUn').value || p.unidade || 'un';
    var disp = calcularDisponivelEstoqueVenda(p);
    var qCampo = parseMoeda(document.getElementById('vdProdQtd').value) || 0;
    var livre = Math.max(0, disp.livre);
    var html = '<strong>Estoque disponível do produto</strong> ' + esc(p.nome) +
        ': <strong style="color:#f1c40f;font-size:1.05em">' + esc(fmtQtdEstoque(livre, un)) + '</strong>';
    html += '<br><span style="opacity:0.9">No cadastro: <strong>' + esc(fmtQtdEstoque(disp.cadastro, un)) +
        '</strong> · No carrinho: <strong>' + esc(fmtQtdEstoque(disp.reservado, un)) + '</strong>';
    if (p.codigo) html += ' · Cód: <strong>' + esc(p.codigo) + '</strong>';
    html += '</span>';

    if (tipoDoc === 'ORCAMENTO') {
        info.className = 'estoque-resumo estoque-orcamento';
        html += '<br><span style="color:#d2b4de">📄 Orçamento: pode lançar qualquer quantidade (não baixa estoque).</span>';
    } else if (livre <= 0) {
        info.className = 'estoque-resumo estoque-zero';
        html += '<br><span style="color:#ff6b6b;font-weight:800">⚠ Estoque 0 — venda direta bloqueada para este produto. Use Orçamento ou reponha o estoque.</span>';
    } else {
        info.className = 'estoque-resumo';
        if (qCampo > 0) {
            var depois = livre - qCampo;
            if (depois < -1e-9) {
                html += '<br><span style="color:#e74c3c;font-weight:700">⚠ Quantidade no campo (' +
                    esc(fmtQtdEstoque(qCampo, un)) + ') passa do disponível (' +
                    esc(fmtQtdEstoque(livre, un)) + ').</span>';
            } else {
                html += '<br><span style="color:#95a5a6">Se incluir esta qtd, saldo ficaria: <strong>' +
                    esc(fmtQtdEstoque(Math.max(0, depois), un)) + '</strong>.</span>';
            }
        }
    }
    info.innerHTML = html;
    info.style.display = 'block';
}

function preencherCamposProdutoEstoque() {
    var p = encontrarProdutoPorBusca(document.getElementById('vdProdBusca').value);
    produtoVendaSelecionado = p;
    if (!p) {
        atualizarResumoEstoqueVenda();
        return;
    }
    document.getElementById('vdProdCusto').value = p.custo || 0;
    document.getElementById('vdProdVenda').value = p.venda || 0;
    var margem = (p.custo > 0) ? (((p.venda / p.custo) - 1) * 100) : 0;
    document.getElementById('vdProdMargem').value = margem.toFixed(1);
    document.getElementById('vdProdUn').value = p.unidade || '';
    document.getElementById('vdProdQtd').value = '1';
    atualizarTotalLinhaEstoque();
    atualizarResumoEstoqueVenda();
    var disp = calcularDisponivelEstoqueVenda(p);
    var un = p.unidade || 'un';
    var tipoDoc = document.getElementById('vdTipo').value;
    if (tipoDoc === 'VENDA' && disp.livre <= 0) {
        toast('Estoque disponível do produto ' + p.nome + ': 0 ' + un + ' — venda bloqueada.');
    } else {
        toast('Estoque disponível do produto ' + p.nome + ': ' + fmtQtdEstoque(Math.max(0, disp.livre), un));
    }
}

function calcTotaisVenda() {
    var sub = carrinhoVenda.reduce(function (s, it) { return s + (Number(it.total) || 0); }, 0);
    var descR = Number(document.getElementById('vdDescReais').value) || 0;
    var descP = Number(document.getElementById('vdDescPerc').value) || 0;
    var total = Math.max(0, sub - descR - (sub * descP / 100));
    var recebido = Number(document.getElementById('vdRecebido').value) || 0;
    var troco = Math.max(0, recebido - total);
    document.getElementById('vdSubtotalTxt').textContent = moeda(sub);
    document.getElementById('vdTotalTxt').textContent = 'TOTAL: ' + moeda(total);
    document.getElementById('vdTrocoTxt').textContent = 'Troco: ' + moeda(troco);
    return { subtotal: sub, total: total, troco: troco, descontoReais: descR, descontoPerc: descP, valorRecebido: recebido };
}

function renderCarrinhoVenda() {
    var box = document.getElementById('vdCarrinhoLista');
    if (!carrinhoVenda.length) {
        box.innerHTML = '<p class="muted">Nenhum item.</p>';
    } else {
        box.innerHTML = carrinhoVenda.map(function (it, idx) {
            var tag = it.origem === 'estoque' ? 'ESTOQUE' : (it.origem === 'mao' ? 'MÃO DE OBRA' : 'AVULSO');
            var cor = it.origem === 'mao' ? '#8fe0b8' : (it.origem === 'estoque' ? '#9fd3ff' : '#ffb4a8');
            return '<div class="row" style="margin-bottom:8px;align-items:center;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:6px">' +
                '<div class="col" style="flex:2"><span style="color:' + cor + ';font-size:0.7rem;font-weight:700;margin-right:6px">' + tag + '</span>' +
                esc(it.desc) + ' <span class="muted">(' + esc(String(it.qtd)) + ' ' + esc(it.unidade || 'un') + ' × ' + moeda(it.venda) + ')</span></div>' +
                '<div class="col">' + moeda(it.total) + '</div>' +
                '<div class="col" style="flex:0.4"><button type="button" class="btn btn-danger" data-vd-rm="' + idx + '">×</button></div></div>';
        }).join('');
        box.querySelectorAll('[data-vd-rm]').forEach(function (b) {
            b.addEventListener('click', function () {
                carrinhoVenda.splice(Number(b.getAttribute('data-vd-rm')), 1);
                renderCarrinhoVenda();
                atualizarResumoEstoqueVenda();
            });
        });
    }
    calcTotaisVenda();
    atualizarResumoEstoqueVenda();
}

function addItemCarrinho(item) {
    carrinhoVenda.push(item);
    renderCarrinhoVenda();
}

document.getElementById('vdProdBusca').addEventListener('change', preencherCamposProdutoEstoque);
document.getElementById('vdProdBusca').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        preencherCamposProdutoEstoque();
    }
});
['vdProdQtd', 'vdProdVenda'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
        atualizarTotalLinhaEstoque();
        if (id === 'vdProdQtd') atualizarResumoEstoqueVenda();
    });
});
document.getElementById('vdProdUn').addEventListener('change', atualizarResumoEstoqueVenda);
document.getElementById('vdProdCusto').addEventListener('input', function () {
    recalcVendaDeCusto('vdProdCusto', 'vdProdMargem', 'vdProdVenda', atualizarTotalLinhaEstoque);
});
document.getElementById('vdProdMargem').addEventListener('input', function () {
    recalcVendaDeCusto('vdProdCusto', 'vdProdMargem', 'vdProdVenda', atualizarTotalLinhaEstoque);
});
document.getElementById('vdProdVenda').addEventListener('input', function () {
    recalcMargemDeVenda('vdProdCusto', 'vdProdMargem', 'vdProdVenda', atualizarTotalLinhaEstoque);
});

document.getElementById('btnVdAddEstoque').addEventListener('click', function () {
    if (!produtoVendaSelecionado) preencherCamposProdutoEstoque();
    var p = produtoVendaSelecionado;
    if (!p) { toast('Selecione um produto do estoque (nome ou código).'); return; }
    var qtd = parseMoeda(document.getElementById('vdProdQtd').value);
    var venda = Number(document.getElementById('vdProdVenda').value) || 0;
    if (qtd <= 0) { toast('Informe a quantidade.'); return; }
    var tipoDoc = document.getElementById('vdTipo').value;
    var un = document.getElementById('vdProdUn').value || p.unidade || 'un';
    var disp = calcularDisponivelEstoqueVenda(p);
    var livre = disp.livre;

    /* Venda direta: só o que tem no estoque. Orçamento: liberado. */
    if (tipoDoc === 'VENDA') {
        if (livre <= 0) {
            toast('Estoque disponível do produto ' + p.nome + ': 0 ' + un + ' — venda bloqueada.');
            atualizarResumoEstoqueVenda();
            return;
        }
        if (qtd > livre + 0.0001) {
            toast('Quantidade acima do disponível. Produto: ' + p.nome +
                ' · Disponível: ' + fmtQtdEstoque(livre, un) +
                ' · Você tentou: ' + fmtQtdEstoque(qtd, un));
            atualizarResumoEstoqueVenda();
            return;
        }
    }

    addItemCarrinho({
        origem: 'estoque',
        produtoId: p.id,
        codigo: p.codigo || '',
        desc: p.nome,
        qtd: qtd,
        unidade: un,
        custo: Number(document.getElementById('vdProdCusto').value) || 0,
        margem: Number(document.getElementById('vdProdMargem').value) || 0,
        venda: venda,
        total: qtd * venda,
        baixaEstoque: tipoDoc === 'VENDA'
    });
    document.getElementById('vdProdBusca').value = '';
    produtoVendaSelecionado = null;
    atualizarResumoEstoqueVenda();
    document.getElementById('vdProdQtd').value = '1';
    document.getElementById('vdProdBusca').focus();
    if (tipoDoc === 'VENDA') {
        toast('Item adicionado. Estoque será baixado ao finalizar a venda.');
    } else {
        toast('Item no orçamento (sem baixa de estoque).');
    }
});

document.getElementById('vdTipo').addEventListener('change', function () {
    atualizarResumoEstoqueVenda();
    var tipo = this.value;
    if (tipo === 'ORCAMENTO') {
        toast('Modo Orçamento: quantidade livre — não baixa estoque.');
    } else {
        toast('Modo Venda Direta: só vende o que tem no estoque — baixa ao finalizar.');
    }
});

['vdAvQtd', 'vdAvVenda'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', atualizarTotalLinhaAvulso);
});
document.getElementById('vdAvCusto').addEventListener('input', function () {
    recalcVendaDeCusto('vdAvCusto', 'vdAvMargem', 'vdAvVenda', atualizarTotalLinhaAvulso);
});
document.getElementById('vdAvMargem').addEventListener('input', function () {
    recalcVendaDeCusto('vdAvCusto', 'vdAvMargem', 'vdAvVenda', atualizarTotalLinhaAvulso);
});

document.getElementById('btnVdAddAvulso').addEventListener('click', function () {
    var desc = document.getElementById('vdAvNome').value.trim();
    var qtd = parseMoeda(document.getElementById('vdAvQtd').value) || 0;
    var venda = Number(document.getElementById('vdAvVenda').value) || 0;
    if (!desc) { toast('Informe a descrição do item avulso.'); return; }
    if (qtd <= 0 || venda < 0) { toast('Qtd e valor de venda inválidos.'); return; }
    addItemCarrinho({
        origem: 'avulso',
        produtoId: null,
        desc: desc,
        qtd: qtd,
        unidade: document.getElementById('vdAvUn').value || 'un',
        custo: Number(document.getElementById('vdAvCusto').value) || 0,
        margem: Number(document.getElementById('vdAvMargem').value) || 0,
        venda: venda,
        total: qtd * venda
    });
    document.getElementById('vdAvNome').value = '';
    document.getElementById('vdAvQtd').value = '1';
    document.getElementById('vdAvVenda').value = '';
    document.getElementById('vdAvTotal').value = '';
    document.getElementById('vdAvNome').focus();
});

document.getElementById('btnVdAddMao').addEventListener('click', function () {
    var desc = document.getElementById('vdMaoDesc').value.trim();
    var valor = parseMoeda(document.getElementById('vdMaoValor').value);
    if (!desc) { toast('Informe a descrição da mão de obra.'); return; }
    addItemCarrinho({
        origem: 'mao',
        produtoId: null,
        desc: desc,
        qtd: 1,
        unidade: 'serv',
        custo: 0,
        margem: 0,
        venda: valor,
        total: valor
    });
    document.getElementById('vdMaoDesc').value = '';
    document.getElementById('vdMaoValor').value = '';
    document.getElementById('vdMaoDesc').focus();
});

['vdDescReais', 'vdDescPerc', 'vdRecebido'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', calcTotaisVenda);
});

function limparVendaForm() {
    carrinhoVenda = [];
    produtoVendaSelecionado = null;
    document.getElementById('vdCliente').value = '';
    document.getElementById('vdPlaca').value = '';
    var placaInt = document.getElementById('vdPlacaInterno');
    if (placaInt) placaInt.value = '';
    var selFunc = document.getElementById('vdFuncionarioId');
    if (selFunc) selFunc.value = '';
    document.getElementById('vdProdBusca').value = '';
    document.getElementById('vdObs').value = '';
    document.getElementById('vdDescReais').value = '0';
    document.getElementById('vdDescPerc').value = '0';
    document.getElementById('vdRecebido').value = '';
    document.getElementById('vdTipo').value = 'VENDA';
    document.getElementById('vdStatus').value = 'PAGO';
    document.getElementById('vdForma').value = 'Dinheiro';
    prepararVendaForm();
    renderCarrinhoVenda();
    atualizarResumoEstoqueVenda();
}

document.getElementById('btnVdLimpar').addEventListener('click', function () {
    limparVendaForm();
    toast('Venda limpa.');
});

document.getElementById('btnVdFinalizar').addEventListener('click', function () {
    var db = carregar();
    var interno = canalVendas === 'interno';
    var clienteNome = '';
    var resolvido = { ok: false, clienteAvulso: true, clienteId: null };
    var funcionarioId = null;
    var funcionarioNome = '';
    var placa = '';

    if (interno) {
        funcionarioId = document.getElementById('vdFuncionarioId').value;
        var func = (db.funcionarios || []).find(function (f) { return f.id === funcionarioId; });
        if (!func || func.ativo === false) {
            toast('Selecione um funcionário ativo. Cadastre em Modo interno → Cadastro de Funcionários.');
            return;
        }
        funcionarioNome = func.nome;
        clienteNome = func.nome;
        placa = (document.getElementById('vdPlacaInterno').value || '').toUpperCase().trim();
    } else {
        clienteNome = document.getElementById('vdCliente').value.trim();
        resolvido = resolverClienteAtendimento(db, clienteNome);
        placa = (document.getElementById('vdPlaca').value || '').toUpperCase().trim();
    }
    var tipo = document.getElementById('vdTipo').value;
    /* Orçamento (oficina/balcão): placa, itens e até cliente não bloqueiam */
    if (tipo !== 'ORCAMENTO') {
        if (!interno && !clienteNome) { toast('Informe o cliente (cadastrado ou avulso).'); return; }
        if (!carrinhoVenda.length) { toast('Adicione itens ao carrinho.'); return; }
    } else {
        if (!clienteNome) {
            clienteNome = 'Orçamento';
            resolvido = { ok: false, clienteAvulso: true, clienteId: null };
        }
    }

    var totais = calcTotaisVenda();
    var status = document.getElementById('vdStatus').value;
    var forma = document.getElementById('vdForma').value;
    var numero = Number(document.getElementById('vdNumero').value) || proximoNumeroVenda(db);

    /* Baixa de estoque — só em VENDA (orçamento não mexe). Igual FH Control. */
    if (tipo === 'VENDA') {
        var necessidade = {};
        for (var i = 0; i < carrinhoVenda.length; i++) {
            var it = carrinhoVenda[i];
            if (!it.produtoId) continue;
            necessidade[it.produtoId] = (necessidade[it.produtoId] || 0) + (Number(it.qtd) || 0);
        }
        var ids = Object.keys(necessidade);
        for (var j = 0; j < ids.length; j++) {
            var pid = ids[j];
            var pi = db.produtos.findIndex(function (p) { return p.id === pid; });
            if (pi < 0) {
                toast('Produto do carrinho não encontrado no estoque.');
                return;
            }
            var prod = db.produtos[pi];
            var tem = Number(prod.qtd) || 0;
            var precisa = necessidade[pid];
            if (precisa > tem + 0.0001) {
                toast('Estoque disponível do produto ' + (prod.nome || '') + ': ' +
                    fmtQtdEstoque(tem, prod.unidade || 'un') +
                    ' — insuficiente para finalizar (precisa ' + fmtQtdEstoque(precisa, prod.unidade || 'un') + ').');
                return;
            }
        }
        for (var k = 0; k < ids.length; k++) {
            var pid2 = ids[k];
            var pi2 = db.produtos.findIndex(function (p) { return p.id === pid2; });
            var novo = (Number(db.produtos[pi2].qtd) || 0) - necessidade[pid2];
            db.produtos[pi2].qtd = Math.round(Math.max(0, novo) * 1000) / 1000;
            db.produtos[pi2].atualizadoEm = new Date().toISOString();
        }
    }

    var doc = {
        id: uid(),
        numero: numero,
        tipo: tipo,
        clienteId: !interno && resolvido.ok && !resolvido.clienteAvulso ? resolvido.clienteId : null,
        clienteNome: clienteNome,
        clienteAvulso: interno ? false : !(resolvido.ok && !resolvido.clienteAvulso),
        vendaFuncionario: interno,
        funcionarioId: funcionarioId,
        funcionarioNome: funcionarioNome,
        placa: placa,
        statusPagamento: status,
        formaPagamento: forma,
        dataEmissao: document.getElementById('vdEmissao').value,
        dataVencimento: document.getElementById('vdVenc').value,
        itens: carrinhoVenda.slice(),
        subtotal: totais.subtotal,
        descontoReais: totais.descontoReais,
        descontoPerc: totais.descontoPerc,
        valor: totais.total,
        valorRecebido: totais.valorRecebido,
        troco: totais.troco,
        observacao: document.getElementById('vdObs').value.trim(),
        descricao: carrinhoVenda.map(function (x) { return x.desc; }).join(', '),
        criadoEm: new Date().toISOString()
    };
    if (!db.orcamentos) db.orcamentos = [];
    db.orcamentos.push(doc);

    /* Destino financeiro — igual FH */
    if (tipo === 'VENDA' || tipo === 'ORCAMENTO') {
        if (status === 'PAGO' && tipo === 'VENDA') {
            var lanc = {
                id: uid(),
                tipo: 'entrada',
                descricao: 'Venda Nº ' + numero + ' — ' + clienteNome,
                valor: totais.total,
                forma: forma,
                vendaId: doc.id,
                criadoEm: new Date().toISOString()
            };
            if (formaPagamentoEhDigital(forma)) {
                if (!db.caixaBanco) db.caixaBanco = [];
                lanc.conta = 'banco';
                db.caixaBanco.push(lanc);
            } else {
                if (!db.caixa) db.caixa = [];
                lanc.conta = 'balcao';
                db.caixa.push(lanc);
            }
        } else if (status === 'PENDENTE' && tipo === 'VENDA') {
            if (!db.pendentes) db.pendentes = [];
            db.pendentes.push({
                id: uid(),
                cliente: clienteNome,
                descricao: 'Venda Nº ' + numero + ' — ' + (doc.descricao || 'Venda'),
                valor: totais.total,
                vencimento: doc.dataVencimento || hojeISO(),
                status: 'aberto',
                vendaId: doc.id,
                formaPrevista: forma,
                criadoEm: new Date().toISOString()
            });
        }
    }

    salvar(db);
    var msg = tipo === 'ORCAMENTO'
        ? 'Orçamento Nº ' + numero + ' salvo (sem baixa de estoque).'
        : (status === 'PAGO'
            ? ('Venda Nº ' + numero + ' salva. Estoque baixado. ' +
                (formaPagamentoEhDigital(forma) ? 'Valor no Caixa do Banco (PIX/cartão).' : 'Valor no Caixa Balcão (dinheiro).'))
            : ('Venda Nº ' + numero + ' salva. Estoque baixado. Valor em Contas a Receber.'));
    toast(interno
        ? (msg + ' Funcionário: ' + funcionarioNome + '.')
        : msg);
    limparVendaForm();
    renderOrcamentos();
    renderProdutos();
    renderCaixa();
    renderCaixaBanco();
    renderPendentes();
    atualizarKPIs(db);
});

function renderOrcamentos() {
    var db = carregar();
    var tb = document.getElementById('tabelaOrc');
    tb.innerHTML = '';
    if (!(db.orcamentos || []).length) {
        tb.innerHTML = '<tr><td colspan="7" class="muted">Nenhum documento.</td></tr>';
        return;
    }
    db.orcamentos.slice().reverse().forEach(function (o) {
        var nome = o.funcionarioNome || o.clienteNome || nomeCliente(db, o.clienteId) || '—';
        var tagAvulso = o.clienteAvulso ? ' <span style="font-size:0.68rem;font-weight:700;color:#8fe0b8">AVULSO</span>' : '';
        var tagFunc = o.vendaFuncionario || o.funcionarioId
            ? ' <span style="font-size:0.68rem;font-weight:700;color:#f1c40f">FUNCIONÁRIO</span>'
            : '';
        var pgto = (o.statusPagamento || '—') + (o.formaPagamento ? ' / ' + o.formaPagamento : '');
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + esc(o.numero || '—') + '</td>' +
            '<td>' + esc(fmtData(o.dataEmissao || o.criadoEm)) + '</td>' +
            '<td>' + esc(o.tipo || '—') + '</td>' +
            '<td>' + esc(nome) + tagFunc + tagAvulso + '</td>' +
            '<td>' + esc(pgto) + '</td>' +
            '<td>' + moeda(o.valor) + '</td>' +
            '<td class="actions"><button type="button" class="btn btn-danger" data-ex="' + o.id + '">Excluir</button></td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-ex]').forEach(function (b) {
        b.addEventListener('click', function () {
            if (!confirm('Excluir documento? (não estorna estoque automaticamente)')) return;
            var db2 = carregar();
            var idEx = b.getAttribute('data-ex');
            if (canalVendas !== 'interno') marcarExcluido(db2, 'orcamentos', idEx);
            db2.orcamentos = db2.orcamentos.filter(function (x) { return x.id !== idEx; });
            salvar(db2);
            renderOrcamentos();
        });
    });
}

/* ---------- Despesas por OS (Modo Interno) ---------- */
var despesaOsSelecionadaId = null;

function obterOsOcultasDespesas() {
    var intDb = carregarInternoRaw();
    if (!intDb.despesasOsOcultas || typeof intDb.despesasOsOcultas !== 'object') {
        return {};
    }
    return intDb.despesasOsOcultas;
}

function ocultarOsDespesas(atendimentoId) {
    if (!atendimentoId) return;
    var intDb = carregarInternoRaw();
    if (!intDb.despesasOsOcultas || typeof intDb.despesasOsOcultas !== 'object') {
        intDb.despesasOsOcultas = {};
    }
    intDb.despesasOsOcultas[String(atendimentoId)] = new Date().toISOString();
    salvarInternoRaw(intDb);
}

function limparDespesasInternasDaOs(atendimentoId) {
    if (!atendimentoId) return 0;
    var canalAntes = canalVendas;
    canalVendas = 'interno';
    var db = carregar();
    var antes = (db.caixa || []).length;
    db.caixa = (db.caixa || []).filter(function (x) {
        return !(x && x.tipo === 'saida' && String(x.atendimentoId) === String(atendimentoId));
    });
    var removidos = antes - (db.caixa || []).length;
    if (removidos > 0) salvar(db);
    canalVendas = canalAntes;
    return removidos;
}

function excluirOsDaListaDespesas(atendimentoId) {
    if (!atendimentoId) return;
    if (!confirm(
        'Excluir esta OS da lista Despesas por OS?\n\n' +
        '• Apaga as despesas internas lançadas nela\n' +
        '• Remove a OS desta tela\n' +
        '(A OS oficial no Histórico / Oficina NÃO é apagada.)'
    )) return;
    var n = limparDespesasInternasDaOs(atendimentoId);
    ocultarOsDespesas(atendimentoId);
    if (despesaOsSelecionadaId === atendimentoId) fecharBoxDespesaOs();
    toast(n > 0
        ? 'OS removida da lista e ' + n + ' despesa(s) apagada(s).'
        : 'OS removida da lista Despesas por OS.');
    renderDespesasOs();
    if (typeof gerarArvorePastasDespesasOs === 'function') gerarArvorePastasDespesasOs();
}

function listarDespesasInternasPorOs(atendimentoId) {
    var intDb = carregarInternoRaw();
    return (intDb.caixa || []).filter(function (x) {
        return x && x.tipo === 'saida' && x.atendimentoId === atendimentoId;
    });
}

function totalDespesasInternasPorOs(atendimentoId) {
    return listarDespesasInternasPorOs(atendimentoId).reduce(function (s, x) {
        return s + (Number(x.valor) || 0);
    }, 0);
}

function resumoLucroOs(atendimento) {
    var bruto = Number(atendimento && atendimento.total) || 0;
    var despesas = totalDespesasInternasPorOs(atendimento && atendimento.id);
    return {
        bruto: bruto,
        despesas: despesas,
        lucro: bruto - despesas
    };
}

function fecharBoxDespesaOs() {
    despesaOsSelecionadaId = null;
    var box = document.getElementById('boxLancarDespesaOs');
    if (box) box.style.display = 'none';
    document.getElementById('dosAtendimentoId').value = '';
    document.getElementById('formDespesaOs').reset();
    document.getElementById('tabelaDespesasOsDetalhe').innerHTML = '';
    document.getElementById('listaDespesasOsDetalheVazia').style.display = 'none';
}

function abrirLancarDespesaOs(atendimentoId) {
    var main = carregarMain();
    var a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
    if (!a) {
        toast('OS não encontrada.');
        return;
    }
    canalVendas = 'interno';
    atualizarBadgeCanal();
    despesaOsSelecionadaId = atendimentoId;
    document.getElementById('dosAtendimentoId').value = atendimentoId;
    var nome = nomeAtendimento(main, a);
    var resumo = resumoLucroOs(a);
    document.getElementById('tituloLancarDespesaOs').textContent =
        'Despesas — ' + nome + ' · ' + ((a.placa || '—').toUpperCase());
    document.getElementById('hintLancarDespesaOs').innerHTML =
        'Bruto OS: <strong>' + moeda(resumo.bruto) +
        '</strong> · Despesas: <strong>' + moeda(resumo.despesas) +
        '</strong> · Lucro: <strong>' + moeda(resumo.lucro) + '</strong>';
    document.getElementById('boxLancarDespesaOs').style.display = '';
    renderDespesasOsDetalhe(atendimentoId);
    document.getElementById('dosDesc').focus();
}

function renderDespesasOsDetalhe(atendimentoId) {
    var lista = listarDespesasInternasPorOs(atendimentoId);
    var tb = document.getElementById('tabelaDespesasOsDetalhe');
    var vazio = document.getElementById('listaDespesasOsDetalheVazia');
    tb.innerHTML = '';
    if (!lista.length) {
        vazio.style.display = '';
        return;
    }
    vazio.style.display = 'none';
    lista.slice().reverse().forEach(function (x) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + esc(fmtData(x.criadoEm)) + '</td>' +
            '<td>' + esc(x.descricao || '—') + '</td>' +
            '<td>' + esc(x.forma || '—') + '</td>' +
            '<td>' + moeda(x.valor) + '</td>' +
            '<td class="actions"><button type="button" class="btn btn-danger" data-dos-ex="' + esc(x.id) + '">Excluir</button></td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-dos-ex]').forEach(function (b) {
        b.addEventListener('click', function () {
            if (!confirm('Excluir esta despesa interna?')) return;
            var idEx = b.getAttribute('data-dos-ex');
            var canalAntes = canalVendas;
            canalVendas = 'interno';
            var db = carregar();
            db.caixa = (db.caixa || []).filter(function (x) { return x.id !== idEx; });
            salvar(db);
            canalVendas = canalAntes;
            toast('Despesa interna excluída.');
            renderDespesasOsDetalhe(atendimentoId);
            renderDespesasOs();
            renderCaixa();
            renderRelatorioCaixa();
        });
    });
}

function renderDespesasOs() {
    var panel = document.getElementById('painelDespesasOs');
    if (!panel) return;
    var main = carregarMain();
    var ocultas = obterOsOcultasDespesas();
    var q = (document.getElementById('buscaDespesasOs').value || '').toLowerCase().trim();
    var lista = (main.atendimentos || []).slice().filter(function (a) {
        if (!a || !a.id) return false;
        if (ocultas[a.id] || ocultas[String(a.id)]) return false;
        return true;
    }).sort(function (a, b) {
        return String(b.entrada || b.criadoEm || '').localeCompare(String(a.entrada || a.criadoEm || ''));
    });
    if (q) {
        lista = lista.filter(function (a) {
            var nome = nomeAtendimento(main, a);
            return [nome, a.placa, a.carro, a.status, a.responsavel].join(' ').toLowerCase().indexOf(q) > -1;
        });
    }

    var totBruto = 0, totDesp = 0;
    lista.forEach(function (a) {
        var r = resumoLucroOs(a);
        totBruto += r.bruto;
        totDesp += r.despesas;
    });
    document.getElementById('dosQtdOs').textContent = String(lista.length);
    document.getElementById('dosBruto').textContent = moeda(totBruto);
    document.getElementById('dosDespesas').textContent = moeda(totDesp);
    document.getElementById('dosLucro').textContent = moeda(totBruto - totDesp);

    if (typeof gerarArvorePastasDespesasOs === 'function') gerarArvorePastasDespesasOs();

    var tb = document.getElementById('tabelaDespesasOs');
    var vazio = document.getElementById('listaDespesasOsVazia');
    tb.innerHTML = '';
    if (!lista.length) {
        vazio.style.display = '';
        return;
    }
    vazio.style.display = 'none';
    lista.forEach(function (a) {
        var r = resumoLucroOs(a);
        var nome = nomeAtendimento(main, a);
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + esc(fmtData(a.entrada || a.criadoEm)) + '</td>' +
            '<td>' + esc(nome) + '</td>' +
            '<td>' + esc(a.carro || '—') + ' · <strong>' + esc((a.placa || '—').toUpperCase()) + '</strong></td>' +
            '<td>' + esc(a.status || '—') + '</td>' +
            '<td>' + moeda(r.bruto) + '</td>' +
            '<td>' + moeda(r.despesas) + '</td>' +
            '<td><strong>' + moeda(r.lucro) + '</strong></td>' +
            '<td class="actions" style="white-space:nowrap">' +
            '<button type="button" class="btn btn-primary" data-dos-abrir="' + esc(a.id) + '">Despesas</button> ' +
            '<button type="button" class="btn btn-danger" data-dos-excluir-os="' + esc(a.id) + '">Excluir</button>' +
            '</td>';
        tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-dos-abrir]').forEach(function (b) {
        b.addEventListener('click', function () {
            abrirLancarDespesaOs(b.getAttribute('data-dos-abrir'));
        });
    });
    tb.querySelectorAll('[data-dos-excluir-os]').forEach(function (b) {
        b.addEventListener('click', function () {
            excluirOsDaListaDespesas(b.getAttribute('data-dos-excluir-os'));
        });
    });

    if (despesaOsSelecionadaId) {
        var aindaExiste = lista.some(function (a) { return a.id === despesaOsSelecionadaId; });
        if (aindaExiste) {
            var aSel = (main.atendimentos || []).find(function (x) { return x.id === despesaOsSelecionadaId; });
            if (aSel) {
                var resumo = resumoLucroOs(aSel);
                document.getElementById('hintLancarDespesaOs').innerHTML =
                    'Bruto OS: <strong>' + moeda(resumo.bruto) +
                    '</strong> · Despesas: <strong>' + moeda(resumo.despesas) +
                    '</strong> · Lucro: <strong>' + moeda(resumo.lucro) + '</strong>';
                renderDespesasOsDetalhe(despesaOsSelecionadaId);
            }
        } else {
            fecharBoxDespesaOs();
        }
    }
}

function lancarDespesaOs(e) {
    e.preventDefault();
    var atendimentoId = document.getElementById('dosAtendimentoId').value || despesaOsSelecionadaId;
    if (!atendimentoId) {
        toast('Selecione uma OS para lançar a despesa.');
        return;
    }
    var main = carregarMain();
    var a = (main.atendimentos || []).find(function (x) { return x.id === atendimentoId; });
    if (!a) {
        toast('OS não encontrada no balcão oficial.');
        return;
    }
    var desc = document.getElementById('dosDesc').value.trim();
    var valor = parseMoeda(document.getElementById('dosValor').value);
    var forma = document.getElementById('dosForma').value;
    if (!desc) { toast('Informe a descrição da despesa.'); return; }
    if (!(valor > 0)) { toast('Informe um valor válido.'); return; }

    var canalAntes = canalVendas;
    canalVendas = 'interno';
    var db = carregar();
    if (!db.caixa) db.caixa = [];
    var nome = nomeAtendimento(main, a);
    var placa = (a.placa || '—').toUpperCase();
    db.caixa.push({
        id: uid(),
        tipo: 'saida',
        descricao: desc,
        valor: valor,
        forma: forma,
        conta: 'balcao',
        atendimentoId: atendimentoId,
        osResumo: {
            cliente: nome,
            placa: placa,
            carro: a.carro || '',
            totalOs: Number(a.total) || 0,
            entrada: a.entrada || a.criadoEm || ''
        },
        criadoEm: new Date().toISOString()
    });
    salvar(db);
    canalVendas = canalAntes;
    atualizarBadgeCanal();

    document.getElementById('formDespesaOs').reset();
    toast('Despesa interna lançada na OS ' + placa + '.');
    renderDespesasOsDetalhe(atendimentoId);
    renderDespesasOs();
    renderCaixa();
    renderRelatorioCaixa();
    document.getElementById('dosDesc').focus();
}

document.getElementById('formDespesaOs').addEventListener('submit', lancarDespesaOs);
document.getElementById('btnCancelarDespesaOs').addEventListener('click', fecharBoxDespesaOs);
document.getElementById('btnLimparDespesasOs').addEventListener('click', function () {
    var id = despesaOsSelecionadaId || document.getElementById('dosAtendimentoId').value;
    if (!id) {
        toast('Nenhuma OS selecionada.');
        return;
    }
    if (!confirm('Apagar TODAS as despesas internas desta OS?')) return;
    var n = limparDespesasInternasDaOs(id);
    toast(n > 0 ? n + ' despesa(s) apagada(s).' : 'Esta OS não tinha despesas internas.');
    renderDespesasOsDetalhe(id);
    renderDespesasOs();
});
document.getElementById('btnAtualizarDespesasOs').addEventListener('click', function () {
    renderDespesasOs();
    toast('Lista de OS atualizada.');
});
document.getElementById('buscaDespesasOs').addEventListener('input', renderDespesasOs);
document.getElementById('btnAtualizarPastasDos').addEventListener('click', function () {
    if (typeof gerarArvorePastasDespesasOs === 'function') gerarArvorePastasDespesasOs();
    toast('Pastas de despesas atualizadas.');
});
document.getElementById('btnRelMesDespesasOs').addEventListener('click', function () {
    if (typeof gerarRelatorioMensalDespesasOsPDF === 'function') gerarRelatorioMensalDespesasOsPDF();
});
document.getElementById('btnArquivarMesDosPc').addEventListener('click', function () {
    if (typeof arquivarMesDespesasOsPastaPC === 'function') arquivarMesDespesasOsPastaPC();
});

/* comissoes/funcionarios: ver js/comissoes.js */

/* ---------- Config / empresa / backup ---------- */
document.getElementById('formEmpresa').addEventListener('submit', function (e) {
    e.preventDefault();
    var emp = lerEmpresaDoForm();
    salvarEmpresaObj(emp);
    var logado = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
    toast(logado
        ? 'Dados salvos — enviando à nuvem…'
        : 'Dados da empresa salvos neste aparelho.');
});

document.getElementById('btnEmpPadrao').addEventListener('click', function () {
    document.getElementById('empNome').value = 'Joninha Suspensões';
    toast('Nome padrão aplicado — clique em Salvar para gravar.');
});

document.getElementById('empCep').addEventListener('input', function () {
    var v = this.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    this.value = v;
});

document.getElementById('empCnpj').addEventListener('input', function () {
    var v = this.value.replace(/\D/g, '').slice(0, 14);
    v = v.replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    this.value = v;
});

document.getElementById('empLogoUpload').addEventListener('change', async function () {
    var file = this.files && this.files[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
        toast('Imagem muito grande. Use até ~2,5 MB.');
        this.value = '';
        return;
    }
    try {
        toast('Comprimindo logo…');
        var data = await comprimirImagemArquivo(file);
        var emp = lerEmpresaDoForm(data);
        salvarEmpresaObj(emp);
        document.getElementById('empLogoUrl').value = '';
        var logado = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
        toast(logado ? 'Logo salva — enviando à nuvem…' : 'Logo atualizada pelo arquivo.');
    } catch (err) {
        toast('Não foi possível ler a imagem.');
    }
    this.value = '';
});

document.getElementById('btnSalvarLogoUrl').addEventListener('click', function () {
    var url = document.getElementById('empLogoUrl').value.trim();
    if (!url) { toast('Informe o link da imagem.'); return; }
    var emp = lerEmpresaDoForm(url);
    salvarEmpresaObj(emp);
    toast('Logo salva pelo link.');
});

document.getElementById('btnLogoPadrao').addEventListener('click', function () {
    var emp = lerEmpresaDoForm('');
    emp.logo = '';
    salvarEmpresaObj(emp);
    document.getElementById('empLogoUrl').value = '';
    toast('Logo padrão (logo-joninha.jpg) restaurada.');
});

document.getElementById('btnExportar').addEventListener('click', function () {
    var pack = {
        oficial: carregarMain(),
        interno: carregarInternoRaw(),
        exportadoEm: new Date().toISOString()
    };
    var blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'joninha-suspensoes-backup-' + hojeISO() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup exportado (oficial + interno).');
});

document.getElementById('btnImportar').addEventListener('click', function () {
    document.getElementById('fileImport').click();
});

document.getElementById('fileImport').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
        try {
            var data = JSON.parse(reader.result);
            if (!confirm('Substituir os dados atuais deste index pelo arquivo importado?')) return;
            if (data.oficial || data.interno) {
                salvarMain(Object.assign(estadoVazio(), data.oficial || {}));
                if (data.interno) salvarInternoRaw(Object.assign(estadoInternoVazio(), data.interno));
            } else {
                salvarMain(Object.assign(estadoVazio(), data));
            }
            toast('Backup importado.');
            renderTudo();
        } catch (err) {
            alert('Arquivo JSON inválido.');
        }
    };
    reader.readAsText(file);
    this.value = '';
});

document.getElementById('btnZerar').addEventListener('click', function () {
    if (!confirm('Apagar TODOS os dados deste index (oficial + interno)?\nOs outros sistemas NÃO serão afetados.')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_INTERNO);
    localStorage.removeItem(ASSIN_KEY);
    limparFormCliente();
    limparProd();
    limparAtendimento();
    toast('Dados do index apagados.');
    renderTudo();
});

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
    if (document.getElementById('painelRelatorioDespesas') &&
        document.getElementById('painelRelatorioDespesas').classList.contains('active')) {
        renderRelatorioDespesas();
    }
    if (document.getElementById('painelDespesasOs') &&
        document.getElementById('painelDespesasOs').classList.contains('active')) {
        renderDespesasOs();
    }
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

/* ========== JONINHA — áudios: checklist, comissão, lucro peça, fechamento, WhatsApp ========== */

function telWa(telefone) {
    var d = String(telefone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d;
}

function abrirWhatsApp(telefone, texto) {
    var tel = telWa(telefone);
    var url = tel
        ? ('https://api.whatsapp.com/send?phone=' + tel + '&text=' + encodeURIComponent(texto))
        : ('https://wa.me/?text=' + encodeURIComponent(texto));
    window.open(url, '_blank');
}

function lerChecklistUI() {
    var out = {};
    document.querySelectorAll('#atChecklistBox input[data-chk]').forEach(function (el) {
        out[el.getAttribute('data-chk')] = !!el.checked;
    });
    return out;
}

function aplicarChecklistUI(mapa) {
    mapa = mapa || {};
    document.querySelectorAll('#atChecklistBox input[data-chk]').forEach(function (el) {
        el.checked = !!mapa[el.getAttribute('data-chk')];
    });
}

function textoChecklist(mapa, obs) {
    var linhas = [];
    Object.keys(CHECKLIST_LABELS).forEach(function (k) {
        if (mapa && mapa[k]) linhas.push('☑ ' + CHECKLIST_LABELS[k]);
    });
    if (!linhas.length) linhas.push('(nenhum item marcado)');
    var t = '*Checklist do veículo — Joninha Suspensões*\n\n' + linhas.join('\n');
    if (obs) t += '\n\n*Observações:* ' + obs;
    return t;
}

/* comissoes select MO: ver js/comissoes.js */

function ganhoItem(it) {
    if (!it || (it.tipo || 'peca') !== 'peca') return 0;
    var venda = Number(it.valor) || 0;
    var custo = Number(it.custo) || 0;
    return Math.max(0, venda - custo);
}

function totaisItens(lista) {
    var pecas = 0, custo = 0, mao = 0, ganho = 0;
    (lista || []).forEach(function (it) {
        var tipo = it.tipo || 'peca';
        var v = Number(it.valor) || 0;
        if (tipo === 'mao') mao += v;
        else {
            pecas += v;
            custo += Number(it.custo) || 0;
            ganho += ganhoItem(it);
        }
    });
    return { pecas: pecas, custoPecas: custo, ganhoPecas: ganho, mao: mao, total: pecas + mao };
}

function telefoneDoAtendimento(db, a) {
    if (!a) return '';
    if (a.telefoneWa) return a.telefoneWa;
    if (a.clienteCadastro && a.clienteCadastro.telefone) return a.clienteCadastro.telefone;
    var c = (db.clientes || []).find(function (x) { return x.id === a.clienteId; });
    return (c && c.telefone) || '';
}

function obterTelefoneWhatsAppOs() {
    var manual = (document.getElementById('atWaTel') && document.getElementById('atWaTel').value.trim()) || '';
    if (manual) return manual;
    var db = carregar();
    var id = document.getElementById('atClienteId').value;
    if (id) {
        var c = (db.clientes || []).find(function (x) { return x.id === id; });
        if (c && c.telefone) return c.telefone;
    }
    return '';
}

var _waEnvioCtx = null;

function garantirTelefoneWaEnvio(tel) {
    if (telWa(tel)) return true;
    toast('Informe o WhatsApp do cliente (obrigatório se for avulso).');
    var el = document.getElementById('atWaTel');
    if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return false;
}

function montarAtendimentoDoFormulario() {
    var db = carregar();
    var resolvido = resolverClienteAtendimento(db, document.getElementById('atClienteBusca').value);
    var id = document.getElementById('atId').value;
    var tots = totaisItens(itensTemp);
    var base = id ? (db.atendimentos || []).find(function (x) { return x.id === id; }) : null;
    var a = {
        id: id || ('temp_' + Date.now()),
        clienteId: resolvido.ok ? resolvido.clienteId : '',
        clienteNome: (resolvido.ok && resolvido.clienteNome) || document.getElementById('atClienteBusca').value.trim() || 'cliente',
        clienteAvulso: resolvido.ok ? !!resolvido.clienteAvulso : true,
        clienteCadastro: resolvido.ok ? snapshotClienteCadastro(db, resolvido) : null,
        responsavel: document.getElementById('atResponsavel').value.trim(),
        carro: document.getElementById('atCarro').value.trim(),
        placa: (document.getElementById('atPlaca').value || '').toUpperCase().trim(),
        cidadePlaca: document.getElementById('atCidadePlaca').value.trim(),
        cor: document.getElementById('atCor').value.trim(),
        anoFabricacao: document.getElementById('atAnoFabricacao').value.trim(),
        anoModelo: document.getElementById('atAnoModelo').value.trim(),
        chassi: document.getElementById('atChassi').value.trim(),
        km: document.getElementById('atKm').value,
        entrada: document.getElementById('atEntrada').value || hojeISO(),
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
        tokenAssinatura: base ? base.tokenAssinatura : null,
        assinaturaCliente: base ? base.assinaturaCliente : null,
        assinadoEm: base ? base.assinadoEm : null,
        criadoEm: (base && base.criadoEm) || new Date().toISOString()
    };
    var wa = obterTelefoneWhatsAppOs();
    if (wa && a.clienteCadastro) a.clienteCadastro.telefone = wa;
    else if (wa) a.telefoneWa = wa;
    return a;
}

function obterCtxWaAtendimento() {
    var db = carregar();
    var ctx = _waEnvioCtx || {};
    if (ctx.deFormulario) {
        var formA = montarAtendimentoDoFormulario();
        return { db: db, a: formA, tel: obterTelefoneWhatsAppOs(), deFormulario: true };
    }
    if (ctx.atendimentoId) {
        var a = (db.atendimentos || []).find(function (x) { return x.id === ctx.atendimentoId; });
        if (a) return { db: db, a: a, tel: telefoneDoAtendimento(db, a), deFormulario: false };
    }
    if (atendimentoNotaAtual) {
        return {
            db: db,
            a: atendimentoNotaAtual,
            tel: telefoneDoAtendimento(db, atendimentoNotaAtual),
            deFormulario: false
        };
    }
    return null;
}

function tituloDocWa(tipo) {
    if (tipo === 'checklist') return 'CHECKLIST DE CHEGADA';
    if (tipo === 'orcamento') return 'ORÇAMENTO / DIAGNÓSTICO';
    return 'ESPELHO DE ATENDIMENTO';
}

function abrirModalWaEnvio(ctx) {
    _waEnvioCtx = ctx || {};
    var tit = document.getElementById('modalWaEnvioTitulo');
    var hint = document.getElementById('modalWaEnvioHint');
    var tipo = _waEnvioCtx.tipo || 'nota';
    if (tit) {
        if (tipo === 'checklist') tit.textContent = 'Checklist no WhatsApp';
        else if (tipo === 'orcamento') tit.textContent = 'Orçamento no WhatsApp';
        else tit.textContent = 'Enviar pelo WhatsApp';
    }
    if (hint) {
        hint.textContent = 'Escolha o formato: texto, imagem JPEG, PDF ou link para o cliente ler e assinar.';
    }
    document.getElementById('modalWaEnvio').classList.add('aberto');
}

function fecharModalWaEnvio() {
    document.getElementById('modalWaEnvio').classList.remove('aberto');
}

async function prepararHtmlWaEnvio(incluirFotos) {
    var info = obterCtxWaAtendimento();
    if (!info || !info.a) {
        toast('Documento não encontrado.');
        return null;
    }
    var a = info.a;
    if (incluirFotos) {
        a = await garantirFotosCarregadas(a);
    }
    var opts = {
        incluirFotos: !!incluirFotos,
        tituloDoc: tituloDocWa((_waEnvioCtx && _waEnvioCtx.tipo) || 'nota')
    };
    var html = htmlNotaEspelho(info.db, a, opts);
    _htmlNotaImpressaoAtual = html;
    atendimentoNotaAtual = a;
    return { html: html, a: a, tel: info.tel, db: info.db };
}

async function waEnvioTexto() {
    var tipo = (_waEnvioCtx && _waEnvioCtx.tipo) || 'nota';
    var id = _waEnvioCtx && _waEnvioCtx.atendimentoId;
    fecharModalWaEnvio();
    if (tipo === 'checklist' && id) {
        enviarWaChecklistSalvo(id);
        return;
    }
    if (tipo === 'orcamento' && id) {
        enviarWaOrcamentoSalvo(id);
        return;
    }
    if (tipo === 'checklist') {
        var tel = obterTelefoneWhatsAppOs();
        if (!garantirTelefoneWaEnvio(tel)) return;
        var m = montarMsgChecklistAtual();
        abrirWhatsApp(tel, m.msg);
        return;
    }
    if (tipo === 'orcamento') {
        var tel2 = obterTelefoneWhatsAppOs();
        if (!garantirTelefoneWaEnvio(tel2)) return;
        var m2 = montarMsgOrcamentoAtual();
        abrirWhatsApp(tel2, m2.msg);
        return;
    }
    var info = obterCtxWaAtendimento();
    if (!info || !info.a) { toast('Abra a nota antes.'); return; }
    enviarWaOrcamentoSalvo(info.a.id);
}

async function waEnvioArquivo(formato) {
    var info0 = obterCtxWaAtendimento();
    if (!info0 || !info0.a) {
        toast('Documento não encontrado.');
        return;
    }
    fecharModalWaEnvio();
    var comFotos = await perguntarEnviarComFotos(info0.a, { forcarPergunta: true });
    if (comFotos === null) return;
    var prep = await prepararHtmlWaEnvio(!!comFotos);
    if (!prep) return;
    var tel = prep.tel || obterTelefoneWhatsAppOs() || '';
    var nomeCli = nomeAtendimento(prep.db, prep.a);
    var emp = getEmpresa().nome || 'Joninha Suspensões';
    var texto = 'Olá *' + nomeCli + '*, segue o documento da *' + emp + '*.';

    if (formato === 'jpeg') {
        var nomeJpg = await perguntarNomeArquivoAsync('jpg', 'Nome do JPEG');
        if (!nomeJpg) return;
        toast('Gerando JPEG…');
        try {
            var blobJpg = await gerarJpegBlobDaNota(prep.html);
            var r1 = await compartilharArquivoCliente(blobJpg, nomeJpg, 'image/jpeg', tel, texto);
            if (r1 === 'shared') toast('JPEG pronto — escolha WhatsApp para enviar.');
            else if (r1 === 'download') toast('JPEG baixado — anexe no WhatsApp.');
        } catch (err) {
            console.error(err);
            toast('Falha ao gerar JPEG. Tente PDF.');
        }
        return;
    }

    var nomePdf = await perguntarNomeArquivoAsync('pdf', 'Nome do PDF');
    if (!nomePdf) return;
    toast('Gerando PDF…');
    try {
        var blobPdf = await gerarPdfBlobDaNota(prep.html, nomePdf);
        if (!blobPdf || blobPdf.size < 800) throw new Error('PDF vazio');
        var r2 = await compartilharArquivoCliente(blobPdf, nomePdf, 'application/pdf', tel, texto);
        if (r2 === 'shared') toast('PDF pronto — escolha WhatsApp para enviar.');
        else if (r2 === 'download') toast('PDF baixado — anexe no WhatsApp.');
    } catch (err2) {
        console.error(err2);
        toast('Falha ao gerar PDF.');
    }
}

function salvarAtendimentoRapidoParaEnvio() {
    var db = carregar();
    var resolvido = resolverClienteAtendimento(db, document.getElementById('atClienteBusca').value);
    if (!resolvido.ok) {
        toast('Informe o nome do cliente (cadastrado ou avulso) para enviar.');
        return null;
    }
    var st = document.getElementById('atStatus').value;
    var agData = document.getElementById('atAgendadoPara').value;
    if (st === 'Agendado' && !agData) {
        toast('Informe a data agendada antes de enviar.');
        document.getElementById('atAgendadoPara').focus();
        return null;
    }
    var id = document.getElementById('atId').value;
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
        entrada: document.getElementById('atEntrada').value || hojeISO(),
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
    var wa = obterTelefoneWhatsAppOs();
    if (wa) {
        if (!payload.clienteCadastro) payload.clienteCadastro = {};
        payload.clienteCadastro.telefone = wa;
    }
    if (id) {
        var i = db.atendimentos.findIndex(function (a) { return a.id === id; });
        if (i >= 0) {
            if (db.atendimentos[i].tokenAssinatura) payload.tokenAssinatura = db.atendimentos[i].tokenAssinatura;
            if (db.atendimentos[i].assinaturaCliente) {
                payload.assinaturaCliente = db.atendimentos[i].assinaturaCliente;
                payload.assinadoEm = db.atendimentos[i].assinadoEm;
            }
            db.atendimentos[i] = Object.assign({}, db.atendimentos[i], payload);
        } else {
            payload.criadoEm = new Date().toISOString();
            db.atendimentos.push(payload);
        }
    } else {
        payload.criadoEm = new Date().toISOString();
        db.atendimentos.push(payload);
    }
    limparExcluido(db, 'atendimentos', payload.id);
    salvar(db);
    document.getElementById('atId').value = payload.id;
    return payload;
}

async function waEnvioAssinar() {
    fecharModalWaEnvio();
    var info = obterCtxWaAtendimento();
    var id = null;

    if (info && info.deFormulario) {
        var salvo = salvarAtendimentoRapidoParaEnvio();
        if (!salvo) return;
        id = salvo.id;
    } else if (info && info.a && info.a.id && String(info.a.id).indexOf('temp_') !== 0) {
        var dbCheck = carregar();
        var existe = (dbCheck.atendimentos || []).some(function (x) { return x.id === info.a.id; });
        if (existe) {
            id = info.a.id;
        } else {
            var salvo2 = salvarAtendimentoRapidoParaEnvio();
            if (!salvo2) return;
            id = salvo2.id;
        }
    } else {
        var salvo3 = salvarAtendimentoRapidoParaEnvio();
        if (!salvo3) return;
        id = salvo3.id;
    }

    await abrirLinkAssinatura(id);
}

function enviarWhatsAppOs(tipo) {
    var tel = obterTelefoneWhatsAppOs();
    if (!garantirTelefoneWaEnvio(tel)) return;
    abrirModalWaEnvio({ tipo: tipo, deFormulario: true });
}

function montarMsgChecklistAtual() {
    var db = carregar();
    var nome = document.getElementById('atClienteBusca').value.trim() || 'cliente';
    var carro = document.getElementById('atCarro').value.trim();
    var placa = (document.getElementById('atPlaca').value || '').toUpperCase().trim();
    var km = document.getElementById('atKm').value;
    var chk = lerChecklistUI();
    var obs = document.getElementById('atEstado').value.trim();
    var emp = getEmpresa().nome || 'Joninha Suspensões';
    var msg = 'Olá *' + nome + '*, tudo bem?\n\n';
    msg += 'Segue o *checklist de chegada* do veículo na *' + emp + '*.\n';
    if (carro || placa) msg += '\n*Veículo:* ' + (carro || '—') + (placa ? ' · Placa ' + placa : '') + '\n';
    if (km) msg += '*Km:* ' + km + '\n';
    msg += '\n' + textoChecklist(chk, obs).replace('*Checklist do veículo — Joninha Suspensões*\n\n', '');
    msg += '\n\nQualquer dúvida, estamos à disposição.';
    return { msg: msg, telefone: obterTelefoneWhatsAppOs() };
}

function montarMsgOrcamentoAtual() {
    var db = carregar();
    var nome = document.getElementById('atClienteBusca').value.trim() || 'cliente';
    var carro = document.getElementById('atCarro').value.trim();
    var placa = (document.getElementById('atPlaca').value || '').toUpperCase().trim();
    var diag = (document.getElementById('atDiagnostico') && document.getElementById('atDiagnostico').value.trim()) || '';
    var serv = document.getElementById('atServicos').value.trim();
    var tot = totaisItens(itensTemp);
    var emp = getEmpresa().nome || 'Joninha Suspensões';
    var msg = 'Olá *' + nome + '*, tudo bem?\n\n';
    msg += 'Segue o *orçamento / diagnóstico* da *' + emp + '*.\n';
    if (carro || placa) msg += '\n*Veículo:* ' + (carro || '—') + (placa ? ' · Placa ' + placa : '') + '\n';
    if (diag) msg += '\n*Diagnóstico:*\n' + diag + '\n';
    if (serv) msg += '\n*Serviços:*\n' + serv + '\n';
    msg += '\n*Itens / serviços:*\n';
    if (!itensTemp.length) msg += '- (ainda sem itens)\n';
    else itensTemp.forEach(function (it) {
        var tag = (it.tipo || 'peca') === 'mao' ? 'MO' : 'Peça';
        msg += '- [' + tag + '] ' + (it.desc || '') + ': ' + moeda(it.valor) + '\n';
    });
    msg += '\n*Peças:* ' + moeda(tot.pecas);
    msg += '\n*Mão de obra:* ' + moeda(tot.mao);
    msg += '\n*Total:* ' + moeda(tot.total) + '\n';
    msg += '\nAguardamos sua aprovação. Obrigado!';
    return { msg: msg, telefone: obterTelefoneWhatsAppOs() };
}

function enviarWaChecklistSalvo(id) {
    var db = carregar();
    var a = (db.atendimentos || []).find(function (x) { return x.id === id; });
    if (!a) { toast('Atendimento não encontrado.'); return; }
    var nome = a.clienteNome || nomeAtendimento(db, a);
    var emp = getEmpresa().nome || 'Joninha Suspensões';
    var msg = 'Olá *' + nome + '*, tudo bem?\n\nChecklist de chegada — *' + emp + '*.\n';
    msg += '*Veículo:* ' + (a.carro || '—') + (a.placa ? ' · ' + a.placa : '') + '\n';
    if (a.km) msg += '*Km:* ' + a.km + '\n\n';
    msg += textoChecklist(a.checklist || {}, a.estado || '').replace('*Checklist do veículo — Joninha Suspensões*\n\n', '');
    if (a.diagnostico) msg += '\n\n*Diagnóstico:* ' + a.diagnostico;
    abrirWhatsApp(telefoneDoAtendimento(db, a), msg);
}

function enviarWaOrcamentoSalvo(id) {
    var db = carregar();
    var a = (db.atendimentos || []).find(function (x) { return x.id === id; });
    if (!a) { toast('Atendimento não encontrado.'); return; }
    var nome = a.clienteNome || nomeAtendimento(db, a);
    var emp = getEmpresa().nome || 'Joninha Suspensões';
    var tot = totaisItens(a.itens || []);
    var msg = 'Olá *' + nome + '*, tudo bem?\n\n*Orçamento / OS* — *' + emp + '*.\n';
    msg += '*Veículo:* ' + (a.carro || '—') + (a.placa ? ' · ' + a.placa : '') + '\n';
    if (a.diagnostico) msg += '\n*Diagnóstico:*\n' + a.diagnostico + '\n';
    if (a.servicos) msg += '\n*Serviços:*\n' + a.servicos + '\n';
    msg += '\n*Itens:*\n';
    (a.itens || []).forEach(function (it) {
        var tag = (it.tipo || 'peca') === 'mao' ? 'MO' : 'Peça';
        msg += '- [' + tag + '] ' + (it.desc || '') + ': ' + moeda(it.valor) + '\n';
    });
    msg += '\n*Peças:* ' + moeda(tot.pecas) + '\n*Mão de obra:* ' + moeda(tot.mao) + '\n*Total:* ' + moeda(a.total != null ? a.total : tot.total);
    abrirWhatsApp(telefoneDoAtendimento(db, a), msg);
}

function periodoOficina() {
    var tipo = (document.getElementById('rofPeriodo') && document.getElementById('rofPeriodo').value) || 'dia';
    var hoje = hojeISO();
    if (tipo === 'dia') return { inicio: hoje, fim: hoje, label: 'Dia ' + fmtData(hoje) };
    if (tipo === 'dia_escolhido') {
        var d = document.getElementById('rofData').value || hoje;
        return { inicio: d, fim: d, label: 'Dia ' + fmtData(d) };
    }
    if (tipo === 'mes') {
        var m = hoje.slice(0, 7);
        return { inicio: m + '-01', fim: m + '-31', label: 'Mês ' + m };
    }
    var mes = (document.getElementById('rofMes') && document.getElementById('rofMes').value) || hoje.slice(0, 7);
    return { inicio: mes + '-01', fim: mes + '-31', label: 'Mês ' + mes };
}

function dataAtendimentoISO(a) {
    return String(a.entrada || a.saida || (a.criadoEm || '').slice(0, 10) || '').slice(0, 10);
}

function calcularRelatorioOficina(periodo) {
    /* Sempre usa as OS da empresa (banco principal), independente do canal do menu */
    var db = (typeof carregarMain === 'function') ? carregarMain() : carregar();
    var pecas = 0, ganho = 0, mao = 0, despesas = 0;
    var linhas = [];
    (db.atendimentos || []).forEach(function (a) {
        var d = dataAtendimentoISO(a);
        if (!d || d < periodo.inicio || d > periodo.fim) return;
        var t = totaisItens(a.itens || []);
        /* compat: se não houver itens tipados, usa totais salvos */
        if (!(a.itens || []).length) {
            t.pecas = Number(a.totalPecas) || 0;
            t.mao = Number(a.maoObra) || 0;
            t.ganhoPecas = 0;
            t.total = Number(a.total) || (t.pecas + t.mao);
        }
        pecas += t.pecas;
        ganho += t.ganhoPecas;
        mao += t.mao;
        linhas.push({
            data: d,
            cliente: a.clienteNome || nomeAtendimento(db, a),
            placa: a.placa || '',
            pecas: t.pecas,
            ganho: t.ganhoPecas,
            mao: t.mao,
            total: Number(a.total) || (t.pecas + t.mao),
            pago: String(a.statusPagamento || '').toUpperCase() === 'PAGO',
            atendimentoId: a.id
        });
    });
    function somaSaidas(lista) {
        (lista || []).forEach(function (l) {
            if (l.tipo !== 'saida') return;
            var d = String(l.criadoEm || '').slice(0, 10);
            if (!d || d < periodo.inicio || d > periodo.fim) return;
            despesas += Number(l.valor) || 0;
        });
    }
    try {
        var dbN = carregarMain();
        somaSaidas(dbN.caixa);
        somaSaidas(dbN.caixaBanco);
    } catch (e0) { /* ok */ }
    try {
        comCanalInterno(function () {
            var di = carregar();
            somaSaidas(di.caixa);
            somaSaidas(di.caixaBanco);
        });
    } catch (e) { /* ok */ }
    var resultado = ganho + mao - despesas;
    return {
        pecas: pecas,
        ganho: ganho,
        mao: mao,
        maoLiq: mao,
        despesas: despesas,
        resultado: resultado,
        linhas: linhas
    };
}

/** Garante que OS pagas entrem no caixa da empresa (Caixa / Balcão oficial) */
function sincronizarOficinaNoCaixaEmpresa() {
    var main = carregarMain();
    var canalAntes = canalVendas;
    canalVendas = 'normal';
    atualizarBadgeCanal();
    var db = carregar();
    if (!db.caixa) db.caixa = [];
    if (!db.caixaBanco) db.caixaBanco = [];
    var cfg = getCaixaConfig(db);
    var bloqueadas = (cfg.osBloqueadasCaixa && typeof cfg.osBloqueadasCaixa === 'object')
        ? cfg.osBloqueadasCaixa
        : {};
    var idsLanc = {};
    (db.caixa || []).concat(db.caixaBanco || []).forEach(function (l) {
        if (l && l.atendimentoId) idsLanc[l.atendimentoId] = true;
    });
    var mudou = false;
    (main.atendimentos || []).forEach(function (a) {
        if (!a || !a.id) return;
        if (String(a.statusPagamento || '').toUpperCase() !== 'PAGO') return;
        if (idsLanc[a.id]) return;
        if (bloqueadas[a.id] || bloqueadas[String(a.id)]) return; /* excluída manualmente do caixa */
        var valor = Number(a.total) || 0;
        if (!(valor > 0)) return;
        var nome = nomeAtendimento(main, a);
        var placa = (a.placa || '—').toUpperCase();
        var forma = a.formaPagamento || 'Dinheiro';
        var digital = formaPagamentoEhDigital(forma);
        var dataRef = a.recebidoEm || a.atualizadoEm || a.entrada || a.criadoEm || new Date().toISOString();
        var t = totaisItens(a.itens || []);
        var lanc = {
            id: uid(),
            tipo: 'entrada',
            descricao: 'Oficina / OS ' + placa + ' — ' + nome,
            valor: valor,
            forma: forma,
            conta: digital ? 'banco' : 'balcao',
            atendimentoId: a.id,
            origemOficina: true,
            osResumo: {
                cliente: nome,
                placa: placa,
                carro: a.carro || '',
                totalOs: valor,
                entrada: a.entrada || a.criadoEm || '',
                pecas: Number(a.totalPecas) || t.pecas,
                mao: Number(a.maoObra) || t.mao
            },
            criadoEm: dataRef
        };
        if (digital) db.caixaBanco.push(lanc);
        else db.caixa.push(lanc);
        idsLanc[a.id] = true;
        mudou = true;
    });
    if (mudou) salvar(db);
    canalVendas = canalAntes;
    atualizarBadgeCanal();
    return mudou;
}

function totaisOficinaNoCaixaHoje(db, hoje) {
    var total = 0;
    function somar(lista) {
        (lista || []).forEach(function (l) {
            if (l.tipo !== 'entrada') return;
            if (!l.atendimentoId && !l.origemOficina) return;
            var d = String(l.criadoEm || '').slice(0, 10);
            if (d !== hoje) return;
            total += Number(l.valor) || 0;
        });
    }
    somar(db.caixa);
    somar(db.caixaBanco);
    return total;
}

function renderRelatorioOficina() {
    var panel = document.getElementById('painelRelatorioOficina');
    if (!panel) return;
    var per = periodoOficina();
    var r = calcularRelatorioOficina(per);
    document.getElementById('rofPecasBruto').textContent = moeda(r.pecas);
    document.getElementById('rofPecasLucro').textContent = moeda(r.ganho);
    document.getElementById('rofMaoBruta').textContent = moeda(r.mao);
    document.getElementById('rofMaoLiq').textContent = moeda(r.maoLiq);
    document.getElementById('rofDespesas').textContent = moeda(r.despesas);
    document.getElementById('rofResultado').textContent = moeda(r.resultado);
    var html = '<p><strong>' + esc(per.label) + '</strong></p>';
    html += '<p class="hint">Peças vendidas: <strong>' + moeda(r.pecas) + '</strong> · Lucro nas peças: <strong class="ganho-linha">' + moeda(r.ganho) + '</strong> · MO: <strong>' + moeda(r.mao) + '</strong> · Despesas: <strong>' + moeda(r.despesas) + '</strong> · Resultado (lucro peça + MO − despesas): <strong>' + moeda(r.resultado) + '</strong></p>';
    html += '<p class="hint">OS pagas entram automaticamente no <strong>Caixa / Balcão</strong> da empresa (CAIXA/RELATÓRIO).</p>';
    if (!r.linhas.length) {
        html += '<div class="empty">Nenhuma OS no período.</div>';
    } else {
        html += '<table><thead><tr><th>Data</th><th>Cliente</th><th>Placa</th><th>Peças</th><th>Ganho peça</th><th>MO</th><th>Pagamento</th></tr></thead><tbody>';
        html += r.linhas.map(function (l) {
            return '<tr><td>' + esc(fmtData(l.data)) + '</td><td>' + esc(l.cliente) + '</td><td>' + esc(l.placa) + '</td><td>' + moeda(l.pecas) + '</td><td class="ganho-linha">' + moeda(l.ganho) + '</td><td>' + moeda(l.mao) + '</td><td>' + (l.pago ? 'PAGO → caixa' : 'Pendente') + '</td></tr>';
        }).join('');
        html += '</tbody></table>';
    }
    document.getElementById('rofDetalhe').innerHTML = html;
}

function imprimirRelatorioOficina() {
    renderRelatorioOficina();
    var per = periodoOficina();
    var r = calcularRelatorioOficina(per);
    var emp = getEmpresa();
    var corpo = document.getElementById('rofDetalhe').innerHTML;
    var html = '<html><head><title>Relatório Oficina — ' + esc(per.label) + '</title><style>body{font-family:Segoe UI,sans-serif;padding:20px;color:#111} table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #ccc;padding:6px;font-size:12px;text-align:left} h1{font-size:18px;margin:0 0 8px} .k{color:#444}</style></head><body>';
    html += '<h1>' + esc(emp.nome || 'Joninha Suspensões') + '</h1>';
    html += '<p class="k">Relatório Oficina — ' + esc(per.label) + ' · gerado em ' + esc(new Date().toLocaleString('pt-BR')) + '</p>';
    html += '<p><b>Peças (bruto):</b> ' + moeda(r.pecas) + ' &nbsp;|&nbsp; <b>Ganho em peças:</b> ' + moeda(r.ganho) + ' &nbsp;|&nbsp; <b>MO bruta/líquida:</b> ' + moeda(r.mao) + ' &nbsp;|&nbsp; <b>Despesas:</b> ' + moeda(r.despesas) + ' &nbsp;|&nbsp; <b>Resultado:</b> ' + moeda(r.resultado) + '</p>';
    html += corpo;
    html += '</body></html>';
    var w = window.open('', '_blank');
    if (!w) { toast('Permita pop-up para imprimir.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
}

/* comissoes painel: ver js/comissoes.js */

/* caixa fechamento: ver js/caixa.js */

/* auth logins func: ver js/auth.js */

(function ligarExtrasJoninha() {
    var bChk = document.getElementById('btnWaChecklist');
    if (bChk) bChk.addEventListener('click', function () {
        enviarWhatsAppOs('checklist');
    });
    var bOr = document.getElementById('btnWaOrcamento');
    if (bOr) bOr.addEventListener('click', function () {
        enviarWhatsAppOs('orcamento');
    });
    var bFechar = document.getElementById('btnFecharCaixaDia');
    if (bFechar) bFechar.addEventListener('click', fecharCaixaDoDia);
    var bRelDia = document.getElementById('btnRelatorioDiaOficina');
    if (bRelDia) bRelDia.addEventListener('click', function () {
        var rof = document.getElementById('rofPeriodo');
        if (rof) rof.value = 'dia';
        abrirPainel('painelRelatorioOficina');
        renderRelatorioOficina();
        imprimirRelatorioOficina();
    });
    var bRof = document.getElementById('btnRofAtualizar');
    if (bRof) bRof.addEventListener('click', renderRelatorioOficina);
    var bRofPdf = document.getElementById('btnRofPdf');
    if (bRofPdf) bRofPdf.addEventListener('click', imprimirRelatorioOficina);
    var bCom = document.getElementById('btnComAtualizar');
    if (bCom) bCom.addEventListener('click', renderComissoes);
    var tabA = document.getElementById('tabLoginAdmin');
    var tabF = document.getElementById('tabLoginFunc');
    if (tabA && tabF) {
        tabA.addEventListener('click', function () {
            tabA.classList.add('active'); tabF.classList.remove('active');
            document.getElementById('loginBoxEntrar').style.display = '';
            document.getElementById('loginBoxFunc').style.display = 'none';
        });
        tabF.addEventListener('click', function () {
            tabF.classList.add('active'); tabA.classList.remove('active');
            document.getElementById('loginBoxEntrar').style.display = 'none';
            document.getElementById('loginBoxFunc').style.display = '';
            atualizarHintLoginsFuncTela();
            puxarLoginsFuncNuvem().then(function (res) {
                atualizarHintLoginsFuncTela();
                if (res && res.ok && res.logins && res.logins.length) {
                    var el = document.getElementById('loginFuncHintQtd');
                    if (el) el.textContent = 'Logins neste navegador: ' + res.logins.join(', ');
                }
            }).catch(function () { /* offline */ });
            var u = document.getElementById('loginFuncUser');
            if (u) setTimeout(function () { u.focus(); }, 50);
        });
    }

    function atualizarHintLoginsFuncTela() {
        var el = document.getElementById('loginFuncHintQtd');
        if (!el) return;
        var logins = listarLoginsFuncDisponiveis();
        if (!logins.length) {
            el.textContent = 'Nenhum login de funcionário neste navegador. Cadastre em Sistema → Acesso do funcionário.';
            return;
        }
        el.textContent = 'Logins neste navegador: ' + logins.join(', ');
    }

    var btnLF = document.getElementById('btnLoginFunc');
    if (btnLF) btnLF.addEventListener('click', async function () {
        try {
            atualizarHintLoginsFuncTela();
            var user = document.getElementById('loginFuncUser').value;
            var senha = document.getElementById('loginFuncSenha').value;
            if (!normalizarLoginFunc(user) || !normalizarSenhaFunc(senha)) {
                mostrarErroLogin('Informe o login e a senha.');
                return;
            }
            btnLF.disabled = true;
            btnLF.textContent = 'Verificando…';
            var f = await autenticarFuncionarioLogin(user, senha);
            if (!f) {
                mostrarErroLogin('Buscando login na nuvem…');
                var pull = null;
                try { pull = await puxarLoginsFuncNuvem(); } catch (eN) { pull = { ok: false, erro: (eN && eN.message) || 'falha' }; }
                atualizarHintLoginsFuncTela();
                f = await autenticarFuncionarioLogin(user, senha);
                if (!f && pull && !pull.ok) {
                    /* segue para mensagem abaixo com detalhe */
                }
            }
            if (!f) {
                var map = sincronizarMapaLoginsFuncLimpo();
                var uNorm = normalizarLoginFunc(user);
                var disponiveis = Object.keys(map);
                if (map[uNorm]) {
                    mostrarErroLogin('Senha incorreta para o login "' + uNorm + '".');
                } else if (!disponiveis.length) {
                    mostrarErroLogin('Nenhum login neste celular. No PC clique em “Enviar logins ao celular”. Depois aqui: “Atualizar logins da nuvem”.');
                } else {
                    mostrarErroLogin(
                        'Login "' + uNorm + '" não encontrado. Neste aparelho: ' +
                        disponiveis.join(', ') +
                        '. Ou toque em “Atualizar logins da nuvem”.'
                    );
                }
                return;
            }
            mostrarErroLogin('');
            btnLF.textContent = 'Abrindo…';
            liberarApp({ funcionarioId: f.id });
            toast('Olá, ' + (f.nome || '') + '!');
        } catch (err) {
            console.error(err);
            mostrarErroLogin('Falha ao entrar: ' + (err && err.message ? err.message : 'erro'));
        } finally {
            btnLF.disabled = false;
            btnLF.textContent = 'Entrar no painel';
        }
    });
    var btnPuxarLF = document.getElementById('btnPuxarLoginFuncNuvem');
    if (btnPuxarLF) btnPuxarLF.addEventListener('click', async function () {
        btnPuxarLF.disabled = true;
        btnPuxarLF.textContent = 'Buscando…';
        mostrarErroLogin('');
        try {
            var res = await puxarLoginsFuncNuvem();
            atualizarHintLoginsFuncTela();
            var logins = (res && res.logins) || listarLoginsFuncDisponiveis();
            if (res && res.ok && logins.length) {
                toast('Logins da nuvem OK: ' + logins.join(', '));
                mostrarErroLogin('Pronto! Logins: ' + logins.join(', ') + '. Agora entre com login e senha.');
            } else {
                mostrarErroLogin((res && res.erro) || 'Nuvem sem login. No PC: Acesso do funcionário → Enviar logins ao celular.');
            }
        } catch (err) {
            mostrarErroLogin('Não deu para buscar na nuvem. Verifique a internet.');
        } finally {
            btnPuxarLF.disabled = false;
            btnPuxarLF.textContent = 'Atualizar logins da nuvem';
        }
    });
    var btnSairF = document.getElementById('btnSairFuncPainel');
    if (btnSairF) btnSairF.addEventListener('click', function () {
        bloquearApp();
        toast('Saiu do painel do funcionário.');
    });
    var formLoginCfg = document.getElementById('formLoginFuncCfg');
    if (formLoginCfg) formLoginCfg.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fid = document.getElementById('cfgLoginFuncId').value;
        var usuario = document.getElementById('cfgLoginUsuario').value;
        var senha = document.getElementById('cfgLoginSenha').value;
        if (!fid) { toast('Selecione o funcionário.'); return; }
        if (!normalizarLoginFunc(usuario) || !normalizarSenhaFunc(senha)) {
            toast('Informe login e senha.');
            return;
        }
        var lista = listarFuncionariosInterno();
        var i = lista.findIndex(function (x) { return x.id === fid; });
        if (i < 0) { toast('Funcionário não encontrado. Cadastre em FUNCIONÁRIO.'); return; }
        var userLow = normalizarLoginFunc(usuario);
        var conflito = lista.some(function (x) {
            return x.id !== fid && normalizarLoginFunc(x.loginUsuario) === userLow;
        });
        var mapChk = carregarMapaLoginsFunc();
        if (mapChk[userLow] && String(mapChk[userLow].funcionarioId) !== String(fid)) {
            conflito = true;
        }
        if (conflito) { toast('Este login já está em uso por outro funcionário.'); return; }
        if (!(await salvarCredencialLoginFunc(lista[i], usuario, senha))) {
            toast('Falha ao salvar login.');
            return;
        }
        var uSalvo = normalizarLoginFunc(usuario);
        var sSalvo = normalizarSenhaFunc(senha);
        var teste = await autenticarFuncionarioLogin(uSalvo, sSalvo);
        var st = document.getElementById('statusEnvioLoginFunc');
        if (!teste) {
            toast('Salvou, mas o teste falhou. Atualize a página (Ctrl+F5) e salve de novo.');
        } else {
            toast('Salvo! Agora clique em “Enviar logins ao celular”.');
            if (st) st.textContent = 'Login salvo: ' + uSalvo + '. Clique em “Enviar logins ao celular”.';
        }
        document.getElementById('cfgLoginUsuario').value = '';
        document.getElementById('cfgLoginSenha').value = '';
        document.getElementById('cfgLoginFuncId').value = '';
        renderLoginsFuncCfg();
    });
    var btnEnviarCel = document.getElementById('btnEnviarLoginsCelular');
    if (btnEnviarCel) btnEnviarCel.addEventListener('click', async function () {
        var st = document.getElementById('statusEnvioLoginFunc');
        btnEnviarCel.disabled = true;
        btnEnviarCel.textContent = 'Enviando…';
        if (st) st.textContent = 'Enviando logins para a nuvem…';
        try {
            var res = await enviarLoginsFuncNuvem();
            if (res && res.ok) {
                var msg = 'Nuvem OK (' + res.qtd + '): ' + (res.logins || []).join(', ') +
                    '. No celular: Atualizar logins da nuvem → entrar.';
                if (st) st.textContent = msg;
                toast(msg);
            } else {
                var er = (res && res.erro) || 'Falha ao enviar.';
                if (st) st.textContent = er;
                toast(er);
            }
        } catch (err) {
            var m = 'Erro: ' + ((err && (err.message || err.code)) || 'sem internet');
            if (st) st.textContent = m;
            toast(m);
        } finally {
            btnEnviarCel.disabled = false;
            btnEnviarCel.textContent = '☁ Enviar logins ao celular';
        }
    });
    var btnLimparCfg = document.getElementById('btnLimparLoginFuncCfg');
    if (btnLimparCfg) btnLimparCfg.addEventListener('click', function () {
        document.getElementById('formLoginFuncCfg').reset();
    });
    var btnVerSenhaLF = document.getElementById('btnVerSenhaLoginFunc');
    if (btnVerSenhaLF) btnVerSenhaLF.addEventListener('click', function () {
        var inp = document.getElementById('loginFuncSenha');
        if (!inp) return;
        if (inp.type === 'password') {
            inp.type = 'text';
            btnVerSenhaLF.textContent = 'Ocultar';
        } else {
            inp.type = 'password';
            btnVerSenhaLF.textContent = 'Mostrar';
        }
    });
    var loginSenhaEl = document.getElementById('loginFuncSenha');
    if (loginSenhaEl) loginSenhaEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btnLoginFunc').click();
        }
    });
    var rofP = document.getElementById('rofPeriodo');
    if (rofP) rofP.addEventListener('change', renderRelatorioOficina);
    var rofD = document.getElementById('rofData');
    if (rofD) { if (!rofD.value) rofD.value = hojeISO(); }
    var rofM = document.getElementById('rofMes');
    if (rofM) { if (!rofM.value) rofM.value = hojeISO().slice(0, 7); }
    document.addEventListener('click', function (ev) {
        var t = ev.target;
        if (!t || !t.getAttribute) return;
        var waC = t.getAttribute('data-wa-checklist');
        if (waC) {
            abrirModalWaEnvio({ tipo: 'checklist', atendimentoId: waC, deFormulario: false });
            return;
        }
        var waO = t.getAttribute('data-wa-orc');
        if (waO) {
            abrirModalWaEnvio({ tipo: 'orcamento', atendimentoId: waO, deFormulario: false });
            return;
        }
    });

    var bWaTxt = document.getElementById('btnWaModoTexto');
    if (bWaTxt) bWaTxt.addEventListener('click', function () { waEnvioTexto(); });
    var bWaJpg = document.getElementById('btnWaModoJpeg');
    if (bWaJpg) bWaJpg.addEventListener('click', function () { waEnvioArquivo('jpeg'); });
    var bWaPdf = document.getElementById('btnWaModoPdf');
    if (bWaPdf) bWaPdf.addEventListener('click', function () { waEnvioArquivo('pdf'); });
    var bWaSig = document.getElementById('btnWaModoAssinar');
    if (bWaSig) bWaSig.addEventListener('click', function () { waEnvioAssinar(); });
    var bWaCan = document.getElementById('btnWaModoCancelar');
    if (bWaCan) bWaCan.addEventListener('click', fecharModalWaEnvio);
    var modalWa = document.getElementById('modalWaEnvio');
    if (modalWa) modalWa.addEventListener('click', function (e) {
        if (e.target.id === 'modalWaEnvio') fecharModalWaEnvio();
    });

    /* —— Blindagem / Diagnóstico —— */
    function aplicarVersaoUI() {
        var elVer = document.getElementById('loginAppVersion');
        if (elVer) elVer.textContent = 'Build ' + APP_VERSION;
        var badgeVer = document.getElementById('badgeAppVersion');
        if (badgeVer) badgeVer.textContent = APP_VERSION;
        var bl = document.getElementById('blindagemVersao');
        if (bl) bl.textContent = APP_VERSION;
    }
    aplicarVersaoUI();

    async function rodarChecklistBlindagem() {
        var ul = document.getElementById('listaBlindagem');
        if (!ul) return;
        ul.innerHTML = '<li>Rodando…</li>';
        var itens = [];
        function add(ok, titulo, detalhe) {
            itens.push({ ok: !!ok, titulo: titulo, detalhe: detalhe || '' });
        }
        add(!!APP_VERSION, 'Versão do build', APP_VERSION);
        var cfg = carregarConfigNuvem();
        add(!!(cfg && cfg.apiKey && cfg.projectId), 'Firebase configurado', cfg && cfg.projectId ? cfg.projectId : 'sem projectId');
        add(!!usuarioNuvemLogado(), 'Sessão nuvem (Admin ou Anônimo)', usuarioNuvemLogado()
            ? (usuarioNuvemEhAnonimo() ? 'anônimo (func/celular)' : 'admin')
            : 'não — ative Auth Anônimo no Firebase');
        var logins = listarLoginsFuncDisponiveis();
        add(logins.length > 0, 'Login funcionário neste aparelho', logins.length ? logins.join(', ') : 'nenhum');
        var comHash = listarFuncionariosInterno().filter(function (f) { return f && f.loginSenhaHash; }).length;
        add(comHash > 0 || !logins.length, 'Senhas com hash (blindagem)', comHash + ' funcionário(s) com hash');
        var db = carregarMain();
        var bloq = (db.caixaConfig && db.caixaConfig.osBloqueadasCaixa) || {};
        add(true, 'OS bloqueadas no caixa', Object.keys(bloq).length + ' registro(s)');
        try {
            blindarCaixaContraOsBloqueadas(db);
            add(true, 'Blindagem de caixa aplicada', 'ok');
        } catch (e) {
            add(false, 'Blindagem de caixa', (e && e.message) || 'falhou');
        }
        var pull = { ok: false, erro: 'não testado' };
        try {
            pull = await puxarLoginsFuncNuvem();
        } catch (eP) {
            pull = { ok: false, erro: (eP && eP.message) || 'erro' };
        }
        add(!!(pull && pull.ok), 'Leitura joninha_logins_func na nuvem',
            pull && pull.ok
                ? ('ok · ' + ((pull.logins || []).join(', ') || pull.qtd || ''))
                : ((pull && pull.erro) || 'falhou — atualize regras Firebase'));
        ul.innerHTML = itens.map(function (it) {
            return '<li style="color:' + (it.ok ? '#8fe0b8' : '#ff8f8f') + '">' +
                (it.ok ? '✓' : '✗') + ' <strong>' + esc(it.titulo) + '</strong> — ' +
                esc(it.detalhe) + '</li>';
        }).join('');
        var falhas = itens.filter(function (x) { return !x.ok; }).length;
        toast(falhas ? (falhas + ' item(ns) vermelho(s) — corrija antes de nova feature') : 'Checklist OK');
    }

    var btnBlind = document.getElementById('btnRodarBlindagem');
    if (btnBlind) btnBlind.addEventListener('click', function () {
        rodarChecklistBlindagem().catch(function (e) {
            toast('Falha no checklist: ' + ((e && e.message) || 'erro'));
        });
    });
    var btnEnvBl = document.getElementById('btnEnviarLoginsBlindagem');
    if (btnEnvBl) btnEnvBl.addEventListener('click', async function () {
        btnEnvBl.disabled = true;
        try {
            var res = await enviarLoginsFuncNuvem();
            toast(res && res.ok ? ('Nuvem OK: ' + (res.logins || []).join(', ')) : ((res && res.erro) || 'Falha'));
            await rodarChecklistBlindagem();
        } finally {
            btnEnvBl.disabled = false;
        }
    });
})();

/* boot */
try {
    localStorage.removeItem('joninha_suspensoes_nuvem');
    localStorage.removeItem('hm_automotivo_nuvem');
} catch (e) { /* ok */ }
migrarProdutosInternoParaEstoqueUnificado();
document.getElementById('atEntrada').value = hojeISO();
atualizarCampoAgendamentoUI();
renderItens();
atualizarPlaca();
prepararVendaForm();
renderCarrinhoVenda();
renderGaleriaFotos();
atualizarBadgeCanal();
renderTudo();
preencherFormEmpresa();
atualizarStatusNuvemUI();
atualizarStatusPastaUI();
preencherSelectMaoFunc();
preencherSelectLoginFunc();
var _rofD = document.getElementById('rofData');
if (_rofD && !_rofD.value) _rofD.value = hojeISO();
var _rofM = document.getElementById('rofMes');
if (_rofM && !_rofM.value) _rofM.value = hojeISO().slice(0, 7);
var _comM = document.getElementById('comMes');
if (_comM && !_comM.value) _comM.value = hojeISO().slice(0, 7);
iniciarLoginApp();

/* PWA — instalar como aplicativo (logo na tela inicial) */
var deferredInstallPrompt = null;
var installBanner = document.getElementById('installBanner');
window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!localStorage.getItem('joninha_hide_install')) {
        installBanner.classList.add('show');
    }
});
document.getElementById('btnInstalarApp').addEventListener('click', function () {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function () {
        deferredInstallPrompt = null;
        installBanner.classList.remove('show');
    });
});
document.getElementById('btnFecharInstall').addEventListener('click', function () {
    installBanner.classList.remove('show');
    localStorage.setItem('joninha_hide_install', '1');
});
window.addEventListener('appinstalled', function () {
    installBanner.classList.remove('show');
    toast('Joninha Suspensões instalado na tela inicial.');
});

if ('serviceWorker' in navigator) {
    var swRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (swRefreshing) return;
        swRefreshing = true;
        window.location.reload();
    });

    navigator.serviceWorker.register('./sw.js').then(function (reg) {
        function checarAtualizacao() {
            try { reg.update(); } catch (e) { /* ok */ }
        }
        /* Ao abrir / voltar ao app (PC ou celular), busca versão nova */
        checarAtualizacao();
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) checarAtualizacao();
        });
        window.addEventListener('focus', checarAtualizacao);
        setInterval(checarAtualizacao, 5 * 60 * 1000);

        reg.addEventListener('updatefound', function () {
            var novo = reg.installing;
            if (!novo) return;
            novo.addEventListener('statechange', function () {
                if (novo.state === 'installed' && navigator.serviceWorker.controller) {
                    toast('Nova versão disponível — atualizando…');
                }
            });
        });
    }).catch(function () {});
}
