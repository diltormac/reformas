// os_painel/js/reforma.js

const supabaseUrl = "https://kiiswukzwwoznkgjyaod.supabase.co";
const supabaseKey = "sb_publishable_WPRvraB-40Fz1RuKbd5bRg_3tGvyAxg";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const SENHA_MESTRA = "1234";
const BUCKET = "fotos-ordens";

let todasReformas = [];
let galeriaFotosAtual = [];
let indexFotoAtual = 0;
let filtroAtual = "todas";

const inputBusca = document.getElementById("inputBusca");
const listaContainer = document.getElementById("listaReformas");

// =========================================================
// FUNÇÕES DE APOIO (CÂMERA E COMPRESSÃO)
// =========================================================
function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1024;
        let width = img.width;
        let height = img.height;
        if (width > height && width > MAX) {
          height *= MAX / width;
          width = MAX;
        } else if (height > MAX) {
          width *= MAX / height;
          height = MAX;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) =>
            resolve(
              new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
                type: "image/jpeg",
              }),
            ),
          "image/jpeg",
          0.7,
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

async function capturarFoto() {
  if (
    window.Capacitor &&
    window.Capacitor.isNativePlatform() &&
    window.Camera
  ) {
    try {
      const image = await window.Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: "dataUrl",
        source: "CAMERA",
      });
      const res = await fetch(image.dataUrl);
      const blob = await res.blob();
      return await comprimirImagem(
        new File([blob], `foto_${Date.now()}.jpg`, { type: "image/jpeg" }),
      );
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes("cancel")) return null;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await comprimirImagem(file));
      } catch {
        resolve(file);
      }
    };
    input.click();
  });
}

// =========================================================
// BUSCAR DADOS DO BANCO
// =========================================================
async function carregarReformas() {
  try {
    const { data, error } = await supabaseClient
      .from("ordens_servico")
      .select(
        "id, numero_os, nome, cor, status, fotos_urls, created_at, servico_finalizado",
      )
      .ilike("servico", "%REFORMA%")
      .order("created_at", { ascending: false });

    if (error) throw error;

    todasReformas = (data || []).sort((a, b) => {
      const numA = parseInt(String(a.numero_os || "0").replace(/\D/g, "")) || 0;
      const numB = parseInt(String(b.numero_os || "0").replace(/\D/g, "")) || 0;
      return numB - numA;
    });

    atualizarEstatisticas();
    renderizarLista();
  } catch (error) {
    console.error("Erro ao carregar:", error);
    listaContainer.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 bg-red-950/40 rounded-2xl border border-red-500/30 shadow-xl p-6"><i class="fa-solid fa-triangle-exclamation text-3xl mb-3"></i><p class="font-extrabold">Erro ao carregar as reformas.</p></div>`;
  }
}

// =========================================================
// ADICIONAR NOVA FOTO
// =========================================================
window.adicionarNovaFoto = async function (id, fotosAtuaisString) {
  const arquivo = await capturarFoto();
  if (!arquivo) return; // cancelou

  Swal.fire({
    title: "Enviando foto...",
    html: '<div class="text-sm font-semibold text-slate-300" id="progressoTexto">Preparando...</div><div class="w-full bg-slate-800 rounded-full h-2.5 mt-3"><div id="barraProgresso" class="bg-indigo-500 h-2.5 rounded-full" style="width: 0%"></div></div>',
    allowOutsideClick: false,
    showConfirmButton: false,
    background: "#111827",
    color: "#f8fafc",
  });

  try {
    const nomeArquivo = `reforma_${id}_${Date.now()}.jpg`;

    const { error: uploadError } = await supabaseClient.storage
      .from(BUCKET)
      .upload(nomeArquivo, arquivo, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseClient.storage
      .from(BUCKET)
      .getPublicUrl(nomeArquivo);
    const novaUrl = urlData.publicUrl;

    let fotosAntigas = [];
    try {
      const parsed = JSON.parse(fotosAtuaisString);
      if (Array.isArray(parsed)) {
        fotosAntigas = parsed;
      } else if (typeof parsed === "string") {
        fotosAntigas = [parsed];
      }
    } catch (e) {
      if (fotosAtuaisString && fotosAtuaisString.startsWith("http")) {
        fotosAntigas = [fotosAtuaisString];
      }
    }

    const fotosNovas = [...fotosAntigas, novaUrl];

    const { error: updateError } = await supabaseClient
      .from("ordens_servico")
      .update({ fotos_urls: fotosNovas })
      .eq("id", id);

    if (updateError) throw updateError;

    const reforma = todasReformas.find((r) => r.id === id);
    if (reforma) reforma.fotos_urls = fotosNovas;

    Swal.close();
    renderizarLista();
    Swal.fire({
      icon: "success",
      title: "Foto Adicionada!",
      text: "A nova imagem foi salva com sucesso.",
      background: "#111827",
      color: "#f8fafc",
      confirmButtonColor: "#10b981",
    });
  } catch (error) {
    console.error("Erro ao adicionar foto:", error);
    Swal.fire({
      icon: "error",
      title: "Erro ao salvar",
      text:
        error.message ||
        "Não foi possível adicionar a foto. Verifique as permissões do Supabase.",
      background: "#111827",
      color: "#f8fafc",
      confirmButtonColor: "#ef4444",
    });
  }
};

// =========================================================
// MARCAR SERVIÇO COMO FINALIZADO (COM SENHA)
// =========================================================
window.marcarServicoFinalizado = async function (id, numeroOs, cliente) {
  const { value: senha } = await Swal.fire({
    title: "Confirmar Senha",
    text: `Digite a senha para finalizar o serviço da OS Nº ${numeroOs || "S/N"}`,
    input: "password",
    inputPlaceholder: "Digite a senha...",
    icon: "lock",
    background: "#111827",
    color: "#f8fafc",
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#334155",
    confirmButtonText: "Confirmar",
    cancelButtonText: "Cancelar",
    showCancelButton: true,
  });

  if (!senha) return;

  if (senha !== SENHA_MESTRA) {
    Swal.fire({
      icon: "error",
      title: "Senha Incorreta",
      text: "A senha digitada está errada.",
      background: "#111827",
      color: "#f8fafc",
      confirmButtonColor: "#ef4444",
    });
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("ordens_servico")
      .update({ servico_finalizado: true })
      .eq("id", id);
    if (error) throw error;

    const reforma = todasReformas.find((r) => r.id === id);
    if (reforma) reforma.servico_finalizado = true;

    atualizarEstatisticas();
    renderizarLista();

    Swal.fire({
      icon: "success",
      title: "Serviço Pronto!",
      text: "A OS está pronta para retirada.",
      background: "#111827",
      color: "#f8fafc",
      confirmButtonColor: "#10b981",
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Erro",
      text: error.message || "Não foi possível atualizar.",
      background: "#111827",
      color: "#f8fafc",
      confirmButtonColor: "#ef4444",
    });
  }
};

// =========================================================
// REABRIR SERVIÇO (COM SENHA)
// =========================================================
window.reabrirServico = async function (id, numeroOs, cliente) {
  const { value: senha } = await Swal.fire({
    title: "Confirmar Senha",
    text: `Digite a senha para reabrir a OS Nº ${numeroOs || "S/N"}`,
    input: "password",
    inputPlaceholder: "Digite a senha...",
    icon: "lock",
    background: "#111827",
    color: "#f8fafc",
    confirmButtonColor: "#f59e0b",
    cancelButtonColor: "#334155",
    confirmButtonText: "Reabrir",
    cancelButtonText: "Cancelar",
    showCancelButton: true,
  });

  if (!senha) return;

  if (senha !== SENHA_MESTRA) {
    Swal.fire({
      icon: "error",
      title: "Senha Incorreta",
      text: "A senha digitada está errada.",
      background: "#111827",
      color: "#f8fafc",
      confirmButtonColor: "#ef4444",
    });
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("ordens_servico")
      .update({ servico_finalizado: false })
      .eq("id", id);
    if (error) throw error;

    const reforma = todasReformas.find((r) => r.id === id);
    if (reforma) reforma.servico_finalizado = false;

    atualizarEstatisticas();
    renderizarLista();

    Swal.fire({
      icon: "success",
      title: "Serviço Reaberto",
      text: "A OS voltou para a produção.",
      background: "#111827",
      color: "#f8fafc",
      confirmButtonColor: "#10b981",
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Erro",
      text: error.message || "Não foi possível atualizar.",
      background: "#111827",
      color: "#f8fafc",
      confirmButtonColor: "#ef4444",
    });
  }
};

// =========================================================
// ATUALIZAR ESTATÍSTICAS E FILTROS
// =========================================================
function atualizarEstatisticas() {
  const total = todasReformas.length;

  // Retiradas: Status = Concluído
  const retiradas = todasReformas.filter(
    (o) => o.status === "Concluído"
  ).length;

  // Prontas p/ Retirada: Finalizado e não concluído
  const prontas = todasReformas.filter(
    (o) => o.servico_finalizado && o.status !== "Concluído"
  ).length;

  // Em Produção: Tudo que NÃO está pronto e NÃO está concluído
  // (Aqui entram tanto Pendentes quanto Em Andamento)
  const producao = todasReformas.filter(
    (o) => !o.servico_finalizado && o.status !== "Concluído"
  ).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statProducao").textContent = producao;
  document.getElementById("statProntas").textContent = prontas;
  document.getElementById("statRetiradas").textContent = retiradas;
}

// Configurando os cliques nos cards para filtrar
document.getElementById("statTotal").parentElement.onclick = () => {
  filtroAtual = "todas";
  renderizarLista();
};
document.getElementById("statProducao").parentElement.onclick = () => {
  filtroAtual = "producao";
  renderizarLista();
};
document.getElementById("statProntas").parentElement.onclick = () => {
  filtroAtual = "prontas";
  renderizarLista();
};
document.getElementById("statRetiradas").parentElement.onclick = () => {
  filtroAtual = "retiradas";
  renderizarLista();
};

// =========================================================
// RENDERIZAR A LISTA
// =========================================================
function renderizarLista() {
  const termo = inputBusca.value.trim().toLowerCase();

  const filtradas = todasReformas.filter((os) => {
    // Filtro de Busca
    if (termo) {
      const texto =
        `${os.numero_os || ""} ${os.nome || ""} ${os.cor || ""}`.toLowerCase();
      if (!texto.includes(termo)) return false;
    }

    // Filtros dos Cards
    if (filtroAtual === "producao") {
      if (os.servico_finalizado || os.status === "Concluído") return false;
    }
    if (filtroAtual === "prontas") {
      if (!os.servico_finalizado || os.status === "Concluído") return false;
    }
    if (filtroAtual === "retiradas") {
      if (os.status !== "Concluído") return false;
    }

    return true;
  });

  if (filtradas.length === 0) {
    listaContainer.innerHTML = `<div class="col-span-full py-16 text-center text-slate-400 bg-darkcard/50 rounded-2xl border border-darkborder shadow-xl"><i class="fa-solid fa-box-open text-4xl mb-3 text-slate-500"></i><p class="font-bold text-slate-300 text-sm">Nenhuma reforma encontrada</p></div>`;
    return;
  }

  listaContainer.innerHTML = filtradas
    .map((os) => {
      // Definindo a cor do badge de acordo com o status
      let bgStatus = "bg-amber-500/20 text-amber-300 border border-amber-500/40";
      if (os.status === "Em andamento")
        bgStatus = "bg-blue-500/20 text-blue-300 border border-blue-500/40";
      if (os.status === "Cancelado")
        bgStatus = "bg-rose-500/20 text-rose-300 border border-rose-500/40";
      if (os.status === "Concluído")
        bgStatus = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";

      let badgeHtml = `<span class="text-xs font-black px-3.5 py-1.5 rounded-xl flex-shrink-0 ${bgStatus} shadow-md uppercase tracking-wider">${os.status || "Pendente"}</span>`;

      // Se estiver finalizado mas não concluído, sobrepõe o badge
      if (os.servico_finalizado && os.status !== "Concluído") {
        badgeHtml = `<span class="text-xs font-black px-3.5 py-1.5 rounded-xl flex-shrink-0 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-md uppercase tracking-wider flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> Pronto p/ Retirada</span>`;
      }

      let fotoUrl = null;
      let fotosArray = [];
      if (Array.isArray(os.fotos_urls)) {
        fotosArray = os.fotos_urls;
      } else if (
        typeof os.fotos_urls === "string" &&
        os.fotos_urls.trim() !== ""
      ) {
        try {
          const parsed = JSON.parse(os.fotos_urls);
          if (Array.isArray(parsed)) fotosArray = parsed;
          else fotosArray = [os.fotos_urls];
        } catch {
          fotosArray = [os.fotos_urls];
        }
      }

      if (fotosArray.length > 0) fotoUrl = fotosArray[0];
      const fotosString = JSON.stringify(fotosArray).replace(/"/g, "&quot;");

      let botaoAcao = "";
      if (os.status !== "Concluído") {
        if (!os.servico_finalizado) {
          botaoAcao = `<button onclick="marcarServicoFinalizado('${os.id}', '${os.numero_os || ""}', '${os.nome || ""}')" class="w-full mt-3 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-900/30 transition flex items-center justify-center gap-2"><i class="fa-solid fa-lock text-sm"></i> Finalizar Serviço</button>`;
        } else {
          botaoAcao = `<div class="w-full mt-3 flex gap-2"><div class="flex-1 py-2 px-2 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 uppercase"><i class="fa-solid fa-thumbs-up"></i> Aguardando Cliente</div><button onclick="reabrirServico('${os.id}', '${os.numero_os || ""}', '${os.nome || ""}')" class="w-10 h-10 flex-shrink-0 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl flex items-center justify-center transition" title="Reabrir OS (Requer senha)"><i class="fa-solid fa-lock-open"></i></button></div>`;
        }
      }

      let avisoTempo = "";
      if (os.servico_finalizado && os.status !== "Concluído") {
        const diffDias = Math.floor(
          (new Date() - new Date(os.created_at)) / (1000 * 60 * 60 * 24),
        );
        if (diffDias >= 3) {
          avisoTempo = `<div class="mt-2 text-center text-[10px] font-bold text-red-400 bg-red-950/40 py-1 rounded border border-red-500/20"><i class="fa-solid fa-clock mr-1"></i> Aguardando retirada há ${diffDias} dias</div>`;
        }
      }

      return `
      <div class="bg-darkcard/80 backdrop-blur-md rounded-2xl border ${os.servico_finalizado ? "border-emerald-500/50 shadow-emerald-950/50" : "border-darkborder"} shadow-2xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition duration-300">
        <div>
          <div class="flex justify-between items-start mb-4 gap-3">
            <div class="min-w-0 flex-1">
              <span class="text-[10px] font-black uppercase tracking-widest text-indigo-400 block mb-1">Ordem de Serviço</span>
              <p class="text-5xl font-black ${os.servico_finalizado ? "text-emerald-400" : "text-indigo-300"} tracking-tight leading-none mb-2 drop-shadow-sm">${os.numero_os || "S/N"}</p>
              <p class="text-base font-extrabold text-white tracking-wide truncate" title="${os.nome || "Sem nome"}"><i class="fa-solid fa-user text-indigo-400 mr-1.5 text-xs"></i> ${os.nome || "Sem nome"}</p>
            </div>
            ${badgeHtml}
          </div>

          <!-- CONTAINER DA FOTO COM O BOTÃO DE ADICIONAR -->
          <div class="relative w-full">
            ${
              fotoUrl
                ? `<div class="w-full h-56 bg-slate-950 rounded-xl overflow-hidden mb-4 border border-darkborder cursor-pointer group shadow-inner" onclick="abrirLightbox('${fotosString}', 0)">
                     <img src="${fotoUrl}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" alt="Foto da Roda">
                     <div class="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/50 transition-all duration-300 flex items-center justify-center">
                       <div class="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                         <i class="fa-solid fa-magnifying-glass-plus text-base"></i>
                       </div>
                     </div>
                   </div>`
                : `<div class="w-full h-56 bg-slate-900/40 border border-dashed border-darkborder rounded-xl flex flex-col items-center justify-center text-slate-500 mb-4">
                     <i class="fa-solid fa-image text-3xl mb-2 text-slate-600"></i>
                     <span class="text-xs font-bold uppercase tracking-wider">Sem foto</span>
                   </div>`
            }
            <!-- Botão Flutuante + para adicionar nova foto -->
            <button onclick="adicionarNovaFoto('${os.id}', '${fotosString}')" class="absolute bottom-6 right-2 w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg transition z-10" title="Adicionar nova foto">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>

          <div class="space-y-2 text-sm bg-slate-900/80 p-3.5 rounded-xl border border-darkborder">
            <p class="flex justify-between items-center"><span class="font-bold text-slate-400 uppercase text-[11px] tracking-wider">Cor:</span> <span class="font-extrabold text-white text-base">${os.cor || "Não informada"}</span></p>
          </div>

          ${botaoAcao}
          ${avisoTempo}
        </div>

        <div class="mt-5 pt-3.5 border-t border-darkborder flex justify-end items-center text-xs text-slate-300 font-bold">
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
  document.getElementById("lightbox").classList.add("active");
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
  document.getElementById("lightbox").classList.remove("active");
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

inputBusca.addEventListener("input", renderizarLista);

document.addEventListener("keydown", (e) => {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox.classList.contains("active")) return;
  if (e.key === "ArrowRight") navegarLightbox(null, 1);
  if (e.key === "ArrowLeft") navegarLightbox(null, -1);
  if (e.key === "Escape") fecharLightbox();
});

// =========================================================
// ATUALIZAÇÃO AUTOMÁTICA (REALTIME + TEMPORIZADOR)
// =========================================================
supabaseClient
  .channel("public:ordens_servico_reforma")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "ordens_servico" },
    (payload) => {
      carregarReformas();
    },
  )
  .subscribe();

setInterval(() => {
  carregarReformas();
}, 30000);

// Inicia a tela
carregarReformas();
