# Cabañas Laguna La Brava — Landing + Panel

Sitio estático (HTML/CSS/JS, sin build) con:

- **`index.html`** — landing pública: cabañas, detalle con galería, la laguna, cómo alquilar, mapa, preguntas frecuentes y contacto por WhatsApp (+54 9 2266 49-54-15).
- **`admin.html`** — panel del propietario con login (email + contraseña de Firebase). Desde ahí se crean, editan, ocultan y eliminan cabañas, se cambia el estado (Disponible / Reservada / No disponible) y se cargan fotos.

Mientras Firebase no esté configurado, la landing muestra 3 cabañas de ejemplo para que puedas ver el diseño.

---

## 1. Crear el proyecto de Firebase

1. Entrá a <https://console.firebase.google.com> → **Agregar proyecto**.
2. **Authentication** → *Comenzar* → *Método de acceso* → habilitá **Correo electrónico/contraseña**.
3. **Authentication → Usuarios → Agregar usuario**: creá tu usuario (email + contraseña). Ese es el que vas a usar en `admin.html`.
4. **Firestore Database** → *Crear base de datos* → modo producción → región `southamerica-east1` (São Paulo).
5. (Opcional, para subir fotos desde el panel) **Storage** → *Comenzar*. Firebase pide el plan **Blaze** para Storage; tiene una capa gratuita amplia, pero requiere tarjeta. Si no querés activarlo, podés cargar fotos pegando el link de la imagen (por ejemplo, de Google Drive público, Imgur, Cloudinary, etc.).

## 2. Conectar el sitio

1. En Firebase: **Configuración del proyecto (⚙) → Tus apps → Web (`</>`)** → registrá la app.
2. Copiá el objeto `firebaseConfig` y pegalo en **`js/firebase-config.js`** reemplazando los valores `TU_...`.

## 3. Reglas de seguridad (importante)

En **`firestore.rules`** y **`storage.rules`** reemplazá `TU_EMAIL@ejemplo.com` por el email del usuario que creaste. Solo ese email puede modificar cabañas; el público solo lee las cabañas marcadas como *Publicada*.

Pegá el contenido en **Firestore → Reglas** y **Storage → Reglas** y publicá (o usá el deploy del paso 4, que las sube solas).

> Recomendado: en **Authentication → Configuración → Acciones del usuario**, desactivá *Habilitar creación (registro)* para que nadie más pueda crear cuentas.

## 4. Publicar la web (Firebase Hosting, gratis)

Requiere [Node.js](https://nodejs.org). En esta carpeta:

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # elegí tu proyecto
firebase deploy
```

Te va a dar una URL tipo `https://tu-proyecto.web.app`. El panel queda en `https://tu-proyecto.web.app/admin.html`.

También podés subir la carpeta a Netlify, Vercel o cualquier hosting estático (en ese caso, cargá las reglas a mano desde la consola).

### Probar en tu PC

Los módulos JS no funcionan abriendo el archivo con doble clic; usá un servidor local:

```bash
npx serve .
# o
python -m http.server 8080
```

## 5. Personalizar

| Qué | Dónde |
|---|---|
| Foto de portada | Guardá una foto horizontal como `assets/hero.jpg` (ideal 2400px de ancho). Se usa sola. |
| Número de WhatsApp | `js/firebase-config.js` → `WHATSAPP_NUMBER` / `WHATSAPP_DISPLAY` |
| Textos, preguntas frecuentes, tiempos de viaje | `index.html` |
| Lista de comodidades del formulario | `js/shared.js` → `COMODIDADES` |
| Colores y tipografías | `css/styles.css` → `:root` |

## Datos de cada cabaña (colección `cabanas`)

Nombre, descripción corta y completa, ubicación, huéspedes, dormitorios, baños, camas, superficie, distancia a la laguna, **precio** (monto + moneda ARS/USD + período mensual/quincenal/semanal/por noche, o **"Consultar precio"**), fotos (la primera es portada), comodidades, mascotas, fumar, check-in/out, estadía mínima, estado, publicada, destacada y orden.
