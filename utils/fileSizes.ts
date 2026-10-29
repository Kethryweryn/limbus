// Espace de stockage affiché en Mo (US-066) : « Mon compte » et la page des comptes
export function formatMegabytes(bytes: number | null | undefined) {
  return `${((bytes || 0) / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}
