export interface ECGParameters {
  bpm: number; // 30 - 220
  pAmplitude: number; // 0.0 - 2.5 mV (scaled)
  prInterval: number; // 0.10s - 0.40s
  qrsDuration: number; // 0.04s - 0.25s
  tAmplitude: number; // -0.8 - 2.5 mV (scaled)
  stLevel: number; // -5.0 - 8.0 mm (mV-equivalent deflection)
  qtInterval?: number; // 0.20s - 0.65s (optional custom QT interval)
  noiseLevel: number; // 0.0 - 1.0 (tremor simulation)
  isIrregular: boolean; // For AFib simulation
}

export interface RhythmPreset {
  id: string;
  nameFarsi: string;
  nameEnglish: string;
  description: string;
  causeFarsi?: string; // Cause of creation / Etiology
  criteria: string[];
  clinicalSignificance: string;
  parameters: ECGParameters;
}
