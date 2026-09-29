import { useEffect, useRef } from 'react'
import './Chart.css'

// Returns nicely-rounded axis max and tick count
function niceMax(raw) {
  if (raw <= 0) return { max: 1, ticks: 4 }
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const normalized = raw / mag
  const nice = normalized <= 1.5 ? 1.5 : normalized <= 3 ? 3 : normalized <= 5 ? 5 : 10
  return { max: nice * mag, ticks: 4 }
}

function fmtAxisVal(v, unit) {
  if (v === 0) return '0'
  if (unit === 'GiB') return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)
  if (unit === 'هسته') return v >= 10 ? v.toFixed(0) : v.toFixed(1)
  return v >= 100 ? v.toFixed(0) : v.toFixed(1)
}

// Draw a single chart on a canvas element
function drawChart(cv, series, height, unit, xLabels) {
  if (!cv) return
  const dpr = window.devicePixelRatio || 1
  const w = cv.clientWidth || cv.width
  const h = height
  cv.width = w * dpr
  cv.height = h * dpr
  const ctx = cv.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const padL = 46, padR = 12, padT = 10, padB = 28
  const innerW = w - padL - padR
  const innerH = h - padT - padB

  const allVals = series.flatMap(s => s.data)
  const { max: axisMax } = niceMax(Math.max(0, ...allVals))
  const tickCount = 4

  // grid lines + Y labels
  ctx.font = `${11 * dpr / dpr}px Vazirmatn, sans-serif`
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= tickCount; i++) {
    const y = padT + (innerH * i) / tickCount
    const val = axisMax * (1 - i / tickCount)

    // grid
    ctx.strokeStyle = i === tickCount ? '#c8d0da' : '#e8edf3'
    ctx.lineWidth = 1
    ctx.setLineDash(i === tickCount ? [] : [3, 3])
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
    ctx.setLineDash([])

    // Y label
    ctx.fillStyle = '#8fa3b8'
    ctx.textAlign = 'right'
    ctx.fillText(fmtAxisVal(val, unit), padL - 6, y)
  }

  // unit label on Y axis
  ctx.save()
  ctx.fillStyle = '#b0b9c4'
  ctx.font = `10px Vazirmatn, sans-serif`
  ctx.textAlign = 'center'
  ctx.translate(11, padT + innerH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(unit, 0, 0)
  ctx.restore()

  // X axis labels
  if (xLabels && xLabels.length) {
    ctx.fillStyle = '#b0b9c4'
    ctx.font = `10px Vazirmatn, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const step = Math.max(1, Math.floor(xLabels.length / 5))
    xLabels.forEach((lbl, i) => {
      if (i % step !== 0 && i !== xLabels.length - 1) return
      const x = padL + (innerW * i) / Math.max(1, xLabels.length - 1)
      ctx.fillText(lbl, x, h - padB + 6)
    })
  }

  // lines + area
  const hasData = series.some(s => s.data.length > 1)
  if (!hasData) return

  series.forEach(s => {
    if (s.data.length < 2) return
    const n = s.data.length
    const pts = s.data.map((v, i) => ({
      x: padL + (innerW * i) / (n - 1),
      y: padT + innerH - (Math.min(v, axisMax) / axisMax) * innerH,
    }))

    // area fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH)
    grad.addColorStop(0, (s.color || '#007dfc') + '28')
    grad.addColorStop(1, (s.color || '#007dfc') + '00')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(pts[0].x, padT + innerH)
    pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(pts[pts.length - 1].x, padT + innerH)
    ctx.closePath()
    ctx.fill()

    // line
    ctx.strokeStyle = s.color || '#007dfc'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
    ctx.stroke()
  })
}

export default function Chart({ series = [], height = 150, unit = '', xLabels, legend, empty }) {
  const ref = useRef(null)
  const hasData = series.some(s => s.data && s.data.length > 1)

  useEffect(() => {
    if (!hasData) return
    const cv = ref.current
    drawChart(cv, series, height, unit, xLabels)

    let ro
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => drawChart(cv, series, height, unit, xLabels))
      ro.observe(cv)
    }
    return () => ro?.disconnect()
  }, [series, height, unit, xLabels, hasData])

  if (!hasData) {
    return (
      <div className="chart-empty" style={{ height }}>
        <span className="chart-empty-icon">📉</span>
        <span>{empty || 'داده‌ای برای این بازه موجود نیست'}</span>
      </div>
    )
  }

  return (
    <div className="chart">
      <canvas ref={ref} dir="ltr" style={{ display: 'block', width: '100%', height }} />
      {legend && legend.length > 0 && (
        <div className="chart-legend">
          {legend.map((l, i) => (
            <span key={i} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
