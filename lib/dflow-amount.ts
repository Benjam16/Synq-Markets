export function parseUiAmountToScaledInt(
  uiAmountStr: string,
  decimals: number,
): bigint {
  const s = String(uiAmountStr ?? '').trim();
  if (!s) throw new Error('uiAmount is required');
  if (!Number.isFinite(decimals) || decimals < 0) {
    throw new Error('Invalid decimals');
  }

  // Only support simple decimal notation (no exponent).
  if (/[eE]/.test(s)) throw new Error('Scientific notation not supported');

  const neg = s.startsWith('-');
  if (neg) throw new Error('uiAmount must be positive');

  const [wholeRaw, fracRaw = ''] = s.split('.');
  const whole = wholeRaw.replace(/_/g, '');
  const frac = fracRaw.replace(/_/g, '');

  if (!/^\d+$/.test(whole || '0') || (frac && !/^\d+$/.test(frac))) {
    throw new Error('uiAmount must be a number');
  }

  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const combined = `${whole || '0'}${fracPadded}`;
  // Remove leading zeros but keep at least one digit.
  const normalized = combined.replace(/^0+(?=\d)/, '');
  const out = BigInt(normalized || '0');
  if (out <= BigInt(0)) throw new Error('uiAmount must be > 0');
  return out;
}

