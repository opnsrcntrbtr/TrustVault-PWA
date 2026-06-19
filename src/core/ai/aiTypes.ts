/** On-device AI shared types. */
export type AiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type StrengthLabel = 'weak' | 'medium' | 'strong' | 'very-strong';

export interface StrengthExplainInput {
  strength: StrengthLabel;
  /** Rounded entropy estimate in bits. The only number sent to AI. */
  entropyBits: number;
}
