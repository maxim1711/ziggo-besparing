import { Download, Flame, Lock, ShieldCheck, Smartphone, Trash2, Upload, User } from 'lucide-react'
import { useRef, useState } from 'react'
import { Page, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, Segmented } from '@/components/ui/inputs'
import { todayIso } from '@/engine/dates'
import { downloadFile } from '@/lib/utils'
import { useData } from '@/store/data'
import { useDraft } from '@/store/draft'
import { toast } from '@/store/toast'

export default function SettingsPage() {
  const data = useData()
  const { settings, updateSettings } = data
  const resetDraft = useDraft((s) => s.reset)
  const [confirm, setConfirm] = useState<'customer' | 'all' | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const setCommission = (patch: Partial<typeof settings.commission>) => updateSettings({ commission: { ...settings.commission, ...patch } })

  const exportAll = () => {
    const { offers, pricing, settings, consultations, followUps, outcomes } = data
    downloadFile(`overstapadvies-backup-${todayIso()}.json`, JSON.stringify({ app: 'overstapadvies', version: 3, offers, pricing, settings, consultations, followUps, outcomes }, null, 2), 'application/json')
  }

  return (
    <Page className="max-w-[1000px]">
      <PageHeader title="Instellingen" subtitle="Alles wordt lokaal op dit apparaat bewaard. Er is geen account en geen server." />
      <div className="space-y-5">
        <Card>
          <CardHeader icon={<User />} title="Adviseur en standaardwaarden" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Uw naam (optioneel)" hint="Wordt vermeld op het PDF-voorstel en de afdruk">
              <Input value={settings.advisorName} onChange={(e) => updateSettings({ advisorName: e.target.value })} />
            </Field>
            <Field label="Standaard vergelijkingsperiode" hint="Geldt voor nieuwe adviezen">
              <Segmented value={settings.defaultPeriod} onChange={(defaultPeriod) => updateSettings({ defaultPeriod })} options={[{ value: 12, label: '12 maanden' }, { value: 24, label: '24 maanden' }]} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Lock />} title="Provisie en weekdoel" description="Alleen zichtbaar voor u; verschijnt nooit in klantweergave, PDF of gedeelde tekst." action={<Badge>Alleen adviseur</Badge>} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Basisprovisie internet">
              <MoneyInput value={settings.commission.internetBaseCents} onChange={(c) => setCommission({ internetBaseCents: c ?? 0 })} emptyAsZero />
            </Field>
            <Field label="Bonus bij Internet + TV">
              <MoneyInput value={settings.commission.tvBonusCents} onChange={(c) => setCommission({ tvBonusCents: c ?? 0 })} emptyAsZero />
            </Field>
            <Field label="Bonus bij 2-jarig contract">
              <MoneyInput value={settings.commission.contract24BonusCents} onChange={(c) => setCommission({ contract24BonusCents: c ?? 0 })} emptyAsZero />
            </Field>
            <Field label="Bonus bij Vodafone-combinatie">
              <MoneyInput value={settings.commission.vodafoneComboBonusCents} onChange={(c) => setCommission({ vodafoneComboBonusCents: c ?? 0 })} emptyAsZero />
            </Field>
            <Field label="Weekdoel provisie" hint="0 = geen doel">
              <MoneyInput value={settings.weeklyTargetCents} onChange={(c) => updateSettings({ weeklyTargetCents: c ?? 0 })} emptyAsZero />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<ShieldCheck />} title="Gegevens en privacy" />
          <div className="space-y-4 p-5">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Gegevens staan alleen in de opslag van deze browser/app op dit apparaat. Er zijn geen accounts, analytics of koppelingen met derden.</li>
              <li>Een lopend advies wordt niet blijvend bewaard; opslaan gebeurt alleen als u daar zelf op tikt.</li>
              <li>Bewaart u een voornaam of notitie bij een opvolging, dan verwerkt u persoonsgegevens en bent u daar zelf verantwoordelijk voor (AVG): beveilig het apparaat, bewaar niet langer dan nodig en verwijder op verzoek.</li>
              <li>Noteer nooit bankgegevens, betaalgegevens, BSN of kopieën van identiteitsbewijzen.</li>
              <li>Wist u de browsergegevens of verwijdert u de app, dan is alles weg. Maak daarom af en toe een back-up.</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportAll}>
                <Download /> Back-up exporteren
              </Button>
              <Button onClick={() => file.current?.click()}>
                <Upload /> Back-up terugzetten
              </Button>
              <input
                ref={file}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    const parsed = JSON.parse(await f.text())
                    if (parsed?.app !== 'overstapadvies') throw new Error('unknown')
                    data.importAll(parsed)
                    toast('Back-up teruggezet')
                  } catch {
                    toast('Dit bestand is geen geldige back-up van deze app.')
                  }
                }}
              />
              <Button variant="danger" onClick={() => setConfirm('customer')}>
                <Trash2 /> Adviezen en opvolgingen wissen
              </Button>
              <Button variant="danger" onClick={() => setConfirm('all')}>
                <Flame /> Alles wissen
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Smartphone />} title="Installeren op uw tablet" description="Na installatie werkt de app ook zonder internet." />
          <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
            <div>
              <h3 className="font-semibold">iPad (Safari)</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Open de app in Safari.</li>
                <li>Tik op het deel-icoon.</li>
                <li>Kies “Zet op beginscherm” en bevestig.</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold">Android-tablet (Chrome)</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Open de app in Chrome.</li>
                <li>Tik op het menu (⋮).</li>
                <li>Kies “App installeren” of “Toevoegen aan startscherm”.</li>
              </ol>
            </div>
          </div>
        </Card>

        <p className="px-1 text-xs text-muted-foreground">
          Overstapadvies is een onafhankelijk hulpmiddel en geen officiële uiting van Ziggo, Vodafone, Essent of een andere aanbieder. Berekeningen zijn indicatief; de actievoorwaarden van de aanbieder zijn leidend. Een energievergelijking is in voorbereiding.
        </p>
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'all' ? 'Alles wissen?' : 'Adviezen en opvolgingen wissen?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Annuleren
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm === 'all') data.wipeEverything()
                else data.wipeCustomerData()
                resetDraft()
                setConfirm(null)
                toast('Gegevens gewist')
              }}
            >
              <Trash2 /> Definitief wissen
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {confirm === 'all' ? 'Alle aanbiedingen, instellingen, opgeslagen adviezen, opvolgingen en resultaten worden gewist en de voorbeeldaanbiedingen worden hersteld.' : 'Alle opgeslagen adviezen en opvolgingen worden van dit apparaat verwijderd. Aanbiedingen en instellingen blijven staan.'} Dit kan niet ongedaan worden gemaakt.
        </p>
      </Dialog>
    </Page>
  )
}
