// Calendario de disponibilidad compartido entre la landing y el panel.
// Las ocupaciones son rangos { desde, hasta } con fechas "AAAA-MM-DD":
// "desde" es el día de ingreso y "hasta" el de salida, así que ocupan las
// noches desde <= d < hasta (el día de salida queda libre para otro ingreso).
import { esc } from "./shared.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const MESES_ADELANTE = 18;

const dos = n => String(n).padStart(2, "0");
export const iso = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const aFecha = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const hoyIso = () => iso(new Date());
export const noches = (desde, hasta) => Math.round((aFecha(hasta) - aFecha(desde)) / 864e5);

export const nocheOcupada = (rangos, dia) => rangos.some(r => r.desde <= dia && dia < r.hasta);
export const rangoLibre = (rangos, desde, hasta) => !rangos.some(r => r.desde < hasta && desde < r.hasta);

// "lunes 3 de noviembre de 2026" (largo) o "lun 3 nov" (corto)
export function fechaTexto(s, largo = false) {
  const opts = largo
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { weekday: "short", day: "numeric", month: "short" };
  return aFecha(s).toLocaleDateString("es-AR", opts).replace(/\./g, "");
}

/**
 * Dibuja un calendario seleccionable dentro de `el`.
 * opciones: ocupado (rangos), meses (cuántos mostrar a la vez), checkIn/checkOut (horarios),
 * etiqueta(dia) → texto de ayuda para un día ocupado, onChange({ desde, hasta }).
 */
export function crearCalendario(el, { ocupado = [], meses = 1, checkIn = "", checkOut = "", leyendaSel = "Tus fechas", etiqueta, onChange } = {}) {
  let rangos = ocupado;
  let ini = null, fin = null, error = "";
  const base = new Date(); base.setDate(1);
  let offset = 0;

  function mesHTML(y, m) {
    const hoy = hoyIso();
    const primero = new Date(y, m, 1);
    const total = new Date(y, m + 1, 0).getDate();
    let celdas = `<span></span>`.repeat((primero.getDay() + 6) % 7);
    for (let n = 1; n <= total; n++) {
      const d = iso(new Date(y, m, n));
      const pasado = d < hoy;
      const ocupada = nocheOcupada(rangos, d);
      const cls = [
        pasado && "is-past", ocupada && "is-busy", d === hoy && "is-today",
        d === ini && "is-start", d === ini && !fin && "is-solo", d === fin && "is-end", ini && fin && d > ini && d < fin && "is-range"
      ].filter(Boolean).join(" ");
      const titulo = ocupada ? (etiqueta?.(d) || "Ocupado") : "";
      celdas += `<button type="button" class="cal__day ${cls}" data-dia="${d}" ${pasado ? "disabled" : ""}
        ${titulo ? `title="${esc(titulo)}"` : ""} aria-label="${esc(fechaTexto(d, true))}${ocupada ? " (ocupado)" : ""}">${n}</button>`;
    }
    return `
      <div class="cal__mes">
        <p class="cal__titulo">${MESES[m]} ${y}</p>
        <div class="cal__grid">${DIAS.map(x => `<span class="cal__dow">${x}</span>`).join("")}${celdas}</div>
      </div>`;
  }

  function hintHTML() {
    if (error) return `<span class="cal__error">${esc(error)}</span>`;
    const hIn = checkIn ? ` (desde las ${esc(checkIn)})` : "";
    const hOut = checkOut ? ` (hasta las ${esc(checkOut)})` : "";
    if (!ini) return "Tocá el día de ingreso.";
    if (!fin) return `Ingreso: <strong>${esc(fechaTexto(ini))}</strong>${hIn}. Ahora tocá el día de salida.`;
    const n = noches(ini, fin);
    return `<strong>${n} noche${n === 1 ? "" : "s"}</strong> · Ingreso ${esc(fechaTexto(ini))}${hIn} · Salida ${esc(fechaTexto(fin))}${hOut}
      <button type="button" class="cal__clear" data-clear>Borrar</button>`;
  }

  function render() {
    let html = "";
    for (let k = 0; k < meses; k++) {
      const d = new Date(base.getFullYear(), base.getMonth() + offset + k, 1);
      html += mesHTML(d.getFullYear(), d.getMonth());
    }
    el.innerHTML = `
      <div class="cal__body">
        <button type="button" class="cal__nav cal__nav--prev" data-nav="-1" aria-label="Mes anterior" ${offset <= 0 ? "disabled" : ""}><svg class="ico"><use href="#i-left"/></svg></button>
        <button type="button" class="cal__nav cal__nav--next" data-nav="1" aria-label="Mes siguiente" ${offset + meses >= MESES_ADELANTE ? "disabled" : ""}><svg class="ico"><use href="#i-right"/></svg></button>
        <div class="cal__meses">${html}</div>
      </div>
      <div class="cal__ley"><span><i class="cal__sw"></i>Libre</span><span><i class="cal__sw cal__sw--busy"></i>Ocupado</span><span><i class="cal__sw cal__sw--sel"></i>${esc(leyendaSel)}</span></div>
      <p class="cal__hint" aria-live="polite">${hintHTML()}</p>`;
  }

  function avisar() {
    error = "";
    render();
    onChange?.({ desde: ini, hasta: fin });
  }

  function elegir(d) {
    if (ini && !fin && d > ini) {
      if (rangoLibre(rangos, ini, d)) fin = d;
      else if (!nocheOcupada(rangos, d)) ini = d;
      else { error = "Hay días ocupados en ese rango. Elegí otras fechas."; return render(); }
    } else if (ini && !fin && d === ini) {
      ini = null;
    } else if (!nocheOcupada(rangos, d)) {
      ini = d; fin = null;
    } else {
      error = "Ese día ya está ocupado.";
      return render();
    }
    avisar();
  }

  el.classList.add("cal");
  el.addEventListener("click", e => {
    const nav = e.target.closest("[data-nav]");
    if (nav) { offset += Number(nav.dataset.nav); error = ""; return render(); }
    if (e.target.closest("[data-clear]")) { ini = fin = null; return avisar(); }
    const dia = e.target.closest("[data-dia]");
    if (dia && !dia.disabled) elegir(dia.dataset.dia);
  });
  render();

  return {
    get seleccion() { return { desde: ini, hasta: fin }; },
    setOcupado(r) { rangos = r; render(); },
    limpiar() { ini = fin = null; avisar(); }
  };
}
