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
    return await $fetch<T>(request, options)
  } catch (error) {
    handleApiAuthError(error)
    throw error
  }
}
