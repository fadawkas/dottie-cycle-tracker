export interface Period {
  id: string;
  startDate: string;
  endDate: string | null;
  endUnknown: boolean;
}

export const symptomLabels = {
  cramps: 'Cramps', headache: 'Headache', bloating: 'Bloating', fatigue: 'Fatigue',
  breastTenderness: 'Breast tenderness', acne: 'Acne',
};

export type Symptom = keyof typeof symptomLabels;

export interface Observations {
  flow?: 'spotting' | 'light' | 'medium' | 'heavy';
  symptoms?: Symptom[];
  mood?: 'good' | 'okay' | 'low' | 'anxious' | 'irritable';
  sleepHours?: number;
  sexualActivity?: 'yes' | 'no';
  protection?: 'used' | 'notUsed';
  note?: string;
}

export type Settings = {
  symptoms: boolean; mood: boolean; sleep: boolean; sexualActivity: boolean; notes: boolean;
  typicalPeriodDays: number | null; symptomShortcuts: Symptom[];
  remindDaily: boolean; remindPeriod: boolean; remindEnd: boolean;
};
export type DailyLog = Observations & { day: string };
export type Tracker = { onboardingComplete: boolean; periods: Period[]; dailyLogs: DailyLog[]; settings: Settings };
export type SetupEntry = ({ kind: 'period' } & Omit<Period, 'id'>)
  | { kind: 'check-in'; day: string; mood: NonNullable<Observations['mood']> };
