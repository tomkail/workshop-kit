import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react'
import styles from './Panel.module.css'

/**
 * Parameter panel primitives shared by workshop tools.
 * Visual language follows Serpentine's hierarchy panel.
 */

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <aside className={`${styles.panel} ${className}`}>{children}</aside>
}

export function PanelHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <div className={styles.title}>{title}</div>
      {children}
    </div>
  )
}

export function PanelBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>
}

export function PanelSection({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      {(title || actions) && (
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{title}</span>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  htmlFor?: string
}

export function Field({ label, hint, children, htmlFor }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        {label}
      </label>
      <div className={styles.fieldControl}>{children}</div>
      {hint && <div className={styles.fieldHint}>{hint}</div>}
    </div>
  )
}

interface NumberFieldProps {
  id?: string
  value: number
  onChange: (value: number) => void
  /** Display a value in the field (e.g. in the user's unit) */
  format?: (value: number) => string
  /** Parse typed text back to a value; return null when invalid */
  parse?: (text: string) => number | null
  min?: number
  max?: number
  /** Arrow-key increment in value units (Shift = ×10) */
  step?: number
  /** Show a range slider under the input */
  slider?: boolean
  sliderMin?: number
  sliderMax?: number
  suffix?: ReactNode
  invalid?: boolean
}

const defaultParse = (text: string) => {
  const n = parseFloat(text)
  return Number.isFinite(n) ? n : null
}

export function NumberField({
  id,
  value,
  onChange,
  format = (v) => String(Math.round(v * 1000) / 1000),
  parse = defaultParse,
  min = -Infinity,
  max = Infinity,
  step = 1,
  slider = false,
  sliderMin,
  sliderMax,
  suffix,
  invalid,
}: NumberFieldProps) {
  const [text, setText] = useState(format(value))
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setText(format(value))
  }, [value, format, editing])

  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  const commit = () => {
    // Untouched text may be a rounded display (e.g. a nearest fraction); don't write it back
    if (text === format(value)) {
      setEditing(false)
      return
    }
    const parsed = parse(text)
    if (parsed !== null && Number.isFinite(parsed)) onChange(clamp(parsed))
    else setText(format(value))
    setEditing(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit()
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      setText(format(value))
      setEditing(false)
      inputRef.current?.blur()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
      const next = clamp(Math.round((value + delta) / step) * step)
      onChange(next)
      setText(format(next))
    }
  }

  const sMin = sliderMin ?? (Number.isFinite(min) ? min : 0)
  const sMax = sliderMax ?? (Number.isFinite(max) ? max : 100)

  return (
    <div className={styles.numberField}>
      <div className={`${styles.inputWrap} ${invalid ? styles.invalid : ''}`}>
        <input
          id={id}
          ref={inputRef}
          className={styles.input}
          value={text}
          inputMode="decimal"
          spellCheck={false}
          onFocus={(e) => {
            setEditing(true)
            e.target.select()
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
      {slider && (
        <input
          type="range"
          className={styles.slider}
          min={sMin}
          max={sMax}
          step={step}
          value={Math.min(sMax, Math.max(sMin, value))}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value)))}
          aria-label={typeof id === 'string' ? `${id} slider` : 'slider'}
        />
      )}
    </div>
  )
}

interface Option<T extends string | number> {
  value: T
  label: ReactNode
  title?: string
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return (
    <div className={styles.segmented} role="radiogroup">
      {options.map((option) => (
        <button
          key={String(option.value)}
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          className={`${styles.segment} ${option.value === value ? styles.segmentActive : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string>({ id, value, options, onChange }: { id?: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode }) {
  return (
    <label className={styles.switchRow}>
      <input type="checkbox" className={styles.switchInput} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.switchTrack} aria-hidden />
      <span className={styles.switchLabel}>{label}</span>
    </label>
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'default' | 'primary' | 'ghost'
  disabled?: boolean
  title?: string
}) {
  return (
    <button className={`${styles.button} ${styles[variant]}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

export function Stat({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: 'warning' | 'danger' }) {
  return (
    <div className={`${styles.stat} ${tone ? styles[tone] : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger'; children: ReactNode }) {
  return <div className={`${styles.callout} ${styles[`callout_${tone}`]}`}>{children}</div>
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${styles.modal} ${wide ? styles.modalWide : ''}`} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  )
}
