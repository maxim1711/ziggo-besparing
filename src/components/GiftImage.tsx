import { Gift } from 'lucide-react'
import { useEffect, useState } from 'react'
import { assetUrl, cn } from '@/lib/utils'

/** Cadeau-afbeelding met nette terugval als het bestand ontbreekt of niet laadt. */
export function GiftImage({ src, alt = '', className }: { src: string | null | undefined; alt?: string; className?: string }) {
  const url = assetUrl(src)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  return (
    <div className={cn('grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-soft to-accent-soft', className)}>
      {url && !failed ? <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full object-cover" /> : <Gift aria-label={alt || 'Cadeau'} className="size-2/5 text-accent" strokeWidth={1.5} />}
    </div>
  )
}
