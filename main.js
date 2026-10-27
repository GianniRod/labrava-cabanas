import { firebaseConfig, firebaseSinConfigurar, COLECCION, WHATSAPP_DISPLAY } from "./firebase-config.js";
import { esc, formatoPrecio, linkWhatsApp, mensajeCabana, ESTADOS } from "./shared.js";
import { crearCalendario, fechaTexto, noches, iso } from "./calendario.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2";

const $ = (s, el = document) => el.querySelector(s);
const grid = $("#gridCabanas");
const empty = $("#emptyCabanas");
const modal = $("#modal");
const modalBody = $("#modalBody");

let cabanas = [];
let galeria = { fotos: [], i: 0 };
// Resuelve una foto a su src: las subidas desde el panel vienen como "fs:<id>" (colección "fotos")
let leerFoto = async f => f;

// ---------- Enlaces generales de WhatsApp ----------
const msgGeneral = "¡Hola! Vi la web de las cabañas en Laguna La Brava y quería hacer una consulta.";
document.querySelectorAll("[data-wa]").forEach(a => (a.href = linkWhatsApp(msgGeneral)));
document.querySelectorAll("[data-wa-display]").forEach(el => (el.textContent = WHATSAPP_DISPLAY));
$("#year").textContent = new Date().getFullYear();

// ---------- Navegación ----------
const nav = $("#nav");
const onScroll = () => nav.classList.toggle("is-solid", window.scrollY > 40);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });
$("#navToggle").addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  $("#navToggle").setAttribute("aria-expanded", open);
});
$("#navLinks").addEventListener("click", e => {
  if (e.target.closest("a")) nav.classList.remove("is-open");
});

// ---------- Datos ----------
async function cargarCabanas() {
  if (firebaseSinConfigurar) {
    console.info("Firebase sin configurar: mostrando cabañas de ejemplo. Editá js/firebase-config.js");
    return DEMO;
  }
  const { initializeApp } = await import(`${FB}/firebase-app.js`);
  const { getFirestore, collection, query, where, getDocs, getDoc, doc } = await import(`${FB}/firebase-firestore.js`);
  const db = getFirestore(initializeApp(firebaseConfig));
  const cache = new Map();
  leerFoto = f => {
    if (!f.startsWith("fs:")) return Promise.resolve(f);
    if (!cache.has(f)) cache.set(f, getDoc(doc(db, "fotos", f.slice(3))).then(s => s.data()?.data || "").catch(() => ""));
    return cache.get(f);
  };
  const snap = await getDocs(query(collection(db, COLECCION), where("publicada", "==", true)));
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Solo las portadas; el resto se carga al abrir cada cabaña
  await Promise.all(lista.map(async c => { if (c.fotos?.[0]) c.fotos[0] = await leerFoto(c.fotos[0]); }));
  return lista;
}

function ordenar(lista) {
  const peso = { disponible: 0, reservada: 1, "no-disponible": 2 };
  return lista.sort((a, b) =>
    (b.destacada === true) - (a.destacada === true) ||
    (peso[a.estado] ?? 0) - (peso[b.estado] ?? 0) ||
    (a.orden ?? 999) - (b.orden ?? 999) ||
    String(a.nombre).localeCompare(String(b.nombre))
  );
}

// ---------- Render ----------
const icon = id => `<svg class="ico"><use href="#${id}"/></svg>`;

function specsHTML(c) {
  const items = [];
  if (c.capacidad) items.push(`<li>${icon("i-users")} ${c.capacidad} huésped${c.capacidad == 1 ? "" : "es"}</li>`);
  if (c.dormitorios) items.push(`<li>${icon("i-bed")} ${c.dormitorios} dormitorio${c.dormitorios == 1 ? "" : "s"}</li>`);
  if (c.banos) items.push(`<li>${icon("i-bath")} ${c.banos} baño${c.banos == 1 ? "" : "s"}</li>`);
  if (c.superficie) items.push(`<li>${icon("i-area")} ${c.superficie} m²</li>`);
  return items.join("");
}

function precioHTML(c) {
  const p = formatoPrecio(c.precio);
  if (!p) return `<div class="price price--consultar"><small>Precio</small><strong>Consultar</strong></div>`;
  return `<div class="price"><small>Desde</small><strong>${esc(p.monto)} <span>/ ${esc(p.periodo)}</span></strong></div>`;
}

const placeholder = `<div class="card__placeholder"><svg viewBox="0 0 64 64"><path d="M8 50 L32 18 L56 50Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><rect x="26" y="36" width="12" height="14" fill="none" stroke="currentColor" stroke-width="2.5"/></svg></div>`;

function cardHTML(c) {
  const fotos = c.fotos || [];
  const estado = c.estado || "disponible";
  return `
  <article class="card">
    <button class="card__media" data-open="${esc(c.id)}" aria-label="Ver detalle de ${esc(c.nombre)}">
      ${fotos[0] ? `<img src="${esc(fotos[0])}" alt="${esc(c.nombre)}" loading="lazy">` : placeholder}
      <span class="badge badge--${esc(estado)}">${esc(ESTADOS[estado] || estado)}</span>
      ${c.destacada ? `<span class="badge badge--feat">Destacada</span>` : ""}
      ${fotos.length > 1 ? `<span class="card__count">${fotos.length} fotos</span>` : ""}
    </button>
    <div class="card__body">
      <h3 class="card__title">${esc(c.nombre)}</h3>
      <p class="card__desc">${esc(c.descripcionCorta || c.descripcion || "")}</p>
      <ul class="specs">${specsHTML(c)}</ul>
      <div class="card__foot">
        ${precioHTML(c)}
        <div class="card__actions">
          <button class="icon-btn" data-open="${esc(c.id)}" aria-label="Ver detalle">${icon("i-arrow")}</button>
          <button class="icon-btn icon-btn--wa" data-reservar="${esc(c.id)}" aria-label="Reservar por WhatsApp">${icon("i-wa")}</button>
        </div>
      </div>
    </div>
  </article>`;
}

function render() {
  const cap = Number($("#fCapacidad").value);
  const soloDisp = $("#fDisponibles").checked;
  const lista = cabanas.filter(c =>
    (!cap || Number(c.capacidad || 0) >= cap) &&
    (!soloDisp || (c.estado || "disponible") === "disponible")
  );
  grid.innerHTML = lista.map(cardHTML).join("");
  empty.hidden = lista.length > 0;
  if (!cabanas.length) empty.innerHTML = `Pronto vas a ver nuestras cabañas acá. Mientras tanto, <a href="${linkWhatsApp(msgGeneral)}" target="_blank" rel="noopener">consultanos por WhatsApp</a>.`;
}

$("#fCapacidad").addEventListener("change", render);
$("#fDisponibles").addEventListener("change", render);

// ---------- Modal de detalle ----------
function detalleHTML(c) {
  const fotos = c.fotos || [];
  const estado = c.estado || "disponible";
  const p = formatoPrecio(c.precio);
  const comodidades = c.comodidades || [];
  const reglas = [];
  if (c.mascotas !== undefined) reglas.push([c.mascotas, c.mascotas ? "Se aceptan mascotas" : "No se aceptan mascotas"]);
  if (c.fumar !== undefined) reglas.push([c.fumar, c.fumar ? "Se permite fumar en exteriores" : "No se permite fumar"]);

  const info = [
    ["Check-in", c.checkIn], ["Check-out", c.checkOut],
    ["Estadía mínima", c.estadiaMinima], ["Camas", c.camas],
    ["Distancia a la laguna", c.distanciaLaguna]
  ].filter(([, v]) => v);

  return `
    ${fotos.length ? `
      <div class="gallery">
        <img class="gallery__img" id="gImg" src="${esc(fotos[0])}" alt="${esc(c.nombre)}">
        <button class="gallery__zoom" data-zoom aria-pressed="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          <span>Ampliar vista</span>
        </button>
        ${fotos.length > 1 ? `
          <button class="gallery__nav gallery__nav--prev" data-g="-1" aria-label="Foto anterior">${icon("i-left")}</button>
          <button class="gallery__nav gallery__nav--next" data-g="1" aria-label="Foto siguiente">${icon("i-right")}</button>
          <span class="gallery__count" id="gCount">1 / ${fotos.length}</span>` : ""}
      </div>
      ${fotos.length > 1 ? `<div class="thumbs">${fotos.map((f, i) =>
        `<button data-t="${i}" class="${i === 0 ? "is-active" : ""}" aria-label="Foto ${i + 1}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
    ` : `<div class="gallery">${placeholder}</div>`}
    <div class="detail">
      <div>
        <h2 id="mTitle">${esc(c.nombre)}</h2>
        <p class="detail__loc">${icon("i-pin")} ${esc(c.ubicacion || "Laguna La Brava, Balcarce")}</p>
        <ul class="specs">${specsHTML(c)}</ul>
        ${c.descripcion ? `<p class="detail__desc">${esc(c.descripcion)}</p>` : ""}
        ${comodidades.length ? `<h3>Comodidades</h3><ul class="amenities">${comodidades.map(x => `<li>${icon("i-check")} ${esc(x)}</li>`).join("")}</ul>` : ""}
        ${reglas.length ? `<h3>Normas de la casa</h3><ul class="rules">${reglas.map(([ok, t]) =>
          `<li><svg class="ico ${ok ? "ico--yes" : "ico--no"}"><use href="#${ok ? "i-check" : "i-x"}"/></svg> ${t}</li>`).join("")}</ul>` : ""}
      </div>
      <aside class="booking">
        ${p
          ? `<div class="price"><small>Valor</small><strong>${esc(p.monto)} <span>/ ${esc(p.periodo)}</span></strong></div>`
          : `<div class="price price--consultar"><small>Valor</small><strong>Consultar precio</strong></div>`}
        <div class="booking__state booking__state--${esc(estado)}">${esc(ESTADOS[estado] || estado)}</div>
        <button class="btn btn--wa" data-reservar="${esc(c.id)}">${icon("i-wa")} Reservar por WhatsApp</button>
        <p class="booking__note">La reserva se confirma por WhatsApp · Trato directo con el dueño</p>
        ${info.length ? `<ul class="booking__list">${info.map(([k, v]) => `<li><span>${k}</span><strong>${esc(v)}</strong></li>`).join("")}</ul>` : ""}
      </aside>
    </div>`;
}

async function abrir(id) {
  const c = cabanas.find(x => x.id === id);
  if (!c) return;
  c.fotos = (await Promise.all((c.fotos || []).map(leerFoto))).filter(Boolean);
  galeria = { fotos: c.fotos || [], i: 0 };
  modalBody.innerHTML = detalleHTML(c);
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  $(".modal__close", modal).focus();
  const img = $("#gImg");
  if (img) img.addEventListener("load", ajustarAmpliada);
}

// ---------- Reservar: calendario y después el botón de enviar ----------
const reserva = $("#reserva");

function abrirReserva(id) {
  const c = cabanas.find(x => x.id === id);
  if (!c) return;
  $("#rTitle").textContent = c.nombre;
  $("#rSinFechas").href = linkWhatsApp(mensajeCabana(c));
  const enviar = $("#rEnviar");
  const listo = sel => {
    const ok = !!(sel.desde && sel.hasta);
    enviar.hidden = !ok;
    if (ok) enviar.href = linkWhatsApp(mensajeReserva(c, sel));
  };
  // Nodo nuevo para no acumular listeners de calendarios anteriores
  const viejo = $("#rCal");
  const el = viejo.cloneNode(false);
  viejo.replaceWith(el);
  crearCalendario(el, { ocupado: c.ocupado || [], checkIn: c.checkIn, checkOut: c.checkOut, onChange: listo });
  listo({});
  reserva.hidden = false;
  document.body.style.overflow = "hidden";
  $(".modal__close", reserva).focus();
}

function cerrarReserva() {
  reserva.hidden = true;
  if (modal.hidden) document.body.style.overflow = "";
}

reserva.addEventListener("click", e => {
  if (e.target.closest("[data-close]")) return cerrarReserva();
  // Al mandar el mensaje se cierra la ventana (WhatsApp se abre en otra pestaña)
  if (e.target.closest("#rEnviar, #rSinFechas")) setTimeout(cerrarReserva, 300);
});

function mensajeReserva(c, { desde, hasta }) {
  const n = noches(desde, hasta);
  return [
    `¡Hola! Quiero reservar la cabaña "${c.nombre}" en Laguna La Brava.`,
    "",
    `Ingreso: ${fechaTexto(desde, true)}${c.checkIn ? ` (${c.checkIn} hs)` : ""}`,
    `Salida: ${fechaTexto(hasta, true)}${c.checkOut ? ` (${c.checkOut} hs)` : ""}`,
    `Total: ${n} noche${n === 1 ? "" : "s"}`,
    "",
    "¿Está disponible para esas fechas y cuál sería el valor?"
  ].join("\n");
}

// Ampliar vista: la galería crece hacia abajo hasta mostrar la foto completa
function ajustarAmpliada() {
  const g = $(".gallery", modalBody), img = $("#gImg");
  if (!g || !img || !g.classList.contains("is-expanded") || !img.naturalWidth) return;
  const alto = g.clientWidth * img.naturalHeight / img.naturalWidth;
  g.style.height = Math.min(alto, window.innerHeight * 0.85) + "px";
}

function toggleAmpliar(btn) {
  const g = btn.closest(".gallery");
  const on = g.classList.toggle("is-expanded");
  btn.setAttribute("aria-pressed", on);
  $("span", btn).textContent = on ? "Reducir vista" : "Ampliar vista";
  if (on) ajustarAmpliada();
  else g.style.height = "";
}

function cerrar() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

function irA(i) {
  const n = galeria.fotos.length;
  if (!n) return;
  galeria.i = (i + n) % n;
  $("#gImg").src = galeria.fotos[galeria.i];
  const count = $("#gCount");
  if (count) count.textContent = `${galeria.i + 1} / ${n}`;
  modalBody.querySelectorAll(".thumbs button").forEach((b, k) => b.classList.toggle("is-active", k === galeria.i));
}

grid.addEventListener("click", e => {
  const r = e.target.closest("[data-reservar]");
  if (r) return abrirReserva(r.dataset.reservar);
  const b = e.target.closest("[data-open]");
  if (b) abrir(b.dataset.open);
});
modal.addEventListener("click", e => {
  if (e.target.closest("[data-close]")) return cerrar();
  const r = e.target.closest("[data-reservar]");
  if (r) return abrirReserva(r.dataset.reservar);
  const z = e.target.closest("[data-zoom]");
  if (z) return toggleAmpliar(z);
  const g = e.target.closest("[data-g]");
  if (g) return irA(galeria.i + Number(g.dataset.g));
  const t = e.target.closest("[data-t]");
  if (t) irA(Number(t.dataset.t));
});
document.addEventListener("keydown", e => {
  if (!reserva.hidden) { if (e.key === "Escape") cerrarReserva(); return; }
  if (modal.hidden) return;
  if (e.key === "Escape") cerrar();
  if (e.key === "ArrowRight") irA(galeria.i + 1);
  if (e.key === "ArrowLeft") irA(galeria.i - 1);
});

// ---------- Datos de ejemplo (solo si Firebase no está configurado) ----------
function rangoDemo(a, b) {
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x); };
  return { desde: d(a), hasta: d(b) };
}
const DEMO = [
  {
    id: "demo-1", nombre: "Cabaña El Mirador", destacada: true, estado: "disponible", orden: 1,
    descripcionCorta: "Vista abierta a la laguna, galería con parrilla y hogar a leña.",
    descripcion: "Cabaña de madera y piedra con vista directa a la laguna. Living comedor con hogar a leña, cocina equipada y galería con parrilla para disfrutar los atardeceres.\n\nIdeal para parejas o familias que buscan tranquilidad.",
    capacidad: 4, dormitorios: 2, banos: 1, camas: "1 matrimonial, 2 individuales", superficie: 65,
    distanciaLaguna: "100 m", checkIn: "14:00", checkOut: "10:00", estadiaMinima: "1 mes",
    mascotas: true, fumar: false, fotos: [], ocupado: [rangoDemo(5, 9), rangoDemo(16, 23)],
    comodidades: ["Wi-Fi", "Parrilla", "Hogar a leña", "Cocina equipada", "Vista a la laguna", "Estacionamiento", "Ropa de cama"],
    precio: { modo: "precio", monto: 850000, moneda: "ARS", periodo: "mes" }
  },
  {
    id: "demo-2", nombre: "Cabaña Los Teros", estado: "disponible", orden: 2,
    descripcionCorta: "Amplia, para grupos y familias, con jardín privado.",
    descripcion: "Tres dormitorios, dos baños y un gran jardín privado con parrilla. Perfecta para familias numerosas o grupos de amigos.",
    capacidad: 6, dormitorios: 3, banos: 2, superficie: 90, distanciaLaguna: "300 m",
    mascotas: false, fumar: false, fotos: [],
    comodidades: ["Wi-Fi", "Parrilla", "Calefacción", "Jardín privado", "Smart TV", "Lavarropas"],
    precio: { modo: "precio", monto: 1200, moneda: "USD", periodo: "mes" }
  },
  {
    id: "demo-3", nombre: "Cabaña Sierra Chica", estado: "reservada", orden: 3,
    descripcionCorta: "Refugio para dos, rodeado de árboles y con deck propio.",
    capacidad: 2, dormitorios: 1, banos: 1, superficie: 40, fotos: [],
    comodidades: ["Wi-Fi", "Galería / deck", "Calefacción", "Cocina equipada"],
    precio: { modo: "consultar" }
  }
];

// ---------- Inicio ----------
cargarCabanas()
  .then(lista => { cabanas = ordenar(lista); render(); })
  .catch(err => {
    console.error("No se pudieron cargar las cabañas:", err);
    grid.innerHTML = "";
    empty.hidden = false;
    empty.innerHTML = `No pudimos cargar las cabañas en este momento. <a href="${linkWhatsApp(msgGeneral)}" target="_blank" rel="noopener">Consultanos por WhatsApp</a>.`;
  });
