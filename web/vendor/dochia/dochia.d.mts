interface Parameters { minLength: number; maxLength: number }
interface PersonalState { abstain: boolean; gap: boolean }
interface Distribution { anchorLow: number; anchorHigh: number }

export function literatureParams(): Parameters;
export function personalState(lengths: number[], params: Parameters): PersonalState;
export function predictive(state: PersonalState, params: Parameters): Distribution;
export function calQuantile(distribution: Distribution, probability: number): number;
export function calCdf(distribution: Distribution, days: number): number;
