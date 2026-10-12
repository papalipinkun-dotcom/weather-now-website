import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type MessageKey, type Messages } from '@/lib/messages/en';
import { hi } from '@/lib/messages/hi';
import { or } from '@/lib/messages/or';
import { bn } from '@/lib/messages/bn';
import { te } from '@/lib/messages/te';

// To add a language: copy messages/en.ts, translate it, then add one line to
// each of the two lists below.
export type LangCode = 'en' | 'hi' | 'or' | 'bn' | 'te';

export const LANGUAGES: { code: LangCode; name: string; locale: string }[] = [
  { code: 'en', name: 'English', locale: 'en-IN' },
  { code: 'hi', name: 'हिन्दी', locale: 'hi-IN' },
  { code: 'or', name: 'ଓଡ଼ିଆ', locale: 'or-IN' },
  { code: 'bn', name: 'বাংলা', locale: 'bn-IN' },
  { code: 'te', name: 'తెలుగు', locale: 'te-IN' },
];

const dictionaries: Record<LangCode, Messages> = { en, hi, or, bn, te };
const STORAGE_KEY = 'weather-now-lang';

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18nValue { lang: LangCode; setLang: (code: LangCode) => void; t: Translate; locale: string }

const I18nContext = createContext<I18nValue | null>(null);

function firstLanguage(): LangCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved as LangCode;
  } catch {
    // storage can be blocked in private mode, English is fine then
  }
  const fromBrowser = navigator.language.slice(0, 2);
  return LANGUAGES.find((l) => l.code === fromBrowser)?.code ?? 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(firstLanguage);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = useCallback<Translate>((key, vars) => {
    let text = dictionaries[lang][key] ?? en[key] ?? key;
    if (vars) for (const name of Object.keys(vars)) text = text.replaceAll(`{${name}}`, String(vars[name]));
    return text;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, locale: LANGUAGES.find((l) => l.code === lang)?.locale ?? 'en-IN' }),
    [lang, setLang, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider');
  return ctx;
}
