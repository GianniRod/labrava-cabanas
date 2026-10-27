// Utilidades compartidas entre la landing y el panel
import { WHATSAPP_NUMBER } from "./firebase-config.js";

export const COMODIDADES = [
  "Wi-Fi", "Parrilla", "Aire acondicionado", "Calefacción", "Hogar a leña",
  "Cocina equipada", "Heladera", "Microondas", "TV / Smart TV", "Ropa de cama",
  "Toallas", "Estacionamiento", "Galería / deck", "Vista a la laguna",
  "Jardín privado", "Pileta", "Lavarropas", "Acceso a la laguna", "Muelle / bajada de botes",
  "Agua caliente", "Vajilla completa", "Juegos de exterior"
];

export const PERIODOS = { mes: "mes", quincena: "quincena", semana: "semana", noche: "noche" };

export const ESTADOS = {
  disponible: "Disponible",
  reservada: "Reservada",
  "no-disponible": "No disponible"
};

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

export function formatoPrecio(precio) {
  if (!precio || precio.modo === "consultar" || !Number(precio.monto)) return null;
  const monto = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Number(precio.monto));
  const simbolo = precio.moneda === "USD" ? "USD" : "$";
  return { monto: `${simbolo} ${monto}`, periodo: PERIODOS[precio.periodo] || "mes" };
}

export function linkWhatsApp(mensaje) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
}

export function mensajeCabana(c) {
  const p = formatoPrecio(c.precio);
  const precio = p ? ` (publicada a ${p.monto} por ${p.periodo})` : "";
  return `¡Hola! Quiero consultar por la cabaña "${c.nombre}"${precio} en Laguna La Brava. ¿Qué fechas tienen disponibles?`;
}
