import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import './EChart.css'

// Register only the modules we use — keeps the bundle lean.
echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent, CanvasRenderer])

/** Animated skeleton overlay shown while data is loading — prevents an empty flash. */
function ChartSkeleton({ height, bars = 12 }) {
  return (
    <div className="echart-skeleton" style={{ height }} aria-hidden="true">
      <div className="echart-skel-grid">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="echart-skel-line" />)}
      </div>
      <div className="echart-skel-bars">
        {Array.from({ length: bars }, (_, i) => (
          <div key={i} className="echart-skel-bar" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="echart-skel-shimmer" />
    </div>
  )
}

/** Empty state: a friendly icon + message (not a bare box). */
function ChartEmpty({ height, message }) {
  return (
    <div className="echart-empty" style={{ height }}>
      <svg viewBox="0 0 48 48" width="36" height="36" className="echart-empty-art" aria-hidden="true">
        {/* broken / flat line hint */}
        <path d="M4 36 L14 26 L22 31 L30 20 L36 25 L44 15" fill="none" stroke="#c4cdd8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
        <circle cx="44" cy="15" r="2.5" fill="#e8a317" opacity=".7" />
      </svg>
      <span className="echart-empty-label">{message === true ? 'داده‌ای برای این بازه موجود نیست' : message}</span>
    </div>
  )
}

export default function EChart({ option, height = 160, className = '', onEvents, empty, loading, title, subtitle, notMerge = true }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const [everLoaded, setEverLoaded] = useState(false)

  useEffect(() => { if (option && !loading) setEverLoaded(true) }, [option, loading])

  // ECharts initializes once, so its container must always stay mounted. Loading and
  // empty states are overlays; otherwise the first empty render prevents init forever.
  useEffect(() => {
    if (!ref.current) return
    chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => chartRef.current?.resize())
    })
    ro.observe(ref.current)
    return () => { cancelAnimationFrame(frame); ro.disconnect(); chartRef.current?.dispose(); chartRef.current = null }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !option) return
    chartRef.current.setOption(option, { notMerge })
  }, [option, notMerge])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    for (const [evt, fn] of Object.entries(onEvents)) chart.on(evt, fn)
    return () => { for (const evt of Object.keys(onEvents || {})) chart.off(evt) }
  }, [onEvents])

  const showSkeleton = !everLoaded && loading === true
  const showEmpty = !!empty && !showSkeleton

  return (
    <div className={`echart-wrap ${className}`}>
      {title && <div className="echart-head"><span className="echart-title">{title}</span>{subtitle && <span className="echart-subtitle">{subtitle}</span>}</div>}
      <div className="echart-body" style={{ height }}>
        <div ref={ref} className={`echart ${everLoaded && !showSkeleton && !showEmpty ? 'echart-in' : ''}`} style={{ height }} dir="ltr" />
        {showSkeleton && <ChartSkeleton height={height} />}
        {showEmpty && <div className="echart-overlay"><ChartEmpty height={height} message={empty} /></div>}
      </div>
    </div>
  )
}
