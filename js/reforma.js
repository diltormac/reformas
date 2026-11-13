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
        const MAX = 1280; // Aumentado um pouco para dar mais nitidez na miniatura grande
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
          0.75,
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
        quality: 80,
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
    listaContainer.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-red-400 mono">Erro ao carregar registros do servidor.</td></tr>`;
  }
}

// =========================================================
// ADICIONAR NOVA FOTO
// =========================================================
window.adicionarNovaFoto = async function (id, fotosAtuaisString) {
  const arquivo = await capturarFoto();
  if (!arquivo) return;

  Swal.fire({
    title: "Enviando...",
    text: "Salvando imagem...",
    allowOutsideClick: false,
    showConfirmButton: false,
    background: "#0e1320",
    color: "#cbd5e1",
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
      if (Array.isArray(parsed)) fotosAntigas = parsed;
      else if (typeof parsed === "string") fotosAntigas = [parsed];
    } catch {
      if (fotosAtuaisString && fotosAtuaisString.startsWith("http"))
        fotosAntigas = [fotosAtuaisString];
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
      title: "Sucesso",
      text: "Foto adicionada.",
      background: "#0e1320",
      color: "#cbd5e1",
      timer: 1200,
      showConfirmButton: false,
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Erro",
      text: error.message || "Falha ao enviar foto.",
      background: "#0e1320",
      color: "#cbd5e1",
    });
  }
};

// =========================================================
// FINALIZAR / REABRIR SERVIÇO
// =========================================================
window.marcarServicoFinalizado = async function (id, numeroOs) {
  const { value: senha } = await Swal.fire({
    title: "Finalizar OS",
    text: `Senha exigida para concluir OS #${numeroOs || "S/N"}:`,
    input: "password",
    inputPlaceholder: "Senha...",
    // === CORREÇÃO AQUI ===
    inputAttributes: {
      inputmode: "numeric",
      pattern: "[0-9]*",
      maxlength: "4",
      autocomplete: "off",
    },
    background: "#0e1320",
    color: "#cbd5e1",
    confirmButtonColor: "#2563eb",
    showCancelButton: true,
  });

  if (!senha) return;
  if (senha !== SENHA_MESTRA) {
    Swal.fire({
      icon: "error",
      title: "Senha Incorreta",
      background: "#0e1320",
      color: "#cbd5e1",
    });
    return;
  }

  const { error } = await supabaseClient
    .from("ordens_servico")
    .update({ servico_finalizado: true })
    .eq("id", id);
  if (!error) {
    const r = todasReformas.find((item) => item.id === id);
    if (r) r.servico_finalizado = true;
    atualizarEstatisticas();
    renderizarLista();
  }
};

window.reabrirServico = async function (id, numeroOs) {
  const { value: senha } = await Swal.fire({
    title: "Reabrir OS",
    text: `Senha exigida para reabrir OS #${numeroOs || "S/N"}:`,
    input: "password",
    inputPlaceholder: "Senha...",
    // === CORREÇÃO AQUI ===
    inputAttributes: {
      inputmode: "numeric",
      pattern: "[0-9]*",
      maxlength: "4",
      autocomplete: "off",
    },
    background: "#0e1320",
    color: "#cbd5e1",
    confirmButtonColor: "#d97706",
    showCancelButton: true,
  });

  if (!senha) return;
  if (senha !== SENHA_MESTRA) {
    Swal.fire({
      icon: "error",
      title: "Senha Incorreta",
      background: "#0e1320",
      color: "#cbd5e1",
    });
    return;
  }

  const { error } = await supabaseClient
    .from("ordens_servico")
    .update({ servico_finalizado: false })
    .eq("id", id);
  if (!error) {
    const r = todasReformas.find((item) => item.id === id);
    if (r) r.servico_finalizado = false;
    atualizarEstatisticas();
    renderizarLista();
  }
};

// =========================================================
// FILTROS E ESTATÍSTICAS
// =========================================================
function atualizarEstatisticas() {
  const total = todasReformas.length;
  const retiradas = todasReformas.filter(
    (o) => o.status === "Concluído",
  ).length;
  const prontas = todasReformas.filter(
    (o) => o.servico_finalizado && o.status !== "Concluído",
  ).length;
  const producao = todasReformas.filter(
    (o) => !o.servico_finalizado && o.status !== "Concluído",
  ).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statProducao").textContent = producao;
  document.getElementById("statProntas").textContent = prontas;
  document.getElementById("statRetiradas").textContent = retiradas;
}

window.definirFiltro = function (tipo) {
  filtroAtual = tipo;
  ["todas", "producao", "prontas", "retiradas"].forEach((t) => {
    const btn = document.getElementById(
      `btnFiltro${t.charAt(0).toUpperCase() + t.slice(1)}`,
    );
    if (btn) {
      if (t === tipo) {
        btn.className =
          "px-3 py-1.5 text-xs mono font-semibold rounded bg-blue-600 text-white transition";
      } else {
        btn.className =
          "px-3 py-1.5 text-xs mono font-semibold rounded bg-darkbase hover:bg-slate-800 text-slate-400 border border-panelborder transition";
      }
    }
  });
  renderizarLista();
};

// =========================================================
// RENDERIZAR LISTA (RESPONSIVO — CARD NO MOBILE)
// =========================================================
function renderizarLista() {
  const termo = inputBusca.value.trim().toLowerCase();

  const filtradas = todasReformas.filter((os) => {
    if (termo) {
      const texto =
        `${os.numero_os || ""} ${os.nome || ""} ${os.cor || ""}`.toLowerCase();
      if (!texto.includes(termo)) return false;
    }
    if (
      filtroAtual === "producao" &&
      (os.servico_finalizado || os.status === "Concluído")
    )
      return false;
    if (
      filtroAtual === "prontas" &&
      (!os.servico_finalizado || os.status === "Concluído")
    )
      return false;
    if (filtroAtual === "retiradas" && os.status !== "Concluído") return false;
    return true;
  });

  if (filtradas.length === 0) {
    listaContainer.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-500 mono">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  listaContainer.innerHTML = filtradas
    .map((os) => {
      let fotosArray = [];
      if (Array.isArray(os.fotos_urls)) fotosArray = os.fotos_urls;
      else if (
        typeof os.fotos_urls === "string" &&
        os.fotos_urls.trim() !== ""
      ) {
        try {
          const p = JSON.parse(os.fotos_urls);
          fotosArray = Array.isArray(p) ? p : [os.fotos_urls];
        } catch {
          fotosArray = [os.fotos_urls];
        }
      }
      const fotoUrl = fotosArray.length > 0 ? fotosArray[0] : null;
      const fotosString = JSON.stringify(fotosArray).replace(/"/g, "&quot;");

      let badgeStatus = `<span class="px-2 py-0.5 rounded text-[10px] mono bg-amber-500/10 text-amber-400 border border-amber-500/20">${os.status || "Pendente"}</span>`;
      if (os.status === "Em andamento")
        badgeStatus = `<span class="px-2 py-0.5 rounded text-[10px] mono bg-blue-500/10 text-blue-400 border border-blue-500/20">Em andamento</span>`;
      if (os.status === "Concluído")
        badgeStatus = `<span class="px-2 py-0.5 rounded text-[10px] mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Retirado</span>`;
      if (os.servico_finalizado && os.status !== "Concluído")
        badgeStatus = `<span class="px-2 py-0.5 rounded text-[10px] mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Pronto p/ Retirada</span>`;

      let acoesHtml = "";
      if (os.status !== "Concluído") {
        if (!os.servico_finalizado) {
          acoesHtml = `<button onclick="marcarServicoFinalizado('${os.id}', '${os.numero_os || ""}')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] rounded mono transition flex-1 sm:flex-none">Finalizar</button>`;
        } else {
          acoesHtml = `<div class="flex items-center justify-end gap-2 flex-1 sm:flex-none"><span class="text-[10px] text-emerald-400 mono">Aguardando</span><button onclick="reabrirServico('${os.id}', '${os.numero_os || ""}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]" title="Reabrir"><i class="fa-solid fa-lock-open"></i></button></div>`;
        }
      }

      const dataFmt = new Date(os.created_at).toLocaleDateString("pt-BR");

      return `
        <tr class="hover:bg-panelborder/30 transition align-top">
          <!-- FOTO (no mobile vira banner grande no topo) -->
          <td class="p-3 text-center">
            ${
              fotoUrl
                ? `<div class="thumb-wrap mx-auto" onclick="abrirLightbox('${fotosString}', 0)">
                   <img src="${fotoUrl}" alt="Foto OS ${os.numero_os || ""}" loading="lazy">
                   <div class="overlay-hint absolute inset-0 bg-slate-950/40 opacity-0 hover:opacity-100 transition flex items-center justify-center">
                     <span class="text-white text-xs font-semibold drop-shadow"><i class="fa-solid fa-magnifying-glass-plus mr-1"></i> Ampliar</span>
                   </div>
                   ${
                     fotosArray.length > 1
                       ? `<span class="absolute bottom-2 right-2 bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded mono border border-slate-700">+${fotosArray.length - 1} fotos</span>`
                       : ""
                   }
                 </div>`
                : `<div class="thumb-empty mx-auto">
                   <i class="fa-regular fa-image text-xl text-slate-600"></i>
                   <span>Sem foto</span>
                 </div>`
            }
          </td>

          <!-- OS — NÚMERO EM DESTAQUE -->
          <td class="p-3">
            <span class="sm:hidden text-[10px] text-slate-500 block font-normal mb-1 mono">OS</span>
            <div class="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/30 rounded-lg px-3 py-1.5">
              <span class="text-[10px] mono text-blue-400 uppercase tracking-widest hidden sm:inline">OS</span>
              <span class="os-numero mono font-bold text-blue-300 leading-none">${os.numero_os || "S/N"}</span>
            </div>
          </td>

          <!-- CLIENTE -->
          <td class="p-3 font-semibold text-slate-200">
            <span class="sm:hidden text-[10px] text-slate-500 block font-normal">Cliente</span>
            <span class="truncate block max-w-[200px]" title="${os.nome || "Sem nome"}">${os.nome || "Sem nome"}</span>
          </td>

          <!-- COR -->
          <td class="p-3 text-slate-300 mono text-xs">
            <span class="sm:hidden text-[10px] text-slate-500 block font-normal">Cor</span>
            ${os.cor || "—"}
          </td>

          <!-- STATUS -->
          <td class="p-3 text-center">
            <span class="sm:hidden text-[10px] text-slate-500 block font-normal mb-1">Status</span>
            ${badgeStatus}
          </td>

          <!-- DATA -->
          <td class="p-3 text-center mono text-slate-400 text-xs">
            <span class="sm:hidden text-[10px] text-slate-500 block font-normal">Data</span>
            ${dataFmt}
          </td>

          <!-- AÇÕES -->
          <td class="p-3 sm:text-right">
            <span class="sm:hidden text-[10px] text-slate-500 block font-normal mb-1">Ações</span>
            <div class="flex items-center justify-end gap-2">
              <button onclick="adicionarNovaFoto('${os.id}', '${fotosString}')" class="p-2 bg-darkbase hover:bg-slate-800 text-slate-300 rounded border border-panelborder transition text-xs" title="Adicionar Foto"><i class="fa-solid fa-camera"></i></button>
              ${acoesHtml}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// =========================================================
// LIGHTBOX
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
// TEMPO REAL E ATUALIZAÇÃO
// =========================================================
supabaseClient
  .channel("public:ordens_servico_reforma")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "ordens_servico" },
    () => {
      carregarReformas();
    },
  )
  .subscribe();

setInterval(() => {
  carregarReformas();
}, 30000);

carregarReformas();
