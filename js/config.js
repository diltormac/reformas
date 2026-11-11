// SENHA PARA EXIBIR O FATURAMENTO
export const SENHA_FATURAMENTO = "admin123";

export const supabaseUrl = "https://kiiswukzwwoznkgjyaod.supabase.co";
export const supabaseKey = "sb_publishable_WPRvraB-40Fz1RuKbd5bRg_3tGvyAxg";

// Se a biblioteca do Supabase não carregou (PC sem internet ao abrir o app),
// o cliente fica null e a interface mostra um aviso em vez de travar inteira.
export const supabaseClient = window.supabase
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;

// CATÁLOGO DE SERVIÇOS (Salvo no localStorage para funcionar 100% offline)
export const servicosIniciaisPadrao = [
  { nome: "ALINHAMENTO", valor: 50.0 },
  { nome: "BALANCEAMENTO", valor: 25.0 },
  { nome: "MONTAGEM DE PNEU", valor: 30.0 },
  { nome: "CONSERTO DE RODA", valor: 150.0 },
  { nome: "SOLDA", valor: 80.0 },
  { nome: "MECANICA", valor: 100.0 },
  { nome: "SUSPENSAO", valor: 120.0 },
];

export const statusClass = {
  Pendente: "badge-pendente",
  "Em andamento": "badge-andamento",
  Concluído: "badge-concluido",
  Cancelado: "badge-cancelado",
};
