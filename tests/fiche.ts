// Une fiche n'a plus de nom ni de téléphone (SPEC-022, US-242) : ils vivent sur ses liens aux jeux. Un test qui crée
// une fiche garde, pour la suite, le nom et le téléphone qu'il lui a donnés dans ses jeux
export async function withFicheValues<T extends object>(created: Promise<T> | T, values: { name: string, phone?: string | null }) {
  return { ...(await created), name: values.name, phone: values.phone ?? null }
}
