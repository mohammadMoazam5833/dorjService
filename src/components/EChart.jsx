import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  withChartTheme,
  toChartDigits,
  CHART_FONT,
} from '../lib/echart-theme.js'
import { DEFAULTS, usePrefs } from '../lib/prefs.jsx'
import './EChart.css'

// Register only the modules we use — keeps the bundle lean.
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkPointComponent,
  CanvasRenderer,
])

/** Animated skeleton overlay shown while data is loading — prevents an empty flash. */
function ChartSkeleton({ height, bars = 12 }) {
  return (
    <div className='echart-skeleton' style={{ height }} aria-hidden='true'>
      <div className='echart-skel-grid'>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className='echart-skel-line' />
        ))}
      </div>
      <div className='echart-skel-bars'>
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className='echart-skel-bar'
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <div className='echart-skel-shimmer' />
    </div>
  )
}

/** Empty state: a friendly icon + message (not a bare box). */
function ChartEmpty({ height, message }) {
  return (
    <div className='echart-empty' style={{ height }}>
      <svg
        viewBox='0 0 48 48'
        width='36'
        height='36'
        className='echart-empty-art'
        aria-hidden='true'
      >
        <path
          d='M4 36 L14 26 L22 31 L30 20 L36 25 L44 15'
          fill='none'
          stroke='#AFC0D6'
          strokeWidth='2.5'
          strokeLinecap='round'
          strokeLinejoin='round'
          opacity='.55'
        />
        <circle cx='44' cy='15' r='2.5' fill='#E8A317' opacity='.7' />
      </svg>
      <span className='echart-empty-label'>
        {message === true ? 'داده‌ای برای این بازه موجود نیست' : message}
      </span>
    </div>
  )
}

/** A chart can fail independently of its page; retry only remounts/reloads this chart's data. */
function ChartError({ height, message, onRetry }) {
  return (
    <div className='echart-error' style={{ height }}>
      <svg viewBox='0 0 48 48' width='30' height='30' aria-hidden='true'>
        <circle
          cx='24'
          cy='24'
          r='18'
          fill='rgba(231,106,94,.08)'
          stroke='rgba(231,106,94,.45)'
          strokeWidth='2'
        />
        <path
          d='M24 15v12'
          stroke='#E76A5E'
          strokeWidth='3'
          strokeLinecap='round'
        />
        <circle cx='24' cy='33' r='1.7' fill='#E76A5E' />
      </svg>
      <span>نمودار بارگذاری نشد</span>
      {message && <small>{String(message)}</small>}
      {onRetry && (
        <button type='button' onClick={onRetry}>
          تلاش دوباره
        </button>
      )}
    </div>
  )
}

export default function EChart({
  option,
  height = 160,
  className = '',
  onEvents,
  empty,
  loading,
  error,
  onRetry,
  title,
  subtitle,
  notMerge = true,
}) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const hadOptionRef = useRef(false)
  const [everLoaded, setEverLoaded] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const prefs = usePrefs()?.prefs || DEFAULTS

  useEffect(() => {
    if (option && !loading && !error) setEverLoaded(true)
  }, [option, loading, error])

  // ECharts initializes once, so its container must always stay mounted. Loading and
  // empty states are overlays; otherwise the first empty render prevents init forever.
  useEffect(() => {
    if (!ref.current) return
    chartRef.current = echarts.init(ref.current, undefined, {
      renderer: 'canvas',
    })
    hadOptionRef.current = false
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => chartRef.current?.resize())
    })
    ro.observe(ref.current)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !option) return
    const themed = withChartTheme(option, prefs)
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const animate = !hadOptionRef.current && !reducedMotion
    // The first paint gets one gentle entrance; polling refreshes stay still.
    chartRef.current.setOption({ ...themed, animation: animate }, { notMerge })
    hadOptionRef.current = true
  }, [option, prefs, notMerge])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    for (const [evt, fn] of Object.entries(onEvents)) chart.on(evt, fn)
    return () => {
      for (const evt of Object.keys(onEvents || {})) chart.off(evt)
    }
  }, [onEvents])

  useEffect(() => {
    if (!option || loading || error) return
    setUpdatedAt(new Date())
  }, [option, loading, error])

  const showSkeleton = !everLoaded && loading === true
  const showError = !!error
  const showEmpty = !!empty && !showSkeleton && !showError
  const updatedLabel = updatedAt
    ? toChartDigits(
        new Intl.DateTimeFormat(
          prefs.lang === 'en' ? 'en-US' : 'fa-IR-u-ca-persian',
          { hour: '2-digit', minute: '2-digit' },
        ).format(updatedAt),
        prefs,
      )
    : null

  return (
    <div className={`echart-wrap ${className}`}>
      {(title || subtitle) && (
        <div className='echart-head'>
          <span className='echart-title'>{title}</span>
          {subtitle && <span className='echart-subtitle'>{subtitle}</span>}
        </div>
      )}
      <div className='echart-body' style={{ height }}>
        <div
          ref={ref}
          className={`echart ${
            everLoaded && !showSkeleton && !showEmpty && !showError
              ? 'echart-in'
              : ''
          }`}
          style={{ height }}
          dir='ltr'
        />
        {showSkeleton && <ChartSkeleton height={height} />}
        {showError && !showSkeleton && (
          <div className='echart-overlay'>
            <ChartError
              height={height}
              message={error?.message || error}
              onRetry={onRetry}
            />
          </div>
        )}
        {showEmpty && !showError && (
          <div className='echart-overlay'>
            <ChartEmpty height={height} message={empty} />
          </div>
        )}
      </div>
      {updatedLabel && !showSkeleton && !showError && !showEmpty && (
        <div className='echart-foot' style={{ fontFamily: CHART_FONT }}>
          آخرین به‌روزرسانی <bdi>{updatedLabel}</bdi>
        </div>
      )}
    </div>
  )
}
