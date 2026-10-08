// Shared Dorj chart language. These helpers only shape presentation options; they never own data.
export const CHART_COLORS = [
  '#2747B8',
  '#5B8CFF',
  '#E8A317',
  '#2BB6A8',
  '#8B7CF6',
  '#E76A5E',
]

export const CHART_FONT = 'Vazirmatn, ui-sans-serif, system-ui, sans-serif'
const AXIS_TEXT = '#748098'
const GRID_LINE = '#E6EBF3'
const BORDER_LINE = '#D9E1EC'

// Convert to the user's preferred digit style while preserving non-numeric chart labels.
export const toChartDigits = (value, prefs = {}) => {
  const text = String(value ?? '')
  return prefs.lang === 'fa' && prefs.digits === 'persian'
    ? text.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit])
    : text
}

// Keep axis ticks compact. Values from Prometheus can be 0.123 or 14400000.
export function formatChartNumber(
  value,
  prefs = {},
  { maximumFractionDigits = 2 } = {},
) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return toChartDigits(value, prefs)
  const abs = Math.abs(n)
  if (abs >= 10_000_000)
    return toChartDigits(
      `${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`,
      prefs,
    )
  if (abs >= 10_000)
    return toChartDigits(
      `${(n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`,
      prefs,
    )
  return toChartDigits(
    n.toLocaleString('en-US', { maximumFractionDigits }),
    prefs,
  )
}

// Explicit HH:mm / MM/DD gives comparable axes across all dashboard charts.
export function formatChartTime(seconds, prefs = {}, longRange = false) {
  const date = new Date(Number(seconds) * 1000)
  if (Number.isNaN(date.getTime())) return toChartDigits(seconds, prefs)
  if (longRange) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return toChartDigits(`${month}/${day}`, prefs)
  }
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return toChartDigits(`${hh}:${mm}`, prefs)
}

// A tiny function factory for callers that already have Prometheus timestamps.
export const chartTimeFormatter =
  (prefs = {}, longRange = false) =>
  (seconds) =>
    formatChartTime(seconds, prefs, longRange)

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

// ECharts options contain formatter callbacks, so structuredClone cannot be used here.
function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    )
  }
  return value
}

function titleOf(items = []) {
  const first = Array.isArray(items) ? items[0] : items
  return first?.axisValueLabel || first?.name || ''
}

function defaultTooltipFormatter(params, prefs, tooltip) {
  const list = Array.isArray(params) ? params : [params]
  const rows = list
    .map((item) => {
      const raw = item?.value
      const value = tooltip?.valueFormatter
        ? tooltip.valueFormatter(raw, item)
        : formatChartNumber(raw, prefs)
      return `${item?.marker || ''}<span style='margin-inline-start:6px'>${item?.seriesName || item?.name || ''}</span><b style='float:right;margin-inline-start:14px'>${value}</b>`
    })
    .join('<br/>')
  const heading = titleOf(list)
    ? `<div style='font-weight:600;margin-bottom:5px'>${titleOf(list)}</div>`
    : ''
  return `${heading}${rows}`
}

function wrapFormatter(formatter, prefs) {
  if (typeof formatter !== 'function') return formatter
  return (...args) => toChartDigits(formatter(...args), prefs)
}

function withLocalizedAxes(next, prefs) {
  const axes = [next.xAxis, next.yAxis].flat().filter(Boolean)
  for (const axis of axes) {
    axis.axisLabel = {
      fontFamily: CHART_FONT,
      hideOverlap: true,
      ...axis.axisLabel,
    }
    axis.axisLabel.formatter =
      axis.type === 'category'
        ? wrapFormatter(axis.axisLabel.formatter || ((value) => value), prefs)
        : wrapFormatter(axis.axisLabel.formatter, prefs)
  }
}

function withReadableSeries(next) {
  next.series = (next.series || []).map((series, index) => {
    if (series?.type === 'bar') {
      series.itemStyle = { borderRadius: 4, ...series.itemStyle }
      return series
    }
    if (series?.type !== 'line') return series
    const color =
      series.color ||
      series.itemStyle?.color ||
      next.color?.[index % next.color.length] ||
      CHART_COLORS[0]
    series.smooth = series.smooth ?? 0.28
    series.showSymbol = series.showSymbol ?? false
    series.lineStyle = {
      width: 2.2,
      cap: 'round',
      join: 'round',
      ...series.lineStyle,
    }
    if (series.areaStyle !== false) {
      series.areaStyle = {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          global: false,
          colorStops: [
            { offset: 0, color: `${color}38` },
            { offset: 1, color: `${color}00` },
          ],
        },
        ...series.areaStyle,
      }
    }
    return series
  })
}

function withSharedTooltip(next, prefs) {
  const hasPie = (next.series || []).some((series) => series?.type === 'pie')
  next.tooltip = {
    trigger: hasPie ? 'item' : 'axis',
    axisPointer: {
      type: 'line',
      lineStyle: { color: '#9CA9BE', type: 'dashed' },
    },
    ...next.tooltip,
  }
  next.tooltip.backgroundColor = 'rgba(255,255,255,.98)'
  next.tooltip.borderColor = 'rgba(39,71,184,.13)'
  next.tooltip.borderWidth = 1
  next.tooltip.padding = [10, 12]
  next.tooltip.textStyle = {
    color: '#101B33',
    fontSize: 12,
    fontFamily: CHART_FONT,
    ...next.tooltip.textStyle,
  }
  next.tooltip.extraCssText = [
    'box-shadow:0 12px 28px rgba(9,30,66,.14)',
    'border-radius:10px',
    'direction:rtl',
    'min-width:140px',
    'backdrop-filter:blur(4px)',
  ].join(';')

  if (next.tooltip.trigger === 'axis') {
    const original = next.tooltip.formatter
    next.tooltip.formatter = (params) => {
      if (typeof original === 'function')
        return toChartDigits(original(params), prefs)
      return defaultTooltipFormatter(params, prefs, next.tooltip)
    }
  }
}

function withReadableLegend(next, prefs) {
  if (!next.legend) return
  next.legend = {
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 14,
    bottom: 0,
    left: 'center',
    textStyle: { color: '#59677F', fontSize: 11.5, fontFamily: CHART_FONT },
    ...next.legend,
  }
  next.legend.align = 'auto'
  next.legend.formatter = typeof next.legend.formatter === 'function'
    ? wrapFormatter(next.legend.formatter, prefs)
    : name => toChartDigits(name, prefs)
}

// Every page calls this from EChart, so page code can stay focused on its data shape.
export function withChartTheme(option, prefs = {}) {
  if (!option) return option
  const next = clone(option)
  next.color =
    Array.isArray(next.color) && next.color.length
      ? next.color
      : [...CHART_COLORS]
  next.textStyle = { fontFamily: CHART_FONT, ...next.textStyle }
  next.animation = next.animation !== false
  next.animationDuration = Math.min(next.animationDuration ?? 480, 480)
  next.animationEasing = next.animationEasing || 'cubicOut'
  withLocalizedAxes(next, prefs)
  withReadableSeries(next)
  withSharedTooltip(next, prefs)
  withReadableLegend(next, prefs)
  return next
}

export const baseTooltip = {
  trigger: 'axis',
  confine: true,
}

export const baseGrid = {
  left: 8,
  right: 22,
  top: 30,
  bottom: 30,
  containLabel: true,
}

export const baseYAxis = (unit = '') => ({
  type: 'value',
  name: unit,
  nameLocation: 'end',
  nameGap: 12,
  nameTextStyle: {
    color: AXIS_TEXT,
    fontSize: 10.5,
    fontWeight: 600,
    fontFamily: CHART_FONT,
    align: 'right',
  },
  axisLabel: {
    color: AXIS_TEXT,
    fontSize: 11,
    margin: 8,
    formatter: (value) => formatChartNumber(value),
  },
  splitLine: { lineStyle: { color: GRID_LINE, type: [3, 4] } },
  axisLine: { show: false },
  axisTick: { show: false },
})

export const baseXAxis = (labels, formatter) => ({
  type: 'category',
  data: labels,
  boundaryGap: false,
  axisLabel: {
    color: AXIS_TEXT,
    fontSize: 10.5,
    margin: 10,
    formatter,
    hideOverlap: true,
    showMaxLabel: true,
  },
  axisLine: { lineStyle: { color: BORDER_LINE } },
  axisTick: { show: false },
})

export const baseLegend = (labels, colors = CHART_COLORS) => ({
  data: labels,
  type: 'scroll',
  pageIconColor: '#2747B8',
  pageIconInactiveColor: '#C6D0E0',
})
