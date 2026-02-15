export function percentInt(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function widthPercentClass(value: number): string {
  return `csp-w-p${percentInt(value)}`;
}

export function heightPercentClass(value: number): string {
  return `csp-h-p${percentInt(value)}`;
}
