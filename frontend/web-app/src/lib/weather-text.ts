import type { MessageKey } from '@/lib/messages/en';
import type { Translate } from '@/lib/i18n';

// The API sends weather conditions and risk levels as English text.
// These helpers turn them into the chosen language and fall back to the
// original text if something unknown shows up.

const CONDITIONS: Record<string, MessageKey> = {
  'clear sky': 'cond.clear',
  'mostly clear': 'cond.mostlyClear',
  'partly cloudy': 'cond.partly',
  overcast: 'cond.overcast',
  fog: 'cond.fog',
  'freezing fog': 'cond.fog',
  'light drizzle': 'cond.drizzle',
  drizzle: 'cond.drizzle',
  'heavy drizzle': 'cond.drizzle',
  'light rain': 'cond.lightRain',
  rain: 'cond.rain',
  'heavy rain': 'cond.heavyRain',
  'light showers': 'cond.showers',
  showers: 'cond.showers',
  'heavy showers': 'cond.showers',
  thunderstorm: 'cond.thunder',
  'thunderstorm with hail': 'cond.thunder',
  'severe thunderstorm with hail': 'cond.thunder',
  'light snow': 'cond.snow',
  snow: 'cond.snow',
  'heavy snow': 'cond.snow',
};

const RISKS: Record<string, MessageKey> = {
  SAFE: 'risk.safe',
  LOW: 'risk.safe',
  CAUTION: 'risk.caution',
  MODERATE: 'risk.moderate',
  HIGH: 'risk.high',
  EXTREME: 'risk.extreme',
};

export const conditionText = (t: Translate, text: string) => {
  const key = CONDITIONS[text.toLowerCase()];
  return key ? t(key) : text;
};

export const riskText = (t: Translate, risk: string) => {
  const key = RISKS[risk.toUpperCase()];
  return key ? t(key) : risk;
};

export function aqiText(t: Translate, aqi: number): string {
  if (aqi <= 50) return t('aqi.good');
  if (aqi <= 100) return t('aqi.moderate');
  if (aqi <= 150) return t('aqi.sensitive');
  if (aqi <= 200) return t('aqi.unhealthy');
  if (aqi <= 300) return t('aqi.veryUnhealthy');
  return t('aqi.hazardous');
}

export function trendText(t: Translate, change: number): string {
  if (change >= 1) return t('trend.rising');
  if (change <= -1) return t('trend.falling');
  return t('trend.steady');
}
