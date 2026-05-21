import { isNetworkError, setServerUnavailable } from '~/utils/connection'

function getErrorStatus(error: any): number | undefined {
  return error?.statusCode || error?.status || error?.response?.status
}

export function handleApiAuthError(error: any): void {
  const status = getErrorStatus(error)
  if (!process.client || (status !== 401 && status !== 403)) return

  localStorage.removeItem('offlineAuth')
  window.location.reload()
}

export async function useApiFetch<T = unknown>(request: string, options?: any): Promise<T> {
  try {
    const result = await $fetch<T>(request, options)
    setServerUnavailable(false)
    return result
  } catch (error) {
    if (isNetworkError(error)) {
      setServerUnavailable(true)
    }
    handleApiAuthError(error)
    throw error
  }
}
