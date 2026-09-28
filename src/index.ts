/**
 * workshop-kit — shared building blocks for Tom's woodworking tools
 * (Serpentine, Star Knobs, …).
 */

// Theme
export type { CanvasTheme } from './theme/types'
export { themes, themeList, defaultTheme } from './theme/themes'
export { primitives, buildTheme } from './theme/tokens'
export { ThemeProvider, createThemeStore, themeToCssVars, hexToRgba, type ThemeState } from './theme/ThemeProvider'

// UI
export { Tooltip } from './ui/Tooltip'
export { Toolbar, ToolbarGroup, ToolbarSeparator, IconButton, IconToggle, DropdownMenu, MenuItem, MenuDivider, MenuLabel } from './ui/Toolbar'
export { Panel, PanelHeader, PanelBody, PanelSection, Field, NumberField, Segmented, Select, Switch, Button, Stat, Callout, Modal } from './ui/Panel'
export { PrintDialog, type PrintOptions } from './ui/PrintDialog'
export { Notifications, useNotificationStore, notify } from './ui/Notifications'
export { useHotkeys, isMac, modKey } from './ui/useHotkeys'

// Canvas
export { createViewportStore, screenToWorld, worldToScreen, type Point, type Rect, type ViewportState } from './canvas/viewport'
export { renderGrid, renderMirrorAxis, clearGridCache, parseColor, type GridOptions } from './canvas/grid'
export {
  APPLE_DISPLAYS,
  NOMINAL_PX_PER_MM,
  matchAppleDisplays,
  pxPerMmFromDiagonal,
  resolveScreenScale,
  screenInfo,
  type DisplayModel,
  type DisplayMatch,
  type ScreenCalibration,
  type ScreenInfo,
  type ScreenScale,
} from './canvas/screenScale'
export { useViewportCanvas, type PointerInfo, type ViewportCanvasHandlers, type CanvasSize } from './canvas/useViewportCanvas'
export { drawTooltip, isModifierHeld, useModifierKeys, NO_MODIFIERS, type TooltipContent, type TooltipAnchor, type ModifierState } from './canvas/tooltip'

// Drawing + output
export * from './drawing/types'
export { drawingToSvg, pathData } from './drawing/svg'
export { drawingsToPdf, textWidthMm } from './drawing/pdf'
export { drawingToDxf } from './drawing/dxf'
export { downloadBlob, pickTextFile, printDrawings } from './drawing/output'
export { PAPER_SIZES, paperById, defaultPaperId, scaleCheck, type PaperSize } from './drawing/paper'
export { composePage, layoutPages, tilePages, pageArea, scaleItems, type PageScale, type PageHeader, type PageSetup, type PageContent, type ComposedPage, type SheetInfo, type TileOptions } from './drawing/page'
export { ellipseArcToCubics, itemsBounds } from './drawing/curves'

// Units
export * from './units/units'
export * from './units/drillBits'

// State
export { createHistory, type HistoryState } from './state/history'
