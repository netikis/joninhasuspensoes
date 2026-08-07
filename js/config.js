'use strict';
/* Joninha — config + estado compartilhado (etapa 2.2) */

var APP_VERSION = '1.2.10-split-ui';
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
