export const money = (n: number): string => `$${Math.round(n).toLocaleString()}`;
export const pct = (n: number): string => `${n.toFixed(1)}%`;
export const miles = (n: number): string => `${n.toLocaleString()} mi`;
