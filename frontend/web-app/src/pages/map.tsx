import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, RefreshCw, Search, Wind } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { aqiText, conditionText, riskText, trendText } from '@/lib/weather-text';
import type { MessageKey } from '@/lib/messages/en';
import { UNAUTHORIZED_EVENT } from '@/lib/auth';
import { buildHeatImage, legendGradient, tempCss, type GridPoint } from '@/lib/heat-colors';
import { loadLeaflet, type Leaflet, type LeafletMap } from '@/lib/leaflet-loader';

interface Place { name: string; region: string; country: string; latitude: number; longitude: number }
interface Gas { key: string; label: string; value: number; unit: string }
interface Signal { id: string; tone: 'safe' | 'caution' | 'high' | 'extreme'; value?: number }
interface PointDetail {
  latitude: number; longitude: number; timezone: string; observedAt: string; condition: string;
  temperatureC: number; apparentTemperatureC: number; humidityPct: number; cloudCoverPct: number;
  precipitationMm: number; solarWm2: number; radiantTemperatureC: number; wbgtC: number; heatIndexC: number; riskLevel: string;
  wind: { speedMps: number; gustMps: number; directionDeg: number; from: string };
  pressure: { surfaceHpa: number; seaLevelHpa: number; trendHpa3h: number | null };
  air: { usAqi: number | null; gases: Gas[] };
  micro: { signals: Signal[]; localSpreadC: number | null; nearbyAverageC: number | null };
  nextHours: { time: string; temperatureC: number }[];
}

const INDIA_CENTER: [number, number] = [22.6, 79.5];
const GRID_SIZE = 6;
const MAX_SPAN = { lat: 60, lon: 90 };

const riskTone = (risk: string) => (risk === 'EXTREME' ? 'extreme' : risk === 'HIGH' ? 'high' : 'caution');
// Message keys for each micro-weather signal the API can send.
const SIGNAL_KEYS: Record<string, [MessageKey, MessageKey]> = {
  'rapid-heating': ['sig.rapid.t', 'sig.rapid.d'],
  cooling: ['sig.cooling.t', 'sig.cooling.d'],
  'radiant-heat': ['sig.radiant.t', 'sig.radiant.d'],
  'still-air': ['sig.still.t', 'sig.still.d'],
  gusts: ['sig.gusts.t', 'sig.gusts.d'],
  'rain-soon': ['sig.rain.t', 'sig.rain.d'],
  'warm-pocket': ['sig.warm.t', 'sig.warm.d'],
  uneven: ['sig.uneven.t', 'sig.uneven.d'],
  calm: ['sig.calm.t', 'sig.calm.d'],
};

const placeLabel = (p: Place) => [p.name, p.region].filter(Boolean).join(', ');

async function getApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin', signal });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${res.status}).`);
  return data as T;
}

function Row({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <div className="feed-row"><div className="feed-title">{label}</div><span className="mono">{value}{unit ? ` ${unit}` : ''}</span></div>;
}

function MiniChart({ hours }: { hours: { time: string; temperatureC: number }[] }) {
  if (hours.length < 2) return null;
  const W = 300, H = 90, pad = 18;
  const values = hours.map((h) => h.temperatureC);
  const lo = Math.min(...values) - 0.5, hi = Math.max(...values) + 0.5;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (hours.length - 1);
  const y = (v: number) => H - 20 - ((v - lo) / (hi - lo || 1)) * (H - 36);
  return <svg viewBox={`0 0 ${W} ${H}`} className="map-mini-chart" role="img" aria-label="Temperature for the next hours">
    <polyline points={hours.map((h, i) => `${x(i).toFixed(1)},${y(h.temperatureC).toFixed(1)}`).join(' ')} fill="none" className="chart-line temp" />
    {[0, Math.floor(hours.length / 2), hours.length - 1].map((i) => <g key={i}>
      <circle cx={x(i)} cy={y(hours[i]!.temperatureC)} r={3.5} className="chart-dot temp" />
      <text x={x(i)} y={y(hours[i]!.temperatureC) - 8} textAnchor="middle" className="chart-text">{Math.round(hours[i]!.temperatureC)}°</text>
      <text x={x(i)} y={H - 4} textAnchor="middle" className="chart-text">{hours[i]!.time.slice(11, 16)}</text>
    </g>)}
  </svg>;
}

export default function MapPage() {
  const { t } = useI18n();
  // The map is built once, so its callbacks read the current language from a ref.
  const tRef = useRef(t);
  tRef.current = t;
  const mapEl = useRef<HTMLDivElement>(null);
  const leaflet = useRef<Leaflet | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const overlay = useRef<ReturnType<Leaflet['imageOverlay']> | null>(null);
  const marker = useRef<ReturnType<Leaflet['circleMarker']> | null>(null);
  const areaCtl = useRef<AbortController | null>(null);
  const pointCtl = useRef<AbortController | null>(null);

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [areaState, setAreaState] = useState<'idle' | 'loading' | 'error' | 'zoom'>('idle');
  const [areaMessage, setAreaMessage] = useState('');
  const [range, setRange] = useState<{ min: number; max: number } | null>(null);
  const [detail, setDetail] = useState<PointDetail | null>(null);
  const [pointLoading, setPointLoading] = useState(false);
  const [pointError, setPointError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searchNote, setSearchNote] = useState('');
  const [locating, setLocating] = useState(false);

  // Colour layer for whatever part of the map is on screen.
  const refreshArea = useCallback(async () => {
    const m = map.current, L = leaflet.current;
    if (!m || !L) return;
    const b = m.getBounds();
    const south = Math.max(-85, b.getSouth()), north = Math.min(85, b.getNorth());
    const west = Math.max(-180, b.getWest()), east = Math.min(180, b.getEast());
    if (north - south > MAX_SPAN.lat || east - west > MAX_SPAN.lon) {
      overlay.current?.remove(); overlay.current = null; setRange(null);
      setAreaState('zoom'); setAreaMessage(tRef.current('map.zoomIn'));
      return;
    }
    areaCtl.current?.abort();
    const ctl = new AbortController();
    areaCtl.current = ctl;
    setAreaState('loading');
    try {
      const q = `south=${south.toFixed(3)}&north=${north.toFixed(3)}&west=${west.toFixed(3)}&east=${east.toFixed(3)}&size=${GRID_SIZE}`;
      const { points } = await getApi<{ points: GridPoint[] }>(`/map/area?${q}`, ctl.signal);
      const url = buildHeatImage(points, GRID_SIZE, south, north);
      const bounds: [[number, number], [number, number]] = [[south, west], [north, east]];
      overlay.current?.remove();
      overlay.current = L.imageOverlay(url, bounds, { opacity: 0.55, interactive: false }).addTo(m) as ReturnType<Leaflet['imageOverlay']>;
      const temps = points.map((p) => p.temperatureC);
      setRange({ min: Math.min(...temps), max: Math.max(...temps) });
      setAreaState('idle');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setAreaState('error'); setAreaMessage((e as Error).message);
    }
  }, []);

  const selectPoint = useCallback(async (lat: number, lon: number) => {
    const L = leaflet.current, m = map.current;
    if (!L || !m) return;
    if (marker.current) marker.current.setLatLng([lat, lon]);
    else marker.current = L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#0b2a5b', fillOpacity: 1 }).addTo(m) as ReturnType<Leaflet['circleMarker']>;
    pointCtl.current?.abort();
    const ctl = new AbortController();
    pointCtl.current = ctl;
    setPointLoading(true); setPointError('');
    try {
      setDetail(await getApi<PointDetail>(`/map/point?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, ctl.signal));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') { setPointError((e as Error).message); setDetail(null); }
    } finally {
      if (!ctl.signal.aborted) setPointLoading(false);
    }
  }, []);

  // Start the map once.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current) return;
      leaflet.current = L;
      const m = L.map(mapEl.current, { zoomControl: true, minZoom: 3, worldCopyJump: false }).setView(INDIA_CENTER, 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      L.control.scale({ imperial: false }).addTo(m);
      m.on('click', (e) => void selectPoint(e.latlng.lat, e.latlng.lng));
      m.on('moveend', () => { clearTimeout(timer); timer = setTimeout(() => void refreshArea(), 700); });
      map.current = m;
      setReady(true);
      void refreshArea();
    }).catch((e: Error) => setMapError(e.message));
    return () => {
      cancelled = true; clearTimeout(timer);
      areaCtl.current?.abort(); pointCtl.current?.abort();
      map.current?.remove(); map.current = null; overlay.current = null; marker.current = null;
    };
  }, [refreshArea, selectPoint]);

  // Place search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearchNote(''); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await getApi<{ places: Place[] }>(`/places/search?q=${encodeURIComponent(q)}&world=1`, ctl.signal);
        setResults(r.places.slice(0, 6));
        setSearchNote(r.places.length ? '' : tRef.current('map.noPlace'));
      } catch (e) { if ((e as Error).name !== 'AbortError') setSearchNote((e as Error).message); }
    }, 400);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [query]);

  const gasName = (g: Gas) => t(`gas.${g.key}` as MessageKey);

  const goTo = (lat: number, lon: number, zoom = 11) => {
    map.current?.flyTo([lat, lon], zoom);
    void selectPoint(lat, lon);
  };
  const pickPlace = (p: Place) => { setQuery(placeLabel(p)); setResults([]); goTo(p.latitude, p.longitude); };
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { setSearchNote(t('map.noShare')); return; }
    setLocating(true); setSearchNote('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); goTo(pos.coords.latitude, pos.coords.longitude, 12); },
      (err) => { setLocating(false); setSearchNote(err.code === 1 ? t('map.blocked') : t('map.locFail')); },
      { timeout: 15000, maximumAge: 300000 },
    );
  };

  return <>
    <div className="page-head"><div><div className="eyebrow">{t('map.eyebrow')}</div><h1>{t('map.title')}</h1>
      <p className="page-description">{t('map.intro')}</p></div></div>

    <div className="map-page">
      <section className="card card-pad map-card">
        <div className="map-toolbar">
          <div className="explore-search">
            <input className="input" placeholder={t('map.search')} value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} aria-label={t('map.search')} />
            <button className="button" onClick={useMyLocation} disabled={locating || !ready}><LocateFixed size={14} />{locating ? t('map.locating') : t('map.myLocation')}</button>
          </div>
          {results.length > 0 && <div className="place-results" role="listbox" aria-label={t('map.search')}>
            {results.map((p) => <button key={`${p.latitude},${p.longitude}`} className="place-option" role="option" aria-selected={false} onClick={() => pickPlace(p)}>
              <strong>{p.name}</strong><span>{[p.region, p.country].filter(Boolean).join(', ')}</span></button>)}
          </div>}
          {searchNote && <div className="card-kicker" style={{ marginTop: 8 }}><Search size={11} style={{ verticalAlign: '-1px' }} /> {searchNote}</div>}
        </div>

        <div className="map-frame">
          <div ref={mapEl} className="map-leaflet" aria-label={t('map.title')} />
          {!ready && !mapError && <div className="map-overlay-note">{t('map.loading')}</div>}
          {mapError && <div className="map-overlay-note error">{mapError}</div>}
          {areaState === 'loading' && <div className="map-chip">{t('map.updating')}</div>}
        </div>

        <div className="map-legend-bar">
          <div className="legend-scale" style={{ background: legendGradient() }} aria-hidden="true" />
          <div className="legend-ticks mono"><span>8°</span><span>24°</span><span>36°</span><span>48°C</span></div>
          <div className="card-kicker">
            {areaState === 'zoom' || areaState === 'error' ? areaMessage
              : range ? t('map.range', { min: range.min.toFixed(0), max: range.max.toFixed(0), n: GRID_SIZE * GRID_SIZE })
              : t('map.noColours')}
            {areaState === 'error' && <> <button className="button small" onClick={() => void refreshArea()}><RefreshCw size={12} /> {t('map.retry')}</button></>}
          </div>
        </div>
      </section>

      <aside className="map-side">
        {!detail && !pointLoading && !pointError && <div className="card empty"><LocateFixed size={22} /><div style={{ marginTop: 8 }}>{t('map.tap')}</div></div>}
        {pointLoading && <div className="skeleton" style={{ height: 320 }} />}
        {pointError && <div className="error-box" role="alert"><span>{pointError}</span></div>}

        {detail && !pointLoading && <>
          <section className="card card-pad">
            <div className="card-head"><div>
              <h2 className="card-title">{detail.latitude.toFixed(3)}, {detail.longitude.toFixed(3)}</h2>
              <div className="card-kicker">{conditionText(t, detail.condition)} · {t('map.localTime', { time: detail.observedAt.slice(11, 16) })} · {detail.timezone}</div></div>
              <span className={`risk-tag ${riskTone(detail.riskLevel)}`}>{riskText(t, detail.riskLevel)}</span></div>
            <div className="temp-hero"><div>
              <div className="temp-value" style={{ color: tempCss(detail.temperatureC) }}>{detail.temperatureC.toFixed(1)}<span className="temp-unit">°C</span></div>
              <div className="card-kicker">{t('map.feels', { v: detail.apparentTemperatureC.toFixed(1) })}</div></div></div>
            <MiniChart hours={detail.nextHours} />
            <div className="feed" style={{ marginTop: 10 }}>
              <Row label={t('map.humidity')} value={String(detail.humidityPct)} unit="%" />
              <Row label={t('map.cloud')} value={String(detail.cloudCoverPct)} unit="%" />
              <Row label={t('map.rain')} value={detail.precipitationMm.toFixed(1)} unit="mm" />
              <Row label={t('map.sun')} value={String(detail.solarWm2)} unit="W/m²" />
              <Row label={t('map.radiant')} value={detail.radiantTemperatureC.toFixed(1)} unit="°C" />
              <Row label={t('map.wbgt')} value={detail.wbgtC.toFixed(1)} unit="°C" />
              <Row label={t('map.heatIndex')} value={detail.heatIndexC.toFixed(1)} unit="°C" />
            </div>
          </section>

          <section className="card card-pad">
            <div className="card-head"><div><h2 className="card-title">{t('map.micro')}</h2>
              <div className="card-kicker">{t('map.microSub')}</div></div></div>
            <div className="trigger-list">
              {detail.micro.signals.map((s) => { const [title, text] = SIGNAL_KEYS[s.id] ?? SIGNAL_KEYS.calm!; return <div className={`trigger micro-${s.tone}`} key={s.id}>
                <div className="trigger-icon"><span className="status-dot" style={{ background: 'currentColor', boxShadow: 'none' }} /></div>
                <div><strong>{t(title)}</strong><span>{t(text, { v: s.value ?? '', dir: detail.wind.from })}</span></div></div>; })}
            </div>
            {detail.micro.nearbyAverageC !== null && <div className="card-kicker" style={{ marginTop: 10 }}>
              {t('map.microNote', { v: detail.micro.nearbyAverageC.toFixed(1) })}</div>}
          </section>

          <section className="card card-pad">
            <div className="card-head"><div><h2 className="card-title">{t('map.windTitle')}</h2></div><Wind size={16} className="subtle" /></div>
            <div className="wind-block">
              <svg viewBox="0 0 80 80" className="wind-dial" role="img" aria-label={`${t('map.windFrom')} ${detail.wind.from}`}>
                <circle cx="40" cy="40" r="34" className="dial-ring" />
                {['N', 'E', 'S', 'W'].map((c, i) => <text key={c} x={[40, 72, 40, 8][i]} y={[12, 43, 76, 43][i]} textAnchor="middle" className="chart-text">{c}</text>)}
                {/* The arrow points the way the wind blows, which is opposite to the direction it comes from. */}
                <g transform={`rotate(${(detail.wind.directionDeg + 180) % 360} 40 40)`}>
                  <line x1="40" y1="56" x2="40" y2="22" className="dial-arrow" /><polygon points="40,14 34,26 46,26" className="dial-head" />
                </g>
              </svg>
              <div className="feed" style={{ flex: 1 }}>
                <Row label={t('map.windFrom')} value={`${detail.wind.from} (${detail.wind.directionDeg}°)`} />
                <Row label={t('map.speed')} value={detail.wind.speedMps.toFixed(1)} unit="m/s" />
                <Row label={t('map.gusts')} value={detail.wind.gustMps.toFixed(1)} unit="m/s" />
              </div>
            </div>
            <div className="feed" style={{ marginTop: 10 }}>
              <Row label={t('map.pSea')} value={String(detail.pressure.seaLevelHpa)} unit="hPa" />
              <Row label={t('map.pSpot')} value={String(detail.pressure.surfaceHpa)} unit="hPa" />
              <Row label={t('map.trend')} value={detail.pressure.trendHpa3h === null ? '—' : `${trendText(t, detail.pressure.trendHpa3h)} (${detail.pressure.trendHpa3h > 0 ? '+' : ''}${detail.pressure.trendHpa3h} hPa)`} />
            </div>
          </section>

          <section className="card card-pad">
            <div className="card-head"><div><h2 className="card-title">{t('map.gasTitle')}</h2>
              <div className="card-kicker">{detail.air.usAqi === null ? t('map.aqiNone') : t('map.aqi', { v: detail.air.usAqi, label: aqiText(t, detail.air.usAqi) })}</div></div></div>
            {detail.air.gases.length ? <div className="feed">
              {detail.air.gases.map((g) => <Row key={g.key} label={gasName(g)} value={String(g.value)} unit={g.unit} />)}
            </div> : <div className="empty">{t('map.noGas')}</div>}
          </section>
        </>}
      </aside>
    </div>
    <div className="footer-note">{t('map.footer')}</div>
  </>;
}
