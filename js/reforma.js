// os_painel/js/reforma.js

// CONEXÃO DIRETA (Mantém a lógica original intacta)
const supabaseUrl = "https://kiiswukzwwoznkgjyaod.supabase.co";
const supabaseKey = "sb_publishable_WPRvraB-40Fz1RuKbd5bRg_3tGvyAxg";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variáveis de estado
let todasReformas = [];
let galeriaFotosAtual = [];
let indexFotoAtual = 0;

const inputBusca = document.getElementById("inputBusca");
const listaContainer = document.getElementById("listaReformas");

// =========================================================
// BUSCAR DADOS DO BANCO
// =========================================================
async function carregarReformas() {
  try {
    const { data, error } = await supabaseClient
      .from("ordens_servico")
      .select("id, numero_os, nome, cor, status, fotos_urls, created_at")
      .ilike("servico", "%REFORMA%")
      .order("created_at", { ascending: false });

    if (error) throw error;

    todasReformas = data || [];
    atualizarEstatisticas();
    renderizarLista();
  } catch (error) {
    console.error("Erro ao carregar reformas:", error);
    listaContainer.innerHTML = `
      <div class="col-span-full py-12 text-center text-red-400 bg-red-950/30 rounded-2xl border border-red-500/20 shadow-xl p-6">
        <i class="fa-solid fa-triangle-exclamation text-3xl mb-3 text-red-400"></i>
        <p class="font-bold text-base text-red-300">Erro ao carregar as reformas</p>
        <p class="text-xs text-red-400/80 mt-1">${error.message}</p>
      </div>`;
  }
}

// =========================================================
// ATUALIZAR ESTATÍSTICAS
// =========================================================
function atualizarEstatisticas() {
  const total = todasReformas.length;
  const pendente = todasReformas.filter((o) => o.status === "Pendente").length;
  const andamento = todasReformas.filter(
    (o) => o.status === "Em andamento",
  ).length;
  const concluido = todasReformas.filter(
    (o) => o.status === "Concluído",
  ).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statPendente").textContent = pendente;
  document.getElementById("statAndamento").textContent = andamento;
  document.getElementById("statConcluido").textContent = concluido;
}

// =========================================================
// RENDERIZAR A LISTA
// =========================================================
function renderizarLista() {
  const termo = inputBusca.value.trim().toLowerCase();

  const filtradas = todasReformas.filter((os) => {
    if (!termo) return true;
    const texto =
      `${os.numero_os || ""} ${os.nome || ""} ${os.cor || ""}`.toLowerCase();
    return texto.includes(termo);
  });

  if (filtradas.length === 0) {
    listaContainer.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500 bg-darkcard/40 rounded-2xl border border-darkborder shadow-xl">
        <i class="fa-solid fa-box-open text-4xl mb-3 text-slate-600"></i>
        <p class="font-bold text-slate-400 text-sm">Nenhuma reforma encontrada</p>
      </div>`;
    return;
  }

  listaContainer.innerHTML = filtradas
    .map((os) => {
      // Define a cor da etiqueta baseada no status com visual moderno
      let bgStatus =
        "bg-amber-500/10 text-amber-400 border border-amber-500/20"; // Pendente
      if (os.status === "Em andamento")
        bgStatus = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      if (os.status === "Concluído")
        bgStatus =
          "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      if (os.status === "Cancelado")
        bgStatus = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

      const fotoUrl =
        os.fotos_urls && os.fotos_urls.length > 0 ? os.fotos_urls[0] : null;

      // Prepara a string com as fotos para o modal
      const fotosString = JSON.stringify(os.fotos_urls || []).replace(
        /"/g,
        "&quot;",
      );

      return `
        <div class="bg-darkcard/60 backdrop-blur-md rounded-2xl border border-darkborder shadow-xl p-6 flex flex-col justify-between hover:border-slate-700 transition duration-300">
          <div>
            <!-- Cabeçalho do Card (Nº OS Gigante) -->
            <div class="flex justify-between items-start mb-4 gap-3">
              <div class="min-w-0 flex-1">
                <!-- NÚMERO DA OS GRANDE -->
                <p class="text-4xl sm:text-5xl font-extrabold text-indigo-400 tracking-tight leading-none mb-2">
                  ${os.numero_os || "S/N"}
                </p>
                <!-- Nome do Cliente -->
                <p class="text-sm font-semibold text-slate-300 truncate" title="${os.nome || "Sem nome"}">
                  ${os.nome || "Sem nome"}
                </p>
              </div>
              <!-- Badge de Status -->
              <span class="text-[11px] font-bold px-3 py-1.5 rounded-xl flex-shrink-0 ${bgStatus} shadow-sm">
                ${os.status || "Pendente"}
              </span>
            </div>

            <!-- Foto -->
            ${
              fotoUrl
                ? `<div class="w-full h-56 bg-slate-900/60 rounded-xl overflow-hidden mb-4 border border-darkborder cursor-pointer group relative shadow-inner"
                       onclick="abrirLightbox('${fotosString}', 0)">
                     <img src="${fotoUrl}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" alt="Foto da Roda">
                     <div class="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/40 transition-all duration-300 flex items-center justify-center">
                       <div class="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                         <i class="fa-solid fa-magnifying-glass-plus text-base"></i>
                       </div>
                     </div>
                   </div>`
                : `<div class="w-full h-56 bg-slate-900/40 border border-dashed border-darkborder rounded-xl flex flex-col items-center justify-center text-slate-500 mb-4">
                     <i class="fa-solid fa-image text-3xl mb-2 text-slate-600"></i>
                     <span class="text-[11px] font-semibold uppercase tracking-wider">Sem foto</span>
                   </div>`
            }

            <!-- Informações -->
            <div class="space-y-2 text-xs text-slate-400 bg-slate-900/40 p-3.5 rounded-xl border border-darkborder">
              <p class="flex justify-between items-center"><span class="font-medium text-slate-400">Cor:</span> <span class="font-semibold text-slate-200">${os.cor || "Não informada"}</span></p>
            </div>
          </div>

          <!-- Rodapé do Card -->
          <div class="mt-5 pt-3.5 border-t border-darkborder flex justify-end items-center text-[11px] text-slate-400 font-medium">
            <span><i class="fa-regular fa-calendar mr-1.5 text-indigo-400"></i> ${new Date(os.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

// =========================================================
// LIGHTBOX (MODAL DE IMAGEM EXPANDIDA)
// =========================================================
window.abrirLightbox = function (fotosString, index) {
  const fotos = JSON.parse(fotosString);
  if (!fotos || fotos.length === 0) return;

  galeriaFotosAtual = fotos;
  indexFotoAtual = index;

  const lightbox = document.getElementById("lightbox");
  lightbox.classList.add("active");

  atualizarImagemLightbox();
};

window.fecharLightbox = function (event) {
  if (event && event.target.tagName === "IMG") return;
  if (
    event &&
    event.target.closest("button") &&
    !event.target.closest("button").classList.contains("absolute")
  )
    return;

  const lightbox = document.getElementById("lightbox");
  lightbox.classList.remove("active");
};

window.navegarLightbox = function (event, direcao) {
  if (event) event.stopPropagation();

  if (galeriaFotosAtual.length <= 1) return;

  indexFotoAtual += direcao;
  if (indexFotoAtual >= galeriaFotosAtual.length) indexFotoAtual = 0;
  if (indexFotoAtual < 0) indexFotoAtual = galeriaFotosAtual.length - 1;

  atualizarImagemLightbox();
};

function atualizarImagemLightbox() {
  const img = document.getElementById("lightboxImg");
  const counter = document.getElementById("lightboxCounter");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");

  img.src = galeriaFotosAtual[indexFotoAtual];
  counter.textContent = `${indexFotoAtual + 1} / ${galeriaFotosAtual.length}`;

  if (galeriaFotosAtual.length <= 1) {
    btnPrev.style.display = "none";
    btnNext.style.display = "none";
  } else {
    btnPrev.style.display = "flex";
    btnNext.style.display = "flex";
  }
}

// =========================================================
// EVENTOS E INICIALIZAÇÃO
// =========================================================
inputBusca.addEventListener("input", renderizarLista);

// Navegar com as setas do teclado
document.addEventListener("keydown", (e) => {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox.classList.contains("active")) return;

  if (e.key === "ArrowRight") navegarLightbox(null, 1);
  if (e.key === "ArrowLeft") navegarLightbox(null, -1);
  if (e.key === "Escape") fecharLightbox();
});

// Chama a função ao abrir a tela
carregarReformas();
