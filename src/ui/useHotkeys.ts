import { useEffect, useRef } from 'react'

/**
 * Global keyboard shortcuts. Keys are written like "mod+z", "mod+shift+z", "f", "[".
 * "mod" is ⌘ on macOS and Ctrl elsewhere. Ignored while typing in form fields.
 */
export function useHotkeys(bindings: Record<string, (e: KeyboardEvent) => void>) {
  const ref = useRef(bindings)
  ref.current = bindings

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      const parts: string[] = []
      if (e.metaKey || e.ctrlKey) parts.push('mod')
      if (e.shiftKey) parts.push('shift')
      if (e.altKey) parts.push('alt')
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
      parts.push(key)
      const combo = parts.join('+')
      // Allow shifted symbols like "?" to match without "shift+"
      const handler = ref.current[combo] ?? (e.shiftKey && !e.metaKey && !e.ctrlKey ? ref.current[key] : undefined)
      if (handler) {
        e.preventDefault()
        handler(e)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const modKey = isMac ? '⌘' : 'Ctrl+'
