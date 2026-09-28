import { drawingToSvg } from './svg'
import type { Drawing } from './types'

export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Pick a file from disk and read it as text */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      resolve({ name: file.name, text: await file.text() })
    }
    input.click()
  })
}

/**
 * Print drawings at true scale. Each drawing becomes a page; the @page size
 * matches the drawing so the browser doesn't rescale it (as long as the
 * print dialog is set to 100% / "Actual size").
 */
export function printDrawings(pages: Drawing[], title = 'Template'): Promise<void> {
  return new Promise((resolve) => {
    if (pages.length === 0) return resolve()
    const { width, height } = pages[0]
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' })
    document.body.appendChild(iframe)

    const svgs = pages
      .map((page) => `<div class="page">${drawingToSvg(page).replace(/^<\?xml[^>]*>\s*/, '')}</div>`)
      .join('\n')
    const doc = iframe.contentDocument!
    doc.open()
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>
<style>
  @page { size: ${width}mm ${height}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .page { width: ${width}mm; height: ${height}mm; overflow: hidden; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page svg { display: block; width: ${width}mm; height: ${height}mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${svgs}</body></html>`)
    doc.close()

    const cleanup = () => {
      setTimeout(() => iframe.remove(), 500)
      resolve()
    }
    const win = iframe.contentWindow!
    win.addEventListener('afterprint', cleanup, { once: true })
    // Give the iframe a frame to lay out before opening the dialog
    setTimeout(() => {
      win.focus()
      win.print()
      // Some browsers don't fire afterprint for iframes; clean up eventually
      setTimeout(cleanup, 60_000)
    }, 100)
  })
}
