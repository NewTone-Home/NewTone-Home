const yongheAcceptanceHost = 'duck-feel-rpm-barbara.trycloudflare.com'

export function isYongheCardPreviewHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === yongheAcceptanceHost
}
