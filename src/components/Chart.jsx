import { useEffect, useRef } from 'react'
import './Chart.css'

// canvas chart replicating Chart.js look of the real platform (axes + grid, live data when present)
export default function Chart({ series = [], height = 130 }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth
    const h = height
    cv.width = w * dpr
    cv.height = h * dpr
    const ctx = cv.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    const padL = 30, padR = 8, padT = 8, padB = 22
    const all = series.flatMap(s => s.data)
    const max = Math.max(1, ...all)
    const innerW = w - padL - padR
    const innerH = h - padT - padB
    ctx.font = '10px Roboto, sans-serif'
    ctx.fillStyle = '#666'
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH * i) / 4
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(w - padR, y)
      ctx.stroke()
      const val = max - (max * i) / 4
      const txt = max === 1 && i === 0 ? '1.0' : val.toFixed(val % 1 === 0 ? 0 : 1)
      ctx.textAlign = 'right'
      ctx.fillText(txt, padL - 6, y + 3)
    }
    ctx.strokeStyle = '#9e9e9e'
    ctx.beginPath()
    ctx.moveTo(padL, padT)
    ctx.lineTo(padL, h - padB)
    ctx.lineTo(w - padR, h - padB)
    ctx.stroke()
    const has = series.some(s => s.data.length > 1)
    if (has) {
      series.forEach(s => {
        if (!s.data.length) return
        const n = s.data.length
        ctx.strokeStyle = s.color || '#007dfc'
        ctx.lineWidth = 2
        ctx.beginPath()
        s.data.forEach((v, i) => {
          const x = padL + (innerW * i) / (n - 1)
          const y = padT + innerH - (v / max) * innerH
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.stroke()
      })
    }
  }, [series, height])
  return <canvas ref={ref} dir="ltr" />
}
