    (function () {
        'use strict';

        /** Banco exclusivo deste index — não usa chaves dos outros sistemas */
        var APP_VERSION = '1.2.3-split-js';
        var STORAGE_KEY = 'joninha_suspensoes_v1';
        var STORAGE_INTERNO = 'joninha_suspensoes_interno_v1';
        var STORAGE_LOGINS_FUNC = 'joninha_suspensoes_logins_func_v1';
        /* Coleção própria (NÃO usar joninha_assinaturas). Celular lê sem login admin. */
        var COL_LOGINS_FUNC_NUVEM = 'joninha_logins_func';
        var DOC_LOGINS_FUNC_NUVEM = 'acessos';
        var SENHA_FUNC_SALT = 'joninha_suspensoes_v1_salt';
        var ASSIN_KEY = 'joninha_suspensoes_assinaturas';
        var atendimentoNotaAtual = null;
        var canalVendas = 'normal'; /* normal | interno */

        var TITULOS = {
            painelInicio: ['Painel', 'Visão geral — Joninha Suspensões'],
            painelClientes: ['Cadastrar Cliente', 'Base de clientes Joninha Suspensões'],
            painelListaClientes: ['Clientes Cadastrados', 'Lista e edição rápida'],
            painelVeiculo: ['Ordem de Serviço / Veículo', 'Atendimento com veículo, serviços e valores'],
            painelHistorico: ['Histórico de Atendimentos', 'Veículos e serviços registrados'],
            painelProdutos: ['Cadastro de Produtos', 'Estoque local simplificado'],
            painelOrcamento: ['Venda / Orçamento', 'Documentos do balcão local'],
            painelCaixa: ['Caixa / Balcão', 'Entradas · saídas · movimentações'],
            painelCaixaBanco: ['Caixa do Banco', 'Pastas mensais · PIX · cartões'],
            painelPendentes: ['Contas a Receber', 'Pastas mensais · a receber'],
            painelRelatorioCaixa: ['Relatório Caixa', 'Pastas mensais · entradas · saídas · relatório geral'],
            painelRelatorioDespesas: ['Relatório de Despesas', 'Pastas mensais · todas as saídas / despesas'],
            painelDespesasOs: ['Despesas por OS', 'Pastas mensais · bruto · despesas · lucro'],
            painelFuncionarios: ['Cadastro de Funcionários', 'Comissão % · PIN · modo interno'],
            painelListaFuncionarios: ['Funcionários Cadastrados', 'Ver · editar · excluir'],
            painelPagFuncionarios: ['Pagamento funcionários', 'Controle semanal interno · sem impressão'],
            painelRelatorioOficina: ['Relatório Oficina', 'Peças · ganho em peça · mão de obra · despesas'],
            painelComissoes: ['Comissões', 'Só o valor da comissão de cada um'],
            painelConfigEmpresa: ['Dados da Empresa', 'Razão, CNPJ, endereço e contato'],
            painelConfigSync: ['Sincronizar — PC ↔ Celular', 'Nuvem automática · forçar sync'],
            painelConfigLogo: ['Logo da empresa', 'Arquivo ou link da logo'],
            painelConfigPasta: ['Pasta no PC', 'Fotos e atendimento no computador'],
            painelConfigLoginFunc: ['Acesso do funcionário ao painel', 'Login e senha do funcionário'],
            painelConfigBlindagem: ['Blindagem / Diagnóstico', 'Checklist · versão · nuvem'],
            painelConfigBackup: ['Backup e limpeza', 'Exportar · importar · zerar dados']
        };

        var CHECKLIST_LABELS = {
            amassado: 'Amassado / batida',
            arranhao: 'Arranhão / risco',
            luzIndicacao: 'Luz de indicação acesa',
            pneus: 'Pneus / rodas',
            combustivel: 'Combustível baixo',
            oleo: 'Óleo / fluido',
            suspensao: 'Suspensão / barulho',
            escapamento: 'Escapamento',
            eletrica: 'Elétrica / bateria',
            vidros: 'Vidros / retrovisores',
            interior: 'Interior danificado',
            outros: 'Outros'
        };
        var sessaoFuncionarioId = null; /* login restrito: só comissões */

        var itensTemp = [];
        var carrinhoVenda = [];
        var produtoVendaSelecionado = null;
        var fotosAtuais = [];
        var LOGO_PADRAO = 'logo-joninha.jpg';
        var PASTA_IDB = 'joninha_suspensoes_pasta_v1';
        var NUVEM_KEY = 'joninha_suspensoes_nuvem';
        var LOGIN_EMAIL_KEY = 'joninha_suspensoes_login_email';
        var SYNC_ULTIMA_KEY = 'joninha_suspensoes_sync_ultima';
        var FOTOS_MAX = 10;
        var FOTO_MAX_LADO = 720;
        var FOTO_JPEG_QUALIDADE = 0.68;
        var FOTO_MAX_CHARS = 220000; /* ~165KB — evita estourar doc Firestore */

        function empresaPadrao() {
            return {
                nome: 'Joninha Suspensões',
                cnpj: '',
                ie: '',
                telefone: '',
                email: '',
                cep: '',
                rua: '',
                numero: '',
                bairro: '',
                cidade: '',
                estado: '',
                complemento: '',
                logo: '',
                logoNaMidia: false,
                atualizadoEm: ''
            };
        }

        function empresaEstaPadrao(emp) {
            var e = emp || {};
            return !e.atualizadoEm &&
                (!e.nome || e.nome === 'Joninha Suspensões') &&
                !e.cnpj && !e.ie && !e.telefone && !e.email &&
                !e.cep && !e.rua && !e.numero && !e.bairro &&
                !e.cidade && !e.estado && !e.complemento &&
                !e.logo && !e.logoNaMidia;
        }

        function mesclarEmpresa(localEmp, nuvemEmp, baseAtualizadoEm) {
            var L = Object.assign(empresaPadrao(), localEmp || {});
            var N = nuvemEmp ? Object.assign(empresaPadrao(), nuvemEmp) : null;
            if (!N) return L;
            if (empresaEstaPadrao(L)) return N;
            var tL = new Date(L.atualizadoEm || 0).getTime();
            var tN = new Date(N.atualizadoEm || baseAtualizadoEm || 0).getTime();
            if (!tL && tN) return N;
            return tN >= tL ? N : L;
        }

        function estadoVazio() {
            return {
                empresa: empresaPadrao(),
                clientes: [],
                atendimentos: [],
                produtos: [],
                orcamentos: [],
                caixa: [],
                caixaBanco: [],
                pendentes: [],
                caixaConfig: { inicialBalcao: 0, inicialBanco: 0 },
                fechamentosCaixa: [],
                excluidos: excluidosVazio()
            };
        }

        function excluidosVazio() {
            return {
                clientes: {},
                atendimentos: {},
                produtos: {},
                orcamentos: {},
                caixa: {},
                caixaBanco: {},
                pendentes: {}
            };
        }

        function garantirExcluidos(db) {
            if (!db.excluidos || typeof db.excluidos !== 'object') db.excluidos = excluidosVazio();
            var base = excluidosVazio();
            Object.keys(base).forEach(function (k) {
                if (!db.excluidos[k] || typeof db.excluidos[k] !== 'object' || Array.isArray(db.excluidos[k])) {
                    db.excluidos[k] = {};
                }
            });
            return db.excluidos;
        }

        function marcarExcluido(db, colecao, id) {
            if (!db || !colecao || !id) return;
            var ex = garantirExcluidos(db);
            if (!ex[colecao]) ex[colecao] = {};
            ex[colecao][id] = new Date().toISOString();
        }

        function limparExcluido(db, colecao, id) {
            if (!db || !colecao || !id) return;
            var ex = garantirExcluidos(db);
            if (ex[colecao] && ex[colecao][id]) delete ex[colecao][id];
        }

        function mesclarMapaExcluidos(a, b) {
            var out = {};
            [a || {}, b || {}].forEach(function (map) {
                Object.keys(map).forEach(function (id) {
                    var t = new Date(map[id] || 0).getTime();
                    var tOut = new Date(out[id] || 0).getTime();
                    if (!out[id] || t >= tOut) out[id] = map[id];
                });
            });
            return out;
        }

        function mesclarExcluidos(localEx, nuvemEx) {
            var base = excluidosVazio();
            var L = localEx || {};
            var N = nuvemEx || {};
            Object.keys(base).forEach(function (k) {
                base[k] = mesclarMapaExcluidos(L[k], N[k]);
            });
            return base;
        }

        function aplicarExcluidosNaLista(lista, mapaEx) {
            if (!mapaEx) return lista || [];
            return (lista || []).filter(function (item) {
                if (!item || !item.id) return true;
                if (!mapaEx[item.id]) return true;
                var tItem = new Date(item.atualizadoEm || item.criadoEm || 0).getTime();
                var tEx = new Date(mapaEx[item.id] || 0).getTime();
                return tItem > tEx;
            });
        }

        function estadoInternoVazio() {
            return {
                produtos: [],
                orcamentos: [],
                caixa: [],
                caixaBanco: [],
                pendentes: [],
                caixaConfig: { inicialBalcao: 0, inicialBanco: 0 },
                funcionarios: [],
                pagamentosFuncionarios: []
            };
        }

        function carregarInternoRaw() {
            try {
                var raw = localStorage.getItem(STORAGE_INTERNO);
                if (!raw) return estadoInternoVazio();
                return Object.assign(estadoInternoVazio(), JSON.parse(raw) || {});
            } catch (e) {
                return estadoInternoVazio();
            }
        }

        function salvarInternoRaw(data) {
            localStorage.setItem(STORAGE_INTERNO, JSON.stringify(data));
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

        function carregarMain() {
            try {
                var raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return estadoVazio();
                var data = JSON.parse(raw);
                return Object.assign(estadoVazio(), data || {});
            } catch (e) {
                return estadoVazio();
            }
        }

        function salvarMain(db) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        }

        /* carregar/salvar: no modo interno, vendas/caixa ficam no banco interno.
           Produtos/estoque são UNIFICADOS (sempre no banco oficial). */
        function carregar() {
            var main = carregarMain();
            if (canalVendas !== 'interno') return main;
            var int = carregarInternoRaw();
            return Object.assign({}, main, {
                orcamentos: int.orcamentos || [],
                caixa: int.caixa || [],
                caixaBanco: int.caixaBanco || [],
                pendentes: int.pendentes || [],
                caixaConfig: int.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
                funcionarios: int.funcionarios || [],
                pagamentosFuncionarios: int.pagamentosFuncionarios || []
            });
        }

        function salvar(db) {
            if (canalVendas !== 'interno') {
                salvarMain(db);
            } else {
                var intAtual = carregarInternoRaw();
                salvarInternoRaw({
                    produtos: [], /* estoque unificado no oficial */
                    orcamentos: db.orcamentos || [],
                    caixa: db.caixa || [],
                    caixaBanco: db.caixaBanco || [],
                    pendentes: db.pendentes || [],
                    caixaConfig: db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
                    funcionarios: db.funcionarios != null ? db.funcionarios : (intAtual.funcionarios || []),
                    pagamentosFuncionarios: db.pagamentosFuncionarios != null ? db.pagamentosFuncionarios : (intAtual.pagamentosFuncionarios || [])
                });
                var main = carregarMain();
                main.empresa = db.empresa || main.empresa;
                main.clientes = db.clientes || main.clientes;
                main.atendimentos = db.atendimentos || main.atendimentos;
                main.produtos = db.produtos || [];
                if (db.excluidos) main.excluidos = garantirExcluidos(db);
                salvarMain(main);
            }
            agendarSyncAutomatico('salvar');
        }

        /* Migra produtos que estavam só no interno para o estoque oficial (uma vez) */
        function migrarProdutosInternoParaEstoqueUnificado() {
            var int = carregarInternoRaw();
            var listaInt = int.produtos || [];
            if (!listaInt.length) return 0;
            var main = carregarMain();
            var map = {};
            var porCodigo = {};

            function normCod(c) {
                return String(c || '').replace(/\D/g, '').toLowerCase();
            }
            function tempo(p) {
                return new Date((p && (p.atualizadoEm || p.criadoEm)) || 0).getTime() || 0;
            }
            function preferirNumero(a, b) {
                var na = Number(a) || 0;
                var nb = Number(b) || 0;
                return nb > na ? nb : na;
            }
            function registrar(p) {
                if (!p || !p.id) return;
                map[p.id] = p;
                var cod = normCod(p.codigo);
                if (cod) porCodigo[cod] = p.id;
            }

            (main.produtos || []).forEach(registrar);

            listaInt.forEach(function (n) {
                if (!n) return;
                var cod = normCod(n.codigo);
                var idAlvo = (n.id && map[n.id]) ? n.id : (cod && porCodigo[cod] ? porCodigo[cod] : null);
                if (!idAlvo) {
                    if (!n.id) n.id = 'hm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                    if (!n.criadoEm) n.criadoEm = new Date().toISOString();
                    if (!n.atualizadoEm) n.atualizadoEm = n.criadoEm;
                    registrar(n);
                    return;
                }
                var L = map[idAlvo];
                var usarN = tempo(n) > tempo(L);
                var m = usarN ? Object.assign({}, L, n, { id: idAlvo }) : Object.assign({}, n, L, { id: idAlvo });
                /* preço: não ficar com zero se o outro lado tem valor */
                m.venda = preferirNumero(L.venda, n.venda);
                m.custo = preferirNumero(L.custo, n.custo);
                /* estoque: prioriza o mais recente; se ambos sem data, usa o maior */
                if (tempo(n) || tempo(L)) {
                    m.qtd = usarN ? (Number(n.qtd) || 0) : (Number(L.qtd) || 0);
                } else {
                    m.qtd = preferirNumero(L.qtd, n.qtd);
                }
                if (!m.nome) m.nome = L.nome || n.nome || '';
                if (!m.codigo) m.codigo = L.codigo || n.codigo || '';
                if (!m.unidade) m.unidade = L.unidade || n.unidade || 'un';
                m.atualizadoEm = new Date().toISOString();
                registrar(m);
            });

            main.produtos = Object.keys(map).map(function (k) { return map[k]; });
            salvarMain(main);
            int.produtos = [];
            salvarInternoRaw(int);
            return listaInt.length;
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

        function configNuvemInjetada() {
            var c = window.JONINHA_FIREBASE_CONFIG;
            if (!c || typeof c !== 'object') return null;
            if (!c.apiKey || !c.projectId) return null;
            return {
                apiKey: String(c.apiKey || '').trim(),
                authDomain: String(c.authDomain || '').trim(),
                projectId: String(c.projectId || '').trim(),
                storageBucket: String(c.storageBucket || '').trim(),
                messagingSenderId: String(c.messagingSenderId || '').trim(),
                appId: String(c.appId || '').trim(),
                email: String(c.email || '').trim(),
                senha: String(c.senha || '')
            };
        }

        function carregarConfigNuvem() {
            var local = null;
            try {
                local = JSON.parse(localStorage.getItem(NUVEM_KEY) || 'null');
            } catch (e) {
                local = null;
            }
            var inj = configNuvemInjetada();
            if (!local && !inj) return null;
            if (!local) return inj;
            if (!inj) return local;
            return {
                apiKey: local.apiKey || inj.apiKey,
                authDomain: local.authDomain || inj.authDomain,
                projectId: local.projectId || inj.projectId,
                storageBucket: local.storageBucket || inj.storageBucket,
                messagingSenderId: local.messagingSenderId || inj.messagingSenderId,
                appId: local.appId || inj.appId,
                email: local.email || inj.email,
                senha: local.senha || inj.senha
            };
        }

        function salvarConfigNuvem(cfg) {
            if (!cfg) localStorage.removeItem(NUVEM_KEY);
            else localStorage.setItem(NUVEM_KEY, JSON.stringify(cfg));
        }

        function atualizarStatusNuvemUI() {
            var el = document.getElementById('nuvemStatusTexto') ||
                document.getElementById('statusNuvem') ||
                document.getElementById('nuvemStatus');
            if (!el) return;
            var cfg = carregarConfigNuvem();
            var user = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                el.className = 'config-status aviso';
                el.innerHTML = '<strong>Nuvem:</strong> faltam chaves — rode <code>npm run build</code> com o arquivo .env.';
                return;
            }
            if (user) {
                el.className = 'config-status';
                var syncTxt = _syncUltimaOkEm
                    ? ' · última sync ' + esc(fmtHoraSync(_syncUltimaOkEm))
                    : '';
                el.innerHTML = '<strong>Nuvem:</strong> conectado como ' + esc(user.email || 'usuário') +
                    ' · ' + esc(cfg.projectId) +
                    ' · sync automática' + syncTxt +
                    (_syncEmAndamento ? ' · sincronizando…' : '') + '.';
            } else {
                el.className = 'config-status aviso';
                el.innerHTML = '<strong>Nuvem:</strong> entre com e-mail/senha do Firebase Authentication.';
            }
        }

        var _fbSessao = null;
        var _fbMods = null;
        var _syncEmAndamento = false;
        var _syncDebounceTimer = null;
        var _syncIntervalId = null;
        var _syncUltimaOkEm = 0;
        try {
            var _ultSyncRaw = localStorage.getItem('joninha_suspensoes_sync_ultima');
            if (_ultSyncRaw) _syncUltimaOkEm = Number(_ultSyncRaw) || 0;
        } catch (eUlt0) { /* ok */ }
        var _syncListenersLigados = false;

        function fmtHoraSync(ts) {
            try {
                var d = new Date(ts);
                return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            } catch (e) {
                return '';
            }
        }

        function usuarioNuvemLogado() {
            return !!(!_fbSessao || !_fbSessao.auth ? false : _fbSessao.auth.currentUser);
        }

        function usuarioNuvemEhAnonimo() {
            var u = _fbSessao && _fbSessao.auth && _fbSessao.auth.currentUser;
            return !!(u && u.isAnonymous);
        }

        /* Admin e-mail OU anônimo (funcionário no celular) */
        async function garantirSessaoNuvemQualquer() {
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) return false;
            try {
                var sessao = await initFirebaseApp();
                if (sessao.auth.currentUser) return true;
                await sessao.authMod.signInAnonymously(sessao.auth);
                return !!(sessao.auth.currentUser);
            } catch (e) {
                console.warn('garantirSessaoNuvemQualquer:', e);
                return false;
            }
        }

        function agendarSyncAutomatico(motivo) {
            if (_syncEmAndamento) return;
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) return;
            /* Ao salvar, agenda mesmo com aba em segundo plano (envia o que acabou de mudar) */
            if (motivo !== 'salvar' && document.hidden) return;
            clearTimeout(_syncDebounceTimer);
            _syncDebounceTimer = setTimeout(function () {
                if (_syncEmAndamento) return;
                if (motivo !== 'salvar' && document.hidden) return;
                dispararSyncConformeSessao({ silencioso: true, motivo: motivo || 'auto' }).catch(function () { /* offline */ });
            }, motivo === 'salvar' ? 2800 : 800);
        }

        async function dispararSyncConformeSessao(opts) {
            opts = opts || {};
            var okAuth = usuarioNuvemLogado() || await garantirSessaoNuvemQualquer();
            if (!okAuth) return;
            if (sessaoFuncionarioId && usuarioNuvemEhAnonimo()) {
                return sincronizarOficinaNuvem(opts);
            }
            if (sessaoFuncionarioId) {
                /* Funcionário com sessão Admin já logada: sync oficina (não mexe caixa no push cego) */
                return sincronizarOficinaNuvem(opts);
            }
            return sincronizarTodosNuvem(opts);
        }

        function iniciarSyncAutomatico() {
            if (_syncIntervalId) return;
            /* A cada 60s, se a aba estiver aberta */
            _syncIntervalId = setInterval(function () {
                if (document.hidden) return;
                dispararSyncConformeSessao({ silencioso: true, motivo: 'intervalo' }).catch(function () { /* offline */ });
            }, 60000);

            if (_syncListenersLigados) return;
            _syncListenersLigados = true;
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) agendarSyncAutomatico('visivel');
            });
            window.addEventListener('focus', function () {
                agendarSyncAutomatico('foco');
            });
            window.addEventListener('online', function () {
                agendarSyncAutomatico('online');
            });
        }

        function pararSyncAutomatico() {
            if (_syncIntervalId) {
                clearInterval(_syncIntervalId);
                _syncIntervalId = null;
            }
            clearTimeout(_syncDebounceTimer);
            _syncDebounceTimer = null;
        }

        async function initFirebaseApp() {
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                throw new Error('Nuvem sem chaves. Rode npm run build com o .env ou configure no Vercel.');
            }
            if (_fbSessao && _fbSessao.projectId === cfg.projectId && _fbSessao.auth) {
                return _fbSessao;
            }
            var firebaseConfig = {
                apiKey: cfg.apiKey,
                authDomain: cfg.authDomain || (cfg.projectId + '.firebaseapp.com'),
                projectId: cfg.projectId,
                storageBucket: cfg.storageBucket || undefined,
                messagingSenderId: cfg.messagingSenderId || '',
                appId: cfg.appId || ''
            };
            var appMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js');
            var authMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
            var fsMod = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
            _fbMods = { appMod: appMod, authMod: authMod, fsMod: fsMod };
            var appName = 'joninha-' + cfg.projectId;
            var app;
            try {
                app = appMod.getApp(appName);
            } catch (e) {
                app = appMod.initializeApp(firebaseConfig, appName);
            }
            var auth = authMod.getAuth(app);
            try {
                await authMod.setPersistence(auth, authMod.browserLocalPersistence);
            } catch (e) { /* ok */ }
            var dbFs = fsMod.getFirestore(app);
            _fbSessao = { projectId: cfg.projectId, app: app, auth: auth, dbFs: dbFs, fsMod: fsMod, authMod: authMod };
            return _fbSessao;
        }

        async function initnuvemApp() { return initFirebaseApp(); }

        async function obterSessaoFirebase() {
            var sessao = await initFirebaseApp();
            if (!sessao.auth.currentUser) {
                throw new Error('Faça login com o e-mail e senha do Firebase para usar a nuvem.');
            }
            return sessao;
        }

        async function obterSessaonuvem() { return obterSessaoFirebase(); }

        async function loginComFirebase(email, senha) {
            var sessao = await initFirebaseApp();
            await sessao.authMod.signInWithEmailAndPassword(sessao.auth, email, senha);
            return sessao.auth.currentUser;
        }

        async function loginComnuvem(email, senha) { return loginComFirebase(email, senha); }

        async function logoutFirebase() {
            try {
                var sessao = await initFirebaseApp();
                if (sessao.auth.currentUser) {
                    await sessao.authMod.signOut(sessao.auth);
                }
            } catch (e) { /* ok */ }
        }

        async function logoutnuvem() { return logoutFirebase(); }

        async function enviarAtendimentoNuvem(atendimento) {
            var sessao = await obterSessaonuvem();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var docOut = JSON.parse(JSON.stringify(atendimento));
            var fotos = docOut.fotos || [];
            for (var i = 0; i < fotos.length; i++) {
                var f = fotos[i];
                if (!f.data || !String(f.data).startsWith('data:')) continue;
                var fotoId = f.id || ('f' + i);
                f.id = fotoId;
                try {
                    f.data = await garantirFotoComprimida(f.data);
                    if (!f.data || String(f.data).length > FOTO_MAX_CHARS * 1.35) {
                        return { ok: false, motivo: 'foto ainda grande demais após compressão' };
                    }
                    await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_midia', atendimento.id + '_' + fotoId), {
                        atendimentoId: atendimento.id,
                        fotoId: fotoId,
                        data: f.data,
                        comprimida: true,
                        atualizadoEm: new Date().toISOString()
                    });
                    delete f.data;
                } catch (midErr) {
                    return { ok: false, motivo: 'falha ao enviar foto: ' + (midErr.message || midErr.code || '') };
                }
            }
            docOut.fotos = fotos;
            docOut.atualizadoEm = new Date().toISOString();
            await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_atendimentos', atendimento.id), docOut);
            return { ok: true, atendimento: docOut };
        }

        async function hidratarFotosDaNuvem(atendimento) {
            var sessao = await obterSessaonuvem();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var fotos = atendimento.fotos || [];
            for (var i = 0; i < fotos.length; i++) {
                var f = fotos[i];
                if (f.data || f.url) continue;
                if (!f.id) continue;
                try {
                    var snap = await fsMod.getDoc(fsMod.doc(dbFs, 'joninha_suspensoes_midia', atendimento.id + '_' + f.id));
                    if (snap.exists()) {
                        var d = snap.data() || {};
                        if (d.data) f.data = d.data;
                        if (d.url) f.url = d.url;
                    }
                } catch (e) { /* segue */ }
            }
            return atendimento;
        }

        async function baixarAtendimentosNuvem() {
            var sessao = await obterSessaonuvem();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var snap = await fsMod.getDocs(fsMod.collection(dbFs, 'joninha_suspensoes_atendimentos'));
            var lista = [];
            snap.forEach(function (docSnap) {
                var a = docSnap.data() || {};
                if (!a.id) a.id = docSnap.id;
                lista.push(a);
            });
            for (var i = 0; i < lista.length; i++) {
                await hidratarFotosDaNuvem(lista[i]);
            }
            return lista;
        }

        function mesclarAtendimentosLocalNuvem(localLista, nuvemLista) {
            var map = {};
            (localLista || []).forEach(function (a) {
                if (a && a.id) map[a.id] = a;
            });
            (nuvemLista || []).forEach(function (n) {
                if (!n || !n.id) return;
                var L = map[n.id];
                if (!L) {
                    map[n.id] = n;
                    return;
                }
                var tL = new Date(L.atualizadoEm || L.criadoEm || 0).getTime();
                var tN = new Date(n.atualizadoEm || n.criadoEm || 0).getTime();
                if (tN >= tL) {
                    var fotosLoc = L.fotos || [];
                    var fotosNuv = n.fotos || [];
                    map[n.id] = Object.assign({}, L, n);
                    if (fotosNuv.length) {
                        map[n.id].fotos = fotosNuv.map(function (fn, idx) {
                            if (fn.data || fn.url) return fn;
                            var fl = fotosLoc.find(function (x) { return x.id === fn.id; }) || fotosLoc[idx];
                            if (fl && (fl.data || fl.url)) return Object.assign({}, fn, { data: fl.data || null, url: fl.url || null });
                            return fn;
                        });
                    } else if (fotosLoc.length) {
                        map[n.id].fotos = fotosLoc;
                    }
                } else {
                    (n.fotos || []).forEach(function (fn) {
                        if (!fn.id) return;
                        var fl = (L.fotos || []).find(function (x) { return x.id === fn.id; });
                        if (fl && !fl.data && !fl.url && (fn.data || fn.url)) {
                            fl.data = fn.data || null;
                            fl.url = fn.url || null;
                        }
                    });
                }
            });
            return Object.keys(map).map(function (k) { return map[k]; });
        }

        function mesclarAtendimentosComExcluidos(localLista, nuvemLista, mapaEx) {
            return aplicarExcluidosNaLista(mesclarAtendimentosLocalNuvem(localLista, nuvemLista), mapaEx);
        }

        function tempoRegistro(item, seSemData) {
            var t = new Date((item && (item.atualizadoEm || item.criadoEm)) || 0).getTime();
            if (t) return t;
            return seSemData != null ? seSemData : 0;
        }

        function mesclarListaPorId(localLista, nuvemLista, mapaEx) {
            var map = {};
            (localLista || []).forEach(function (x) {
                if (x && x.id) map[x.id] = x;
            });
            (nuvemLista || []).forEach(function (n) {
                if (!n || !n.id) return;
                var L = map[n.id];
                if (!L) {
                    map[n.id] = n;
                    return;
                }
                /* Local sem data = edição recente (evita nuvem antiga zerar preço/estoque).
                   Empate: local vence. Só nuvem mais nova sobrescreve. */
                var tL = tempoRegistro(L, Date.now());
                var tN = tempoRegistro(n, 0);
                map[n.id] = tN > tL ? Object.assign({}, L, n) : Object.assign({}, n, L);
            });
            return aplicarExcluidosNaLista(Object.keys(map).map(function (k) { return map[k]; }), mapaEx);
        }

        async function enviarLogoEmpresaNuvem(logoDataUrl) {
            var sessao = await obterSessaonuvem();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            if (logoDataUrl && String(logoDataUrl).startsWith('data:')) {
                await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_midia', 'logo_empresa'), {
                    data: logoDataUrl,
                    atualizadoEm: new Date().toISOString()
                });
                return true;
            }
            try {
                await fsMod.deleteDoc(fsMod.doc(dbFs, 'joninha_suspensoes_midia', 'logo_empresa'));
            } catch (e) { /* ok se não existir */ }
            return false;
        }

        async function hidratarLogoEmpresa(emp) {
            var e = Object.assign(empresaPadrao(), emp || {});
            if (e.logo && String(e.logo).startsWith('data:')) return e;
            if (e.logo && /^https?:\/\//i.test(e.logo)) return e;
            if (!e.logoNaMidia && e.logo) return e;
            try {
                var sessao = await obterSessaonuvem();
                var snap = await sessao.fsMod.getDoc(
                    sessao.fsMod.doc(sessao.dbFs, 'joninha_suspensoes_midia', 'logo_empresa')
                );
                if (snap.exists()) {
                    var d = snap.data() || {};
                    if (d.data) {
                        e.logo = d.data;
                        e.logoNaMidia = true;
                    }
                }
            } catch (err) { /* segue sem logo */ }
            return e;
        }

        function empresaParaBaseNuvem(emp) {
            var out = Object.assign(empresaPadrao(), emp || {});
            if (out.logo && String(out.logo).startsWith('data:')) {
                out.logoNaMidia = true;
                out.logo = '';
            }
            return out;
        }

        var _envioEmpTimer = null;
        function agendarEnvioEmpresaNuvem(emp) {
            clearTimeout(_envioEmpTimer);
            _envioEmpTimer = setTimeout(function () {
                enviarEmpresaNuvem(emp).then(function (ok) {
                    if (ok) {
                        atualizarStatusNuvemUI();
                        toast('Configuração da empresa na nuvem OK.');
                    }
                }).catch(function () { /* sem login / offline: fica só local */ });
            }, 350);
        }

        async function enviarEmpresaNuvem(emp) {
            if (!_fbSessao || !_fbSessao.auth || !_fbSessao.auth.currentUser) return false;
            var sessao = await obterSessaonuvem();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var empLocal = Object.assign(empresaPadrao(), emp || getEmpresa());
            await enviarLogoEmpresaNuvem(empLocal.logo);
            var empNuv = empresaParaBaseNuvem(empLocal);
            /* merge:true — só atualiza empresa; NÃO regrava produtos/clientes antigos */
            await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_base', 'principal'), {
                empresa: empNuv,
                atualizadoEm: new Date().toISOString()
            }, { merge: true });
            return true;
        }

        async function puxarConfigEmpresaNuvemSilencioso() {
            try {
                if (!_fbSessao || !_fbSessao.auth || !_fbSessao.auth.currentUser) return false;
                var baseNuv = await baixarBaseNuvemSilencioso();
                if (!baseNuv || !baseNuv.empresa) {
                    /* Nada na nuvem ainda: sobe o que estiver no PC */
                    var local = carregarMain().empresa;
                    if (local && !empresaEstaPadrao(local)) {
                        await enviarEmpresaNuvem(local);
                        return true;
                    }
                    return false;
                }
                var db = carregarMain();
                var empAntes = db.empresa;
                var tL = new Date((empAntes && empAntes.atualizadoEm) || 0).getTime();
                var tN = new Date((baseNuv.empresa && baseNuv.empresa.atualizadoEm) || baseNuv.atualizadoEm || 0).getTime();
                var mesclada = mesclarEmpresa(db.empresa, baseNuv.empresa, baseNuv.atualizadoEm);
                mesclada = await hidratarLogoEmpresa(mesclada);
                db.empresa = mesclada;
                salvarMain(db);
                aplicarIdentidadeVisual();
                preencherFormEmpresa();
                if (tL > tN && !empresaEstaPadrao(empAntes)) {
                    await enviarEmpresaNuvem(mesclada);
                }
                return true;
            } catch (e) {
                return false;
            }
        }

        async function enviarBaseNuvem(db) {
            var sessao = await obterSessaonuvem();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var empLocal = Object.assign(empresaPadrao(), db.empresa || empresaPadrao());
            await enviarLogoEmpresaNuvem(empLocal.logo);
            var base = {
                empresa: empresaParaBaseNuvem(empLocal),
                clientes: db.clientes || [],
                produtos: db.produtos || [],
                orcamentos: db.orcamentos || [],
                caixa: db.caixa || [],
                caixaBanco: db.caixaBanco || [],
                pendentes: db.pendentes || [],
                caixaConfig: db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 },
                excluidos: garantirExcluidos(db),
                funcionarios: listarFuncionariosInterno(),
                atualizadoEm: new Date().toISOString()
            };
            await fsMod.setDoc(fsMod.doc(dbFs, 'joninha_suspensoes_base', 'principal'), base);
            try { await enviarLoginsFuncNuvem(); } catch (eLog) { /* ok */ }
            return base;
        }

        async function baixarBaseNuvemSilencioso(sessao) {
            try {
                var s = sessao || await obterSessaonuvem();
                var snap = await s.fsMod.getDoc(s.fsMod.doc(s.dbFs, 'joninha_suspensoes_base', 'principal'));
                if (!snap.exists()) return null;
                return snap.data() || null;
            } catch (e) {
                return null;
            }
        }

        async function baixarBaseNuvem() {
            var sessao = await obterSessaonuvem();
            var fsMod = sessao.fsMod;
            var dbFs = sessao.dbFs;
            var snap = await fsMod.getDoc(fsMod.doc(dbFs, 'joninha_suspensoes_base', 'principal'));
            if (!snap.exists()) return null;
            return snap.data() || null;
        }

        /* Sync seguro p/ funcionário (e Admin no celular): OS + fotos + clientes. Não empurra caixa. */
        async function sincronizarOficinaNuvem(opts) {
            opts = opts || {};
            var silencioso = !!opts.silencioso;
            var mostrarToast = opts.mostrarToast != null ? !!opts.mostrarToast : !silencioso;
            if (_syncEmAndamento) {
                if (!silencioso) toast('Sincronização já em andamento…');
                return;
            }
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                if (!silencioso) toast('Modo local — nuvem desativada.');
                return;
            }
            if (!usuarioNuvemLogado()) {
                var okA = await garantirSessaoNuvemQualquer();
                if (!okA) {
                    if (!silencioso) toast('Ative Authentication → Anônimo no Firebase (Blindagem).');
                    return;
                }
            }

            _syncEmAndamento = true;
            atualizarStatusNuvemUI();
            if (!silencioso) toast('Sincronizando oficina (OS + fotos)…');

            try {
                await obterSessaonuvem();
                var canalAntes = canalVendas;
                canalVendas = 'normal';
                var db = carregar();
                var ok = 0, falha = 0;

                try {
                    var baseNuv = await baixarBaseNuvem();
                    if (baseNuv) {
                        db.excluidos = mesclarExcluidos(db.excluidos, baseNuv.excluidos);
                        var ex = garantirExcluidos(db);
                        db.clientes = mesclarListaPorId(db.clientes, baseNuv.clientes, ex.clientes);
                        if (baseNuv.funcionarios) aplicarFuncionariosDaNuvem(baseNuv.funcionarios);
                    }
                } catch (eBase) { /* offline parcial */ }

                var nuvemLista = await baixarAtendimentosNuvem();
                var exAt = garantirExcluidos(db).atendimentos;
                db.atendimentos = mesclarAtendimentosComExcluidos(db.atendimentos, nuvemLista, exAt);

                for (var i = 0; i < (db.atendimentos || []).length; i++) {
                    var at = db.atendimentos[i];
                    if (!at || !at.id) continue;
                    /* Comprime fotos locais antes do upload */
                    if (at.fotos && at.fotos.length) {
                        for (var fi = 0; fi < at.fotos.length; fi++) {
                            if (at.fotos[fi] && at.fotos[fi].data) {
                                at.fotos[fi].data = await garantirFotoComprimida(at.fotos[fi].data);
                            }
                        }
                    }
                    var r = await enviarAtendimentoNuvem(at);
                    if (r.ok) {
                        ok++;
                        if (r.atendimento) {
                            var locais = at.fotos || [];
                            var nuvFotos = r.atendimento.fotos || [];
                            db.atendimentos[i].syncNuvemEm = new Date().toISOString();
                            db.atendimentos[i].fotos = nuvFotos.map(function (fn, idx) {
                                var fl = locais.find(function (x) { return x && fn && x.id === fn.id; }) || locais[idx] || {};
                                return {
                                    id: (fn && fn.id) || fl.id || uid(),
                                    data: fl.data || null,
                                    url: fl.url || (fn && fn.url) || null
                                };
                            });
                            if (!db.atendimentos[i].fotos.length && locais.length) {
                                db.atendimentos[i].fotos = locais;
                            }
                        }
                    } else falha++;
                }

                /* Sobe só clientes (merge), sem reescrever caixa */
                try {
                    var sessao = await obterSessaonuvem();
                    await sessao.fsMod.setDoc(
                        sessao.fsMod.doc(sessao.dbFs, 'joninha_suspensoes_base', 'principal'),
                        {
                            clientes: db.clientes || [],
                            atualizadoEm: new Date().toISOString()
                        },
                        { merge: true }
                    );
                } catch (eCli) { /* ok */ }

                salvar(db);
                canalVendas = canalAntes;
                _syncUltimaOkEm = Date.now();
                try { localStorage.setItem(SYNC_ULTIMA_KEY, String(_syncUltimaOkEm)); } catch (eUlt) { /* ok */ }

                if (mostrarToast) {
                    toast('Oficina nuvem: ' + ok + ' OS' + (falha ? ' · ' + falha + ' falha(s)' : '') + '.');
                }
                try { renderHistorico(); } catch (eH) { /* ok */ }
                try { renderTudo(); } catch (eR) { /* ok */ }
            } finally {
                _syncEmAndamento = false;
                atualizarStatusNuvemUI();
            }
        }

        async function sincronizarTodosNuvem(opts) {
            opts = opts || {};
            var silencioso = !!opts.silencioso;
            var mostrarToast = opts.mostrarToast != null ? !!opts.mostrarToast : !silencioso;
            if (_syncEmAndamento) {
                if (!silencioso) toast('Sincronização já em andamento…');
                return;
            }
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                if (!silencioso) toast('Modo local — nuvem desativada.');
                return;
            }
            if (!usuarioNuvemLogado()) {
                if (!silencioso) toast('Faça login para sincronizar.');
                return;
            }

            _syncEmAndamento = true;
            atualizarStatusNuvemUI();
            if (!silencioso) toast('Entrando na nuvem e sincronizando…');

            try {
                await obterSessaonuvem();

                var canalAntes = canalVendas;
                canalVendas = 'normal';
                var db = carregar();
                var ok = 0, falha = 0;

                /* 1) Baixa e mescla base (empresa, clientes, estoque, caixa…) */
                var baseNuv = await baixarBaseNuvem();
                if (baseNuv) {
                    db.excluidos = mesclarExcluidos(db.excluidos, baseNuv.excluidos);
                    var ex = garantirExcluidos(db);
                    db.empresa = mesclarEmpresa(db.empresa, baseNuv.empresa, baseNuv.atualizadoEm);
                    db.empresa = await hidratarLogoEmpresa(db.empresa);
                    db.clientes = mesclarListaPorId(db.clientes, baseNuv.clientes, ex.clientes);
                    db.produtos = mesclarListaPorId(db.produtos, baseNuv.produtos, ex.produtos);
                    db.orcamentos = mesclarListaPorId(db.orcamentos, baseNuv.orcamentos, ex.orcamentos);
                    db.caixa = mesclarListaPorId(db.caixa, baseNuv.caixa, ex.caixa);
                    db.caixaBanco = mesclarListaPorId(db.caixaBanco, baseNuv.caixaBanco, ex.caixaBanco);
                    db.pendentes = mesclarListaPorId(db.pendentes, baseNuv.pendentes, ex.pendentes);
                    db.caixaConfig = mesclarCaixaConfig(db.caixaConfig, baseNuv.caixaConfig);
                    if (baseNuv.funcionarios) {
                        aplicarFuncionariosDaNuvem(baseNuv.funcionarios);
                    }
                    /* Remove da nuvem qualquer OS que o usuário já excluiu do caixa */
                    var bloq = (db.caixaConfig && db.caixaConfig.osBloqueadasCaixa) || {};
                    if (Object.keys(bloq).length) {
                        db.caixa = (db.caixa || []).filter(function (x) {
                            if (!x || !x.atendimentoId) return true;
                            if (!bloq[x.atendimentoId] && !bloq[String(x.atendimentoId)]) return true;
                            marcarExcluido(db, 'caixa', x.id);
                            return false;
                        });
                        db.caixaBanco = (db.caixaBanco || []).filter(function (x) {
                            if (!x || !x.atendimentoId) return true;
                            if (!bloq[x.atendimentoId] && !bloq[String(x.atendimentoId)]) return true;
                            marcarExcluido(db, 'caixaBanco', x.id);
                            return false;
                        });
                    }
                } else {
                    db.excluidos = garantirExcluidos(db);
                    db.empresa = await hidratarLogoEmpresa(db.empresa);
                }

                /* 2) Baixa e mescla OS + fotos (respeitando exclusões) */
                var nuvemLista = await baixarAtendimentosNuvem();
                var exAt = garantirExcluidos(db).atendimentos;
                db.atendimentos = mesclarAtendimentosComExcluidos(db.atendimentos, nuvemLista, exAt);

                /* 2b) Apaga na nuvem OS que foram excluídas */
                try {
                    var sessaoDel = await obterSessaonuvem();
                    var idsEx = Object.keys(exAt || {});
                    for (var di = 0; di < idsEx.length; di++) {
                        try {
                            await sessaoDel.fsMod.deleteDoc(
                                sessaoDel.fsMod.doc(sessaoDel.dbFs, 'joninha_suspensoes_atendimentos', idsEx[di])
                            );
                        } catch (delErr) { /* ok */ }
                    }
                } catch (eDel) { /* ok */ }

                /* 3) Envia o resultado mesclado de volta */
                await enviarBaseNuvem(db);
                for (var i = 0; i < (db.atendimentos || []).length; i++) {
                    var r = await enviarAtendimentoNuvem(db.atendimentos[i]);
                    if (r.ok) {
                        ok++;
                        if (r.atendimento) {
                            var locais = db.atendimentos[i].fotos || [];
                            var nuvFotos = r.atendimento.fotos || [];
                            db.atendimentos[i].syncNuvemEm = new Date().toISOString();
                            db.atendimentos[i].fotos = nuvFotos.map(function (fn, idx) {
                                var fl = locais.find(function (x) { return x && fn && x.id === fn.id; }) || locais[idx] || {};
                                return {
                                    id: (fn && fn.id) || fl.id || uid(),
                                    data: fl.data || null,
                                    url: fl.url || (fn && fn.url) || null
                                };
                            });
                            if (!db.atendimentos[i].fotos.length && locais.length) {
                                db.atendimentos[i].fotos = locais;
                            }
                        }
                    } else falha++;
                }

                salvar(db);
                try { blindarCaixaContraOsBloqueadas(db); salvar(db); } catch (eBl) { /* ok */ }
                canalVendas = canalAntes;
                _syncUltimaOkEm = Date.now();
                try { localStorage.setItem(SYNC_ULTIMA_KEY, String(_syncUltimaOkEm)); } catch (eUlt) { /* ok */ }

                if (mostrarToast) {
                    if (silencioso) {
                        toast('Sincronizado na nuvem.');
                    } else {
                        toast('Nuvem OK: ' + ok + ' OS · ' + (db.clientes || []).length + ' cliente(s)' +
                            (falha ? ' · ' + falha + ' falha(s)' : '') + '.');
                    }
                }
                preencherFormEmpresa();
                renderTudo();
            } finally {
                _syncEmAndamento = false;
                atualizarStatusNuvemUI();
            }
        }

        document.getElementById('btnConfigPasta').addEventListener('click', configurarPastaRaiz);
        document.getElementById('btnAtualizarPasta').addEventListener('click', atualizarStatusPastaUI);
        document.getElementById('btnSyncNuvem').addEventListener('click', function () {
            sincronizarTodosNuvem({ silencioso: false, mostrarToast: true }).catch(function (err) {
                toast('Erro na nuvem: ' + (err.message || err.code || 'verifique login e regras'));
            });
        });

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

        function somaPorTipo(tipo) {
            return itensTemp.reduce(function (s, it) {
                return s + ((it.tipo || 'peca') === tipo ? (Number(it.valor) || 0) : 0);
            }, 0);
        }

        function renderItens() {
            var box = document.getElementById('listaItens');
            if (!itensTemp.length) {
                box.innerHTML = '<p class="muted">Nenhuma peça ou mão de obra adicionada.</p>';
            } else {
                box.innerHTML = itensTemp.map(function (it, idx) {
                    var tipo = it.tipo || 'peca';
                    var tag = tipo === 'mao'
                        ? '<span style="display:inline-block;margin-right:8px;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:700;background:rgba(47,158,107,0.2);color:#8fe0b8;border:1px solid rgba(47,158,107,0.45)">MÃO DE OBRA</span>'
                        : '<span style="display:inline-block;margin-right:8px;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:700;background:rgba(61,160,232,0.15);color:#9fd3ff;border:1px solid rgba(61,160,232,0.4)">PEÇA</span>';
                    var extra = '';
                    if (tipo === 'peca') {
                        extra = '<div class="muted" style="font-size:0.78rem">Custo ' + moeda(it.custo || 0) + ' · Ganho <span class="ganho-linha">' + moeda(ganhoItem(it)) + '</span></div>';
                    } else if (it.funcionarioId || it.funcionarioNome) {
                        var pctLinha = Number(it.comissaoPct);
                        if (isNaN(pctLinha)) pctLinha = 0;
                        var comVal = it.comissaoValor != null
                            ? Number(it.comissaoValor)
                            : +((Number(it.valor) || 0) * pctLinha / 100).toFixed(2);
                        var tipoLbl = it.tipoMao ? rotuloTipoMaoComissao(it.tipoMao) : '';
                        extra = '<div class="muted" style="font-size:0.78rem">' +
                            (tipoLbl ? esc(tipoLbl) + ' · ' : '') +
                            esc(it.funcionarioNome || 'Funcionário') +
                            (comVal > 0
                                ? ' · Comissão: <span class="ganho-linha">' + moeda(comVal) + '</span>'
                                : '') +
                            '</div>';
                    }
                    return '<div class="row" style="margin-bottom:6px;align-items:center">' +
                        '<div class="col" style="flex:2">' + tag + esc(it.desc) + extra + '</div>' +
                        '<div class="col">' + moeda(it.valor) + '</div>' +
                        '<div class="col" style="flex:0.5"><button type="button" class="btn btn-danger" data-rm="' + idx + '">×</button></div>' +
                        '</div>';
                }).join('');
                box.querySelectorAll('[data-rm]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        itensTemp.splice(Number(b.getAttribute('data-rm')), 1);
                        renderItens();
                    });
                });
            }
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
            var custo = parseMoeda(document.getElementById('itemCusto').value);
            var valor = parseMoeda(document.getElementById('itemValor').value);
            if (!desc) { toast('Informe a descrição da peça/item.'); return; }
            if (!(valor > 0) && !(custo > 0)) { toast('Informe o valor de venda da peça.'); return; }
            itensTemp.push({ tipo: 'peca', desc: desc, custo: custo, valor: valor || custo });
            document.getElementById('itemDesc').value = '';
            document.getElementById('itemCusto').value = '';
            document.getElementById('itemValor').value = '';
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
            /* Garante comissão calculada e gravada em cada mão de obra */
            itensTemp.forEach(function (it) {
                if (!it || (it.tipo || '') !== 'mao') return;
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
                return {
                    tipo: it.tipo || 'peca',
                    tipoMao: tipoMao,
                    desc: it.desc || '',
                    valor: valorMo,
                    custo: Number(it.custo) || 0,
                    funcionarioId: fid,
                    funcionarioNome: nome,
                    comissaoPct: pct,
                    comissaoValor: comVal
                };
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
            comCanalInterno(function () {
                var db = carregar();
                db.funcionarios = (db.funcionarios || []).filter(function (f) { return f.id !== id; });
                salvar(db);
                toast('Funcionário removido.');
                if (document.getElementById('pfFuncEditId').value === id) limparFormFuncionario();
            });
            fecharModalVerFuncionario();
            renderListaFuncionarios();
            renderPagFuncionarios();
            preencherSelectFuncionariosVenda();
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

        /* ---------- Caixa / Relatórios (modelo FH Control) ---------- */
        function getCaixaConfig(db) {
            return Object.assign({
                inicialBalcao: 0,
                inicialBanco: 0,
                basePainelEntradas: 0,
                basePainelSaidas: 0,
                atualizadoEm: '',
                osBloqueadasCaixa: {}
            }, (db && db.caixaConfig) || {});
        }

        function mesclarCaixaConfig(localCfg, nuvemCfg) {
            var L = getCaixaConfig({ caixaConfig: localCfg });
            var N = getCaixaConfig({ caixaConfig: nuvemCfg });
            function mergeBloqueadas(a, b) {
                var out = {};
                [a || {}, b || {}].forEach(function (map) {
                    Object.keys(map).forEach(function (id) {
                        var t = new Date(map[id] || 0).getTime();
                        var tOut = new Date(out[id] || 0).getTime();
                        if (!out[id] || t >= tOut) out[id] = map[id];
                    });
                });
                return out;
            }
            if (!nuvemCfg) return L;
            if (!localCfg) return N;
            var tL = new Date(L.atualizadoEm || 0).getTime();
            var tN = new Date(N.atualizadoEm || 0).getTime();
            var base;
            if (tL && tN) base = tL >= tN ? L : N;
            else if (tL && !tN) base = L;
            else if (!tL && tN) {
                if ((Number(L.inicialBalcao) || 0) > 0 || (Number(L.inicialBanco) || 0) > 0) base = L;
                else base = N;
            } else if ((Number(L.inicialBalcao) || 0) !== (Number(N.inicialBalcao) || 0) ||
                (Number(L.inicialBanco) || 0) !== (Number(N.inicialBanco) || 0)) {
                base = {
                    inicialBalcao: Math.max(Number(L.inicialBalcao) || 0, Number(N.inicialBalcao) || 0),
                    inicialBanco: Math.max(Number(L.inicialBanco) || 0, Number(N.inicialBanco) || 0),
                    basePainelEntradas: Number(L.basePainelEntradas) || Number(N.basePainelEntradas) || 0,
                    basePainelSaidas: Number(L.basePainelSaidas) || Number(N.basePainelSaidas) || 0,
                    zeradoEm: L.zeradoEm || N.zeradoEm || '',
                    atualizadoEm: L.atualizadoEm || N.atualizadoEm || new Date().toISOString()
                };
            } else {
                base = L;
            }
            base.osBloqueadasCaixa = mergeBloqueadas(L.osBloqueadasCaixa, N.osBloqueadasCaixa);
            return base;
        }

        function salvarCaixaConfigOficial(cfg) {
            cfg = getCaixaConfig({ caixaConfig: cfg });
            cfg.atualizadoEm = new Date().toISOString();
            var db = carregarMain();
            db.caixaConfig = cfg;
            salvarMain(db);
            agendarSyncAutomatico('salvar');
            return cfg;
        }

        function somarLista(lista, tipo) {
            return (lista || []).filter(function (x) { return x.tipo === tipo; })
                .reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
        }

        function zerarPainelCaixa() {
            if (!confirm(
                '⚠️ ATENÇÃO: Zerar o painel do Caixa / Balcão?\n\n' +
                'Entradas, saídas e o caixa inicial do painel voltam para R$ 0,00.\n' +
                '(Os documentos da tabela NÃO são apagados — só o resumo numérico é limpo.)'
            )) return;
            var db = carregarMain();
            var cfg = getCaixaConfig(db);
            var lista = db.caixa || [];
            cfg.inicialBalcao = 0;
            cfg.basePainelEntradas = somarLista(lista, 'entrada');
            cfg.basePainelSaidas = somarLista(lista, 'saida');
            cfg.zeradoEm = new Date().toISOString();
            salvarCaixaConfigOficial(cfg);
            renderCaixa();
            atualizarKPIs(carregarMain());
            toast('Painel do caixa zerado.');
        }

        function sincronizarPainelCaixa() {
            sincronizarOficinaNoCaixaEmpresa();
            renderCaixa();
            atualizarKPIs(carregarMain());
            toast('Painel sincronizado.');
        }

        function editarCaixaInicial() {
            var db = carregarMain();
            var cfg = getCaixaConfig(db);
            var atual = Number(cfg.inicialBalcao) || 0;
            var v = prompt(
                'Editar caixa inicial do dia\n\n' +
                'Valor atual: ' + moeda(atual) + '\n\n' +
                'Digite o valor correto (R$):',
                String(atual).replace('.', ',')
            );
            if (v == null) return;
            var valor = parseMoeda(v);
            if (isNaN(valor) || valor < 0) {
                toast('Valor inválido.');
                return;
            }
            if (valor === atual) {
                toast('Caixa inicial permanece ' + moeda(atual) + '.');
                return;
            }
            if (!confirm(
                'Corrigir caixa inicial?\n\n' +
                'De: ' + moeda(atual) + '\n' +
                'Para: ' + moeda(valor)
            )) return;
            cfg.inicialBalcao = valor;
            salvarCaixaConfigOficial(cfg);
            toast('Caixa inicial corrigido: ' + moeda(valor));
            renderCaixa();
            atualizarKPIs(carregarMain());
        }

        document.getElementById('btnCxInicial').addEventListener('click', editarCaixaInicial);
        var cardCxIni = document.getElementById('cardCxInicial');
        if (cardCxIni) cardCxIni.addEventListener('click', editarCaixaInicial);

        function lancarBalcaoRapido(tipo) {
            var titulo = tipo === 'saida' ? 'Lançar DESPESA no balcão' : 'Lançar ENTRADA no balcão';
            var desc = prompt(titulo + '\n\nDescrição / Cliente:', '');
            if (desc == null) return;
            desc = String(desc).trim();
            if (!desc) { toast('Informe a descrição.'); return; }
            var vStr = prompt('Valor (R$):', '0,00');
            if (vStr == null) return;
            var valor = parseMoeda(vStr);
            if (!(valor > 0)) { toast('Informe um valor válido.'); return; }
            var forma = prompt('Forma (Dinheiro, PIX, Cartão, Transferência):', 'Dinheiro');
            if (forma == null) return;
            forma = String(forma).trim() || 'Dinheiro';
            var db = carregarMain();
            if (!db.caixa) db.caixa = [];
            db.caixa.push({
                id: uid(),
                tipo: tipo === 'saida' ? 'saida' : 'entrada',
                descricao: desc,
                valor: valor,
                forma: forma,
                conta: 'balcao',
                criadoEm: new Date().toISOString()
            });
            salvarMain(db);
            agendarSyncAutomatico('salvar');
            toast(tipo === 'saida' ? 'Despesa lançada no balcão.' : 'Entrada lançada no balcão.');
            renderCaixa();
            atualizarKPIs(db);
        }

        document.getElementById('btnCxFocoEntrada').addEventListener('click', function () {
            lancarBalcaoRapido('entrada');
        });

        document.getElementById('btnCxFocoDespesa').addEventListener('click', function () {
            lancarBalcaoRapido('saida');
        });

        document.getElementById('btnZerarCaixa').addEventListener('click', zerarPainelCaixa);
        document.getElementById('btnSincronizarPainelCaixa').addEventListener('click', sincronizarPainelCaixa);

        function bloquearOsNoCaixa(db, atendimentoId) {
            if (!db || !atendimentoId) return;
            var cfg = getCaixaConfig(db);
            if (!cfg.osBloqueadasCaixa || typeof cfg.osBloqueadasCaixa !== 'object') {
                cfg.osBloqueadasCaixa = {};
            }
            cfg.osBloqueadasCaixa[String(atendimentoId)] = new Date().toISOString();
            cfg.atualizadoEm = new Date().toISOString();
            db.caixaConfig = cfg;
        }

        /* Blindagem: OS bloqueada não volta ao caixa após sync */
        function blindarCaixaContraOsBloqueadas(db) {
            if (!db) return;
            var cfg = getCaixaConfig(db);
            var bloq = (cfg && cfg.osBloqueadasCaixa && typeof cfg.osBloqueadasCaixa === 'object')
                ? cfg.osBloqueadasCaixa
                : {};
            var keys = Object.keys(bloq);
            if (!keys.length) return;
            function filtrar(lista, nome) {
                return (lista || []).filter(function (x) {
                    if (!x || !x.atendimentoId) return true;
                    if (!bloq[x.atendimentoId] && !bloq[String(x.atendimentoId)]) return true;
                    marcarExcluido(db, nome, x.id);
                    return false;
                });
            }
            db.caixa = filtrar(db.caixa, 'caixa');
            db.caixaBanco = filtrar(db.caixaBanco, 'caixaBanco');
        }

        function excluirLancamentoCaixaBalcao(idLanc, atendimentoIdHint) {
            var db = carregarMain();
            var idEx = String(idLanc || '').trim();
            var atId = String(atendimentoIdHint || '').trim();
            var removidos = [];

            function coletar(lista, nomeLista) {
                return (lista || []).filter(function (x) {
                    if (!x) return false;
                    var mesmoId = idEx && String(x.id) === idEx;
                    var mesmaOs = atId && x.atendimentoId && String(x.atendimentoId) === atId;
                    if (mesmoId || mesmaOs) {
                        removidos.push({ id: x.id, atendimentoId: x.atendimentoId, lista: nomeLista });
                        return false;
                    }
                    return true;
                });
            }

            /* Se não achou pelo hint, tenta descobrir a OS pelo id do lançamento */
            if (!atId && idEx) {
                var achado = (db.caixa || []).concat(db.caixaBanco || []).find(function (x) {
                    return x && String(x.id) === idEx;
                });
                if (achado && achado.atendimentoId) atId = String(achado.atendimentoId);
            }

            db.caixa = coletar(db.caixa, 'caixa');
            db.caixaBanco = coletar(db.caixaBanco, 'caixaBanco');

            if (!removidos.length && idEx) {
                /* fallback: remove só pelo id em qualquer lista */
                db.caixa = (db.caixa || []).filter(function (x) {
                    if (x && String(x.id) === idEx) {
                        removidos.push({ id: x.id, atendimentoId: x.atendimentoId, lista: 'caixa' });
                        return false;
                    }
                    return true;
                });
                db.caixaBanco = (db.caixaBanco || []).filter(function (x) {
                    if (x && String(x.id) === idEx) {
                        removidos.push({ id: x.id, atendimentoId: x.atendimentoId, lista: 'caixaBanco' });
                        return false;
                    }
                    return true;
                });
            }

            if (!removidos.length) {
                toast('Não encontrei esse lançamento para excluir.');
                return false;
            }

            removidos.forEach(function (r) {
                if (r.lista === 'caixaBanco') marcarExcluido(db, 'caixaBanco', r.id);
                else marcarExcluido(db, 'caixa', r.id);
                if (r.atendimentoId) bloquearOsNoCaixa(db, r.atendimentoId);
            });
            if (atId) bloquearOsNoCaixa(db, atId);

            salvarMain(db);
            agendarSyncAutomatico('salvar');
            toast('Excluído do caixa (' + removidos.length + ').');
            return true;
        }

        function classificarTipoCaixaFh(x) {
            if (x.tipo === 'saida' || x.tipo === 'DESPESA') return { sigla: 'DESPESAS', cls: 'despesas' };
            if (x.tipo === 'fechamento' || x.origemFechamento) return { sigla: 'FECH.CAIXA', cls: 'fech' };
            if (x.atendimentoId || x.origemOficina) return { sigla: 'ORDEM.SERV.', cls: 'os' };
            return { sigla: 'ENTRADA', cls: 'entrada' };
        }

        function numDocCaixaFh(x) {
            if (x.osResumo && x.osResumo.placa) return String(x.osResumo.placa).toUpperCase();
            if (x.numDoc) return String(x.numDoc);
            return String(x.id || '—').slice(-6).toUpperCase();
        }

        function clienteCaixaFh(x) {
            if (x.osResumo && x.osResumo.cliente) return x.osResumo.cliente;
            if (x.clienteNome) return x.clienteNome;
            return x.descricao || '—';
        }

        function renderCaixa() {
            sincronizarOficinaNoCaixaEmpresa();
            /* Sempre lê o caixa oficial da empresa (não o banco interno) */
            var db = carregarMain();
            var cfg = getCaixaConfig(db);
            var exCx = garantirExcluidos(db).caixa || {};
            var lista = aplicarExcluidosNaLista(db.caixa || [], exCx);
            /* Se ficou algum excluído no array, limpa de vez */
            if (lista.length !== (db.caixa || []).length) {
                db.caixa = lista;
                salvarMain(db);
            }
            var entradasBrutas = somarLista(lista, 'entrada');
            var saidasBrutas = somarLista(lista, 'saida');
            var entradas = Math.max(0, entradasBrutas - (Number(cfg.basePainelEntradas) || 0));
            var saidas = Math.max(0, saidasBrutas - (Number(cfg.basePainelSaidas) || 0));
            var inicial = Number(cfg.inicialBalcao) || 0;
            var elIni = document.getElementById('cxInicial');
            if (elIni) elIni.textContent = moeda(inicial);
            document.getElementById('cxEntradas').textContent = moeda(entradas);
            document.getElementById('cxSaidas').textContent = moeda(saidas);
            document.getElementById('cxSaldo').textContent = moeda(inicial + entradas - saidas);

            var hoje = hojeISO();
            var of = calcularRelatorioOficina({ inicio: hoje, fim: hoje, label: hoje });
            var elP = document.getElementById('cxOfPecas');
            var elG = document.getElementById('cxOfGanho');
            var elM = document.getElementById('cxOfMao');
            var elN = document.getElementById('cxOfNoCaixa');
            if (elP) elP.textContent = moeda(of.pecas);
            if (elG) elG.textContent = moeda(of.ganho);
            if (elM) elM.textContent = moeda(of.mao);
            if (elN) elN.textContent = moeda(totaisOficinaNoCaixaHoje(db, hoje));

            var tb = document.getElementById('tabelaCaixa');
            tb.innerHTML = '';
            /* pastas do balcão foram movidas para Relatório de Despesas */

            var q = ((document.getElementById('buscaCaixaBalcao') && document.getElementById('buscaCaixaBalcao').value) || '').toLowerCase().trim();
            var listaFiltrada = lista.slice().reverse().filter(function (x) {
                if (!q) return true;
                var dataLanc = fmtData(x.criadoEm);
                var venc = x.vencimento ? fmtData(x.vencimento) : dataLanc;
                var blob = [
                    numDocCaixaFh(x),
                    clienteCaixaFh(x),
                    x.descricao,
                    x.forma,
                    x.tipo,
                    dataLanc,
                    venc,
                    String(x.criadoEm || '').slice(0, 10)
                ].join(' ').toLowerCase();
                return blob.indexOf(q) > -1;
            });

            if (!listaFiltrada.length) {
                tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#fff;font-weight:700">' +
                    (lista.length ? 'Nenhum registro encontrado na busca.' : 'Nenhum documento registrado no balcão.') +
                    '</td></tr>';
                return;
            }

            var main = carregarMain();
            listaFiltrada.forEach(function (x) {
                var tip = classificarTipoCaixaFh(x);
                var doc = numDocCaixaFh(x);
                var cli = clienteCaixaFh(x);
                var dataLanc = fmtData(x.criadoEm);
                var venc = x.vencimento ? fmtData(x.vencimento) : dataLanc;
                var valorCor = tip.cls === 'despesas' ? '#e74c3c' : '#2ecc71';
                var forma = (x.forma || '').toUpperCase();
                var statusHtml;
                if (tip.cls === 'despesas' || tip.cls === 'fech') {
                    statusHtml = '—';
                } else {
                    statusHtml = '<span class="badge-cx pago">✅ PAGO' + (forma ? ' - ' + esc(forma) : '') + '</span>';
                }
                var assHtml = '—';
                if (x.atendimentoId) {
                    var at = (main.atendimentos || []).find(function (a) { return a.id === x.atendimentoId; });
                    if (at && at.assinaturaCliente) assHtml = '<span style="color:#2ecc71">✍️ OK</span>';
                    else assHtml = '<span style="color:#e74c3c">❌ Pend</span>';
                }

                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td style="font-weight:800">' + esc(doc) + '</td>' +
                    '<td><span class="badge-cx ' + tip.cls + '">' + tip.sigla + '</span></td>' +
                    '<td>' + esc(dataLanc) + '</td>' +
                    '<td>' + esc(cli) + '</td>' +
                    '<td>' + esc(venc) + '</td>' +
                    '<td style="color:' + valorCor + ';font-weight:800">' + moeda(x.valor) + '</td>' +
                    '<td style="text-align:center">' + statusHtml + '</td>' +
                    '<td style="text-align:center;font-size:0.8rem">' + assHtml + '</td>' +
                    '<td class="cx-acoes-cell"></td>';
                var acoesCell = tr.querySelector('.cx-acoes-cell');
                var wrap = document.createElement('div');
                wrap.className = 'cx-acoes-fh';
                if (x.atendimentoId) {
                    var bVer = document.createElement('button');
                    bVer.type = 'button';
                    bVer.className = 'btn btn-secondary';
                    bVer.textContent = 'Ver';
                    bVer.setAttribute('data-cx-ver', String(x.atendimentoId));
                    wrap.appendChild(bVer);
                    var bPdf = document.createElement('button');
                    bPdf.type = 'button';
                    bPdf.className = 'btn btn-pdf';
                    bPdf.textContent = 'PDF';
                    bPdf.setAttribute('data-cx-pdf', String(x.atendimentoId));
                    wrap.appendChild(bPdf);
                    var bLink = document.createElement('button');
                    bLink.type = 'button';
                    bLink.className = 'btn btn-assinar';
                    bLink.textContent = 'Link';
                    bLink.setAttribute('data-cx-link', String(x.atendimentoId));
                    wrap.appendChild(bLink);
                }
                var bEx = document.createElement('button');
                bEx.type = 'button';
                bEx.className = 'btn btn-danger';
                bEx.textContent = 'Excluir';
                bEx.setAttribute('data-ex', String(x.id || ''));
                if (x.atendimentoId) bEx.setAttribute('data-ex-at', String(x.atendimentoId));
                wrap.appendChild(bEx);
                acoesCell.appendChild(wrap);
                tb.appendChild(tr);
            });

            if (!tb._cxClickLigado) {
                tb._cxClickLigado = true;
                tb.addEventListener('click', function (e) {
                    var bEx = e.target.closest('[data-ex]');
                    if (bEx) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!confirm('Excluir este lançamento do caixa / balcão?')) return;
                        var ok = excluirLancamentoCaixaBalcao(
                            bEx.getAttribute('data-ex'),
                            bEx.getAttribute('data-ex-at')
                        );
                        if (ok) {
                            renderCaixa();
                            atualizarKPIs(carregarMain());
                        }
                        return;
                    }
                    var bVer = e.target.closest('[data-cx-ver]');
                    if (bVer) {
                        abrirNota(bVer.getAttribute('data-cx-ver'));
                        return;
                    }
                    var bPdf = e.target.closest('[data-cx-pdf]');
                    if (bPdf) {
                        imprimirNotaPdf(bPdf.getAttribute('data-cx-pdf'));
                        return;
                    }
                    var bLink = e.target.closest('[data-cx-link]');
                    if (bLink) {
                        abrirLinkAssinatura(bLink.getAttribute('data-cx-link'));
                    }
                });
            }
        }

        (function ligarBuscaCaixaBalcao() {
            var el = document.getElementById('buscaCaixaBalcao');
            if (!el || el._ligadoCx) return;
            el._ligadoCx = true;
            el.addEventListener('input', function () { renderCaixa(); });
        })();

        document.getElementById('btnBkInicial').addEventListener('click', function () {
            var db = carregarMain();
            var cfg = getCaixaConfig(db);
            var atual = Number(cfg.inicialBanco) || 0;
            var v = prompt('Informe o saldo inicial do banco (R$):', String(atual).replace('.', ','));
            if (v == null) return;
            var valor = parseMoeda(v);
            if (isNaN(valor) || valor < 0) {
                toast('Valor inválido.');
                return;
            }
            cfg.inicialBanco = valor;
            salvarCaixaConfigOficial(cfg);
            toast('Saldo inicial do banco gravado: ' + moeda(valor));
            renderCaixaBanco();
            atualizarKPIs(carregarMain());
        });

        document.getElementById('formBanco').addEventListener('submit', function (e) {
            e.preventDefault();
            var db = carregar();
            if (!db.caixaBanco) db.caixaBanco = [];
            db.caixaBanco.push({
                id: uid(),
                tipo: document.getElementById('bkTipo').value,
                descricao: document.getElementById('bkDesc').value.trim(),
                valor: parseMoeda(document.getElementById('bkValor').value),
                forma: document.getElementById('bkForma').value,
                conta: 'banco',
                criadoEm: new Date().toISOString()
            });
            salvar(db);
            document.getElementById('formBanco').reset();
            toast('Lançamento no banco registrado.');
            renderCaixaBanco();
            atualizarKPIs(db);
        });

        function renderCaixaBanco() {
            var db = carregarMain();
            var cfg = getCaixaConfig(db);
            var exBk = garantirExcluidos(db).caixaBanco || {};
            var lista = aplicarExcluidosNaLista(db.caixaBanco || [], exBk);
            var bloq = (cfg.osBloqueadasCaixa && typeof cfg.osBloqueadasCaixa === 'object') ? cfg.osBloqueadasCaixa : {};
            if (Object.keys(bloq).length) {
                var antes = lista.length;
                lista = lista.filter(function (x) {
                    if (!x || !x.atendimentoId) return true;
                    if (!bloq[x.atendimentoId] && !bloq[String(x.atendimentoId)]) return true;
                    marcarExcluido(db, 'caixaBanco', x.id);
                    return false;
                });
                if (lista.length !== antes || lista.length !== (db.caixaBanco || []).length) {
                    db.caixaBanco = lista;
                    salvarMain(db);
                }
            } else if (lista.length !== (db.caixaBanco || []).length) {
                db.caixaBanco = lista;
                salvarMain(db);
            }
            var entradas = somarLista(lista, 'entrada');
            var saidas = somarLista(lista, 'saida');
            var inicial = Number(cfg.inicialBanco) || 0;
            document.getElementById('bkInicial').textContent = moeda(inicial);
            document.getElementById('bkEntradas').textContent = moeda(entradas);
            document.getElementById('bkSaidas').textContent = moeda(saidas);
            document.getElementById('bkSaldo').textContent = moeda(inicial + entradas - saidas);

            var tb = document.getElementById('tabelaBanco');
            tb.innerHTML = '';
            if (typeof gerarArvorePastasCaixa === 'function') {
                gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
            }
            if (!lista.length) {
                tb.innerHTML = '<tr><td colspan="6" class="muted">Sem lançamentos no banco.</td></tr>';
                return;
            }
            lista.slice().reverse().forEach(function (x) {
                var tr = document.createElement('tr');
                var tdAcoes = document.createElement('td');
                tdAcoes.className = 'actions';
                var bEx = document.createElement('button');
                bEx.type = 'button';
                bEx.className = 'btn btn-danger';
                bEx.textContent = 'Excluir';
                bEx.setAttribute('data-ex', String(x.id || ''));
                if (x.atendimentoId) bEx.setAttribute('data-ex-at', String(x.atendimentoId));
                tdAcoes.appendChild(bEx);
                tr.innerHTML =
                    '<td>' + esc(fmtData(x.criadoEm)) + '</td>' +
                    '<td>' + esc(x.tipo) + '</td>' +
                    '<td>' + esc(x.descricao) + '</td>' +
                    '<td>' + esc(x.forma) + '</td>' +
                    '<td>' + moeda(x.valor) + '</td>';
                tr.appendChild(tdAcoes);
                tb.appendChild(tr);
            });
            if (!tb._bkClickLigado) {
                tb._bkClickLigado = true;
                tb.addEventListener('click', function (e) {
                    var b = e.target.closest('[data-ex]');
                    if (!b) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (!confirm('Excluir lançamento do caixa do banco (PIX / cartões)?')) return;
                    var ok = excluirLancamentoCaixaBalcao(
                        b.getAttribute('data-ex'),
                        b.getAttribute('data-ex-at')
                    );
                    if (ok) {
                        renderCaixaBanco();
                        renderCaixa();
                        atualizarKPIs(carregarMain());
                    }
                });
            }
        }

        document.getElementById('formPendente').addEventListener('submit', function (e) {
            e.preventDefault();
            var db = carregar();
            if (!db.pendentes) db.pendentes = [];
            db.pendentes.push({
                id: uid(),
                cliente: document.getElementById('pdCliente').value.trim(),
                descricao: document.getElementById('pdDesc').value.trim(),
                valor: parseMoeda(document.getElementById('pdValor').value),
                vencimento: document.getElementById('pdVenc').value,
                status: 'aberto',
                criadoEm: new Date().toISOString()
            });
            salvar(db);
            document.getElementById('formPendente').reset();
            toast('Conta pendente adicionada.');
            renderPendentes();
        });

        function receberPendente(id, destino) {
            var db = carregar();
            var i = (db.pendentes || []).findIndex(function (p) { return p.id === id; });
            if (i < 0) return;
            var p = db.pendentes[i];
            var lanc = {
                id: uid(),
                tipo: 'entrada',
                descricao: p.cliente + ' — ' + p.descricao,
                valor: Number(p.valor) || 0,
                forma: destino === 'banco' ? 'PIX' : 'Dinheiro',
                conta: destino,
                pendenteId: p.id,
                criadoEm: new Date().toISOString()
            };
            if (destino === 'banco') {
                if (!db.caixaBanco) db.caixaBanco = [];
                db.caixaBanco.push(lanc);
            } else {
                if (!db.caixa) db.caixa = [];
                db.caixa.push(lanc);
            }
            if (canalVendas !== 'interno') marcarExcluido(db, 'pendentes', p.id);
            db.pendentes.splice(i, 1);
            salvar(db);
            toast('Recebido no ' + (destino === 'banco' ? 'banco' : 'balcão') + '.');
            renderPendentes();
            renderCaixa();
            renderCaixaBanco();
            atualizarKPIs(db);
        }

        function renderPendentes() {
            var db = carregar();
            var lista = (db.pendentes || []).filter(function (p) { return p.status !== 'pago'; });
            var total = lista.reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
            document.getElementById('pdTotal').textContent = moeda(total);
            document.getElementById('pdQtd').textContent = String(lista.length);
            var tb = document.getElementById('tabelaPendentes');
            tb.innerHTML = '';
            if (typeof gerarArvorePastasCaixa === 'function') {
                gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
            }
            if (!lista.length) {
                tb.innerHTML = '<tr><td colspan="5" class="muted">Nenhuma conta pendente.</td></tr>';
                return;
            }
            lista.slice().reverse().forEach(function (p) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + esc(p.cliente) + '</td>' +
                    '<td>' + esc(p.descricao) + '</td>' +
                    '<td>' + esc(fmtData(p.vencimento)) + '</td>' +
                    '<td>' + moeda(p.valor) + '</td>' +
                    '<td class="actions">' +
                    '<button type="button" class="btn btn-ok" data-rec-b="' + p.id + '">Receber balcão</button>' +
                    '<button type="button" class="btn btn-primary" data-rec-k="' + p.id + '">Receber banco</button>' +
                    '<button type="button" class="btn btn-danger" data-ex="' + p.id + '">Excluir</button>' +
                    '</td>';
                tb.appendChild(tr);
            });
            tb.querySelectorAll('[data-rec-b]').forEach(function (b) {
                b.addEventListener('click', function () { receberPendente(b.getAttribute('data-rec-b'), 'balcao'); });
            });
            tb.querySelectorAll('[data-rec-k]').forEach(function (b) {
                b.addEventListener('click', function () { receberPendente(b.getAttribute('data-rec-k'), 'banco'); });
            });
            tb.querySelectorAll('[data-ex]').forEach(function (b) {
                b.addEventListener('click', function () {
                    if (!confirm('Excluir pendente?')) return;
                    var db2 = carregar();
                    var idEx = b.getAttribute('data-ex');
                    if (canalVendas !== 'interno') marcarExcluido(db2, 'pendentes', idEx);
                    db2.pendentes = (db2.pendentes || []).filter(function (x) { return x.id !== idEx; });
                    salvar(db2);
                    renderPendentes();
                });
            });
        }

        /* ---------- Relatório mensal + pastas (modelo FH Control) ---------- */
        var MES_NOMES_CX = {
            '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
            '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
            '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
        };
        var REL_MES_TITULOS = {
            geral: 'RELATÓRIO MENSAL GERAL (BALCÃO + BANCO + CONTAS A RECEBER)',
            balcao: 'RELATÓRIO MENSAL — CAIXA / BALCÃO',
            banco: 'RELATÓRIO MENSAL — CAIXA BANCO (PIX / CARTÕES)',
            pendentes: 'RELATÓRIO MENSAL — CONTAS A RECEBER',
            despesas: 'RELATÓRIO MENSAL — DESPESAS / SAÍDAS'
        };
        var REL_MES_PREFIXO = {
            geral: 'Relatorio-Geral',
            balcao: 'Relatorio-Balcao',
            banco: 'Relatorio-Banco',
            pendentes: 'Relatorio-ContasReceber',
            despesas: 'Relatorio-Despesas'
        };

        function mesAnoDeIso(iso) {
            if (!iso) return '';
            var s = String(iso).trim();
            if (/^\d{4}-\d{2}/.test(s)) return s.slice(5, 7) + '/' + s.slice(0, 4);
            var limpa = s.split(/[\s,]/)[0];
            var p = limpa.split('/');
            if (p.length === 3) return p[1].padStart(2, '0') + '/' + p[2].slice(0, 4);
            return '';
        }

        function mesAnoAtualPadrao() {
            var d = new Date();
            return String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
        }

        function pastaMesLabel(mesAno) {
            var p = String(mesAno || '').split('/');
            if (p.length !== 2) return mesAno;
            return (MES_NOMES_CX[p[0]] || p[0]) + ' / ' + p[1];
        }

        function coletarItensRelatorioMensal(db, filtro, mesAno) {
            filtro = filtro || 'geral';
            mesAno = String(mesAno || '').trim();
            var itens = [];

            function pushLanc(x, canal) {
                if (!x) return;
                var ma = mesAnoDeIso(x.criadoEm);
                if (ma !== mesAno) return;
                var desc = x.descricao || '';
                if (x.atendimentoId && x.osResumo) {
                    desc = '[OS ' + (x.osResumo.placa || '') + '] ' + desc;
                }
                itens.push({
                    data: fmtData(x.criadoEm),
                    doc: x.atendimentoId ? 'OS' : (canal === 'banco' ? 'BANCO' : 'CX'),
                    tipo: x.tipo === 'saida' ? 'SAÍDA' : 'ENTRADA',
                    descricao: desc,
                    forma: x.forma || '—',
                    valor: Number(x.valor) || 0,
                    natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
                    canal: canal
                });
            }

            (db.caixa || []).forEach(function (x) { pushLanc(x, 'balcao'); });
            (db.caixaBanco || []).forEach(function (x) { pushLanc(x, 'banco'); });

            (db.pendentes || []).forEach(function (p) {
                if (!p || p.status === 'pago') return;
                var ref = p.criadoEm || p.vencimento;
                var ma = mesAnoDeIso(ref);
                if (!ma && p.vencimento) {
                    var v = String(p.vencimento);
                    if (/^\d{4}-\d{2}/.test(v)) ma = v.slice(5, 7) + '/' + v.slice(0, 4);
                }
                if (ma !== mesAno) return;
                itens.push({
                    data: fmtData(ref) || (p.vencimento || '—'),
                    doc: 'PEND',
                    tipo: 'A RECEBER',
                    descricao: (p.cliente ? p.cliente + ' — ' : '') + (p.descricao || ''),
                    forma: p.vencimento ? ('Venc. ' + fmtData(p.vencimento)) : '—',
                    valor: Number(p.valor) || 0,
                    natureza: 'PENDENTE',
                    canal: 'pendente'
                });
            });

            itens = itens.filter(function (it) {
                if (filtro === 'pendentes') return it.natureza === 'PENDENTE';
                if (filtro === 'balcao') return it.canal === 'balcao' && it.natureza !== 'PENDENTE';
                if (filtro === 'banco') return it.canal === 'banco' && it.natureza !== 'PENDENTE';
                if (filtro === 'despesas') return it.natureza === 'SAIDA';
                return true;
            });

            itens.sort(function (a, b) {
                var da = String(a.data).split('/').reverse().join('');
                var db2 = String(b.data).split('/').reverse().join('');
                return da.localeCompare(db2);
            });
            return itens;
        }

        function montarHtmlSecoesRelatorioMes(itens, filtro) {
            var totE = 0, totS = 0, totP = 0;
            var linE = '', linS = '', linP = '';
            itens.forEach(function (item) {
                var linha =
                    '<tr>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;width:70px">' + esc(item.data) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;width:60px">' + esc(item.doc) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;font-size:9px;width:80px">' + esc(item.tipo) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(item.descricao) +
                    '<br><small style="color:#777">' + esc(item.forma) + '</small></td>';
                if (item.natureza === 'PENDENTE') {
                    totP += item.valor;
                    linP += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#d35400;font-weight:bold;text-align:right">' +
                        moeda(item.valor) + '</td></tr>';
                } else if (item.natureza === 'ENTRADA') {
                    totE += item.valor;
                    linE += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#27ae60;font-weight:bold;text-align:right">+ ' +
                        moeda(item.valor) + '</td></tr>';
                } else {
                    totS += item.valor;
                    linS += linha + '<td style="padding:6px;border-bottom:1px solid #ddd;color:#e74c3c;font-weight:bold;text-align:right">- ' +
                        moeda(item.valor) + '</td></tr>';
                }
            });
            if (!linE) linE = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma entrada neste período.</td></tr>';
            if (!linS) linS = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma saída neste período.</td></tr>';
            if (!linP) linP = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhum pendente neste período.</td></tr>';

            var resumo;
            if (filtro === 'pendentes') {
                resumo =
                    '<div class="resumo"><div class="resumo-box" style="color:#f39c12">TOTAL A RECEBER<b>' + moeda(totP) + '</b></div></div>';
            } else if (filtro === 'despesas' || filtro === 'saidas') {
                resumo =
                    '<div class="resumo"><div class="resumo-box" style="color:#e74c3c">TOTAL DESPESAS / SAÍDAS<b>' + moeda(totS) + '</b></div></div>';
            } else {
                resumo =
                    '<div class="resumo">' +
                    '<div class="resumo-box" style="color:#27ae60">RECEBIMENTOS / ENTRADAS<b>' + moeda(totE) + '</b></div>' +
                    '<div class="resumo-box" style="color:#e74c3c">PAGAMENTOS / SAÍDAS<b>' + moeda(totS) + '</b></div>' +
                    '<div class="resumo-box" style="color:#2980b9">SALDO LÍQUIDO DO MÊS<b>' + moeda(totE - totS) + '</b></div>' +
                    '</div>';
            }

            var secE =
                '<div class="section-title entrada"><span>ENTRADAS (RECEBIMENTOS)</span><span>TOTAL: ' + moeda(totE) + '</span></div>' +
                '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição / Forma</th><th style="text-align:right">Valor</th></tr></thead>' +
                '<tbody>' + linE + '</tbody></table>';
            var secS =
                '<div class="section-title saida"><span>SAÍDAS E DESPESAS</span><span>TOTAL: ' + moeda(totS) + '</span></div>' +
                '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição / Motivo</th><th style="text-align:right">Valor</th></tr></thead>' +
                '<tbody>' + linS + '</tbody></table>';
            var secP =
                '<div class="section-title pendente"><span>CONTAS A RECEBER</span><span>TOTAL: ' + moeda(totP) + '</span></div>' +
                '<table><thead><tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Cliente / Vencimento</th><th style="text-align:right">Valor</th></tr></thead>' +
                '<tbody>' + linP + '</tbody></table>';

            var secoes;
            if (filtro === 'pendentes') secoes = secP;
            else if (filtro === 'entradas') secoes = secE;
            else if (filtro === 'saidas' || filtro === 'despesas') secoes = secS;
            else if (filtro === 'geral') secoes = secE + secS + secP;
            else secoes = secE + secS;

            return {
                html: resumo + secoes,
                totEntradas: totE,
                totSaidas: totS,
                totPendentes: totP,
                saldo: totE - totS
            };
        }

        function gerarRelatorioMensalPDF(filtro, mesAnoFixo) {
            filtro = filtro || 'geral';
            var mesAno = mesAnoFixo || prompt('Digite o mês e ano do relatório (Ex: 07/2026):', mesAnoAtualPadrao());
            if (!mesAno) return;
            mesAno = String(mesAno).trim();
            if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
                alert('Use o formato MM/AAAA (Ex: 07/2026).');
                return;
            }
            var db = carregar();
            var emp = getEmpresa(db);
            var itens = coletarItensRelatorioMensal(db, filtro, mesAno);
            if (!itens.length) {
                alert('Nenhum registro encontrado para o período: ' + mesAno);
                return;
            }
            var montado = montarHtmlSecoesRelatorioMes(itens, filtro);
            var titulo = REL_MES_TITULOS[filtro] || REL_MES_TITULOS.geral;
            var html =
                '<div class="nota-espelho relatorio-mensal-print">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho">' + esc(titulo) + '</div>' +
                    '<div class="nota-sub">Competência: ' + esc(mesAno) + ' · ' + esc(pastaMesLabel(mesAno)) + '</div>'
                ) +
                '<style>' +
                '.relatorio-mensal-print .resumo{display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
                '.relatorio-mensal-print .resumo-box{text-align:center;font-size:11px}' +
                '.relatorio-mensal-print .resumo-box b{display:block;font-size:14px;margin-top:4px}' +
                '.relatorio-mensal-print .section-title{padding:8px 10px;font-size:11px;font-weight:bold;margin-top:18px;text-transform:uppercase;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;color:#fff}' +
                '.relatorio-mensal-print .section-title.entrada{background:#27ae60}' +
                '.relatorio-mensal-print .section-title.saida{background:#e74c3c}' +
                '.relatorio-mensal-print .section-title.pendente{background:#f39c12}' +
                '.relatorio-mensal-print table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}' +
                '.relatorio-mensal-print th{background:#ecf0f1;color:#111;padding:8px;text-align:left;font-size:10px;border-bottom:2px solid #bdc3c7}' +
                '</style>' +
                montado.html +
                '<div style="text-align:center;margin-top:24px;font-size:9px;color:#777">' +
                'Documento gerado pelo Joninha Suspensões em ' + esc(new Date().toLocaleString('pt-BR')) +
                '</div></div>';
            executarImpressaoHtml(html);
        }

        function montarArvoreCaixaDados(db) {
            var arvore = {};
            function addDoc(iso, item) {
                var ma = mesAnoDeIso(iso);
                if (!ma) return;
                var p = ma.split('/');
                var ano = p[1];
                var mesNum = p[0];
                var mesNome = MES_NOMES_CX[mesNum] || mesNum;
                if (!arvore[ano]) arvore[ano] = {};
                if (!arvore[ano][mesNome]) {
                    arvore[ano][mesNome] = { mesNum: mesNum, mesAno: ma, entradas: [], saidas: [], pendentes: [] };
                }
                var bucket = arvore[ano][mesNome];
                if (item.natureza === 'ENTRADA') bucket.entradas.push(item);
                else if (item.natureza === 'SAIDA') bucket.saidas.push(item);
                else bucket.pendentes.push(item);
            }

            (db.caixa || []).forEach(function (x) {
                addDoc(x.criadoEm, {
                    data: fmtData(x.criadoEm),
                    descricao: x.descricao || '—',
                    forma: x.forma || '—',
                    valor: Number(x.valor) || 0,
                    natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
                    origem: 'Balcão'
                });
            });
            (db.caixaBanco || []).forEach(function (x) {
                addDoc(x.criadoEm, {
                    data: fmtData(x.criadoEm),
                    descricao: x.descricao || '—',
                    forma: x.forma || '—',
                    valor: Number(x.valor) || 0,
                    natureza: x.tipo === 'saida' ? 'SAIDA' : 'ENTRADA',
                    origem: 'Banco'
                });
            });
            (db.pendentes || []).forEach(function (p) {
                if (!p || p.status === 'pago') return;
                var ref = p.criadoEm || p.vencimento;
                addDoc(ref, {
                    data: fmtData(ref),
                    descricao: (p.cliente ? p.cliente + ' — ' : '') + (p.descricao || '—'),
                    forma: p.vencimento ? ('Venc. ' + fmtData(p.vencimento)) : '—',
                    valor: Number(p.valor) || 0,
                    natureza: 'PENDENTE',
                    origem: 'Pendente'
                });
            });
            return arvore;
        }

        function htmlItensPastaCx(lista, classeValor) {
            if (!lista || !lista.length) {
                return '<div class="muted" style="padding:6px 0">Nenhum lançamento nesta pasta.</div>';
            }
            return lista.map(function (it) {
                return '<div class="pasta-cx-item">' +
                    '<span><strong>[' + esc(it.origem || '') + ']</strong> ' + esc(it.data) + ' · ' + esc(it.descricao) +
                    ' <small class="muted">(' + esc(it.forma) + ')</small></span>' +
                    '<span class="' + classeValor + '">' + moeda(it.valor) + '</span></div>';
            }).join('');
        }

        function togglePastaCaixa(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
        }
        window.togglePastaCaixa = togglePastaCaixa;

        function filtrarItensArvoreCaixa(lista, filtro) {
            if (!lista) return [];
            if (filtro === 'balcao') return lista.filter(function (x) { return x.origem === 'Balcão'; });
            if (filtro === 'banco') return lista.filter(function (x) { return x.origem === 'Banco'; });
            if (filtro === 'pendentes') return lista.filter(function (x) { return x.origem === 'Pendente'; });
            return lista.slice();
        }

        function gerarArvorePastasCaixa(opts) {
            opts = opts || {};
            var elId = opts.elId || 'arvorePastasCaixa';
            var filtro = opts.filtro || 'geral';
            var idPrefix = opts.idPrefix || 'pasta_cx';
            var el = document.getElementById(elId);
            if (!el) return;
            var db = carregar();
            var arvoreFull = montarArvoreCaixaDados(db);
            var arvore = {};
            Object.keys(arvoreFull).forEach(function (ano) {
                Object.keys(arvoreFull[ano]).forEach(function (mesNome) {
                    var b = arvoreFull[ano][mesNome];
                    var entradas = filtrarItensArvoreCaixa(b.entradas, filtro);
                    var saidas = filtrarItensArvoreCaixa(b.saidas, filtro);
                    var pendentes = filtrarItensArvoreCaixa(b.pendentes, filtro);
                    if (filtro === 'pendentes') {
                        entradas = [];
                        saidas = [];
                    } else if (filtro === 'despesas') {
                        entradas = [];
                        pendentes = [];
                        saidas = (b.saidas || []).slice();
                    } else if (filtro === 'balcao' || filtro === 'banco') {
                        pendentes = [];
                    }
                    if (!entradas.length && !saidas.length && !pendentes.length) return;
                    if (!arvore[ano]) arvore[ano] = {};
                    arvore[ano][mesNome] = {
                        mesNum: b.mesNum,
                        mesAno: b.mesAno,
                        entradas: entradas,
                        saidas: saidas,
                        pendentes: pendentes
                    };
                });
            });
            var anos = Object.keys(arvore).sort().reverse();
            if (!anos.length) {
                el.innerHTML = '<div class="muted" style="padding:10px;text-align:center">' +
                    (filtro === 'despesas'
                        ? 'Ainda não há despesas lançadas para montar as pastas do mês.'
                        : 'Ainda não há lançamentos para montar as pastas do mês.') +
                    '</div>';
                return;
            }
            var html = '';
            var idc = 0;
            anos.forEach(function (ano) {
                idc++;
                var idAno = idPrefix + '_ano_' + idc;
                html += '<div class="pasta-cx-ano" onclick="togglePastaCaixa(\'' + idAno + '\')">📁 Ano: ' + esc(ano) + '</div>';
                html += '<div id="' + idAno + '" style="display:none">';
                Object.keys(arvore[ano]).forEach(function (mesNome) {
                    var bucket = arvore[ano][mesNome];
                    idc++;
                    var idMes = idPrefix + '_mes_' + idc;
                    var totE = bucket.entradas.reduce(function (s, x) { return s + x.valor; }, 0);
                    var totS = bucket.saidas.reduce(function (s, x) { return s + x.valor; }, 0);
                    var totP = bucket.pendentes.reduce(function (s, x) { return s + x.valor; }, 0);
                    var resumoMes = filtro === 'pendentes'
                        ? ('a receber ' + moeda(totP))
                        : (filtro === 'despesas'
                            ? ('despesas ' + moeda(totS))
                            : ('saldo ' + moeda(totE - totS)));
                    html += '<div class="pasta-cx-mes" onclick="togglePastaCaixa(\'' + idMes + '\')">📂 Mês: ' +
                        esc(mesNome) + ' <small style="font-weight:500;opacity:.85">(' + esc(bucket.mesAno) +
                        ' · ' + resumoMes + ')</small></div>';
                    html += '<div class="pasta-cx-mes-acoes">' +
                        '<button type="button" class="btn btn-pdf" style="padding:6px 10px;font-size:12px" data-rel-mes-fixo="' +
                        esc(bucket.mesAno) + '" data-rel-mes="' + esc(filtro) + '">📄 Relatório geral</button>' +
                        '<button type="button" class="btn btn-secondary" style="padding:6px 10px;font-size:12px" data-arquivar-mes="' +
                        esc(bucket.mesAno) + '" data-arquivar-filtro="' + esc(filtro) + '">📂 Arquivar no PC</button></div>';
                    html += '<div id="' + idMes + '" style="display:none">';

                    if (filtro === 'despesas') {
                        idc++;
                        var idS = idPrefix + '_s_' + idc;
                        html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idS + '\')">🔻 Despesas (' +
                            bucket.saidas.length + ' · ' + moeda(totS) + ')</div>';
                        html += '<div id="' + idS + '" class="pasta-cx-conteudo" style="display:none">' +
                            htmlItensPastaCx(bucket.saidas, 'val-sai') + '</div>';
                    } else if (filtro !== 'pendentes') {
                        idc++;
                        var idE = idPrefix + '_e_' + idc;
                        html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idE + '\')">✅ Entradas (' +
                            bucket.entradas.length + ' · ' + moeda(totE) + ')</div>';
                        html += '<div id="' + idE + '" class="pasta-cx-conteudo" style="display:none">' +
                            htmlItensPastaCx(bucket.entradas, 'val-ent') + '</div>';

                        idc++;
                        var idS2 = idPrefix + '_s_' + idc;
                        html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idS2 + '\')">🔻 Saídas (' +
                            bucket.saidas.length + ' · ' + moeda(totS) + ')</div>';
                        html += '<div id="' + idS2 + '" class="pasta-cx-conteudo" style="display:none">' +
                            htmlItensPastaCx(bucket.saidas, 'val-sai') + '</div>';
                    }

                    if (filtro === 'geral' || filtro === 'pendentes') {
                        idc++;
                        var idP = idPrefix + '_p_' + idc;
                        html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idP + '\')">⏳ Pendentes (' +
                            bucket.pendentes.length + ' · ' + moeda(totP) + ')</div>';
                        html += '<div id="' + idP + '" class="pasta-cx-conteudo" style="display:none">' +
                            htmlItensPastaCx(bucket.pendentes, 'val-pen') + '</div>';
                    }

                    html += '</div>';
                });
                html += '</div>';
            });
            el.innerHTML = html;

            el.querySelectorAll('[data-rel-mes-fixo]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes') || 'geral', b.getAttribute('data-rel-mes-fixo'));
                });
            });
            el.querySelectorAll('[data-arquivar-mes]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    arquivarMesPastaPC(b.getAttribute('data-arquivar-mes'), b.getAttribute('data-arquivar-filtro') || filtro);
                });
            });
        }

        function atualizarTodasPastasCaixa() {
            gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
            gerarArvorePastasCaixa({ elId: 'arvorePastasDespesas', filtro: 'despesas', idPrefix: 'pasta_des' });
            gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
            gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
        }

        function renderRelatorioDespesas() {
            var db = carregar();
            var mesAno = mesAnoAtualPadrao();
            var itensMes = coletarItensRelatorioMensal(db, 'despesas', mesAno);
            var totMes = itensMes.reduce(function (s, x) { return s + (Number(x.valor) || 0); }, 0);
            var totGeral = 0;
            (db.caixa || []).forEach(function (x) {
                if (x.tipo === 'saida') totGeral += Number(x.valor) || 0;
            });
            (db.caixaBanco || []).forEach(function (x) {
                if (x.tipo === 'saida') totGeral += Number(x.valor) || 0;
            });
            var elM = document.getElementById('rdDespesasMes');
            var elQ = document.getElementById('rdQtdMes');
            var elT = document.getElementById('rdDespesasTotal');
            if (elM) elM.textContent = moeda(totMes);
            if (elQ) elQ.textContent = String(itensMes.length);
            if (elT) elT.textContent = moeda(totGeral);
            gerarArvorePastasCaixa({ elId: 'arvorePastasDespesas', filtro: 'despesas', idPrefix: 'pasta_des' });
        }

        function htmlArquivoRelatorioMes(emp, titulo, mesAno, corpoHtml) {
            return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
                '<title>Joninha Suspensões</title>' +
                '<style>body{font-family:Segoe UI,Arial,sans-serif;font-size:12px;color:#222;margin:24px}' +
                'h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;color:#555;margin:0 0 16px}' +
                'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}' +
                'th{background:#ecf0f1}.section-title{padding:8px 10px;color:#fff;font-weight:bold;margin-top:18px;display:flex;justify-content:space-between}' +
                '.entrada{background:#27ae60}.saida{background:#e74c3c}.pendente{background:#f39c12}' +
                '.resumo{display:flex;gap:12px;flex-wrap:wrap;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
                '.resumo-box{text-align:center;flex:1;min-width:120px}.resumo-box b{display:block;margin-top:4px;font-size:14px}</style></head><body>' +
                '<h1>' + esc(titulo) + '</h1>' +
                '<h2>' + esc(emp.nome || 'Joninha Suspensões') + ' — Competência: ' + esc(mesAno) + '</h2>' +
                corpoHtml +
                '<p style="margin-top:28px;font-size:10px;color:#888;text-align:center">Gerado em ' +
                esc(new Date().toLocaleString('pt-BR')) + ' · Joninha Suspensões</p></body></html>';
        }

        async function gravarTextoNaPasta(dirHandle, nomeArquivo, texto) {
            var fh = await dirHandle.getFileHandle(nomeArquivo, { create: true });
            var w = await fh.createWritable();
            await w.write(texto);
            await w.close();
        }

        async function arquivarMesPastaPC(mesAnoFixo, filtroFixo) {
            if (!('showDirectoryPicker' in window)) {
                toast('Arquivar na pasta do PC só funciona no Chrome/Edge no computador.');
                return;
            }
            var filtro = filtroFixo || 'geral';
            var mesAno = mesAnoFixo || prompt('Qual mês arquivar na pasta do PC? (Ex: 07/2026)', mesAnoAtualPadrao());
            if (!mesAno) return;
            mesAno = String(mesAno).trim();
            if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
                alert('Use o formato MM/AAAA (Ex: 07/2026).');
                return;
            }
            var root = await carregarHandlePastaRaiz();
            if (!root) {
                toast('Configure a pasta do PC em Config primeiro.');
                return;
            }
            if (!(await solicitarPermissaoPasta(root))) {
                toast('Sem permissão na pasta do PC.');
                return;
            }

            var db = carregar();
            var emp = getEmpresa(db);
            var itens = coletarItensRelatorioMensal(db, filtro, mesAno);
            if (!itens.length) {
                alert('Nenhum registro para arquivar em ' + mesAno);
                return;
            }
            var entradas = itens.filter(function (x) { return x.natureza === 'ENTRADA'; });
            var saidas = itens.filter(function (x) { return x.natureza === 'SAIDA'; });
            var pendentes = itens.filter(function (x) { return x.natureza === 'PENDENTE'; });
            var filtroHtml = filtro === 'pendentes' ? 'pendentes' : (filtro === 'geral' ? 'geral' : filtro);
            var montGeral = montarHtmlSecoesRelatorioMes(itens, filtroHtml);
            var montEnt = montarHtmlSecoesRelatorioMes(entradas, 'entradas');
            var montSai = montarHtmlSecoesRelatorioMes(saidas, 'saidas');

            var partes = mesAno.split('/');
            var ano = partes[1];
            var mesNum = partes[0];
            var mesNome = MES_NOMES_CX[mesNum] || mesNum;
            var nomePastaMes = mesNum + '-' + slugPasta(mesNome);
            var subTipo = filtro === 'balcao' ? 'Balcao'
                : (filtro === 'banco' ? 'Banco'
                    : (filtro === 'pendentes' ? 'Pendentes'
                        : (filtro === 'despesas' ? 'Despesas' : 'Geral')));
            var tituloRel = REL_MES_TITULOS[filtro] || REL_MES_TITULOS.geral;

            try {
                var pastaCaixa = await root.getDirectoryHandle('Caixa', { create: true });
                var pastaTipo = await pastaCaixa.getDirectoryHandle(subTipo, { create: true });
                var pastaAno = await pastaTipo.getDirectoryHandle(ano, { create: true });
                var pastaMes = await pastaAno.getDirectoryHandle(nomePastaMes, { create: true });

                if (filtro === 'despesas') {
                    var pastaSaidasD = await pastaMes.getDirectoryHandle('Despesas', { create: true });
                    await gravarTextoNaPasta(pastaSaidasD, 'despesas-' + mesNum + '-' + ano + '.html',
                        htmlArquivoRelatorioMes(emp, 'DESPESAS DO MÊS', mesAno, montSai.html));
                    await gravarTextoNaPasta(pastaSaidasD, 'despesas-' + mesNum + '-' + ano + '.json',
                        JSON.stringify(saidas, null, 2));
                } else if (filtro !== 'pendentes') {
                    var pastaEntradas = await pastaMes.getDirectoryHandle('Entradas', { create: true });
                    var pastaSaidas = await pastaMes.getDirectoryHandle('Saidas', { create: true });
                    await gravarTextoNaPasta(pastaEntradas, 'entradas-' + mesNum + '-' + ano + '.html',
                        htmlArquivoRelatorioMes(emp, 'ENTRADAS DO MÊS', mesAno, montEnt.html));
                    await gravarTextoNaPasta(pastaEntradas, 'entradas-' + mesNum + '-' + ano + '.json',
                        JSON.stringify(entradas, null, 2));
                    await gravarTextoNaPasta(pastaSaidas, 'saidas-' + mesNum + '-' + ano + '.html',
                        htmlArquivoRelatorioMes(emp, 'SAÍDAS DO MÊS', mesAno, montSai.html));
                    await gravarTextoNaPasta(pastaSaidas, 'saidas-' + mesNum + '-' + ano + '.json',
                        JSON.stringify(saidas, null, 2));
                } else {
                    var pastaPend = await pastaMes.getDirectoryHandle('Pendentes', { create: true });
                    await gravarTextoNaPasta(pastaPend, 'pendentes-' + mesNum + '-' + ano + '.html',
                        htmlArquivoRelatorioMes(emp, 'CONTAS A RECEBER', mesAno, montGeral.html));
                    await gravarTextoNaPasta(pastaPend, 'pendentes-' + mesNum + '-' + ano + '.json',
                        JSON.stringify(pendentes, null, 2));
                }

                await gravarTextoNaPasta(pastaMes, 'Relatorio-' + subTipo + '-' + mesNum + '-' + ano + '.html',
                    htmlArquivoRelatorioMes(emp, tituloRel, mesAno, montGeral.html));
                await gravarTextoNaPasta(pastaMes, 'resumo-' + mesNum + '-' + ano + '.json', JSON.stringify({
                    mesAno: mesAno,
                    mes: mesNome,
                    filtro: filtro,
                    geradoEm: new Date().toISOString(),
                    totais: {
                        entradas: montGeral.totEntradas,
                        saidas: montGeral.totSaidas,
                        pendentes: montGeral.totPendentes,
                        saldo: montGeral.saldo
                    },
                    qtd: { entradas: entradas.length, saidas: saidas.length, pendentes: pendentes.length },
                    pendentes: pendentes
                }, null, 2));

                var caminho = 'Caixa/' + subTipo + '/' + ano + '/' + nomePastaMes;
                toast('Mês ' + mesAno + ' arquivado em ' + caminho);
                alert(
                    'Pasta do mês criada com sucesso!\n\n' +
                    root.name + '/' + caminho + '/\n' +
                    (filtro === 'pendentes'
                        ? '  ├─ Pendentes/\n  └─ Relatorio-…html\n\nA receber: ' + moeda(montGeral.totPendentes)
                        : (filtro === 'despesas'
                            ? '  ├─ Despesas/\n  └─ Relatorio-…html\n\nDespesas: ' + moeda(montGeral.totSaidas)
                            : '  ├─ Entradas/\n  ├─ Saidas/\n  └─ Relatorio-…html\n\nEntradas: ' + moeda(montGeral.totEntradas) +
                              '\nSaídas: ' + moeda(montGeral.totSaidas) +
                              '\nSaldo: ' + moeda(montGeral.saldo)))
                );
            } catch (err) {
                console.error(err);
                toast('Falha ao gravar a pasta do mês no PC.');
            }
        }

        /* ---------- Pastas mensais — Despesas por OS (Modo Interno) ---------- */
        function listarOsDoMes(mesAno) {
            var main = carregarMain();
            var ocultas = obterOsOcultasDespesas();
            return (main.atendimentos || []).filter(function (a) {
                if (!a || !a.id) return false;
                if (ocultas[a.id] || ocultas[String(a.id)]) return false;
                return mesAnoDeIso(a.entrada || a.criadoEm) === mesAno;
            }).map(function (a) {
                var r = resumoLucroOs(a);
                var despesas = listarDespesasInternasPorOs(a.id);
                return {
                    id: a.id,
                    data: fmtData(a.entrada || a.criadoEm),
                    cliente: nomeAtendimento(main, a),
                    placa: (a.placa || '—').toUpperCase(),
                    carro: a.carro || '—',
                    status: a.status || '—',
                    bruto: r.bruto,
                    despesas: r.despesas,
                    lucro: r.lucro,
                    lancamentosDespesa: despesas.map(function (x) {
                        return {
                            data: fmtData(x.criadoEm),
                            descricao: x.descricao || '—',
                            forma: x.forma || '—',
                            valor: Number(x.valor) || 0
                        };
                    })
                };
            }).sort(function (a, b) {
                return String(b.data).split('/').reverse().join('').localeCompare(String(a.data).split('/').reverse().join(''));
            });
        }

        function montarArvoreDespesasOs() {
            var main = carregarMain();
            var arvore = {};
            (main.atendimentos || []).forEach(function (a) {
                var ma = mesAnoDeIso(a.entrada || a.criadoEm);
                if (!ma) return;
                var p = ma.split('/');
                var ano = p[1];
                var mesNum = p[0];
                var mesNome = MES_NOMES_CX[mesNum] || mesNum;
                if (!arvore[ano]) arvore[ano] = {};
                if (!arvore[ano][mesNome]) {
                    arvore[ano][mesNome] = { mesNum: mesNum, mesAno: ma, os: [] };
                }
                var r = resumoLucroOs(a);
                arvore[ano][mesNome].os.push({
                    id: a.id,
                    data: fmtData(a.entrada || a.criadoEm),
                    cliente: nomeAtendimento(main, a),
                    placa: (a.placa || '—').toUpperCase(),
                    carro: a.carro || '—',
                    status: a.status || '—',
                    bruto: r.bruto,
                    despesas: r.despesas,
                    lucro: r.lucro,
                    lancamentos: listarDespesasInternasPorOs(a.id)
                });
            });
            return arvore;
        }

        function htmlCorpoRelatorioDespesasOs(listaOs) {
            var totB = 0, totD = 0, totL = 0;
            var linhasOs = '';
            var linhasDesp = '';
            listaOs.forEach(function (o) {
                totB += o.bruto;
                totD += o.despesas;
                totL += o.lucro;
                linhasOs +=
                    '<tr>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.data) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.cliente) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.carro) + ' · ' + esc(o.placa) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#27ae60;font-weight:bold">' + moeda(o.bruto) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#e74c3c;font-weight:bold">' + moeda(o.despesas) + '</td>' +
                    '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#2980b9;font-weight:bold">' + moeda(o.lucro) + '</td>' +
                    '</tr>';
                (o.lancamentosDespesa || o.lancamentos || []).forEach(function (d) {
                    linhasDesp +=
                        '<tr>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.data || fmtData(d.criadoEm)) + '</td>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(o.placa) + '</td>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.descricao) + '</td>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd">' + esc(d.forma) + '</td>' +
                        '<td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;color:#e74c3c;font-weight:bold">' + moeda(d.valor) + '</td>' +
                        '</tr>';
                });
            });
            if (!linhasOs) linhasOs = '<tr><td colspan="6" style="padding:10px;text-align:center;color:#777">Nenhuma OS neste período.</td></tr>';
            if (!linhasDesp) linhasDesp = '<tr><td colspan="5" style="padding:10px;text-align:center;color:#777">Nenhuma despesa interna neste período.</td></tr>';

            return {
                html:
                    '<div class="resumo">' +
                    '<div class="resumo-box" style="color:#27ae60">BRUTO (OS)<b>' + moeda(totB) + '</b></div>' +
                    '<div class="resumo-box" style="color:#e74c3c">DESPESAS INTERNAS<b>' + moeda(totD) + '</b></div>' +
                    '<div class="resumo-box" style="color:#2980b9">LUCRO ESTIMADO<b>' + moeda(totL) + '</b></div>' +
                    '</div>' +
                    '<div class="section-title entrada"><span>BRUTO / ENTRADAS POR OS</span><span>TOTAL: ' + moeda(totB) + '</span></div>' +
                    '<table><thead><tr><th>Data</th><th>Cliente</th><th>Veículo / Placa</th><th style="text-align:right">Bruto</th><th style="text-align:right">Despesas</th><th style="text-align:right">Lucro</th></tr></thead>' +
                    '<tbody>' + linhasOs + '</tbody></table>' +
                    '<div class="section-title saida"><span>DESPESAS / SAÍDAS INTERNAS</span><span>TOTAL: ' + moeda(totD) + '</span></div>' +
                    '<table><thead><tr><th>Data</th><th>Placa</th><th>Descrição</th><th>Forma</th><th style="text-align:right">Valor</th></tr></thead>' +
                    '<tbody>' + linhasDesp + '</tbody></table>',
                totBruto: totB,
                totDespesas: totD,
                totLucro: totL
            };
        }

        function gerarRelatorioMensalDespesasOsPDF(mesAnoFixo) {
            var mesAno = mesAnoFixo || prompt('Digite o mês e ano do relatório de despesas por OS (Ex: 07/2026):', mesAnoAtualPadrao());
            if (!mesAno) return;
            mesAno = String(mesAno).trim();
            if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
                alert('Use o formato MM/AAAA (Ex: 07/2026).');
                return;
            }
            var lista = listarOsDoMes(mesAno);
            if (!lista.length) {
                alert('Nenhuma OS encontrada para o período: ' + mesAno);
                return;
            }
            var emp = getEmpresa(carregarMain());
            var montado = htmlCorpoRelatorioDespesasOs(lista);
            var html =
                '<div class="nota-espelho relatorio-mensal-print">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho">RELATÓRIO MENSAL — LUCRO POR OS (INTERNO)</div>' +
                    '<div class="nota-sub">Competência: ' + esc(mesAno) + ' · ' + esc(pastaMesLabel(mesAno)) + '</div>'
                ) +
                '<style>' +
                '.relatorio-mensal-print .resumo{display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px;background:#f4f4f4;padding:12px;border:1px solid #ccc;margin:12px 0}' +
                '.relatorio-mensal-print .resumo-box{text-align:center;font-size:11px}' +
                '.relatorio-mensal-print .resumo-box b{display:block;font-size:14px;margin-top:4px}' +
                '.relatorio-mensal-print .section-title{padding:8px 10px;font-size:11px;font-weight:bold;margin-top:18px;text-transform:uppercase;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;color:#fff}' +
                '.relatorio-mensal-print .section-title.entrada{background:#27ae60}' +
                '.relatorio-mensal-print .section-title.saida{background:#e74c3c}' +
                '.relatorio-mensal-print table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px}' +
                '.relatorio-mensal-print th{background:#ecf0f1;color:#111;padding:8px;text-align:left;font-size:10px;border-bottom:2px solid #bdc3c7}' +
                '</style>' +
                montado.html +
                '<div style="text-align:center;margin-top:24px;font-size:9px;color:#777">' +
                'Documento interno · Joninha Suspensões · ' + esc(new Date().toLocaleString('pt-BR')) +
                '</div></div>';
            executarImpressaoHtml(html);
        }

        function gerarArvorePastasDespesasOs() {
            var el = document.getElementById('arvorePastasDespesasOs');
            if (!el) return;
            var arvore = montarArvoreDespesasOs();
            var anos = Object.keys(arvore).sort().reverse();
            if (!anos.length) {
                el.innerHTML = '<div class="muted" style="padding:10px;text-align:center">Ainda não há OS oficiais para montar as pastas do mês.</div>';
                return;
            }
            var html = '';
            var idc = 0;
            anos.forEach(function (ano) {
                idc++;
                var idAno = 'pasta_dos_ano_' + idc;
                html += '<div class="pasta-cx-ano" onclick="togglePastaCaixa(\'' + idAno + '\')">📁 Ano: ' + esc(ano) + '</div>';
                html += '<div id="' + idAno + '" style="display:none">';
                Object.keys(arvore[ano]).forEach(function (mesNome) {
                    var bucket = arvore[ano][mesNome];
                    var totB = 0, totD = 0, totL = 0;
                    bucket.os.forEach(function (o) {
                        totB += o.bruto;
                        totD += o.despesas;
                        totL += o.lucro;
                    });
                    idc++;
                    var idMes = 'pasta_dos_mes_' + idc;
                    html += '<div class="pasta-cx-mes" onclick="togglePastaCaixa(\'' + idMes + '\')">📂 Mês: ' +
                        esc(mesNome) + ' <small style="font-weight:500;opacity:.85">(' + esc(bucket.mesAno) +
                        ' · ' + bucket.os.length + ' OS · lucro ' + moeda(totL) + ')</small></div>';
                    html += '<div class="pasta-cx-mes-acoes">' +
                        '<button type="button" class="btn btn-pdf" style="padding:6px 10px;font-size:12px" data-dos-rel="' +
                        esc(bucket.mesAno) + '">📄 Relatório geral</button>' +
                        '<button type="button" class="btn btn-secondary" style="padding:6px 10px;font-size:12px" data-dos-arquivar="' +
                        esc(bucket.mesAno) + '">📂 Arquivar no PC</button></div>';
                    html += '<div id="' + idMes + '" style="display:none">';

                    /* Bruto / Entradas */
                    idc++;
                    var idE = 'pasta_dos_e_' + idc;
                    html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idE + '\')">✅ Bruto / Entradas (' +
                        bucket.os.length + ' OS · ' + moeda(totB) + ')</div>';
                    html += '<div id="' + idE + '" class="pasta-cx-conteudo" style="display:none">';
                    if (!bucket.os.length) {
                        html += '<div class="muted">Nenhuma OS neste mês.</div>';
                    } else {
                        bucket.os.forEach(function (o) {
                            html += '<div class="pasta-cx-item">' +
                                '<span><strong>' + esc(o.data) + '</strong> · ' + esc(o.cliente) +
                                ' · ' + esc(o.placa) +
                                ' <button type="button" class="btn btn-primary" style="padding:3px 8px;font-size:11px;margin-left:8px" data-dos-abrir-pasta="' +
                                esc(o.id) + '">Despesas</button></span>' +
                                '<span class="val-ent">' + moeda(o.bruto) + '</span></div>';
                        });
                    }
                    html += '</div>';

                    /* Despesas / Saídas */
                    idc++;
                    var idS = 'pasta_dos_s_' + idc;
                    var qtdDesp = 0;
                    bucket.os.forEach(function (o) { qtdDesp += (o.lancamentos || []).length; });
                    html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idS + '\')">🔻 Despesas / Saídas (' +
                        qtdDesp + ' · ' + moeda(totD) + ')</div>';
                    html += '<div id="' + idS + '" class="pasta-cx-conteudo" style="display:none">';
                    if (!qtdDesp) {
                        html += '<div class="muted">Nenhuma despesa interna lançada neste mês.</div>';
                    } else {
                        bucket.os.forEach(function (o) {
                            (o.lancamentos || []).forEach(function (d) {
                                html += '<div class="pasta-cx-item">' +
                                    '<span><strong>[' + esc(o.placa) + ']</strong> ' + esc(fmtData(d.criadoEm)) +
                                    ' · ' + esc(d.descricao || '—') +
                                    ' <small class="muted">(' + esc(d.forma || '—') + ')</small></span>' +
                                    '<span class="val-sai">' + moeda(d.valor) + '</span></div>';
                            });
                        });
                    }
                    html += '</div>';

                    /* Relatório / Lucro */
                    idc++;
                    var idL = 'pasta_dos_l_' + idc;
                    html += '<div class="pasta-cx-tipo" onclick="togglePastaCaixa(\'' + idL + '\')">📊 Lucro / Relatório (' +
                        moeda(totL) + ')</div>';
                    html += '<div id="' + idL + '" class="pasta-cx-conteudo" style="display:none">' +
                        '<div class="pasta-cx-item"><span>Total bruto</span><span class="val-ent">' + moeda(totB) + '</span></div>' +
                        '<div class="pasta-cx-item"><span>Total despesas</span><span class="val-sai">' + moeda(totD) + '</span></div>' +
                        '<div class="pasta-cx-item"><span><strong>Lucro estimado do mês</strong></span><span class="val-ent"><strong>' +
                        moeda(totL) + '</strong></span></div></div>';

                    html += '</div>';
                });
                html += '</div>';
            });
            el.innerHTML = html;

            el.querySelectorAll('[data-dos-rel]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    gerarRelatorioMensalDespesasOsPDF(b.getAttribute('data-dos-rel'));
                });
            });
            el.querySelectorAll('[data-dos-arquivar]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    arquivarMesDespesasOsPastaPC(b.getAttribute('data-dos-arquivar'));
                });
            });
            el.querySelectorAll('[data-dos-abrir-pasta]').forEach(function (b) {
                b.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    abrirLancarDespesaOs(b.getAttribute('data-dos-abrir-pasta'));
                });
            });
        }

        async function arquivarMesDespesasOsPastaPC(mesAnoFixo) {
            if (!('showDirectoryPicker' in window)) {
                toast('Arquivar na pasta do PC só funciona no Chrome/Edge no computador.');
                return;
            }
            var mesAno = mesAnoFixo || prompt('Qual mês de despesas por OS arquivar? (Ex: 07/2026)', mesAnoAtualPadrao());
            if (!mesAno) return;
            mesAno = String(mesAno).trim();
            if (!/^\d{2}\/\d{4}$/.test(mesAno)) {
                alert('Use o formato MM/AAAA (Ex: 07/2026).');
                return;
            }
            var root = await carregarHandlePastaRaiz();
            if (!root) {
                toast('Configure a pasta do PC em Config primeiro.');
                return;
            }
            if (!(await solicitarPermissaoPasta(root))) {
                toast('Sem permissão na pasta do PC.');
                return;
            }

            var lista = listarOsDoMes(mesAno);
            if (!lista.length) {
                alert('Nenhuma OS para arquivar em ' + mesAno);
                return;
            }
            var emp = getEmpresa(carregarMain());
            var montado = htmlCorpoRelatorioDespesasOs(lista);
            var entradas = lista.map(function (o) {
                return { data: o.data, cliente: o.cliente, placa: o.placa, carro: o.carro, bruto: o.bruto, status: o.status };
            });
            var saidas = [];
            lista.forEach(function (o) {
                (o.lancamentosDespesa || []).forEach(function (d) {
                    saidas.push({
                        data: d.data,
                        placa: o.placa,
                        cliente: o.cliente,
                        descricao: d.descricao,
                        forma: d.forma,
                        valor: d.valor
                    });
                });
            });

            var partes = mesAno.split('/');
            var ano = partes[1];
            var mesNum = partes[0];
            var mesNome = MES_NOMES_CX[mesNum] || mesNum;
            var nomePastaMes = mesNum + '-' + slugPasta(mesNome);

            var htmlEntradas =
                '<div class="resumo"><div class="resumo-box" style="color:#27ae60">BRUTO TOTAL<b>' + moeda(montado.totBruto) + '</b></div></div>' +
                '<table><thead><tr><th>Data</th><th>Cliente</th><th>Veículo / Placa</th><th style="text-align:right">Bruto</th></tr></thead><tbody>' +
                entradas.map(function (o) {
                    return '<tr><td>' + esc(o.data) + '</td><td>' + esc(o.cliente) + '</td><td>' +
                        esc(o.carro) + ' · ' + esc(o.placa) + '</td><td style="text-align:right;color:#27ae60;font-weight:bold">' +
                        moeda(o.bruto) + '</td></tr>';
                }).join('') + '</tbody></table>';

            var htmlSaidas =
                '<div class="resumo"><div class="resumo-box" style="color:#e74c3c">DESPESAS TOTAL<b>' + moeda(montado.totDespesas) + '</b></div></div>' +
                '<table><thead><tr><th>Data</th><th>Placa</th><th>Descrição</th><th>Forma</th><th style="text-align:right">Valor</th></tr></thead><tbody>' +
                (saidas.length ? saidas.map(function (d) {
                    return '<tr><td>' + esc(d.data) + '</td><td>' + esc(d.placa) + '</td><td>' + esc(d.descricao) +
                        '</td><td>' + esc(d.forma) + '</td><td style="text-align:right;color:#e74c3c;font-weight:bold">' +
                        moeda(d.valor) + '</td></tr>';
                }).join('') : '<tr><td colspan="5" style="text-align:center;color:#777;padding:10px">Sem despesas neste mês.</td></tr>') +
                '</tbody></table>';

            try {
                var pastaRaizDos = await root.getDirectoryHandle('Despesas-OS', { create: true });
                var pastaAno = await pastaRaizDos.getDirectoryHandle(ano, { create: true });
                var pastaMes = await pastaAno.getDirectoryHandle(nomePastaMes, { create: true });
                var pastaEntradas = await pastaMes.getDirectoryHandle('Entradas', { create: true });
                var pastaSaidas = await pastaMes.getDirectoryHandle('Saidas', { create: true });

                await gravarTextoNaPasta(pastaEntradas, 'bruto-os-' + mesNum + '-' + ano + '.html',
                    htmlArquivoRelatorioMes(emp, 'BRUTO / ENTRADAS POR OS', mesAno, htmlEntradas));
                await gravarTextoNaPasta(pastaEntradas, 'bruto-os-' + mesNum + '-' + ano + '.json',
                    JSON.stringify(entradas, null, 2));

                await gravarTextoNaPasta(pastaSaidas, 'despesas-' + mesNum + '-' + ano + '.html',
                    htmlArquivoRelatorioMes(emp, 'DESPESAS / SAÍDAS INTERNAS', mesAno, htmlSaidas));
                await gravarTextoNaPasta(pastaSaidas, 'despesas-' + mesNum + '-' + ano + '.json',
                    JSON.stringify(saidas, null, 2));

                await gravarTextoNaPasta(pastaMes, 'Relatorio-Geral-Lucro-OS-' + mesNum + '-' + ano + '.html',
                    htmlArquivoRelatorioMes(emp, 'RELATÓRIO MENSAL — LUCRO POR OS (INTERNO)', mesAno, montado.html));
                await gravarTextoNaPasta(pastaMes, 'resumo-lucro-os-' + mesNum + '-' + ano + '.json', JSON.stringify({
                    mesAno: mesAno,
                    mes: mesNome,
                    geradoEm: new Date().toISOString(),
                    totais: {
                        bruto: montado.totBruto,
                        despesas: montado.totDespesas,
                        lucro: montado.totLucro
                    },
                    qtdOs: lista.length,
                    os: lista
                }, null, 2));

                toast('Mês ' + mesAno + ' arquivado em Despesas-OS/' + ano + '/' + nomePastaMes);
                alert(
                    'Pasta de despesas por OS criada!\n\n' +
                    root.name + '/Despesas-OS/' + ano + '/' + nomePastaMes + '/\n' +
                    '  ├─ Entradas/  (bruto das OS)\n' +
                    '  ├─ Saidas/    (despesas internas)\n' +
                    '  └─ Relatorio-Geral-Lucro-OS-…html\n\n' +
                    'Bruto: ' + moeda(montado.totBruto) +
                    '\nDespesas: ' + moeda(montado.totDespesas) +
                    '\nLucro: ' + moeda(montado.totLucro)
                );
            } catch (err) {
                console.error(err);
                toast('Falha ao gravar a pasta de despesas por OS no PC.');
            }
        }

        function renderRelatorioCaixa() {
            var db = carregar();
            var cfg = getCaixaConfig(db);
            var balEnt = somarLista(db.caixa, 'entrada');
            var balSai = somarLista(db.caixa, 'saida');
            var banEnt = somarLista(db.caixaBanco, 'entrada');
            var banSai = somarLista(db.caixaBanco, 'saida');
            var pend = (db.pendentes || []).reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
            var salBal = (Number(cfg.inicialBalcao) || 0) + balEnt - balSai;
            var salBan = (Number(cfg.inicialBanco) || 0) + banEnt - banSai;
            document.getElementById('relCxBalcao').textContent = moeda(salBal);
            document.getElementById('relCxBanco').textContent = moeda(salBan);
            document.getElementById('relCxPend').textContent = moeda(pend);
            document.getElementById('relCxGeral').textContent = moeda(salBal + salBan);

            var mapa = {};
            function acum(origem, item) {
                var k = origem + '|' + (item.forma || '—') + '|' + (item.tipo || '—');
                if (!mapa[k]) mapa[k] = { origem: origem, forma: item.forma || '—', tipo: item.tipo || '—', qtd: 0, total: 0 };
                mapa[k].qtd++;
                mapa[k].total += Number(item.valor) || 0;
            }
            (db.caixa || []).forEach(function (x) { acum('Balcão', x); });
            (db.caixaBanco || []).forEach(function (x) { acum('Banco', x); });

            var tb = document.getElementById('tabelaRelCx');
            var rows = Object.keys(mapa).map(function (k) { return mapa[k]; });
            tb.innerHTML = '';
            if (!rows.length) {
                tb.innerHTML = '<tr><td colspan="5" class="muted">Sem movimentações para resumir.</td></tr>';
            } else {
                rows.sort(function (a, b) { return a.origem.localeCompare(b.origem) || a.forma.localeCompare(b.forma); });
                rows.forEach(function (r) {
                    var tr = document.createElement('tr');
                    tr.innerHTML =
                        '<td>' + esc(r.origem) + '</td>' +
                        '<td>' + esc(r.forma) + '</td>' +
                        '<td>' + esc(r.tipo) + '</td>' +
                        '<td>' + r.qtd + '</td>' +
                        '<td>' + moeda(r.total) + '</td>';
                    tb.appendChild(tr);
                });
            }

            /* No modo interno: resumo de lucro por OS (despesas vinculadas) */
            var boxRel = document.getElementById('relCxConteudo');
            var oldLucro = document.getElementById('relLucroOsBox');
            if (oldLucro) oldLucro.remove();
            if (canalVendas === 'interno') {
                var main = carregarMain();
                var linhasLucro = [];
                var totBruto = 0, totDesp = 0;
                (main.atendimentos || []).forEach(function (a) {
                    var r = resumoLucroOs(a);
                    if (r.despesas <= 0 && r.bruto <= 0) return;
                    if (r.despesas <= 0) return; /* só OS com despesa interna */
                    totBruto += r.bruto;
                    totDesp += r.despesas;
                    linhasLucro.push({
                        data: fmtData(a.entrada || a.criadoEm),
                        cliente: nomeAtendimento(main, a),
                        placa: (a.placa || '—').toUpperCase(),
                        bruto: r.bruto,
                        despesas: r.despesas,
                        lucro: r.lucro
                    });
                });
                var wrap = document.createElement('div');
                wrap.id = 'relLucroOsBox';
                wrap.style.marginTop = '18px';
                if (!linhasLucro.length) {
                    wrap.innerHTML = '<h2>Lucro por OS (despesas internas)</h2><p class="muted">Nenhuma despesa vinculada a OS ainda.</p>';
                } else {
                    wrap.innerHTML =
                        '<h2>Lucro por OS (despesas internas)</h2>' +
                        '<p class="hint">Bruto das OS oficiais − saídas do caixa interno vinculadas. Total despesas: <strong>' +
                        moeda(totDesp) + '</strong> · Lucro: <strong>' + moeda(totBruto - totDesp) + '</strong></p>' +
                        '<table><thead><tr><th>Data</th><th>Cliente</th><th>Placa</th><th>Bruto</th><th>Despesas</th><th>Lucro</th></tr></thead>' +
                        '<tbody>' +
                        linhasLucro.map(function (r) {
                            return '<tr><td>' + esc(r.data) + '</td><td>' + esc(r.cliente) + '</td><td>' +
                                esc(r.placa) + '</td><td>' + moeda(r.bruto) + '</td><td>' +
                                moeda(r.despesas) + '</td><td><strong>' + moeda(r.lucro) + '</strong></td></tr>';
                        }).join('') +
                        '</tbody></table>';
                }
                boxRel.appendChild(wrap);
            }

            gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
        }

        document.getElementById('btnAtualizarRelCx').addEventListener('click', function () {
            renderRelatorioCaixa();
            toast('Relatório atualizado.');
        });
        document.getElementById('btnImprimirRelCx').addEventListener('click', function () {
            renderRelatorioCaixa();
            var db = carregar();
            var emp = getEmpresa(db);
            executarImpressaoHtml(
                '<div class="nota-espelho">' +
                htmlCabecalhoNotaEmpresa(emp,
                    '<div class="nota-sub nota-titulo-espelho">Relatório de Caixa · ' + esc(fmtData(hojeISO())) + '</div>'
                ) +
                document.getElementById('relCxConteudo').innerHTML +
                '<div style="margin-top:12px">Balcão: <strong>' + document.getElementById('relCxBalcao').textContent +
                '</strong> · Banco: <strong>' + document.getElementById('relCxBanco').textContent +
                '</strong> · Pendentes: <strong>' + document.getElementById('relCxPend').textContent +
                '</strong> · Geral: <strong>' + document.getElementById('relCxGeral').textContent + '</strong></div></div>'
            );
        });

        document.querySelectorAll('[data-rel-mes]').forEach(function (b) {
            if (b.hasAttribute('data-rel-mes-fixo')) return;
            b.addEventListener('click', function () {
                gerarRelatorioMensalPDF(b.getAttribute('data-rel-mes') || 'geral');
            });
        });
        document.getElementById('btnAtualizarPastasCx').addEventListener('click', function () {
            gerarArvorePastasCaixa({ elId: 'arvorePastasCaixa', filtro: 'geral', idPrefix: 'pasta_cx' });
            toast('Pastas atualizadas.');
        });
        document.getElementById('btnArquivarMesPc').addEventListener('click', function () {
            arquivarMesPastaPC(null, 'geral');
        });

        document.getElementById('btnAtualizarPastasDespesas').addEventListener('click', function () {
            renderRelatorioDespesas();
            toast('Pastas de despesas atualizadas.');
        });
        document.getElementById('btnRelMesDespesas').addEventListener('click', function () {
            gerarRelatorioMensalPDF('despesas');
        });
        document.getElementById('btnArquivarMesDespesas').addEventListener('click', function () {
            arquivarMesPastaPC(null, 'despesas');
        });

        document.getElementById('btnAtualizarPastasBanco').addEventListener('click', function () {
            gerarArvorePastasCaixa({ elId: 'arvorePastasBanco', filtro: 'banco', idPrefix: 'pasta_ban' });
            toast('Pastas do banco atualizadas.');
        });
        document.getElementById('btnRelMesBanco').addEventListener('click', function () {
            gerarRelatorioMensalPDF('banco');
        });
        document.getElementById('btnArquivarMesBanco').addEventListener('click', function () {
            arquivarMesPastaPC(null, 'banco');
        });

        document.getElementById('btnAtualizarPastasPend').addEventListener('click', function () {
            gerarArvorePastasCaixa({ elId: 'arvorePastasPendentes', filtro: 'pendentes', idPrefix: 'pasta_pen' });
            toast('Pastas a receber atualizadas.');
        });
        document.getElementById('btnRelMesPend').addEventListener('click', function () {
            gerarRelatorioMensalPDF('pendentes');
        });
        document.getElementById('btnArquivarMesPend').addEventListener('click', function () {
            arquivarMesPastaPC(null, 'pendentes');
        });

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

        function listarComissoes(filtroFuncId, mesYYYYMM) {
            var db = carregar();
            var funcsMap = {};
            try {
                comCanalInterno(function () {
                    (carregar().funcionarios || []).forEach(function (f) { funcsMap[f.id] = f; });
                });
            } catch (e) {
                try {
                    var raw = localStorage.getItem(STORAGE_INTERNO);
                    var int = raw ? JSON.parse(raw) : {};
                    (int.funcionarios || []).forEach(function (f) { funcsMap[f.id] = f; });
                } catch (e2) {}
            }
            var out = [];
            (db.atendimentos || []).forEach(function (a) {
                var d = dataAtendimentoISO(a);
                if (mesYYYYMM && d.slice(0, 7) !== mesYYYYMM) return;
                (a.itens || []).forEach(function (it) {
                    if ((it.tipo || '') !== 'mao') return;
                    var fid = it.funcionarioId || '';
                    if (!fid) return;
                    if (filtroFuncId && fid !== filtroFuncId) return;
                    var f = funcsMap[fid] || {};
                    var tipoMao = it.tipoMao || 'servico';
                    var pct = it.comissaoPct != null ? Number(it.comissaoPct) : pctComissaoPorTipo(f, tipoMao);
                    if (isNaN(pct)) pct = 0;
                    var base = Number(it.valor) || 0;
                    var valor = it.comissaoValor != null && !isNaN(Number(it.comissaoValor))
                        ? +(Number(it.comissaoValor)).toFixed(2)
                        : +(base * pct / 100).toFixed(2);
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

        function fecharCaixaDoDia() {
            var db = carregar();
            var hoje = hojeISO();
            var cfg = db.caixaConfig || { inicialBalcao: 0, inicialBanco: 0 };
            var ent = 0, sai = 0;
            (db.caixa || []).forEach(function (l) {
                if (String(l.criadoEm || '').slice(0, 10) !== hoje) return;
                if (l.tipo === 'entrada') ent += Number(l.valor) || 0;
                if (l.tipo === 'saida') sai += Number(l.valor) || 0;
            });
            var inicial = Number(cfg.inicialBalcao) || 0;
            var saldo = inicial + ent - sai;
            var of = calcularRelatorioOficina({ inicio: hoje, fim: hoje, label: hoje });
            if (!confirm(
                'Fechar o caixa do dia ' + fmtData(hoje) + '?\n\n' +
                'Inicial: ' + moeda(inicial) + '\nEntradas: ' + moeda(ent) + '\nSaídas: ' + moeda(sai) + '\nSaldo: ' + moeda(saldo) + '\n\n' +
                'Oficina — ganho peças: ' + moeda(of.ganho) + ' · MO: ' + moeda(of.mao)
            )) return;
            if (!db.fechamentosCaixa) db.fechamentosCaixa = [];
            db.fechamentosCaixa.push({
                id: uid(),
                data: hoje,
                inicialBalcao: inicial,
                entradas: ent,
                saidas: sai,
                saldo: saldo,
                pecasBruto: of.pecas,
                ganhoPecas: of.ganho,
                maoObra: of.mao,
                despesas: of.despesas,
                resultado: of.resultado,
                criadoEm: new Date().toISOString()
            });
            salvar(db);
            toast('Caixa do dia fechado e salvo no histórico.');
            imprimirFechamentoDia(db.fechamentosCaixa[db.fechamentosCaixa.length - 1]);
        }

        function imprimirFechamentoDia(f) {
            var emp = getEmpresa();
            var html = '<html><head><title>Fechamento ' + esc(f.data) + '</title><style>body{font-family:Segoe UI,sans-serif;padding:24px} h1{margin:0 0 8px} .l{margin:6px 0}</style></head><body>';
            html += '<h1>' + esc(emp.nome || 'Joninha Suspensões') + '</h1>';
            html += '<h2>Fechamento de caixa — ' + esc(fmtData(f.data)) + '</h2>';
            html += '<div class="l">Caixa inicial: <b>' + moeda(f.inicialBalcao) + '</b></div>';
            html += '<div class="l">Entradas: <b>' + moeda(f.entradas) + '</b></div>';
            html += '<div class="l">Saídas: <b>' + moeda(f.saidas) + '</b></div>';
            html += '<div class="l">Saldo final: <b>' + moeda(f.saldo) + '</b></div><hr>';
            html += '<div class="l">Peças (venda): <b>' + moeda(f.pecasBruto) + '</b></div>';
            html += '<div class="l">Ganho em peças: <b>' + moeda(f.ganhoPecas) + '</b></div>';
            html += '<div class="l">Mão de obra: <b>' + moeda(f.maoObra) + '</b></div>';
            html += '<div class="l">Despesas: <b>' + moeda(f.despesas) + '</b></div>';
            html += '<div class="l">Resultado estimado: <b>' + moeda(f.resultado) + '</b></div>';
            html += '<p style="margin-top:18px;color:#666;font-size:12px">Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + '</p></body></html>';
            var w = window.open('', '_blank');
            if (!w) return;
            w.document.write(html);
            w.document.close();
            setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
        }

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

        async function enviarLoginsFuncNuvem() {
            var cfg = carregarConfigNuvem();
            if (!cfg || !cfg.apiKey || !cfg.projectId) {
                return { ok: false, erro: 'Nuvem sem configuração Firebase.' };
            }
            var pack = await payloadLoginsFuncNuvem();
            if (!(pack.funcionarios || []).length) {
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
                    await s2.fsMod.setDoc(
                        s2.fsMod.doc(s2.dbFs, 'joninha_suspensoes_base', 'principal'),
                        { funcionarios: listarFuncionariosInterno().map(function (f) {
                            return {
                                id: f.id,
                                nome: f.nome,
                                ativo: f.ativo !== false,
                                loginUsuario: f.loginUsuario || '',
                                loginSenhaHash: f.loginSenhaHash || '',
                                atualizadoEm: f.atualizadoEm || null
                            };
                        }), atualizadoEm: pack.atualizadoEm },
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

        function forcarAplicarFuncionariosNuvem(remotos) {
            if (!Array.isArray(remotos) || !remotos.length) return [];
            var lista = listarFuncionariosInterno();
            var byId = {};
            lista.forEach(function (f) {
                if (f && f.id) byId[f.id] = Object.assign({}, f);
            });
            remotos.forEach(function (r) {
                if (!r || !r.id) return;
                var cur = byId[r.id] || { id: r.id, criadoEm: r.atualizadoEm || new Date().toISOString() };
                var u = normalizarLoginFunc(r.loginUsuario);
                byId[r.id] = Object.assign({}, cur, {
                    id: r.id,
                    nome: r.nome || cur.nome || u || 'Funcionário',
                    ativo: r.ativo !== false,
                    loginUsuario: u || cur.loginUsuario || '',
                    loginSenhaHash: r.loginSenhaHash || cur.loginSenhaHash || '',
                    atualizadoEm: r.atualizadoEm || new Date().toISOString()
                });
                /* Nuvem não manda senha em texto — preserva local se existir */
                if (r.loginSenha && !byId[r.id].loginSenha) {
                    byId[r.id].loginSenha = normalizarSenhaFunc(r.loginSenha);
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
    })();
