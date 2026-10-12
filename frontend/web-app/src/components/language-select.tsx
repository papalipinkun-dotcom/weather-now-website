import { Languages } from 'lucide-react';
import { LANGUAGES, useI18n, type LangCode } from '@/lib/i18n';

export default function LanguageSelect() {
  const { lang, setLang, t } = useI18n();
  return <label className="lang-select" title={t('top.language')}>
    <Languages size={14} aria-hidden="true" />
    <select className="select" value={lang} onChange={(e) => setLang(e.target.value as LangCode)} aria-label={t('top.language')} data-testid="select-language">
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
    </select>
  </label>;
}
