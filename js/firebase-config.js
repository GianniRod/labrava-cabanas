// ============================================================
//  Configuración de Firebase
//  Reemplazá estos valores por los de tu proyecto:
//  Firebase Console > Configuración del proyecto > Tus apps > Web
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyBaQdyW-PpsecIF1hkqXILhAelrD-y-7F4",
  authDomain: "labrava-cabana.firebaseapp.com",
  projectId: "labrava-cabana",
  storageBucket: "labrava-cabana.firebasestorage.app",
  messagingSenderId: "626172404254",
  appId: "1:626172404254:web:d4b2ffc8fa8e5407d6040f"
};

// Número de WhatsApp (formato internacional, solo dígitos)
export const WHATSAPP_NUMBER = "5492266495415";
export const WHATSAPP_DISPLAY = "+54 9 2266 49-54-15";

// Colección de Firestore donde se guardan las cabañas
export const COLECCION = "cabanas";

// true si todavía no se cargó la configuración real
export const firebaseSinConfigurar = firebaseConfig.apiKey === "TU_API_KEY";
