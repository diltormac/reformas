/* ============================================================
   reforma.js — Painel de Reformas
   Requer: @supabase/supabase-js v2 carregado antes deste módulo
   ============================================================ */

// ⚠️ SUBSTITUA pelas suas credenciais
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA-ANON-KEY";

// ⚠️ SUBSTITUA pelo nome real da sua tabela e colunas
const TABELA = "reformas";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ ESTADO ============
let reformas = [];
let reformasFiltradas = [];
let lightboxImagens = [];
let lightboxIndex = 0;

// ============ HELPERS ============
const $ = (id) => document.getElementById(id);

function statusInfo(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("pend")) return { label: "Pendente", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40", icon: "fa-clock" };
  if (s.includes("andamento")) return { label: "Em Andamento", cls: "bg-blue-500/20 text-blue-300 border-blue-500/40", icon: "fa-spinner" };
  if (s.includes("pront") || s.includes("retirad")) return { label: "Pronta p/ Retirada", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: "fa-check" };
  if (s.includes("entreg") || s.includes("final")) return { label: "Entregue", cls: "bg-slate-500/20 text-slate-300 border-slate-500/40", icon: "fa-box" };
  return { label: status || "—", cls: "bg-slate-500/20 text-slate-300 border-slate-500/40", icon: "fa-circle" };
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ============ RENDER ============
function atualizarStats(lista) {
  const total = lista.length;
  let pend = 0, and = 0, pronto = 0;
  lista.forEach((r) => {
    const s = (r.status || "").toLowerCase();
    if (s.includes("pend")) pend++;
    else if (s.includes("andamento")) and++;
    else if (s.includes("pront") || s.includes("retirad")) pronto++;
  });
  $("statTotal").textContent = total;
  $("statPendente").textContent = pend;
  $("statAndamento").textContent = and;
  $("statProntas").textContent = pronto;
}

function cardHTML(r) {
  const info = statusInfo(r.status);
  const fotos = normalizarFotos(r);
  const thumbs = fotos
    .slice(0, 4)
    .map(
      (url, i) => `
      <div class="relative aspect-square rounded-lg overflow-hidden border border-slate-700 cursor-zoom-in group"
           onclick="abrirLightbox(${r.id}, ${i})">
        <img src="${esc(url)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
      </div>`
    )
    .join("");

  return `
    <div class="bg-darkcard/90 border border-darkborder rounded-2xl p-4 shadow-xl hover:border-indigo-500/40 transition">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <p class="text-[11px] font-extrabold text-indigo-400 uppercase tracking-wider">OS #${esc(r.numero_os ?? r.id)}</p>
          <h3 class="text-base font-black text-white mt-0.5">${esc(r.cliente ?? "Cliente não informado")}</h3>
        </div>
        <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${info.cls} whitespace-nowrap">
          <i class="fa-solid ${info.icon} mr-1"></i>${info.label}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs mb-3">
        <div class="bg-slate-800/50 rounded-lg p-2">
          <p class="text-slate-500 font-bold uppercase text-[9px]">Cor</p>
          <p class="text-slate-200 font-semibold truncate">${esc(r.cor ?? "—")}</p>
        </div>
        <div class="bg-slate-800/50 rounded-lg p-2">
          <p class="text-slate-500 font-bold uppercase text-[9px]">Roda</p>
          <p class="text-slate-200 font-semibold truncate">${esc(r.roda ?? "—")}</p>
        </div>
      </div>

      ${
        fotos.length
          ? `<div class="grid grid-cols-4 gap-2">${thumbs}</div>`
          : `<div class="text-center py-4 text-slate-600 text-xs font-bold"><i class="fa-regular fa-image mr-1"></i> Sem fotos</div>`
      }
    </div>`;
}

// ============ FOTOS ============
// Aceita: array, string JSON, string separada por vírgula
function normalizarFotos(r) {
  let v = r.fotos ?? r.imagens ?? r.foto ?? [];
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith("[")) {
      try { v = JSON.parse(s); } catch { v = [s]; }
    } else {
      v = s.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(v)) v = [v];
  return v.filter(Boolean);
}

function acharReforma(id) {
  return reformas.find((r) => String(r.id) === String(id));
}

// ============ LIGHTBOX ============
window.abrirLightbox = function (reformaId, index = 0) {
  const r = acharReforma(reformaId);
  if (!r) return;
  lightboxImagens = normalizarFotos(r);
  if (!lightboxImagens.length) return;
  lightboxIndex = Math.max(0, Math.min(index, lightboxImagens.length - 1));
  renderLightbox();
  $("lightbox").classList.add("active");
};

function renderLightbox() {
  $("lightboxImg").src = lightboxImagens[lightboxIndex];
  $("lightboxCounter").textContent = `${lightboxIndex + 1} / ${lightboxImagens.length}`;
  const soUma = lightboxImagens.length <= 1;
  $("btnPrev").style.display = soUma ? "none" : "flex";
  $("btnNext").style.display = soUma ? "none" : "flex";
}

window.fecharLightbox = function (e) {
  if (e && e.target && e.target.id !== "lightbox") {
    // clique nos botões internos ou na imagem → ignora (exceto o próprio fundo)
    if (e.currentTarget && e.target !== e.currentTarget) return;
  }
  $("lightbox").classList.remove("active");
};

window.navegarLightbox = function (e, dir) {
  e.stopPropagation();
  if (!lightboxImagens.length) return;
  lightboxIndex = (lightboxIndex + dir + lightboxImagens.length) % lightboxImagens.length;
  renderLightbox();
};

// Teclado
document.addEventListener("keydown", (e) => {
  const lb = $("lightbox");
  if (!lb || !lb.classList.contains("active")) return;
  if (e.key === "Escape") window.fecharLightbox();
  if (e.key === "ArrowLeft") window.navegarLightbox(e, -1);
  if (e.key === "ArrowRight") window.navegarLightbox(e, 1);
});

// ============ BUSCA ============
function aplicarBusca(termo) {
  const t = (termo || "").toLowerCase().trim();
  if (!t) {
    reformasFiltradas = [...reformas];
  } else {
    reformasFiltradas = reformas.filter((r) => {
      const campos = [
        r.numero_os,
        r.id,
        r.cliente,
        r.cor,
        r.roda,
        r.status,
      ].map((x) => String(x ?? "").toLowerCase());
      return campos.some((c) => c.includes(t));
    });
  }
  renderLista();
}

function renderLista() {
  const box = $("listaReformas");
  if (!reformasFiltradas.length) {
    box.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500">
        <i class="fa-solid fa-inbox text-4xl mb-3 opacity-50"></i>
        <p class="text-sm font-bold">Nenhuma reforma encontrada</p>
      </div>`;
    return;
  }
  box.innerHTML = reformasFiltradas.map(cardHTML).join("");
}

// ============ CARREGAMENTO ============
async function carregar() {
  try {
    const { data, error } = await db
      .from(TABELA)
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;
    reformas = data || [];
    reformasFiltradas = [...reformas];
    atualizarStats(reformas);
    renderLista();
  } catch (err) {
    console.error(err);
    $("listaReformas").innerHTML = `
      <div class="col-span-full py-16 text-center text-rose-400">
        <i class="fa-solid fa-triangle-exclamation text-4xl mb-3"></i>
        <p class="text-sm font-bold">Erro ao carregar reformas</p>
        <p class="text-xs text-slate-500 mt-1">${esc(err.message || err)}</p>
      </div>`;
    if (window.Swal) {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: err.message || String(err),
        background: "#111827",
        color: "#f8fafc",
      });
    }
  }
}

// ============ INIT ============
$("inputBusca").addEventListener("input", (e) => aplicarBusca(e.target.value));
carregar();
