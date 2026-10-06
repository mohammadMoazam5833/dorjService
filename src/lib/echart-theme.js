// Shared ECharts defaults for the dorj theme: colors, fonts, tooltip/axis styling.
export const CHART_COLORS = ['#2563eb', '#a855f7', '#0d9488', '#E8A317', '#ef4444', '#3b82f6']

export const baseTooltip = {
  trigger: 'axis',
  backgroundColor: '#fff',
  borderColor: '#d5dde8',
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: '#0c1a33', fontSize: 12, fontFamily: 'Vazirmatn, sans-serif' },
  extraCssText: 'box-shadow: 0 4px 16px rgba(7,42,82,.12); border-radius: 8px; direction: rtl;',
}

export const baseGrid = { left: 48, right: 12, top: 10, bottom: 26, containLabel: false }

export const baseYAxis = (unit = '') => ({
  type: 'value',
  name: unit,
  nameTextStyle: { color: '#b0b9c4', fontSize: 10, padding: [0, 0, 0, -30] },
  axisLabel: { color: '#8fa3b8', fontSize: 11, fontFamily: 'Vazirmatn, sans-serif' },
  splitLine: { lineStyle: { color: '#e8edf3', type: 'dashed' } },
  axisLine: { show: false },
  axisTick: { show: false },
})

export const baseXAxis = (labels, formatter) => ({
  type: 'category',
  data: labels,
  boundaryGap: false,
  axisLabel: { color: '#b0b9c4', fontSize: 10, fontFamily: 'Vazirmatn, sans-serif', formatter, interval: 'auto' },
  axisLine: { lineStyle: { color: '#c8d0da' } },
  axisTick: { show: false },
})

export const baseLegend = (labels, colors) => ({
  data: labels,
  bottom: 0,
  left: 'center',
  itemWidth: 10,
  itemHeight: 10,
  textStyle: { color: '#56657f', fontSize: 11.5, fontFamily: 'Vazirmatn, sans-serif' },
})
