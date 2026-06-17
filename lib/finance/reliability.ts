// Curated reliability scores (0-100) used to rank cars. Brand-level baseline with
// a few model overrides for vehicles where reputation diverges from the brand.
// Sourced from the general consensus of Consumer Reports / J.D. Power dependability
// rankings — directional, not gospel.

const BRAND_SCORES: Record<string, number> = {
  toyota: 95,
  lexus: 95,
  honda: 90,
  acura: 87,
  mazda: 86,
  hyundai: 80,
  kia: 79,
  subaru: 80,
  nissan: 72,
  ford: 68,
  chevrolet: 66,
  gmc: 65,
  volkswagen: 64,
  dodge: 60,
  jeep: 58,
  ram: 60,
  bmw: 62,
  "mercedes-benz": 60,
  audi: 61,
  tesla: 70,
};

const MODEL_OVERRIDES: Record<string, number> = {
  "toyota prius": 98,
  "toyota corolla": 96,
  "toyota camry": 95,
  "honda accord": 92,
  "honda civic": 92,
  "hyundai ioniq": 84,
};

export function reliabilityScore(make: string, model?: string): number {
  const m = make.trim().toLowerCase();
  if (model) {
    const key = `${m} ${model.trim().toLowerCase()}`;
    for (const overrideKey of Object.keys(MODEL_OVERRIDES)) {
      if (key.startsWith(overrideKey)) return MODEL_OVERRIDES[overrideKey];
    }
  }
  return BRAND_SCORES[m] ?? 70;
}

export function reliabilityLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Average";
  return "Below average";
}
