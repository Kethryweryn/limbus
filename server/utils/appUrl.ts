export function publicAppUrl() {
  const configuredUrl = useRuntimeConfig().publicAppUrl || process.env.PUBLIC_APP_URL
  const normalizedUrl = String(configuredUrl || '').trim().replace(/\/+$/, '')

  if (normalizedUrl) {
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      throw createError({
        statusCode: 500,
        message: 'PUBLIC_APP_URL doit commencer par http:// ou https://'
      })
    }

    return normalizedUrl
  }

  if (process.env.NODE_ENV === 'production') {
    throw createError({
      statusCode: 500,
      message: 'PUBLIC_APP_URL doit être configuré en production'
    })
  }

  return 'http://localhost:3000'
}

export function absoluteAppUrl(path: string) {
  return `${publicAppUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
