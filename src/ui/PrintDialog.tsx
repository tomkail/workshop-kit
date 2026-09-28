import { useMemo, useState, type ReactNode } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button, Callout, Field, Modal, Segmented, Select, Switch } from './Panel'
import { PAPER_SIZES } from '../drawing/paper'
import { drawingToSvg } from '../drawing/svg'
import { drawingsToPdf } from '../drawing/pdf'
import { downloadBlob, printDrawings } from '../drawing/output'
import type { ComposedPage } from '../drawing/page'
import styles from './PrintDialog.module.css'

export interface PrintOptions {
  paperId: string
  landscape: boolean
  /** Title/spec header */
  labels: boolean
  /** Scale-check rulers (true-size prints only) */
  scaleCheck: boolean
}

interface PrintDialogProps {
  title?: string
  /** Pages to preview and output (several when a true-size print is tiled), built from `options` by the app */
  pages: ComposedPage[]
  /** Replace the SVG download (e.g. one full-size SVG instead of per-sheet) */
  onDownloadSvg?: () => void
  options: PrintOptions
  onChange: (changes: Partial<PrintOptions>) => void
  onClose: () => void
  /** File name without extension, and the PDF/print document title */
  filename: string
  documentTitle: string
  /** Page is at true size (shows ruler switch and 100% advice) */
  physical: boolean
  labelsLabel?: string
  /** App-specific options (copies, layers, scale…) */
  children?: ReactNode
  /** Extra warnings shown above the advice */
  notices?: ReactNode
}

/** Shared print / download dialog with a live page preview */
export function PrintDialog({ title = 'Print', pages, onDownloadSvg, options, onChange, onClose, filename, documentTitle, physical, labelsLabel = 'Title & notes', children, notices }: PrintDialogProps) {
  const [printing, setPrinting] = useState(false)
  const [index, setIndex] = useState(0)
  const current = Math.min(index, pages.length - 1)
  const page = pages[current]
  const svg = useMemo(() => drawingToSvg(page, { background: '#ffffff' }).replace(/^<\?xml[^>]*>\s*/, ''), [page])
  const tiled = pages.length > 1
  const sheet = page.sheet

  const print = async () => {
    setPrinting(true)
    await printDrawings(pages, documentTitle)
    setPrinting(false)
  }
  const downloadSvg =
    onDownloadSvg ?? (tiled ? undefined : () => downloadBlob(drawingToSvg(page, { title: documentTitle, background: '#ffffff' }), `${filename}-page.svg`, 'image/svg+xml'))

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          {downloadSvg && (
            <Button variant="ghost" title="Download as SVG" onClick={downloadSvg}>
              <Download size={14} /> SVG
            </Button>
          )}
          <Button title={tiled ? `All ${pages.length} sheets as one vector PDF` : 'Page as a vector PDF'} onClick={() => downloadBlob(drawingsToPdf(pages, { title: documentTitle }), `${filename}.pdf`, 'application/pdf')}>
            <Download size={14} /> PDF
          </Button>
          <Button variant="primary" onClick={print} disabled={printing}>
            <Printer size={14} /> {tiled ? `Print ${pages.length} sheets…` : 'Print…'}
          </Button>
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.previewColumn}>
          <div className={styles.previewWrap}>
            <div className={styles.preview} style={{ aspectRatio: `${page.width} / ${page.height}` }} dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          {tiled && sheet && (
            <div className={styles.pager}>
              <Button variant="ghost" onClick={() => setIndex(Math.max(0, current - 1))} disabled={current === 0}>
                ‹
              </Button>
              <span>
                Sheet {sheet.label} · {current + 1} of {pages.length} ({sheet.cols} across × {sheet.rows} down)
              </span>
              <Button variant="ghost" onClick={() => setIndex(Math.min(pages.length - 1, current + 1))} disabled={current === pages.length - 1}>
                ›
              </Button>
            </div>
          )}
        </div>
        <div className={styles.options}>
          <Field label="Paper" htmlFor="paper">
            <Select id="paper" value={options.paperId} options={PAPER_SIZES.map((p) => ({ value: p.id, label: p.label }))} onChange={(paperId) => onChange({ paperId })} />
          </Field>
          <Field label="Orientation">
            <Segmented
              value={options.landscape ? 'landscape' : 'portrait'}
              onChange={(v) => onChange({ landscape: v === 'landscape' })}
              options={[
                { value: 'portrait', label: 'Portrait' },
                { value: 'landscape', label: 'Landscape' },
              ]}
            />
          </Field>
          {children}
          <div className={styles.switches}>
            <Switch checked={options.labels} onChange={(labels) => onChange({ labels })} label={labelsLabel} />
            {physical && <Switch checked={options.scaleCheck} onChange={(scaleCheck) => onChange({ scaleCheck })} label="Scale-check rulers" />}
          </div>
          {physical && !page.fits && <Callout tone="warning">This is bigger than the printable area at true size. Try landscape or a larger paper size.</Callout>}
          {tiled && (
            <Callout>
              Too big for one sheet, so it’s split across {pages.length}. Trim one edge of each overlap, line up the ⊕ registration marks on the dashed line, and tape.
            </Callout>
          )}
          {notices}
          {physical ? (
            <Callout>
              In the print dialog choose <strong>100% / Actual size</strong> (turn off “Fit to page”). Measure the rulers on the printout before you cut. The PDF has its print scaling set to none.
            </Callout>
          ) : (
            <Callout>Scaled to fit the page ({Math.round(page.mmPerUnit * 1000) / 1000} mm per unit).</Callout>
          )}
        </div>
      </div>
    </Modal>
  )
}
