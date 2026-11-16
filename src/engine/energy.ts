import type { Cents } from './money'

/**
 * Voorbereiding energiemodule (Essent). Nog niet gekoppeld aan de UI.
 *
 * Ontwerpregel: er bestaat bewust GEEN veld voor een maandelijks voorschot.
 * Twee tarieven worden altijd doorgerekend met hetzelfde verbruiksprofiel,
 * zodat nooit het ene voorschot met het andere wordt vergeleken.
 *
 * Tarieven per eenheid staan in honderdduizendsten van een euro (1e-5 €),
 * zodat bv. € 0,24531/kWh exact als integer 24531 kan worden opgeslagen.
 */
export type MicroEuro = number

export interface ConsumptionProfile {
  electricityNormalKwh: number
  /** 0 bij enkel tarief. */
  electricityOffPeakKwh: number
  gasM3: number
  solarFeedInKwh: number
}

export interface EnergyTariff {
  supplier: string
  contractMonths: number
  meter: 'enkel' | 'dubbel'
  electricityNormalPerKwh: MicroEuro
  electricityOffPeakPerKwh: MicroEuro
  gasPerM3: MicroEuro
  feedInCompensationPerKwh: MicroEuro
  feedInChargePerKwh: MicroEuro
  energyTaxElectricityPerKwh: MicroEuro
  energyTaxGasPerM3: MicroEuro
  fixedDeliveryPerYearCents: Cents
  networkChargesPerYearCents: Cents
  taxReductionPerYearCents: Cents
  oneTimeIncentiveCents: Cents
}

export interface AnnualEnergyCost {
  electricitySupplyCents: Cents
  gasSupplyCents: Cents
  energyTaxCents: Cents
  feedInNetCents: Cents
  fixedCents: Cents
  taxReductionCents: Cents
  /** Structurele jaarkosten, zonder eenmalige actie. */
  totalPerYearCents: Cents
  firstYearCents: Cents
}

const toCents = (micro: number): Cents => Math.round(micro / 1000)

export function annualEnergyCost(p: ConsumptionProfile, t: EnergyTariff): AnnualEnergyCost {
  const offPeakRate = t.meter === 'dubbel' ? t.electricityOffPeakPerKwh : t.electricityNormalPerKwh
  const totalKwh = p.electricityNormalKwh + p.electricityOffPeakKwh
  const electricitySupplyCents = toCents(p.electricityNormalKwh * t.electricityNormalPerKwh + p.electricityOffPeakKwh * offPeakRate)
  const gasSupplyCents = toCents(p.gasM3 * t.gasPerM3)
  const energyTaxCents = toCents(totalKwh * t.energyTaxElectricityPerKwh + p.gasM3 * t.energyTaxGasPerM3)
  const feedInNetCents = toCents(p.solarFeedInKwh * (t.feedInChargePerKwh - t.feedInCompensationPerKwh))
  const fixedCents = t.fixedDeliveryPerYearCents + t.networkChargesPerYearCents
  const totalPerYearCents = electricitySupplyCents + gasSupplyCents + energyTaxCents + feedInNetCents + fixedCents - t.taxReductionPerYearCents
  return {
    electricitySupplyCents,
    gasSupplyCents,
    energyTaxCents,
    feedInNetCents,
    fixedCents,
    taxReductionCents: t.taxReductionPerYearCents,
    totalPerYearCents,
    firstYearCents: totalPerYearCents - t.oneTimeIncentiveCents,
  }
}

/** Vergelijkt twee tarieven met exact hetzelfde verbruik. Positief = besparing. */
export function compareEnergy(profile: ConsumptionProfile, current: EnergyTariff, proposed: EnergyTariff) {
  const a = annualEnergyCost(profile, current)
  const b = annualEnergyCost(profile, proposed)
  return { current: a, proposed: b, annualSavingsCents: a.totalPerYearCents - b.totalPerYearCents, firstYearSavingsCents: a.firstYearCents - b.firstYearCents }
}
