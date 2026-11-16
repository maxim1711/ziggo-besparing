import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useEffect, useState } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const kindLabel = (kind: 'internet' | 'internet_tv') => (kind === 'internet' ? 'Alleen internet' : 'Internet + TV')

/**
 * Maakt van een opgeslagen afbeeldingsverwijzing een bruikbare URL.
 * Geüploade foto's zijn data-URL's; meegeleverde afbeeldingen zijn paden in `public/`
 * en krijgen het basispad van de app ervoor (werkt dus ook in een submap op GitHub Pages).
 */
export function assetUrl(src: string | null | undefined): string | null {
  if (!src) return null
  if (/^(data:|blob:|https?:)/.test(src)) return src
  return `${import.meta.env.BASE_URL}${src.replace(/^\/+/, '')}`
}
