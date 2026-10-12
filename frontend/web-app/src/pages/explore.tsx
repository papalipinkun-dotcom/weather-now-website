import { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, LocateFixed, RefreshCw, Search } from 'lucide-react';
import { UNAUTHORIZED_EVENT } from '@/lib/auth';
import { useI18n, type Translate } from '@/lib/i18n';
import { conditionText, riskText } from '@/lib/weather-text';

interface Place { name: string; region: string; country: string; latitude: number; longitude: number }
interface Hour {
  time: string; temperatureC: number; apparentTemperatureC: number; humidityPct: number; windSpeedMps: number;
  solarWm2: number; precipitationMm: number; condition: string; radiantTemperatureC: number; wbgtC: number;
  heatIndexC: number; riskLevel: string;
}
interface DayWeather {
  latitude: number; longitude: number; date: string; timezone: string; utcOffsetSeconds: number;
  source: 'forecast' | 'archive'; hours: Hour[]; fetchedAt: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (date: string, days: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const placeLabel = (p: Place) => [p.name, p.region, p.country].filter(Boolean).join(', ');
const hourOf = (h: Hour) => Number(h.time.slice(11, 13));
const riskTone = (risk: string) => (risk === 'EXTREME' ? 'extreme' : risk === 'HIGH' ? 'high' : 'caution');
const dayLabel = (date: string, locale: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

async function getApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin', signal });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${res.status}).`);
  return data as T;
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return <div className={`metric${tone ? ` tone-${tone}` : ''}`}>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}<span className="metric-unit">{unit}</span></div>
  </div>;
}

function DayChart({ hours, selected, onPick, label }: { hours: Hour[]; selected: number; onPick: (hour: number) => void; label: string }) {
  const W = 640, H = 210, pl = 38, pr = 12, pt = 14, pb = 26;
  const values = hours.flatMap((h) => [h.temperatureC, h.wbgtC]);
  const min = Math.floor(Math.min(...values) - 1), max = Math.ceil(Math.max(...values) + 1);
  const x = (i: number) => pl + (i * (W - pl - pr)) / Math.max(1, hours.length - 1);
  const y = (v: number) => pt + (1 - (v - min) / (max - min || 1)) * (H - pt - pb);
  const line = (pick: (h: Hour) => number) => hours.map((h, i) => `${x(i).toFixed(1)},${y(pick(h)).toFixed(1)}`).join(' ');
  const idx = Math.max(0, hours.findIndex((h) => hourOf(h) === selected));
  const choose = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - pl) / (W - pl - pr)) * (hours.length - 1));
    const h = hours[Math.min(hours.length - 1, Math.max(0, i))];
    if (h) onPick(hourOf(h));
  };
  return <svg className="explore-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerDown={choose}>
    {[min, (min + max) / 2, max].map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="chart-grid" /><text x={pl - 6} y={y(v) + 4} textAnchor="end" className="chart-text">{Math.round(v)}°</text></g>)}
    {[0, 6, 12, 18, 23].map((h) => <text key={h} x={x(Math.min(h, hours.length - 1))} y={H - 7} textAnchor="middle" className="chart-text">{pad(h)}:00</text>)}
    <polyline points={line((h) => h.wbgtC)} fill="none" className="chart-line wbgt" />
    <polyline points={line((h) => h.temperatureC)} fill="none" className="chart-line temp" />
    <line x1={x(idx)} x2={x(idx)} y1={pt} y2={H - pb} className="chart-marker" />
    <circle cx={x(idx)} cy={y(hours[idx].temperatureC)} r={5} className="chart-dot temp" />
    <circle cx={x(idx)} cy={y(hours[idx].wbgtC)} r={5} className="chart-dot wbgt" />
  </svg>;
}

export default function ExplorePage() {
  const { t, locale } = useI18n();
  const tRef = useRef<Translate>(t);
  tRef.current = t;
  const today = localDate(new Date());
  const maxDate = addDays(new Date().toISOString().slice(0, 10), 15);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [worldwide, setWorldwide] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [date, setDate] = useState(today);
  const [hour, setHour] = useState(new Date().getHours());
  const [data, setData] = useState<DayWeather | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (!showResults || q.length < 2) { setResults([]); setSearchError(''); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true); setSearchError('');
      try {
        const r = await getApi<{ places: Place[] }>(`/places/search?q=${encodeURIComponent(q)}&world=${worldwide ? 1 : 0}`, ctl.signal);
        setResults(r.places);
        if (r.places.length === 0) setSearchError(tRef.current('ex.noPlace'));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setSearchError((e as Error).message);
      } finally { if (!ctl.signal.aborted) setSearching(false); }
    }, 400);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [query, showResults, worldwide]);

  useEffect(() => {
    if (!place) return;
    const ctl = new AbortController();
    setLoading(true); setError('');
    getApi<DayWeather>(`/explore?lat=${place.latitude.toFixed(4)}&lon=${place.longitude.toFixed(4)}&date=${date}`, ctl.signal)
      .then((d) => setData(d))
      .catch((e: Error) => { if (e.name !== 'AbortError') { setError(e.message); setData(null); } })
      .finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    return () => ctl.abort();
  }, [place, date, tick]);

  // For today, jump to the current hour at the chosen place.
  useEffect(() => {
    if (!data) return;
    const nowAtPlace = new Date(Date.now() + data.utcOffsetSeconds * 1000).toISOString();
    if (nowAtPlace.slice(0, 10) === data.date) setHour(Number(nowAtPlace.slice(11, 13)));
  }, [data]);

  const pick = (p: Place) => { setPlace(p); setQuery(placeLabel(p)); setShowResults(false); setResults([]); setLocError(''); };
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { setLocError(t('ex.noShare')); return; }
    setLocating(true); setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false); setShowResults(false); setResults([]); setQuery('');
        setPlace({ name: t('ex.myLocation'), region: `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`, country: '', latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === 1 ? t('ex.blocked') : t('ex.locFail'));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  const selected = useMemo(() => data?.hours.find((h) => hourOf(h) === hour) ?? data?.hours[0], [data, hour]);
  const locationToday = data ? new Date(Date.now() + data.utcOffsetSeconds * 1000).toISOString().slice(0, 10) : today;
  const sourceLabel = !data ? '' : data.date > locationToday ? t('ex.src.forecast') : data.source === 'archive' ? t('ex.src.history') : t('ex.src.recent');
  const goDate = (d: string) => { if (d >= '1940-01-01' && d <= maxDate) setDate(d); };

  return <>
    <div className="page-head"><div><div className="eyebrow">{t('ex.eyebrow')}</div><h1>{t('ex.title')}</h1>
      <p className="page-description">{t('ex.intro')}</p></div></div>

    <div className="card card-pad">
      <div className="explore-controls">
        <div>
          <label className="eyebrow" htmlFor="explore-search" style={{ display: 'block', marginBottom: 7 }}>{t('ex.place')}</label>
          <div className="explore-search">
            <input id="explore-search" className="input" placeholder={t('ex.placeholder')} value={query} autoComplete="off"
              onChange={(e) => { setQuery(e.target.value); setShowResults(true); }} onFocus={() => { if (query.trim().length >= 2) setShowResults(true); }} data-testid="input-explore-search" />
            <button className="button" onClick={useMyLocation} disabled={locating} data-testid="button-use-location"><LocateFixed size={14} />{locating ? t('map.locating') : t('ex.useLocation')}</button>
          </div>
          <label className="notice" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}><input type="checkbox" checked={worldwide} onChange={(e) => setWorldwide(e.target.checked)} /> {t('ex.worldwide')}</label>
          {searching && <div className="card-kicker" style={{ marginTop: 8 }}>{t('ex.searching')}</div>}
          {searchError && <div className="card-kicker" style={{ marginTop: 8 }}>{searchError}</div>}
          {locError && <div className="error-box" style={{ marginTop: 10 }} role="alert">{locError}</div>}
          {results.length > 0 && <div className="place-results" role="listbox" aria-label={t('ex.place')}>
            {results.map((p) => <button key={`${p.latitude},${p.longitude}`} className="place-option" role="option" aria-selected={false} onClick={() => pick(p)}>
              <strong>{p.name}</strong><span>{[p.region, p.country].filter(Boolean).join(', ')}</span></button>)}
          </div>}
        </div>
        <div>
          <label className="eyebrow" htmlFor="explore-date" style={{ display: 'block', marginBottom: 7 }}>{t('ex.date')}</label>
          <div className="explore-date">
            <button className="button small" onClick={() => goDate(addDays(date, -1))} aria-label={t('ex.prevDay')}>‹</button>
            <input id="explore-date" type="date" className="input" value={date} min="1940-01-01" max={maxDate} onChange={(e) => e.target.value && goDate(e.target.value)} data-testid="input-explore-date" />
            <button className="button small" onClick={() => goDate(addDays(date, 1))} aria-label={t('ex.nextDay')}>›</button>
          </div>
          <div className="explore-quick">
            <button className="button small" onClick={() => goDate(addDays(today, -1))}>{t('ex.yesterday')}</button>
            <button className="button small" onClick={() => goDate(today)}>{t('ex.today')}</button>
            <button className="button small" onClick={() => goDate(addDays(today, 1))}>{t('ex.tomorrow')}</button>
          </div>
        </div>
      </div>
    </div>

    {!place && <div className="card empty" style={{ marginTop: 15 }}><Compass size={22} /><div style={{ marginTop: 8 }}>{t('ex.empty')}</div></div>}
    {place && error && <div className="error-box" style={{ marginTop: 15 }} role="alert"><span>{error}</span><button className="button small" onClick={() => setTick((n) => n + 1)}><RefreshCw size={13} /> {t('ex.retry')}</button></div>}
    {place && loading && !data && <div className="skeleton" style={{ height: 260, marginTop: 15 }} />}

    {place && data && selected && <div style={{ marginTop: 15, opacity: loading ? 0.6 : 1 }}>
      <div className="card card-pad">
        <div className="card-head"><div>
          <h2 className="card-title">{placeLabel(place)}</h2>
          <div className="card-kicker">{dayLabel(data.date, locale)} · {t('ex.localTime', { time: `${pad(hourOf(selected))}:00` })} · {data.timezone} · {data.latitude.toFixed(2)}, {data.longitude.toFixed(2)}</div></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="plain-pill mono">{sourceLabel}</span>
            <span className={`risk-tag ${riskTone(selected.riskLevel)}`}>{riskText(t, selected.riskLevel)}</span>
            <button className="button small" onClick={() => setTick((n) => n + 1)} disabled={loading} aria-label="Refresh"><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="explore-time">
          <label htmlFor="explore-hour" className="eyebrow">{t('ex.time')}</label>
          <input id="explore-hour" type="range" min={0} max={23} step={1} value={hour} onChange={(e) => setHour(Number(e.target.value))} data-testid="input-explore-hour" />
          <strong className="mono">{pad(hour)}:00</strong>
        </div>
        <div className="temp-hero" style={{ marginTop: 6 }}><div><div className="temp-value">{selected.temperatureC.toFixed(1)}<span className="temp-unit">°C</span></div>
          <div className="card-kicker">{conditionText(t, selected.condition)} · {t('ex.feels', { v: selected.apparentTemperatureC.toFixed(1) })}</div></div></div>
        <div className="metric-grid">
          <Stat label={t('ex.humidity')} value={String(selected.humidityPct)} unit="%" />
          <Stat label={t('ex.wind')} value={selected.windSpeedMps.toFixed(1)} unit="m/s" />
          <Stat label={t('ex.rain')} value={selected.precipitationMm.toFixed(1)} unit="mm" />
          <Stat label={t('ex.sun')} value={String(selected.solarWm2)} unit="W/m²" />
          <Stat label={t('ex.wbgt')} value={selected.wbgtC.toFixed(1)} unit="°C" tone={riskTone(selected.riskLevel)} />
          <Stat label={t('ex.heatIndex')} value={selected.heatIndexC.toFixed(1)} unit="°C" />
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 15 }}>
        <div className="card-head"><div><h2 className="card-title">{t('ex.dayTitle')}</h2><div className="card-kicker">{t('ex.dayHelp')}</div></div></div>
        <DayChart hours={data.hours} selected={hour} onPick={setHour} label={t('ex.chart')} />
        <div className="table-wrap" style={{ marginTop: 12 }}><table>
          <thead><tr><th>{t('ex.col.time')}</th><th>{t('ex.col.conditions')}</th><th>{t('ex.col.temp')}</th><th>{t('ex.col.feels')}</th><th>{t('ex.col.humidity')}</th><th>{t('ex.col.wind')}</th><th>{t('ex.col.rain')}</th><th>{t('ex.col.wbgt')}</th><th>{t('ex.col.risk')}</th></tr></thead>
          <tbody>{data.hours.map((h) => <tr key={h.time} className={hourOf(h) === hour ? 'hour-row selected' : 'hour-row'} onClick={() => setHour(hourOf(h))} aria-selected={hourOf(h) === hour}>
            <td className="mono">{pad(hourOf(h))}:00</td><td>{conditionText(t, h.condition)}</td><td className="mono">{h.temperatureC.toFixed(1)}°</td><td className="mono">{h.apparentTemperatureC.toFixed(1)}°</td>
            <td className="mono">{h.humidityPct}%</td><td className="mono">{h.windSpeedMps.toFixed(1)} m/s</td><td className="mono">{h.precipitationMm.toFixed(1)} mm</td>
            <td className="mono">{h.wbgtC.toFixed(1)}°</td><td><span className={`risk-tag ${riskTone(h.riskLevel)}`}>{riskText(t, h.riskLevel)}</span></td></tr>)}</tbody>
        </table></div>
      </div>
      <div className="footer-note">{t('ex.footer')}</div>
    </div>}
  </>;
}
