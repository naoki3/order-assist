export interface UnitConfig {
  pieces_per_ball: number | null;
  balls_per_case: number | null;
  cases_per_pallet: number | null;
}

export type UnitType = 'pallet' | 'case' | 'ball' | 'piece';

export const UNIT_LABELS_JA: Record<UnitType, string> = {
  pallet: 'パレット', case: 'ケース', ball: 'ボール', piece: 'ピース',
};

export const UNIT_LABELS_EN: Record<UnitType, string> = {
  pallet: 'Pallet', case: 'Case / Carton', ball: 'Inner pack / Box', piece: 'Piece / Each',
};

export function getUnitLabels(lang: string): Record<UnitType, string> {
  return lang === 'en' ? UNIT_LABELS_EN : UNIT_LABELS_JA;
}

export function getAvailableUnits(config: UnitConfig): UnitType[] {
  const units: UnitType[] = ['piece'];
  if (config.pieces_per_ball) {
    units.unshift('ball');
    if (config.balls_per_case) {
      units.unshift('case');
      if (config.cases_per_pallet) units.unshift('pallet');
    }
  }
  return units;
}

// Convert from a unit to pieces
export function unitToPieces(qty: number, unit: UnitType, config: UnitConfig): number {
  const ppb = config.pieces_per_ball ?? 1;
  const bpc = config.balls_per_case ?? 1;
  const cpp = config.cases_per_pallet ?? 1;
  switch (unit) {
    case 'piece': return qty;
    case 'ball': return qty * ppb;
    case 'case': return qty * bpc * ppb;
    case 'pallet': return qty * cpp * bpc * ppb;
  }
}

const UNIT_DISPLAY_EN: Record<string, [string, string]> = {
  pallet: ['pallet', 'pallets'],
  case: ['case', 'cases'],
  ball: ['ball', 'balls'],
  piece: ['piece', 'pieces'],
};

// Format pieces as breakdown string e.g. "1ボール2ピース" (ja) or "1 ball 2 pieces" (en)
export function formatQty(pieces: number, config: UnitConfig, lang = 'ja'): string {
  if (!config.pieces_per_ball) return `${pieces}`;
  const ppb = config.pieces_per_ball;
  const bpc = config.balls_per_case;
  const cpp = config.cases_per_pallet;
  let rem = pieces;
  const parts: string[] = [];
  if (lang === 'en') {
    if (cpp && bpc) {
      const ppp = cpp * bpc * ppb;
      const p = Math.floor(rem / ppp);
      if (p > 0) { const [s, pl] = UNIT_DISPLAY_EN.pallet; parts.push(`${p} ${p > 1 ? pl : s}`); rem -= p * ppp; }
    }
    if (bpc) {
      const ppc = bpc * ppb;
      const c = Math.floor(rem / ppc);
      if (c > 0) { const [s, pl] = UNIT_DISPLAY_EN.case; parts.push(`${c} ${c > 1 ? pl : s}`); rem -= c * ppc; }
    }
    const b = Math.floor(rem / ppb);
    if (b > 0) { const [s, pl] = UNIT_DISPLAY_EN.ball; parts.push(`${b} ${b > 1 ? pl : s}`); rem -= b * ppb; }
    if (rem > 0 || parts.length === 0) { const [s, pl] = UNIT_DISPLAY_EN.piece; parts.push(`${rem} ${rem > 1 ? pl : s}`); }
    return parts.join(' ');
  }
  if (cpp && bpc) {
    const ppp = cpp * bpc * ppb;
    const p = Math.floor(rem / ppp);
    if (p > 0) { parts.push(`${p}パレット`); rem -= p * ppp; }
  }
  if (bpc) {
    const ppc = bpc * ppb;
    const c = Math.floor(rem / ppc);
    if (c > 0) { parts.push(`${c}ケース`); rem -= c * ppc; }
  }
  const b = Math.floor(rem / ppb);
  if (b > 0) { parts.push(`${b}ボール`); rem -= b * ppb; }
  if (rem > 0 || parts.length === 0) parts.push(`${rem}ピース`);
  return parts.join('');
}

// Given pieces, find the best representation in a single unit (for default display in input)
export function piecesToDisplay(pieces: number, config: UnitConfig): { val: number; unit: UnitType } {
  const ppb = config.pieces_per_ball;
  const bpc = config.balls_per_case;
  const cpp = config.cases_per_pallet;
  if (cpp && bpc && ppb && pieces % (cpp * bpc * ppb) === 0)
    return { val: pieces / (cpp * bpc * ppb), unit: 'pallet' };
  if (bpc && ppb && pieces % (bpc * ppb) === 0)
    return { val: pieces / (bpc * ppb), unit: 'case' };
  if (ppb && pieces % ppb === 0)
    return { val: pieces / ppb, unit: 'ball' };
  return { val: pieces, unit: 'piece' };
}
