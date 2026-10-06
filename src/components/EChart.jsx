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

export default function EChart({ option, height = 160, className = '', onEvents, empty, loading, title, subtitle, notMerge = true }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const [everLoaded, setEverLoaded] = useState(false)

  useEffect(() => { if (option && !loading) setEverLoaded(true) }, [option, loading])

  // mount — the chart div is ALWAYS in the DOM (even under the skeleton), so init always runs
  useEffect(() => {
    if (!ref.current) return
    chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect(); chartRef.current?.dispose(); chartRef.current = null }
  }, [])

  // option updates
  useEffect(() => {
    if (!chartRef.current || !option) return
    chartRef.current.setOption(option, { notMerge })
  }, [option, notMerge])

  // event handlers
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    for (const [evt, fn] of Object.entries(onEvents)) chart.on(evt, fn)
    return () => { for (const evt of Object.keys(onEvents || {})) chart.off(evt) }
  }, [onEvents])

  if (empty) {
    return (
      <div className={`echart-empty ${className}`} style={{ height }}>
        <span className="echart-empty-icon">📉</span>
        <span>{empty === true ? 'داده‌ای برای این بازه موجود نیست' : empty}</span>
      </div>
    )
  }

  // Skeleton is absolutely positioned ON TOP of the chart div (which is always rendered)
  const showSkeleton = !everLoaded && loading !== false

  return (
    <div className={`echart-wrap ${className}`}>
      {title && <div className="echart-head"><span className="echart-title">{title}</span>{subtitle && <span className="echart-subtitle">{subtitle}</span>}</div>}
      <div className="echart-body" style={{ height }}>
        <div ref={ref} className={`echart ${everLoaded && !showSkeleton ? 'echart-in' : ''}`} style={{ height }} dir="ltr" />
        {showSkeleton && <ChartSkeleton height={height} />}
      </div>
    </div>
  )
}
