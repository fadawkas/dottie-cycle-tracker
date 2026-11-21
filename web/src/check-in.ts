import type { Observations } from './model.ts';

type SexDetails = Pick<Observations, 'sexualActivity' | 'protection'>;

export const sexualActivityChoices = {
  noDetails: 'Had sex (no details)',
  withProtection: 'With protection',
  withoutProtection: 'Without protection',
  noSex: 'No sex',
};

type SexChoice = keyof typeof sexualActivityChoices;

export function getSexChoice({ sexualActivity, protection }: SexDetails): SexChoice | undefined {
  if (sexualActivity === 'no') return 'noSex';
  if (sexualActivity !== 'yes') return undefined;
  if (protection === 'used') return 'withProtection';
  if (protection === 'notUsed') return 'withoutProtection';
  return 'noDetails';
}

export function sexDetails(choice: SexChoice | undefined): SexDetails {
  return {
    sexualActivity: choice === 'noSex' ? 'no' : choice ? 'yes' : undefined,
    protection: choice === 'withProtection' ? 'used' : choice === 'withoutProtection' ? 'notUsed' : undefined,
  };
}

export function prepareCheckIn(details: Observations, sleep: string): Observations | null {
  const values = { ...details, sleepHours: sleep === '' ? undefined : Number(sleep), note: details.note?.trim() || undefined };
  if (!values.symptoms?.length) delete values.symptoms;
  if (values.sexualActivity !== 'yes') delete values.protection;
  return Object.values(values).some((value) => value !== undefined) ? values : null;
}
