// Les écritures doivent venir de Limbus (US-104, ADR-0053) : comme un navigateur sur la page de l'application, chaque
// requête des tests porte Sec-Fetch-Site: same-origin, sauf si le test en fixe un, ou en retire avec 'x-test-no-origin'
const nativeFetch = globalThis.fetch

globalThis.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers)
  if (headers.has('x-test-no-origin')) headers.delete('x-test-no-origin')
  else if (!headers.has('sec-fetch-site')) headers.set('sec-fetch-site', 'same-origin')
  return nativeFetch(input, { ...init, headers })
}
