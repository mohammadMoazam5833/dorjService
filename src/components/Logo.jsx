/*
 * لوگوی دُرج — an emerald-cut jewel viewed top-down (step facets),
 * the single gem kept in the casket that the name «دُرج» describes.
 * variant: 'light' → dark grounds (sidebar, login) · 'dark' → light grounds
 */
import { useBranding } from '../lib/branding.js'

export default function Logo({ variant = 'light', height = 40, showWord = true }) {
  const { logo_data_uri: logoUri, display_name: brandName } = useBranding()
  const word = variant === 'dark' ? '#0B1B3A' : '#F3F6FC'
  const uid = variant + height
  const m = height // mark size

  const Mark = (
    <svg viewBox="0 0 48 48" width={m} height={m} aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={`ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2D4CA8" />
          <stop offset="1" stopColor="#16295e" />
        </linearGradient>
        <linearGradient id={`tbl-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4C24B" />
          <stop offset="1" stopColor="#E8A317" />
        </linearGradient>
      </defs>
      {/* alternating step facets — outer ring */}
      <g stroke="#0B1B3A" strokeWidth="0.6" strokeLinejoin="round">
        <polygon points="17,6 31,6 28,13 20,13"  fill="#3556B6" />
        <polygon points="31,6 42,17 35,20 28,13" fill="#1E3A8A" />
        <polygon points="42,17 42,31 35,28 35,20" fill="#3556B6" />
        <polygon points="42,31 31,42 28,35 35,28" fill="#1E3A8A" />
        <polygon points="31,42 17,42 20,35 28,35" fill="#3556B6" />
        <polygon points="17,42 6,31 13,28 20,35"  fill="#1E3A8A" />
        <polygon points="6,31 6,17 13,20 13,28"   fill="#3556B6" />
        <polygon points="6,17 17,6 20,13 13,20"   fill="#1E3A8A" />
      </g>
      {/* table facet — the gold heart of the jewel */}
      <polygon points="20,13 28,13 35,20 35,28 28,35 20,35 13,28 13,20"
        fill={`url(#tbl-${uid})`} stroke="#0B1B3A" strokeWidth="0.6" />
      {/* inner table lines */}
      <g stroke="rgba(11,27,58,.28)" strokeWidth="0.7" fill="none">
        <polygon points="22,17 26,17 31,22 31,26 26,31 22,31 17,26 17,22" />
      </g>
      {/* gold girdle highlight */}
      <polygon points="17,6 31,6 42,17 42,31 31,42 17,42 6,31 6,17"
        fill="none" stroke={`url(#tbl-${uid})`} strokeWidth="1.4" strokeLinejoin="round" opacity=".9" />
    </svg>
  )

  // admin-panel branding (/api/branding) overrides the bundled mark
  if (logoUri) {
    const img = <img src={logoUri} alt={brandName || 'logo'} style={{ height: m, width: 'auto', display: 'block', maxWidth: 'none' }} />
    // collapsed sidebar: only the first letter of the wordmark (the left square of the 3:1 logo)
    if (!showWord) return <span dir="ltr" style={{ display: 'block', width: Math.round(m * 1.14), height: m, overflow: 'hidden', flexShrink: 0 }}>{img}</span>
    return img
  }

  if (!showWord) return Mark

  return (
    <span dir="rtl" style={{ display: 'inline-flex', alignItems: 'center', gap: m * 0.35, lineHeight: 1 }}>
      {Mark}
      <span style={{ fontFamily: 'Vazirmatn, sans-serif', fontWeight: 700, fontSize: m * 0.6, color: word, lineHeight: 1 }}>{brandName || 'دُرج'}</span>
    </span>
  )
}
