'use strict';
/* Joninha — config + estado compartilhado (etapa 2.2) */

var APP_VERSION = '1.3.80';

function rotuloBuildApp() {
    var v = String(APP_VERSION || '');
    var m = v.match(/^(\d+(?:\.\d+)*)/);
    return m ? m[1] : v;
}

function textoBuildApp() {
    return 'Build ' + rotuloBuildApp();
}

function produtoEhServico(p) {
    if (!p) return false;
    if (String(p.tipo || '').toLowerCase() === 'servico') return true;
    return String(p.unidade || '') === 'serv';
}

function codigoPecaDe(p) {
    return String((p && (p.codigoPeca || p.codPeca)) || '').trim();
}

function textoMaiusculoCadastro(s) {
    return String(s == null ? '' : s).toLocaleUpperCase('pt-BR');
}

function textoMaiusculoSalvar(s) {
    return textoMaiusculoCadastro(s).replace(/\s+/g, ' ').trim();
}

function descricaoPecaDe(pOuItem) {
    if (!pOuItem) return '';
    return String(pOuItem.aplicacao || pOuItem.descricao || '').trim();
}

function rotuloLinhaPeca(it) {
    if (!it) return '';
    var d = String(it.desc || it.nome || '').trim();
    var a = descricaoPecaDe(it);
    if (!a) return d;
    if (!d) return a;
    var dU = textoMaiusculoCadastro(d);
    var aU = textoMaiusculoCadastro(a);
    if (dU.indexOf(aU) >= 0) return d;
    return d + ' — ' + a;
}

function rotuloUnidade(un) {
    if (String(un || '') === 'serv') return 'serviço';
    return un || 'un';
}

function dataISODia(ymd) {
    var d = String(ymd || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

function isoComDataLocal(ymd) {
    var d = dataISODia(ymd);
    if (!d) return new Date().toISOString();
    return d + 'T12:00:00.000';
}

function fmtNumOs(n) {
    var v = Number(n);
    if (isNaN(v)) return '';
    return String(v.toFixed(2)).replace('.', ',');
}
var STORAGE_KEY = 'joninha_suspensoes_v1';
var STORAGE_INTERNO = 'joninha_suspensoes_interno_v1';
var STORAGE_LOGINS_FUNC = 'joninha_suspensoes_logins_func_v1';
/* Coleção própria (NÃO usar joninha_assinaturas). Celular lê sem login admin. */
var COL_LOGINS_FUNC_NUVEM = 'joninha_logins_func';
var DOC_LOGINS_FUNC_NUVEM = 'acessos';
var SENHA_FUNC_SALT = 'joninha_suspensoes_v1_salt';
var ASSIN_KEY = 'joninha_suspensoes_assinaturas';
var COL_ASSINATURAS_NUVEM = 'joninha_assinaturas';
var atendimentoNotaAtual = null;
var canalVendas = 'normal'; /* normal | interno */

var TITULOS = {
    painelInicio: ['Painel', 'OS e venda pagas entram no caixa · peça avulsa sem abrir OS'],
    painelClientes: ['Cadastrar Cliente', 'Base de clientes Joninha Suspensões'],
    painelListaClientes: ['Clientes Cadastrados', 'Lista e edição rápida'],
    painelVeiculo: ['Ordem de Serviço / Veículo', 'Atendimento com veículo, serviços e valores'],
    painelHistorico: ['Histórico da oficina', 'OS e vendas no mesmo lugar — busque pelo cliente'],
    painelProdutos: ['Cadastro de Produtos', 'Estoque da oficina'],
    painelOrcamento: ['Venda da oficina', 'Peça avulsa sem abrir OS · PAGO entra em Entradas (pagas)'],
    painelCaixa: ['Caixa / Balcão', 'Fecha o saldo da tela e zera · o mês fica no relatório'],
    painelCaixaBanco: ['Caixa do Banco', 'PIX · cartões · fecha e zera junto com o balcão'],
    painelPendentes: ['Contas a Receber', 'Valores em aberto'],
    painelRelatorioCaixa: ['Relatório Caixa', 'Mês completo · fechamentos · PDF'],
    painelFuncionarios: ['Cadastro de Funcionários', 'Comissão % · PIN · modo interno'],
    painelListaFuncionarios: ['Funcionários Cadastrados', 'Ver · editar · excluir'],
    painelPagFuncionarios: ['Pagamento funcionários', 'Controle semanal interno · sem impressão'],
    painelRelatorioOficina: ['Relatório Oficina', 'Lucro da casa · peças · MO · comissão · mês'],
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

/* Larguras CSS (px lógicos) de celulares reais — o layout usa estes tamanhos */
var TELAS_CELULAR = [
    { id: 'iphone-se1', marca: 'Apple', nome: 'iPhone SE 1 / 5s', cssW: 320, cssH: 568 },
    { id: 'android-compacto-320', marca: 'Android', nome: 'Android compacto', cssW: 320, cssH: 640 },
    { id: 'android-360', marca: 'Android', nome: 'Galaxy A / Xiaomi / Moto', cssW: 360, cssH: 800 },
    { id: 'iphone-se2', marca: 'Apple', nome: 'iPhone SE 2/3 / 8', cssW: 375, cssH: 667 },
    { id: 'iphone-mini', marca: 'Apple', nome: 'iPhone 12/13 mini', cssW: 375, cssH: 812 },
    { id: 'android-384', marca: 'Android', nome: 'Pixel compacto', cssW: 384, cssH: 832 },
    { id: 'iphone-12', marca: 'Apple', nome: 'iPhone 12/13/14', cssW: 390, cssH: 844 },
    { id: 'iphone-14-pro', marca: 'Apple', nome: 'iPhone 14/15 Pro', cssW: 393, cssH: 852 },
    { id: 'iphone-16', marca: 'Apple', nome: 'iPhone 16', cssW: 393, cssH: 852 },
    { id: 'iphone-16-pro', marca: 'Apple', nome: 'iPhone 16 Pro', cssW: 402, cssH: 874 },
    { id: 'android-412', marca: 'Android', nome: 'Pixel / Galaxy S', cssW: 412, cssH: 915 },
    { id: 'iphone-xr', marca: 'Apple', nome: 'iPhone XR / 11', cssW: 414, cssH: 896 },
    { id: 'iphone-promax-12', marca: 'Apple', nome: 'iPhone 12/13 Pro Max', cssW: 428, cssH: 926 },
    { id: 'iphone-15-plus', marca: 'Apple', nome: 'iPhone 14/15 Plus / Pro Max', cssW: 430, cssH: 932 },
    { id: 'iphone-16-promax', marca: 'Apple', nome: 'iPhone 16 Pro Max', cssW: 440, cssH: 956 },
    { id: 'pixel-pro', marca: 'Android', nome: 'Pixel Pro', cssW: 448, cssH: 998 },
    { id: 'android-480', marca: 'Android', nome: 'Android grande', cssW: 480, cssH: 960 },
    { id: 'phablet-540', marca: 'Android', nome: 'Phablet', cssW: 540, cssH: 960 },
    { id: 'android-600', marca: 'Android', nome: 'Android landscape / tablet pequeno', cssW: 600, cssH: 960 }
];
