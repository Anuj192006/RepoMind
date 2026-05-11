const DEFAULT_TIMEOUT_MS = 15000
const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '/api').trim()
const normalizedApiBase = configuredApiBase.replace(/\/+$/, '') || '/api'

export class ApiError extends Error {
  constructor(message, { status, url, detail, cause } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
    this.detail = detail
    this.cause = cause
  }
}

export function getApiBaseUrl() {
  return normalizedApiBase
}

function toAbsoluteUrl(path, searchParams) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = normalizedApiBase.startsWith('http')
    ? normalizedApiBase
    : new URL(normalizedApiBase, window.location.origin).toString().replace(/\/+$/, '')
  const url = new URL(`${base}${normalizedPath}`)

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    })
  }

  return url
}

function buildErrorMessage(error, url, timeoutMs) {
  if (error?.name === 'AbortError') {
    return `The request to ${url.pathname} timed out after ${Math.round(timeoutMs / 1000)}s.`
  }

  if (error instanceof ApiError) {
    return error.message
  }

  return `Unable to reach the API at ${url.origin}. Make sure the backend is running and reachable.`
}

export async function apiRequest(
  path,
  {
    method = 'GET',
    body,
    headers,
    searchParams,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const url = toAbsoluteUrl(path, searchParams)
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      body,
      headers,
      signal: controller.signal,
    })

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const detail = typeof data === 'object' ? data?.detail || data?.message : data
      throw new ApiError(
        detail || `Request failed with status ${response.status}.`,
        { status: response.status, url: url.toString(), detail },
      )
    }

    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(buildErrorMessage(error, url, timeoutMs), {
      url: url.toString(),
      cause: error,
    })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export function getErrorMessage(error, fallbackMessage = 'Something went wrong.') {
  if (error instanceof ApiError && error.message) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}
