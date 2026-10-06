import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import './EChart.css'

// Register only the modules we use — keeps the bundle lean.
echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent, CanvasRenderer])

export default function EChart({ option, height = 160, className = '', onEvents, empty, notMerge = true }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  // mount
  useEffect(() => {
    if (!ref.current) return
    chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect(); chartRef.current?.dispose(); chartRef.current = null }
  }, [])

  // option updates (notMerge: true — each render replaces the option entirely)
  useEffect(() => {
    if (!chartRef.current || !option) return
    chartRef.current.setOption(option, { notMerge })
  }, [option, notMerge])

  // event handlers
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    for (const [evt, fn] of Object.entries(onEvents)) {
      chart.on(evt, fn)
    }
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

  return <div ref={ref} className={`echart ${className}`} style={{ height }} dir="ltr" />
}
