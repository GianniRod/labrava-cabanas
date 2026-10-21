import { firebaseConfig, firebaseSinConfigurar, COLECCION } from "./firebase-config.js";
import { esc, formatoPrecio, COMODIDADES, ESTADOS } from "./shared.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2";
const { initializeApp } = await import(`${FB}/firebase-app.js`);
const {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} = await import(`${FB}/firebase-auth.js`);
const {
  getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, getDocs, getDoc, serverTimestamp
} = await import(`${FB}/firebase-firestore.js`);

const $ = (s, el = document) => el.querySelector(s);
const icon = id => `<svg class="ico"><use href="#${id}"/></svg>`;

const viewLogin = $("#viewLogin");
const viewApp = $("#viewApp");

// ---------- Toast ----------
let toastTimer;
function toast(msg, error = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (error ? " toast--error" : "");
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), error ? 6000 : 3000);
}

// ---------- Firebase sin configurar ----------
if (firebaseSinConfigurar) {
  viewLogin.hidden = false;
  $("#cfgNotice").hidden = false;
  $("#loginBtn").disabled = true;
  throw new Error("Configurá js/firebase-config.js");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const col = collection(db, COLECCION);

// Las fotos subidas se guardan en la colección "fotos" (sin Firebase Storage)
// y en la cabaña se referencian como "fs:<id>". Los links se guardan tal cual.
const fotosCol = collection(db, "fotos");
const cacheFotos = new Map();
const esFotoFs = f => f.startsWith("fs:");
function leerFoto(f) {
  if (!esFotoFs(f)) return Promise.resolve(f);
  if (!cacheFotos.has(f)) {
    cacheFotos.set(f, getDoc(doc(fotosCol, f.slice(3))).then(s => s.data()?.data || "").catch(() => ""));
  }
  return cacheFotos.get(f);
}
// Completa el src de las <img data-foto> dentro de el
function hidratarFotos(el) {
  el.querySelectorAll("img[data-foto]").forEach(async img => {
    const src = await leerFoto(img.dataset.foto);
    if (src) img.src = src;
  });
}
const borrarFotos = refs => refs.filter(esFotoFs).forEach(f => {
  cacheFotos.delete(f);
  deleteDoc(doc(fotosCol, f.slice(3))).catch(console.error);
});

// ============================================================
//  LOGIN
// ============================================================
const ERRORES_AUTH = {
  "auth/invalid-credential": "Usuario o contraseña incorrectos.",
  "auth/invalid-login-credentials": "Usuario o contraseña incorrectos.",
  "auth/wrong-password": "Usuario o contraseña incorrectos.",
  "auth/user-not-found": "Usuario o contraseña incorrectos.",
  "auth/invalid-email": "El usuario no es válido.",
  "auth/missing-password": "Ingresá tu contraseña.",
  "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos e intentá de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revisá tu internet.",
  "auth/user-disabled": "Este usuario está deshabilitado.",
  "auth/operation-not-allowed": "El proveedor Correo/Contraseña no está habilitado en Firebase Authentication.",
  "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication."
};
const errorAuth = e => ERRORES_AUTH[e.code] || "No se pudo iniciar sesión. Intentá de nuevo.";

function loginError(msg) {
  const el = $("#loginError");
  el.textContent = msg || "";
  el.hidden = !msg;
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  loginError("");
  const btn = $("#loginBtn");
  btn.disabled = true;
  btn.textContent = "Ingresando…";
  try {
    const user = $("#lEmail").value.trim();
    const email = user.includes("@") ? user : user + "@labrava.com";
    await signInWithEmailAndPassword(auth, email, $("#lPass").value);
  } catch (err) {
    loginError(errorAuth(err));
  } finally {
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
});

$("#togglePw").addEventListener("click", () => {
  const i = $("#lPass");
  i.type = i.type === "password" ? "text" : "password";
});

$("#forgotBtn").addEventListener("click", async () => {
  const user = $("#lEmail").value.trim();
  if (!user) return loginError("Escribí tu usuario arriba y volvé a tocar 'Olvidé mi contraseña'.");
  const email = user.includes("@") ? user : user + "@labrava.com";
  try {
    await sendPasswordResetEmail(auth, email);
    loginError("");
    toast("Te enviamos un email para restablecer la contraseña.");
  } catch (err) {
    loginError(errorAuth(err));
  }
});

$("#logoutBtn").addEventListener("click", () => signOut(auth));

// ============================================================
//  LISTADO
// ============================================================
let cabanas = [];
let unsub = null;
let unsubAdmins = null;

onAuthStateChanged(auth, user => {
  viewLogin.hidden = !!user;
  viewApp.hidden = !user;
  if (unsub) { unsub(); unsub = null; }
  if (unsubAdmins) { unsubAdmins(); unsubAdmins = null; }
  if (!user) return;
  escucharAdmins();
  $("#userEmail").textContent = user.email;
  $("#list").innerHTML = `<p class="loading">Cargando cabañas…</p>`;
  unsub = onSnapshot(col, snap => {
    cabanas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.nombre).localeCompare(String(b.nombre)));
    renderLista();
  }, err => {
    console.error(err);
    $("#list").innerHTML = "";
    toast(err.code === "permission-denied"
      ? "Tu usuario no tiene permisos de administrador (revisá las reglas de Firestore)."
      : "No se pudieron cargar las cabañas.", true);
  });
});

function precioTexto(c) {
  const p = formatoPrecio(c.precio);
  return p ? `${p.monto} / ${p.periodo}` : "Consultar precio";
}

function renderLista() {
  const q = $("#search").value.trim().toLowerCase();
  const fe = $("#fEstado").value;
  const lista = cabanas.filter(c =>
    (!q || String(c.nombre).toLowerCase().includes(q)) && (!fe || (c.estado || "disponible") === fe));

  $("#sTotal").textContent = cabanas.length;
  $("#sPub").textContent = cabanas.filter(c => c.publicada).length;
  $("#sDisp").textContent = cabanas.filter(c => (c.estado || "disponible") === "disponible").length;
  $("#sRes").textContent = cabanas.filter(c => c.estado === "reservada").length;

  $("#listEmpty").hidden = cabanas.length > 0;
  $("#list").innerHTML = lista.length || !cabanas.length ? lista.map(c => {
    const estado = c.estado || "disponible";
    const meta = [
      c.capacidad && `${c.capacidad} huéspedes`,
      c.dormitorios && `${c.dormitorios} dorm.`,
      c.banos && `${c.banos} baño${c.banos == 1 ? "" : "s"}`,
      `${(c.fotos || []).length} fotos`
    ].filter(Boolean);
    return `
    <div class="row-item">
      ${c.fotos?.[0] ? `<img class="row-item__img" data-foto="${esc(c.fotos[0])}" alt="">` : `<div class="row-item__img"></div>`}
      <div class="row-item__main">
        <h3>${esc(c.nombre)}${c.destacada ? `<span class="tag">Destacada</span>` : ""}${c.publicada ? "" : `<span class="tag tag--off">Oculta</span>`}</h3>
        <div class="row-item__meta"><span class="row-item__price">${esc(precioTexto(c))}</span>${meta.map(m => `<span>${esc(m)}</span>`).join("")}</div>
      </div>
      <div class="row-item__ctrl">
        <label class="switch row-item__pub"><input type="checkbox" data-pub="${esc(c.id)}" ${c.publicada ? "checked" : ""}><span class="switch__track"></span><span>Publicada</span></label>
        <div class="row-item__state">
          <select data-estado="${esc(c.id)}" data-v="${esc(estado)}" aria-label="Estado">
            ${Object.entries(ESTADOS).map(([v, t]) => `<option value="${v}" ${v === estado ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
        <div class="row-item__actions">
          <button class="icon-btn" data-edit="${esc(c.id)}" aria-label="Editar">${icon("i-edit")}</button>
          <button class="icon-btn icon-btn--danger" data-del="${esc(c.id)}" aria-label="Eliminar">${icon("i-trash")}</button>
        </div>
      </div>
    </div>`;
  }).join("") : `<p class="loading">No hay cabañas que coincidan con la búsqueda.</p>`;
  hidratarFotos($("#list"));
}

$("#search").addEventListener("input", renderLista);
$("#fEstado").addEventListener("change", renderLista);

$("#list").addEventListener("change", async e => {
  const t = e.target;
  try {
    if (t.dataset.pub) {
      await updateDoc(doc(db, COLECCION, t.dataset.pub), { publicada: t.checked, actualizado: serverTimestamp() });
      toast(t.checked ? "Cabaña publicada en la web." : "Cabaña oculta de la web.");
    } else if (t.dataset.estado) {
      t.dataset.v = t.value;
      await updateDoc(doc(db, COLECCION, t.dataset.estado), { estado: t.value, actualizado: serverTimestamp() });
      toast(`Estado: ${ESTADOS[t.value]}.`);
    }
  } catch (err) {
    console.error(err);
    toast("No se pudo guardar el cambio.", true);
  }
});

$("#list").addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]");
  if (ed) return abrirEditor(cabanas.find(c => c.id === ed.dataset.edit));
  const del = e.target.closest("[data-del]");
  if (del) {
    const c = cabanas.find(x => x.id === del.dataset.del);
    if (!confirm(`¿Eliminar "${c?.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, COLECCION, del.dataset.del));
      borrarFotos(c?.fotos || []);
      toast("Cabaña eliminada.");
    } catch (err) {
      console.error(err);
      toast("No se pudo eliminar.", true);
    }
  }
});

$("#newBtn").addEventListener("click", () => abrirEditor(null));
document.querySelector("[data-new]").addEventListener("click", () => abrirEditor(null));

// ============================================================
//  EDITOR
// ============================================================
const drawer = $("#drawer");
const form = $("#form");
let editId = null;
let fotos = [];
let fotosOriginales = [];
let comodidadesExtra = [];
let subiendo = 0;

const CAMPOS_TEXTO = ["nombre", "descripcionCorta", "descripcion", "ubicacion", "camas", "distanciaLaguna", "checkIn", "checkOut", "estadiaMinima"];
const CAMPOS_NUM = ["capacidad", "dormitorios", "banos", "superficie", "orden"];

function abrirEditor(c) {
  editId = c?.id || null;
  form.reset();
  formError("");
  $("#formTitle").textContent = c ? "Editar cabaña" : "Nueva cabaña";

  CAMPOS_TEXTO.forEach(k => ($("#" + k).value = c?.[k] ?? ""));
  CAMPOS_NUM.forEach(k => ($("#" + k).value = c?.[k] ?? ""));
  if (!c) $("#ubicacion").value = "Laguna La Brava, Balcarce";

  const p = c?.precio || { modo: "precio", moneda: "ARS", periodo: "mes" };
  form.querySelector(`input[name="modo"][value="${p.modo === "consultar" ? "consultar" : "precio"}"]`).checked = true;
  $("#moneda").value = p.moneda || "ARS";
  $("#monto").value = p.monto ?? "";
  $("#periodo").value = p.periodo || "mes";

  $("#mascotas").checked = !!c?.mascotas;
  $("#fumar").checked = !!c?.fumar;
  $("#estado").value = c?.estado || "disponible";
  $("#publicada").checked = c ? !!c.publicada : true;
  $("#destacada").checked = !!c?.destacada;

  fotos = [...(c?.fotos || [])];
  fotosOriginales = [...fotos];
  const actuales = c?.comodidades || [];
  comodidadesExtra = actuales.filter(x => !COMODIDADES.includes(x));
  renderComodidades(actuales);
  renderFotos();
  actualizarPrecio();
  $("#uploadStatus").hidden = true;

  drawer.hidden = false;
  document.body.style.overflow = "hidden";
  $(".drawer__body").scrollTop = 0;
  setTimeout(() => $("#nombre").focus(), 50);
}

function cerrarEditor() {
  if (subiendo && !confirm("Hay fotos subiéndose. ¿Cerrar igual?")) return;
  // Sin guardar: descartar las fotos subidas en esta edición
  borrarFotos(fotos.filter(f => !fotosOriginales.includes(f)));
  drawer.hidden = true;
  document.body.style.overflow = "";
}

drawer.addEventListener("click", e => { if (e.target.closest("[data-close]")) cerrarEditor(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !drawer.hidden) cerrarEditor(); });

function formError(msg) {
  const el = $("#formError");
  el.textContent = msg || "";
  el.hidden = !msg;
}

// ---------- Precio ----------
function leerPrecio() {
  const modo = form.querySelector('input[name="modo"]:checked').value;
  if (modo === "consultar") return { modo };
  return { modo, moneda: $("#moneda").value, monto: Number($("#monto").value) || 0, periodo: $("#periodo").value };
}

function actualizarPrecio() {
  const p = leerPrecio();
  $("#precioCampos").classList.toggle("is-off", p.modo === "consultar");
  const f = formatoPrecio(p);
  $("#precioPreview").textContent = f ? `${f.monto} / ${f.periodo}` : "Consultar precio";
}
["#moneda", "#monto", "#periodo"].forEach(s => $(s).addEventListener("input", actualizarPrecio));
form.querySelectorAll('input[name="modo"]').forEach(r => r.addEventListener("change", actualizarPrecio));

// ---------- Comodidades ----------
function renderComodidades(seleccionadas) {
  const todas = [...COMODIDADES, ...comodidadesExtra];
  $("#comodidades").innerHTML = todas.map(x =>
    `<label class="check"><input type="checkbox" value="${esc(x)}" ${seleccionadas.includes(x) ? "checked" : ""}> ${esc(x)}</label>`).join("");
}
const comodidadesMarcadas = () => [...$("#comodidades").querySelectorAll("input:checked")].map(i => i.value);

function agregarComodidad() {
  const v = $("#comodidadExtra").value.trim();
  if (!v) return;
  const marcadas = comodidadesMarcadas();
  if (!COMODIDADES.includes(v) && !comodidadesExtra.includes(v)) comodidadesExtra.push(v);
  renderComodidades([...marcadas, v]);
  $("#comodidadExtra").value = "";
}
$("#addComodidadBtn").addEventListener("click", agregarComodidad);
$("#comodidadExtra").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); agregarComodidad(); } });

// ---------- Fotos ----------
function renderFotos() {
  $("#photos").innerHTML = fotos.map((f, i) => `
    <div class="photo">
      <img data-foto="${esc(f)}" alt="Foto ${i + 1}">
      ${i === 0 ? `<span class="photo__cover">Portada</span>` : ""}
      <div class="photo__tools">
        <span>
          <button type="button" data-mv="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Mover a la izquierda">${icon("i-left")}</button>
          <button type="button" data-mv="${i}" data-dir="1" ${i === fotos.length - 1 ? "disabled" : ""} aria-label="Mover a la derecha">${icon("i-right")}</button>
        </span>
        <button type="button" data-del="${i}" aria-label="Quitar foto">${icon("i-trash")}</button>
      </div>
    </div>`).join("");
  hidratarFotos($("#photos"));
}

$("#photos").addEventListener("click", e => {
  const mv = e.target.closest("[data-mv]");
  if (mv) {
    const i = Number(mv.dataset.mv), j = i + Number(mv.dataset.dir);
    [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
    return renderFotos();
  }
  const del = e.target.closest("[data-del]");
  if (del) { fotos.splice(Number(del.dataset.del), 1); renderFotos(); }
});

function agregarUrl() {
  const v = $("#fotoUrl").value.trim();
  if (!/^https?:\/\/\S+$/i.test(v)) return toast("Pegá un link válido que empiece con https://", true);
  fotos.push(v);
  $("#fotoUrl").value = "";
  renderFotos();
}
$("#addUrlBtn").addEventListener("click", agregarUrl);
$("#fotoUrl").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); agregarUrl(); } });

// Redimensiona y comprime a JPEG hasta que entre en un documento de Firestore (límite 1 MB)
async function comprimir(file) {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  for (const [max, calidad] of [[1600, 0.8], [1280, 0.72], [1024, 0.65], [800, 0.6]]) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", calidad);
    if (url.length < 900_000) return url;
  }
  throw new Error("La foto es demasiado pesada");
}

$("#fileInput").addEventListener("change", async e => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  const status = $("#uploadStatus");
  status.hidden = false;
  subiendo += files.length;
  let ok = 0;
  for (const file of files) {
    status.textContent = `Subiendo fotos… (${ok + 1} de ${files.length})`;
    try {
      const data = await comprimir(file);
      const r = await addDoc(fotosCol, { data, creado: serverTimestamp() });
      const f = "fs:" + r.id;
      cacheFotos.set(f, Promise.resolve(data));
      fotos.push(f);
      ok++;
      renderFotos();
    } catch (err) {
      console.error(err);
      toast(err.code === "permission-denied"
        ? "No se pudo subir la foto: falta actualizar las reglas de Firestore (ver README)."
        : "No se pudo subir una foto. Probá con otra imagen o pegá el link.", true);
    } finally {
      subiendo--;
    }
  }
  status.textContent = ok ? `${ok} foto${ok === 1 ? "" : "s"} subida${ok === 1 ? "" : "s"}. Recordá guardar la cabaña.` : "";
  status.hidden = !ok;
});

// ---------- Guardar ----------
form.addEventListener("submit", async e => {
  e.preventDefault();
  formError("");
  const nombre = $("#nombre").value.trim();
  if (!nombre) { formError("El nombre de la cabaña es obligatorio."); $("#nombre").focus(); return; }
  const precio = leerPrecio();
  if (precio.modo === "precio" && !precio.monto) {
    formError("Ingresá un monto o elegí “Consultar precio”.");
    $("#monto").focus();
    return;
  }
  if (subiendo) { formError("Esperá a que terminen de subirse las fotos."); return; }

  const data = { precio, fotos, comodidades: comodidadesMarcadas() };
  CAMPOS_TEXTO.forEach(k => (data[k] = $("#" + k).value.trim()));
  CAMPOS_NUM.forEach(k => {
    const v = $("#" + k).value;
    data[k] = v === "" ? null : Number(v);
  });
  data.mascotas = $("#mascotas").checked;
  data.fumar = $("#fumar").checked;
  data.estado = $("#estado").value;
  data.publicada = $("#publicada").checked;
  data.destacada = $("#destacada").checked;
  data.actualizado = serverTimestamp();

  const btn = $("#saveBtn");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    if (editId) {
      await updateDoc(doc(db, COLECCION, editId), data);
    } else {
      data.creado = serverTimestamp();
      await addDoc(col, data);
    }
    borrarFotos(fotosOriginales.filter(f => !fotos.includes(f)));
    drawer.hidden = true;
    document.body.style.overflow = "";
    toast(editId ? "Cambios guardados." : "Cabaña creada.");
  } catch (err) {
    console.error(err);
    formError(err.code === "permission-denied"
      ? "No tenés permisos para guardar. Revisá las reglas de Firestore."
      : "No se pudo guardar. Intentá de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar cabaña";
  }
});


// ============================================================
//  TABS
// ============================================================
const tabBtns = document.querySelectorAll("[data-tab]");
const panels = { cabanas: $("#panelCabanas"), usuarios: $("#panelUsuarios") };

tabBtns.forEach(btn => btn.addEventListener("click", () => {
  tabBtns.forEach(b => b.classList.remove("tab--active"));
  btn.classList.add("tab--active");
  Object.values(panels).forEach(p => p.hidden = true);
  panels[btn.dataset.tab].hidden = false;
}));

// ============================================================
//  GESTIÓN DE USUARIOS (colección "admins")
// ============================================================
const adminsCol = collection(db, "admins");
let admins = [];

async function escucharAdmins() {
  if (unsubAdmins) { unsubAdmins(); unsubAdmins = null; }

  // Bootstrap: intentar auto-registrarse como admin.
  // Si ya existe el doc, fallará silenciosamente (update denegado).
  if (auth.currentUser) {
    try {
      await setDoc(doc(db, "admins", auth.currentUser.email), {
        creadoPor: "bootstrap", creado: serverTimestamp()
      });
    } catch (e) {
      // Esperado si el doc ya existe o el usuario ya es admin
    }
  }

  unsubAdmins = onSnapshot(adminsCol, snap => {
    admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsuarios();
  }, err => {
    console.error(err);
  });
}

function renderUsuarios() {
  const currentEmail = auth.currentUser?.email;
  $("#userListEmpty").hidden = admins.length > 0;
  $("#userList").innerHTML = admins
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(a => {
      const nombre = a.id.replace("@labrava.com", "");
      const esSelf = a.id === currentEmail;
      return `
      <div class="user-item">
        <div class="user-item__info">
          <span class="user-item__name">${esc(nombre)}${esSelf ? ` <span class="user-item__you">Vos</span>` : ""}</span>
          <span class="user-item__email">${esc(a.id)}</span>
        </div>
        ${esSelf ? "" : `<button class="icon-btn icon-btn--danger" data-deluser="${esc(a.id)}" aria-label="Eliminar usuario">${icon("i-trash")}</button>`}
      </div>`;
    }).join("");
}


// Crear usuario
function userError(msg) {
  const el = $("#userError");
  el.textContent = msg || "";
  el.hidden = !msg;
}

$("#addUserBtn").addEventListener("click", async () => {
  userError("");
  const nombre = $("#nuevoUser").value.trim().toLowerCase();
  const pass = $("#nuevoPass").value;

  if (!nombre) { userError("Ingresá un nombre de usuario."); return; }
  if (/[^a-z0-9._-]/.test(nombre)) { userError("Solo letras minúsculas, números, puntos y guiones."); return; }
  if (!pass || pass.length < 6) { userError("La contraseña debe tener al menos 6 caracteres."); return; }

  const email = nombre + "@labrava.com";
  const btn = $("#addUserBtn");
  btn.disabled = true;
  btn.textContent = "Creando…";

  try {
    // Crear usuario en Auth usando una app secundaria para no cerrar la sesión actual
    const secondaryApp = initializeApp(firebaseConfig, "secondary-" + Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    await signOut(secondaryAuth);
    // No necesitamos deleteApp, simplemente ignoramos la instancia secundaria

    // Agregar a la colección admins
    await setDoc(doc(db, "admins", email), { creadoPor: auth.currentUser.email, creado: serverTimestamp() });

    toast(`Usuario "${nombre}" creado.`);
    $("#nuevoUser").value = "";
    $("#nuevoPass").value = "";
  } catch (err) {
    console.error(err);
    const msgs = {
      "auth/email-already-in-use": "Ya existe un usuario con ese nombre.",
      "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres).",
      "auth/invalid-email": "El nombre de usuario no es válido.",
    };
    userError(msgs[err.code] || "No se pudo crear el usuario. Intentá de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = " Crear usuario";
  }
});

// Eliminar usuario (solo de la colección admins, no de Auth)
$("#userList").addEventListener("click", async e => {
  const btn = e.target.closest("[data-deluser]");
  if (!btn) return;
  const email = btn.dataset.deluser;
  const nombre = email.replace("@labrava.com", "");
  if (!confirm(`¿Eliminar el acceso de "${nombre}"? Ya no podrá ingresar al panel.`)) return;
  try {
    await deleteDoc(doc(db, "admins", email));
    toast(`Acceso de "${nombre}" eliminado.`);
  } catch (err) {
    console.error(err);
    toast("No se pudo eliminar el usuario.", true);
  }
});
