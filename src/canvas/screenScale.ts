/**
 * Working out how many CSS pixels make a real millimetre on this screen.
 *
 * Browsers don't expose physical screen size: CSS fixes 1in = 96px, and
 * devicePixelRatio only relates CSS pixels to hardware pixels. So we:
 *
 *  1. Recognise Apple displays from the "looks like" resolution the browser
 *     reports (screen.width × screen.height at 2×). Every scaled mode of a
 *     panel still spans the same physical width, so pxPerMm = screen.width / widthMm.
 *  2. Otherwise compute from the advertised diagonal the user types (27″ etc).
 *  3. Let the user fine-tune by measuring an on-screen bar with a ruler.
 *
 * Results are remembered per screen signature, so moving the window between
 * a laptop and an external monitor picks up the right calibration.
 */

export const NOMINAL_PX_PER_MM = 96 / 25.4

export interface DisplayModel {
  id: string
  name: string
  /** Width of the active area in mm (from the viewable diagonal and native aspect) */
  widthMm: number
  /** Default "looks like" resolution */
  defaultSize: [number, number]
  /** All "looks like" resolutions offered in System Settings → Displays */
  sizes: [number, number][]
}

/** Physical width of a panel from its viewable diagonal and pixel aspect */
function widthFromDiagonal(inches: number, w: number, h: number): number {
  return (inches * 25.4 * w) / Math.hypot(w, h)
}

const mac = (id: string, name: string, diagonal: number, native: [number, number], defaultSize: [number, number], sizes: [number, number][]): DisplayModel => ({
  id,
  name,
  widthMm: Math.round(widthFromDiagonal(diagonal, native[0], native[1]) * 10) / 10,
  defaultSize,
  sizes,
})

/** Retina Apple displays (all report devicePixelRatio 2 at 100% browser zoom) */
export const APPLE_DISPLAYS: DisplayModel[] = [
  mac('macbook-12', 'MacBook 12″ (2015–2017)', 12, [2304, 1440], [1280, 800], [[1024, 640], [1152, 720], [1280, 800], [1440, 900]]),
  mac('mb-13', 'MacBook Air / Pro 13.3″ (2016–2022)', 13.3, [2560, 1600], [1440, 900], [[1024, 640], [1280, 800], [1440, 900], [1680, 1050]]),
  mac('mba-13-6', 'MacBook Air 13.6″ (M2 and later)', 13.6, [2560, 1664], [1470, 956], [[1024, 666], [1280, 832], [1470, 956], [1710, 1112]]),
  mac('mba-15', 'MacBook Air 15.3″', 15.3, [2880, 1864], [1710, 1107], [[1280, 828], [1440, 932], [1710, 1107], [1920, 1243]]),
  mac('mbp-14', 'MacBook Pro 14″ (2021 and later)', 14.2, [3024, 1964], [1512, 982], [[1147, 745], [1352, 878], [1512, 982], [1800, 1169]]),
  mac('mbp-16', 'MacBook Pro 16″ (2021 and later)', 16.2, [3456, 2234], [1728, 1117], [[1312, 848], [1496, 967], [1728, 1117], [2056, 1329]]),
  mac('mbp-15', 'MacBook Pro 15″ (2012–2019)', 15.4, [2880, 1800], [1440, 900], [[1024, 640], [1280, 800], [1440, 900], [1680, 1050], [1920, 1200]]),
  mac('mbp-16-2019', 'MacBook Pro 16″ (2019)', 16, [3072, 1920], [1536, 960], [[1152, 720], [1344, 840], [1536, 960], [1792, 1120], [2048, 1280]]),
  mac('imac-21', 'iMac 21.5″ 4K', 21.5, [4096, 2304], [2048, 1152], [[1280, 720], [1600, 900], [1920, 1080], [2048, 1152], [2304, 1296]]),
  mac('imac-24', 'iMac 24″', 23.5, [4480, 2520], [2240, 1260], [[1600, 900], [1920, 1080], [2240, 1260], [2560, 1440], [2880, 1620]]),
  mac('5k-27', 'iMac 27″ 5K / Studio Display', 27, [5120, 2880], [2560, 1440], [[1600, 900], [2048, 1152], [2560, 1440], [2880, 1620], [3200, 1800]]),
  mac('xdr-32', 'Pro Display XDR 32″', 31.6, [6016, 3384], [3008, 1692], [[1920, 1080], [2560, 1440], [3008, 1692], [3360, 1890], [3760, 2115]]),
]

export interface ScreenInfo {
  width: number
  height: number
  dpr: number
  isMac: boolean
  /** Stable key for remembering a calibration per screen */
  signature: string
  /** Browser zoom looks like it isn't 100% (non-standard devicePixelRatio) */
  zoomed: boolean
}

export function screenInfo(): ScreenInfo {
  const width = window.screen.width
  const height = window.screen.height
  const dpr = Math.round(window.devicePixelRatio * 100) / 100
  const isMac = /Mac/.test(navigator.platform) && navigator.maxTouchPoints <= 1
  return {
    width,
    height,
    dpr,
    isMac,
    signature: `${width}x${height}@${dpr}`,
    // Real displays run at 1×, 1.5×, 2×, 3×…; anything else is almost always page zoom
    zoomed: ![1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3].includes(dpr),
  }
}

export interface DisplayMatch {
  model: DisplayModel
  pxPerMm: number
  /** The reported size is this model's default scaling */
  isDefault: boolean
}

/** Apple displays whose scaled modes match this screen, most likely first */
export function matchAppleDisplays(info: ScreenInfo = screenInfo()): DisplayMatch[] {
  if (!info.isMac || info.dpr !== 2) return []
  const near = ([w, h]: [number, number]) => w === info.width && Math.abs(h - info.height) <= 8
  return APPLE_DISPLAYS.filter((m) => m.sizes.some(near))
    .map((model) => ({ model, pxPerMm: info.width / model.widthMm, isDefault: near(model.defaultSize) }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
}

export function pxPerMmFromDiagonal(inches: number, info: ScreenInfo = screenInfo()): number {
  return info.width / widthFromDiagonal(inches, info.width, info.height)
}

export type ScaleSource = 'measured' | 'model' | 'diagonal' | 'detected' | 'estimate'

export interface ScreenCalibration {
  pxPerMm: number
  source: ScaleSource
  label: string
  modelId?: string
}

export interface ScreenScale extends ScreenCalibration {
  /** Safe to use without asking the user */
  confident: boolean
  info: ScreenInfo
  matches: DisplayMatch[]
}

/**
 * Best current scale: a saved calibration for this screen, else an unambiguous
 * Apple display match, else a guess (not confident, so the app should ask).
 */
export function resolveScreenScale(saved: Record<string, ScreenCalibration>): ScreenScale {
  const info = screenInfo()
  const matches = matchAppleDisplays(info)
  const own = saved[info.signature]
  if (own) return { ...own, confident: !info.zoomed, info, matches }

  const defaults = matches.filter((m) => m.isDefault)
  const distinct = (list: DisplayMatch[]) => new Set(list.map((m) => Math.round(m.pxPerMm * 50))).size
  const best = defaults[0] ?? matches[0]
  if (best) {
    const unambiguous = (defaults.length > 0 ? distinct(defaults) : distinct(matches)) === 1
    return {
      pxPerMm: best.pxPerMm,
      source: 'detected',
      label: best.model.name,
      modelId: best.model.id,
      confident: unambiguous && !info.zoomed,
      info,
      matches,
    }
  }
  const retinaMac = info.isMac && info.dpr === 2
  return {
    pxPerMm: retinaMac ? 5.0 : NOMINAL_PX_PER_MM,
    source: 'estimate',
    label: retinaMac ? 'Typical Retina Mac (estimate)' : 'Browser default, 96 px/inch (estimate)',
    confident: false,
    info,
    matches,
  }
}
