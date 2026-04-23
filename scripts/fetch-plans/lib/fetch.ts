const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const TIMEOUT_MS = 10_000

export async function fetchHtml(url: string): Promise<string> {
  const attempt = async (): Promise<string> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
        redirect: 'follow',
        signal: controller.signal,
      })
      if (!res.ok) {
        const err: Error & { status?: number } = new Error(`HTTP ${res.status} for ${url}`)
        err.status = res.status
        throw err
      }
      return await res.text()
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    return await attempt()
  } catch (err) {
    const e = err as Error & { status?: number }
    const retryable = !e.status || e.status >= 500 || e.name === 'AbortError'
    if (!retryable) throw err
    return await attempt()
  }
}
