import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewportState {
  /** Screen position (CSS px) of the world origin */
  pan: Point
  /** Screen pixels per world unit */
  zoom: number
  minZoom: number
  maxZoom: number

  setPan: (pan: Point) => void
  setZoom: (zoom: number, center?: Point) => void
  panBy: (delta: Point) => void
  zoomBy: (factor: number, center?: Point) => void
  fitToRect: (bounds: Rect, canvasWidth: number, canvasHeight: number, paddingRatio?: number) => void
  /** Set an exact zoom and centre a world point in the canvas */
  centerOn: (world: Point, canvasWidth: number, canvasHeight: number, zoom?: number) => void
  reset: () => void
}

export interface ViewportOptions {
  /** localStorage key; omit to disable persistence */
  storageKey?: string
  defaultZoom?: number
  minZoom?: number
  maxZoom?: number
  fitPaddingRatio?: number
}

/**
 * Create a pan/zoom viewport store (extracted from Serpentine's viewportStore).
 * Each tool creates its own so zoom ranges and persistence keys stay independent.
 */
export function createViewportStore(options: ViewportOptions = {}) {
  const {
    storageKey,
    defaultZoom = 1,
    minZoom = 0.1,
    maxZoom = 5,
    fitPaddingRatio = 0.25,
  } = options

  const clamp = (z: number) => Math.min(maxZoom, Math.max(minZoom, z))

  const initializer = (set: (partial: Partial<ViewportState>) => void, get: () => ViewportState): ViewportState => ({
    pan: { x: 0, y: 0 },
    zoom: defaultZoom,
    minZoom,
    maxZoom,

    setPan: (pan) => set({ pan }),

    setZoom: (zoom, center) => {
      const clampedZoom = clamp(zoom)
      if (center) {
        // Keep the point under the cursor stationary
        const state = get()
        const ratio = clampedZoom / state.zoom
        set({
          zoom: clampedZoom,
          pan: {
            x: center.x - (center.x - state.pan.x) * ratio,
            y: center.y - (center.y - state.pan.y) * ratio,
          },
        })
      } else {
        set({ zoom: clampedZoom })
      }
    },

    panBy: (delta) => {
      const { pan } = get()
      set({ pan: { x: pan.x + delta.x, y: pan.y + delta.y } })
    },

    zoomBy: (factor, center) => {
      const state = get()
      state.setZoom(state.zoom * factor, center)
    },

    fitToRect: (bounds, canvasWidth, canvasHeight, paddingRatio = fitPaddingRatio) => {
      if (bounds.width <= 0 || bounds.height <= 0) return
      const availableWidth = canvasWidth * (1 - paddingRatio * 2)
      const availableHeight = canvasHeight * (1 - paddingRatio * 2)
      const zoom = clamp(Math.min(availableWidth / bounds.width, availableHeight / bounds.height))
      get().centerOn(
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        canvasWidth,
        canvasHeight,
        zoom
      )
    },

    centerOn: (world, canvasWidth, canvasHeight, zoom) => {
      const z = zoom === undefined ? get().zoom : clamp(zoom)
      set({
        zoom: z,
        pan: { x: canvasWidth / 2 - world.x * z, y: canvasHeight / 2 - world.y * z },
      })
    },

    reset: () => set({ pan: { x: 0, y: 0 }, zoom: defaultZoom }),
  })

  if (!storageKey) {
    return create<ViewportState>()((set, get) => initializer(set, get))
  }

  return create<ViewportState>()(
    persist((set, get) => initializer(set, get), {
      name: storageKey,
      partialize: (state) => ({ pan: state.pan, zoom: state.zoom }),
    })
  )
}

export function screenToWorld(screenPoint: Point, pan: Point, zoom: number): Point {
  return {
    x: (screenPoint.x - pan.x) / zoom,
    y: (screenPoint.y - pan.y) / zoom,
  }
}

export function worldToScreen(worldPoint: Point, pan: Point, zoom: number): Point {
  return {
    x: worldPoint.x * zoom + pan.x,
    y: worldPoint.y * zoom + pan.y,
  }
}
