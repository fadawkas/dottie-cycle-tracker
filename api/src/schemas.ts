import type { FastifySchema } from 'fastify';

export const day = { type: 'string', format: 'date', pattern: '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$' };
const uuid = { type: 'string', format: 'uuid' };
const optionalDay = { anyOf: [day, { type: 'null' }] };
const bool = { type: 'boolean' };
const choice = (...values: string[]) => ({ type: 'string', enum: values });
const object = (properties: object, required: string[] = Object.keys(properties)) =>
  ({ type: 'object', properties, required, additionalProperties: false });
const array = (items: object) => ({ type: 'array', items });

const periodFields = { startDate: day, endDate: optionalDay, endUnknown: bool };
export const periodBody = object(periodFields, ['startDate', 'endDate']);
export const periodId = object({ id: uuid });
export const logDay = object({ day });
const period = object({ id: uuid, ...periodFields });
const symptom = choice('cramps', 'headache', 'bloating', 'fatigue', 'breastTenderness', 'acne');
const symptomList = { ...array(symptom), uniqueItems: true, maxItems: 6 };
const mood = choice('good', 'okay', 'low', 'anxious', 'irritable');
export const setupBody = { oneOf: [
  object({ kind: choice('period'), ...periodFields }),
  object({ kind: choice('check-in'), day, mood }),
] };
const logFields = {
  flow: choice('spotting', 'light', 'medium', 'heavy'),
  symptoms: symptomList,
  mood,
  sleepHours: { type: 'number', minimum: 0, maximum: 24, multipleOf: 0.25 },
  sexualActivity: choice('yes', 'no'),
  protection: choice('used', 'notUsed'),
  note: { type: 'string', maxLength: 1000 },
};
export const logBody = object(logFields, []);
const log = object({ day, ...logFields }, ['day']);
const settingsFields = {
  symptoms: bool, mood: bool, sleep: bool, sexualActivity: bool, notes: bool,
  typicalPeriodDays: { anyOf: [{ type: 'integer', minimum: 1, maximum: 30 }, { type: 'null' }] },
  symptomShortcuts: symptomList,
  remindDaily: bool, remindPeriod: bool, remindEnd: bool,
};
export const settingsBody = object(settingsFields, ['symptoms', 'mood', 'sleep', 'sexualActivity']);
export const settingsResponse = object(settingsFields);
export const snapshot = object({ onboardingComplete: bool, periods: array(period), dailyLogs: array(log), settings: settingsResponse });
export const errorSchema = object({ error: { type: 'string' } });

export const responses = (success: object, code = 200): FastifySchema['response'] => ({
  [code]: success,
  '4xx': errorSchema,
  '5xx': errorSchema,
});
export const periodResponses = (code: number) => responses(period, code);
export const logResponses = responses(log);

export type PeriodInput = { startDate: string; endDate: string | null; endUnknown?: boolean };
export type SetupInput = ({ kind: 'period' } & Required<PeriodInput>)
  | { kind: 'check-in'; day: string; mood: 'good' | 'okay' | 'low' | 'anxious' | 'irritable' };
export type Settings = {
  symptoms: boolean; mood: boolean; sleep: boolean; sexualActivity: boolean; notes: boolean;
  typicalPeriodDays: number | null; symptomShortcuts: string[];
  remindDaily: boolean; remindPeriod: boolean; remindEnd: boolean;
};
export type SettingsInput = Pick<Settings, 'symptoms' | 'mood' | 'sleep' | 'sexualActivity'> & Partial<Settings>;
export type LogInput = {
  flow?: string; symptoms?: string[]; mood?: string; sleepHours?: number;
  sexualActivity?: 'yes' | 'no'; protection?: 'used' | 'notUsed'; note?: string;
};
