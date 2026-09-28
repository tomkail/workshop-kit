import { useEffect, useRef, type ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import styles from './Toolbar.module.css'

/**
 * Floating bottom toolbar and its building blocks, extracted from Serpentine.
 */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className={styles.toolbar}>{children}</div>
}

export function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className={styles.group}>{children}</div>
}

export function ToolbarSeparator() {
  return <div className={styles.separator} />
}

interface IconButtonProps {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}

/** Square action button with a visible background */
export function IconButton({ label, shortcut, onClick, disabled, children }: IconButtonProps) {
  return (
    <Tooltip text={label} shortcut={shortcut}>
      <button
        className={`${styles.iconButton} ${disabled ? styles.disabled : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {children}
      </button>
    </Tooltip>
  )
}

interface IconToggleProps extends IconButtonProps {
  active: boolean
}

/** Round toggle, transparent when off and accent-outlined when on */
export function IconToggle({ label, shortcut, onClick, disabled, active, children }: IconToggleProps) {
  return (
    <Tooltip text={label} shortcut={shortcut}>
      <button
        className={`${styles.iconToggle} ${active ? styles.active : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={`${label}: ${active ? 'on' : 'off'}`}
        aria-pressed={active}
      >
        {children}
      </button>
    </Tooltip>
  )
}

interface DropdownMenuProps {
  trigger: ReactNode
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
  tooltip?: string
  align?: 'left' | 'right'
}

/** Menu that opens upward from the toolbar */
export function DropdownMenu({ trigger, isOpen, onToggle, onClose, children, tooltip, align = 'left' }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const timeoutId = setTimeout(() => document.addEventListener('pointerdown', handleClickOutside), 0)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const button = (
    <button className={`${styles.menuButton} ${isOpen ? styles.active : ''}`} onClick={onToggle} aria-label={tooltip} aria-expanded={isOpen}>
      {trigger}
    </button>
  )

  return (
    <div ref={menuRef} className={styles.dropdownContainer}>
      {tooltip && !isOpen ? <Tooltip text={tooltip}>{button}</Tooltip> : button}
      {isOpen && <div className={align === 'right' ? styles.dropdownRight : styles.dropdown}>{children}</div>}
    </div>
  )
}

interface MenuItemProps {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  /** Render a check column; true shows the tick */
  checked?: boolean
}

export function MenuItem({ label, shortcut, onClick, disabled, checked }: MenuItemProps) {
  return (
    <button className={styles.menuItem} onClick={onClick} disabled={disabled}>
      {checked !== undefined && <span className={styles.menuItemCheck}>{checked ? '✓' : ''}</span>}
      <span className={styles.menuItemLabel}>{label}</span>
      {shortcut && <span className={styles.menuItemShortcut}>{shortcut}</span>}
    </button>
  )
}

export function MenuDivider() {
  return <div className={styles.menuDivider} />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className={styles.menuLabel}>{children}</div>
}
