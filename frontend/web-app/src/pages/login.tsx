import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Flame, Mail, RefreshCw, Smartphone } from 'lucide-react';
import { describeAuthError, useAuth, type OtpRequestResult } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import LanguageSelect from '@/components/language-select';

type Mode = 'email' | 'mobile';

export default function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('email');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState<OtpRequestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', localStorage.getItem('weather-now-theme') === 'dark');
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const switchMode = (next: Mode) => { setMode(next); setIdentifier(''); setError(''); };

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await requestOtp(identifier);
      setSent(result);
      setCode('');
      setCooldown(30);
    } catch (err) {
      const info = describeAuthError(err);
      setError(info.message);
      if (info.retryAfterSec) setCooldown(info.retryAfterSec);
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await verifyOtp(identifier, code, name);
    } catch (err) {
      setError(describeAuthError(err).message);
      setBusy(false);
    }
  };

  const startOver = () => { setSent(null); setCode(''); setError(''); };

  return <div className="auth-page">
    <div className="auth-layout">
    <div className="auth-intro">
      <div className="eyebrow">{t('login.eyebrow')}</div>
      <h1>{t('login.heading')}</h1>
      <p>{t('login.intro')}</p>
      <div className="auth-levels" aria-label="Heat-risk colours used in the app">
        <span className="risk-tag safe"><span className="status-dot" />{t('risk.safe')}</span>
        <span className="risk-tag caution"><span className="status-dot" />{t('risk.caution')}</span>
        <span className="risk-tag high"><span className="status-dot" />{t('risk.high')}</span>
        <span className="risk-tag extreme"><span className="status-dot" />{t('risk.extreme')}</span>
      </div>
    </div>
    <div className="card auth-card">
      <div className="brand auth-brand">
        <div className="brand-mark"><Flame size={20} strokeWidth={2.6} /></div>
        <div><div className="brand-name" style={{ color: 'var(--navy)' }}>Weather Now</div><div className="subtle" style={{ fontSize: 12 }}>{t('app.tagline')}</div></div>
        <div style={{ marginLeft: 'auto' }}><LanguageSelect /></div>
      </div>
      <h1 className="auth-title">{t('login.title')}</h1>
      <p className="page-description">{sent ? t('login.codeSent', { dest: sent.destination }) : t('login.subtitle')}</p>

      {!sent && <form onSubmit={sendCode} data-testid="form-login-request">
        <div className="auth-tabs" role="tablist" aria-label={t('login.method')}>
          <button type="button" role="tab" aria-selected={mode === 'email'} className={mode === 'email' ? 'active' : ''} onClick={() => switchMode('email')} data-testid="tab-email"><Mail size={14} /> {t('login.email')}</button>
          <button type="button" role="tab" aria-selected={mode === 'mobile'} className={mode === 'mobile' ? 'active' : ''} onClick={() => switchMode('mobile')} data-testid="tab-mobile"><Smartphone size={14} /> {t('login.mobile')}</button>
        </div>
        <div className="form-field">
          <label htmlFor="login-identifier">{mode === 'email' ? t('login.emailLabel') : t('login.mobileLabel')}</label>
          <input id="login-identifier" className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus
            type={mode === 'email' ? 'email' : 'tel'} inputMode={mode === 'email' ? 'email' : 'tel'} autoComplete={mode === 'email' ? 'email' : 'tel'}
            placeholder={mode === 'email' ? 'you@example.com' : '98765 43210'} data-testid="input-identifier" />
          {mode === 'mobile' && <div className="notice">{t('login.mobileNote')}</div>}
        </div>
        {error && <div className="error-box" style={{ marginBottom: 12 }} role="alert">{error}</div>}
        <button className="button primary auth-submit" type="submit" disabled={busy || cooldown > 0 || !identifier.trim()} data-testid="button-send-code">
          {busy ? <RefreshCw size={14} /> : <ArrowRight size={14} />}{busy ? t('login.sending') : cooldown > 0 ? t('login.wait', { s: cooldown }) : t('login.send')}
        </button>
      </form>}

      {sent && <form onSubmit={confirmCode} data-testid="form-login-verify">
        {sent.devCode && <div className="demo-box" role="status" data-testid="text-dev-code">
          <b>Demo mode.</b> No email or SMS service is connected, so nothing was sent. Your code is <b className="mono">{sent.devCode}</b> (it is also printed in the API terminal).
        </div>}
        <div className="form-field">
          <label htmlFor="login-code">{t('login.codeLabel')}</label>
          <input id="login-code" className="input otp-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" pattern="[0-9]{6}" data-testid="input-code" />
        </div>
        <div className="form-field">
          <label htmlFor="login-name">{t('login.nameLabel')} <span className="subtle">{t('login.nameHint')}</span></label>
          <input id="login-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" placeholder="Ravi Kumar" data-testid="input-name" />
        </div>
        {error && <div className="error-box" style={{ marginBottom: 12 }} role="alert">{error}</div>}
        <button className="button primary auth-submit" type="submit" disabled={busy || code.length !== 6} data-testid="button-verify">
          {busy ? <RefreshCw size={14} /> : <ArrowRight size={14} />}{busy ? t('login.checking') : t('login.verify')}
        </button>
        <div className="auth-links">
          <button type="button" className="link-button" onClick={startOver} data-testid="button-change-identifier">{sent.channel === 'email' ? t('login.otherEmail') : t('login.otherNumber')}</button>
          <button type="button" className="link-button" onClick={() => void sendCode()} disabled={busy || cooldown > 0} data-testid="button-resend">{cooldown > 0 ? t('login.resendIn', { s: cooldown }) : t('login.resend')}</button>
        </div>
      </form>}
    </div>
    </div>
  </div>;
}
