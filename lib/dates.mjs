export const yr = d => (d || '').match(/\d{4}/)?.[0] ?? ''

/** Sort key by birth year; people without one sort last and keep their order. */
export const byBirth = indi => (a, b) => {
  const ya = yr(indi.get(a)?.birt?.date), yb = yr(indi.get(b)?.birt?.date)
  return (ya ? Number(ya) : Infinity) - (yb ? Number(yb) : Infinity)
}

/** Birth year as a number, or null when missing, unparseable or private. */
export const birthYear = p => (p?.birt?.resn ? null : Number(yr(p?.birt?.date)) || null)

