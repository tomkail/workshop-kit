import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  clear: () => void
}

/**
 * Undo/redo for any zustand store (generalised from Serpentine's historyStore).
 *
 * `select` picks the undoable snapshot; `apply` writes a snapshot back.
 * Rapid changes (dragging a handle, typing) are grouped into one step by a debounce.
 */
export function createHistory<S, Snapshot>(
  store: UseBoundStore<StoreApi<S>>,
  select: (state: S) => Snapshot,
  apply: (snapshot: Snapshot) => void,
  options: { maxHistory?: number; debounceMs?: number; equals?: (a: Snapshot, b: Snapshot) => boolean } = {}
) {
  const { maxHistory = 100, debounceMs = 400, equals = (a, b) => JSON.stringify(a) === JSON.stringify(b) } = options

  const undoStack: Snapshot[] = []
  const redoStack: Snapshot[] = []
  let committed = select(store.getState())
  let applying = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const useHistory = create<HistoryState>()(() => ({
    canUndo: false,
    canRedo: false,
    undo,
    redo,
    clear,
  }))

  const sync = () => useHistory.setState({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 })

  function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const current = select(store.getState())
    if (equals(current, committed)) return
    undoStack.push(committed)
    if (undoStack.length > maxHistory) undoStack.shift()
    redoStack.length = 0
    committed = current
    sync()
  }

  function restore(snapshot: Snapshot) {
    applying = true
    apply(snapshot)
    applying = false
    committed = snapshot
    sync()
  }

  function undo() {
    flush()
    const previous = undoStack.pop()
    if (previous === undefined) return
    redoStack.push(committed)
    restore(previous)
  }

  function redo() {
    flush()
    const next = redoStack.pop()
    if (next === undefined) return
    undoStack.push(committed)
    restore(next)
  }

  function clear() {
    undoStack.length = 0
    redoStack.length = 0
    committed = select(store.getState())
    sync()
  }

  store.subscribe(() => {
    if (applying) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  })

  return { useHistory, undo, redo, clear, flush }
}
