import { useEffect, useRef, useState, type RefObject } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { screenToWorld, type Point, type ViewportState } from './viewport'

export interface PointerInfo {
  world: Point
  screen: Point
  shift: boolean
  alt: boolean
  meta: boolean
}

export interface ViewportCanvasHandlers {
  /** Return true to claim the pointer for a drag. Unclaimed left-drags pan the canvas. */
  onPointerDown?: (info: PointerInfo) => boolean
  onDrag?: (info: PointerInfo) => void
  onDragEnd?: (info: PointerInfo) => void
  /** Called on pointer move when nothing is being dragged; world is null when the pointer leaves */
  onHover?: (info: PointerInfo | null) => void
}

export interface CanvasSize {
  width: number
  height: number
  dpr: number
}

/**
 * Wires up a canvas for pan/zoom plus app-defined drag handles.
 *
 * - Wheel / trackpad pinch zooms around the cursor
 * - Middle mouse, Space + drag, or dragging empty canvas pans
 * - Two-finger touch pinches and pans
 * - Keeps the backing store sized to the element at devicePixelRatio
 */
export function useViewportCanvas(
  canvasRef: RefObject<HTMLCanvasElement>,
  useViewport: UseBoundStore<StoreApi<ViewportState>>,
  handlers: ViewportCanvasHandlers
): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0, dpr: 1 })
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  // Resize the backing store to match the element
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const update = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      setSize({ width: rect.width, height: rect.height, dpr })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(canvas)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let spaceHeld = false
    const pointers = new Map<number, Point>()
    let mode: 'idle' | 'pan' | 'drag' | 'pinch' = 'idle'
    let lastPan: Point | null = null
    let pinchStart: { distance: number; center: Point; zoom: number; pan: Point } | null = null

    const toScreen = (e: { clientX: number; clientY: number }): Point => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const info = (e: PointerEvent | MouseEvent): PointerInfo => {
      const screen = toScreen(e)
      const { pan, zoom } = useViewport.getState()
      return {
        screen,
        world: screenToWorld(screen, pan, zoom),
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey || e.ctrlKey,
      }
    }

    const pinchMetrics = () => {
      const [a, b] = Array.from(pointers.values())
      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      const screen = toScreen(e)
      pointers.set(e.pointerId, screen)
      canvas.setPointerCapture(e.pointerId)

      if (pointers.size === 2) {
        // Second finger down: abandon any drag and start pinching
        if (mode === 'drag') handlersRef.current.onDragEnd?.(info(e))
        const { zoom, pan } = useViewport.getState()
        pinchStart = { ...pinchMetrics(), zoom, pan }
        mode = 'pinch'
        return
      }
      if (pointers.size > 2) return

      const isPanButton = e.button === 1 || (e.button === 0 && spaceHeld)
      if (!isPanButton && e.button === 0 && handlersRef.current.onPointerDown?.(info(e))) {
        mode = 'drag'
        return
      }
      if (e.button === 0 || e.button === 1) {
        mode = 'pan'
        lastPan = screen
        canvas.style.cursor = 'grabbing'
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const screen = toScreen(e)
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, screen)

      if (mode === 'pinch' && pinchStart && pointers.size === 2) {
        const { distance, center } = pinchMetrics()
        const viewport = useViewport.getState()
        const zoom = Math.min(viewport.maxZoom, Math.max(viewport.minZoom, pinchStart.zoom * (distance / pinchStart.distance)))
        // World point under the initial pinch centre follows the fingers
        const world = screenToWorld(pinchStart.center, pinchStart.pan, pinchStart.zoom)
        viewport.setPan({ x: center.x - world.x * zoom, y: center.y - world.y * zoom })
        useViewport.setState({ zoom })
        return
      }
      if (mode === 'pan' && lastPan) {
        useViewport.getState().panBy({ x: screen.x - lastPan.x, y: screen.y - lastPan.y })
        lastPan = screen
        return
      }
      if (mode === 'drag') {
        handlersRef.current.onDrag?.(info(e))
        return
      }
      if (e.pointerType !== 'touch') handlersRef.current.onHover?.(info(e))
    }

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
      if (mode === 'drag') handlersRef.current.onDragEnd?.(info(e))
      if (mode === 'pan') canvas.style.cursor = spaceHeld ? 'grab' : ''
      if (pointers.size === 0) {
        mode = 'idle'
        lastPan = null
        pinchStart = null
      } else if (mode === 'pinch' && pointers.size === 1) {
        // Continue as a pan with the remaining finger
        mode = 'pan'
        lastPan = Array.from(pointers.values())[0]
        pinchStart = null
      }
    }

    const onPointerLeave = () => {
      if (mode === 'idle') handlersRef.current.onHover?.(null)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const center = toScreen(e)
      // Trackpad pinch arrives as ctrl+wheel with small deltas
      const sensitivity = e.ctrlKey ? 0.01 : 0.0015
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      useViewport.getState().zoomBy(Math.exp(-delta * sensitivity), center)
    }

    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        if (!spaceHeld && mode === 'idle') canvas.style.cursor = 'grab'
        spaceHeld = true
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld = false
        if (mode !== 'pan') canvas.style.cursor = ''
      }
    }
    const preventContextMenu = (e: Event) => e.preventDefault()

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', preventContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', preventContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [canvasRef, useViewport])

  return size
}
