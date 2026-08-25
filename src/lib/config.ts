// Configuración global de marca y sistema para la personalización de la plataforma.

export const CONFIG = {
  // Nombre del sistema (se usa en títulos y menús)
  SYSTEM_NAME: "OpsVaultec",
  
  // Nombre completo de la empresa (para pantallas corporativas)
  COMPANY_NAME: "Vaultec SpA",
  
  // Dominio de correo electrónico por defecto para placeholders y sugerencias
  DEFAULT_EMAIL_DOMAIN: "vaultec.cl",
  
  // Texto de derechos de autor (copyright)
  COPYRIGHT_TEXT: `© ${new Date().getFullYear()} Vaultec. Todos los derechos reservados.`,
  
  // Versión del sistema
  SYSTEM_VERSION: "v2026.1",
  
  // Ruta al logo de la empresa
  LOGO_PATH: "/logo.png",
  
  // ¿Usar el logo como imagen física o preferir un logo dinámico con icono CSS?
  // true = usa LOGO_PATH. false = dibuja un logo premium usando CSS + Lucide Icon
  USE_IMAGE_LOGO: true,
};
