import { useEffect, useState, type ReactNode } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Check,
  Cloud, Code2, Compass, Fan, Flame, Gauge, Layers3, Map as MapIcon, MapPin, Menu, Moon, Radio,
  LogOut, RefreshCw, Shield, Sun, Thermometer, User, Wind, Wifi, WifiOff, Zap,
} from 'lucide-react';
import {
  getGetAlertsQueryKey, getGetDashboardQueryKey, getGetForecastQueryKey, getHealthCheckQueryKey,
  getGetHeatmapQueryKey, getGetNodeQueryKey, getGetNodeReadingsQueryKey, getGetNodesQueryKey,
  getGetSimulationQueryKey, useGetAlerts, useGetDashboard, useGetForecast,
  useGetHeatmap, useGetNode, useGetNodeReadings, useGetNodes, useGetSimulation,
  useHealthCheck, useIngestSensorData, useTriggerWorkerAction, useUpdateAlert, useUpdateSimulation,
  type DashboardSnapshot, type ForecastPoint, type ForecastSnapshot, type HeatAlert,
  type HeatmapSnapshot, type NodeSummary, type SensorReading, type SensorReadingInput,
  type SimulationState,
} from '@workspace/api-client-react';
import { AuthProvider, UNAUTHORIZED_EVENT, useAuth } from '@/lib/auth';
import LoginPage from '@/pages/login';
import ExplorePage from '@/pages/explore';
import MapPage from '@/pages/map';
import { LanguageProvider, useI18n } from '@/lib/i18n';
import LanguageSelect from '@/components/language-select';

const isUnauthorized = (error: unknown) => (error as { status?: number } | null)?.status === 401;
const onUnauthorized = (error: unknown) => { if (isUnauthorized(error)) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)); };
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onUnauthorized }),
  mutationCache: new MutationCache({ onError: onUnauthorized }),
  defaultOptions: { queries: { retry: (count, error) => !isUnauthorized(error) && count < 1, refetchOnWindowFocus: false } },
});

const fmt = (value?: number | null, digits = 1) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const timeLabel = (value?: string) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const riskClass = (risk?: string) => (risk || 'moderate').toLowerCase();
/** Visual tone for a status label that the app already computes (colour only; no new data). */
const toneOf = (status?: string): 'safe' | 'caution' | 'high' | 'extreme' | undefined => {
  const key = (status || '').toUpperCase();
  if (key === 'EXTREME') return 'extreme';
  if (key === 'HIGH' || key === 'ELEVATED') return 'high';
  if (key === 'MODERATE' || key === 'HUMID' || key === 'DRY' || key === 'LOW AIRFLOW') return 'caution';
  if (key === 'IN RANGE' || key === 'NORMAL' || key === 'AIRFLOW OK') return 'safe';
  return undefined;
};
const safeDecode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };
const deltaFromHour = (current?: number, previous?: number) =>
  current == null || previous == null ? undefined : Math.round((current - previous) * 10) / 10;
/** Map box for the India map (degrees). */
const INDIA_MAP = { lon0: 67.5, lon1: 98.5, lat0: 6.5, lat1: 37.5 };
/** Simplified outline of India as [longitude, latitude] points. */
const INDIA_OUTLINE: [number, number][] = [[73.7,36.9],[75.9,37.1],[77.8,35.5],[79.8,35.4],[79.0,33.2],[78.7,32.0],[79.1,31.0],[80.2,30.2],[80.1,28.9],[81.0,28.2],[82.0,27.9],[83.3,27.4],[84.7,27.0],[85.9,26.6],[87.3,26.4],[88.1,26.5],[88.1,27.4],[88.9,28.1],[88.8,27.3],[89.8,26.7],[91.6,26.8],[92.1,27.8],[93.1,28.5],[94.5,29.3],[96.1,29.4],[96.6,28.4],[97.4,28.3],[97.0,27.2],[96.1,27.3],[95.2,26.0],[94.6,25.3],[94.2,24.1],[93.3,23.0],[93.0,22.0],[92.4,22.6],[91.9,23.7],[91.3,23.0],[91.2,24.1],[91.8,25.2],[90.0,25.2],[89.9,26.0],[89.0,26.3],[88.4,26.5],[88.1,25.5],[88.5,24.9],[88.0,24.6],[88.7,24.2],[88.4,23.5],[89.0,22.9],[89.0,21.7],[87.0,21.5],[86.9,20.7],[86.4,20.0],[85.4,19.5],[84.8,19.0],[84.1,18.3],[83.3,17.5],[82.3,16.7],[81.3,16.2],[80.9,15.8],[80.2,15.5],[80.1,14.0],[80.3,13.2],[79.9,11.9],[79.8,10.8],[79.3,10.3],[78.9,9.3],[78.2,8.9],[77.5,8.1],[76.5,8.7],[75.9,9.8],[75.4,11.2],[74.5,12.8],[74.0,14.5],[73.4,15.5],[73.1,16.5],[72.8,17.6],[72.5,19.0],[72.5,20.0],[72.5,21.5],[72.2,21.5],[71.0,20.8],[70.4,20.9],[69.0,22.3],[70.0,22.9],[68.9,22.3],[68.2,23.6],[69.5,24.2],[70.1,24.9],[70.5,25.5],[70.0,26.6],[70.6,27.9],[71.9,27.9],[72.8,29.1],[73.9,29.9],[74.6,31.0],[74.5,31.7],[74.7,32.5],[75.3,32.9],[74.0,33.5],[73.8,34.5],[73.0,35.2],[72.6,35.8]];
const INDIA_PATH = INDIA_OUTLINE.map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${(((lon - INDIA_MAP.lon0) / (INDIA_MAP.lon1 - INDIA_MAP.lon0)) * 100).toFixed(2)} ${(((INDIA_MAP.lat1 - lat) / (INDIA_MAP.lat1 - INDIA_MAP.lat0)) * 100).toFixed(2)}`).join(' ') + ' Z';

function AppShell() {
  const { t } = useI18n();
  const [path, setPath] = useLocation();
  const [dark, setDark] = useState(() => localStorage.getItem('weather-now-theme') === 'dark');
  const [selectedId, setSelectedId] = useState('');
  const [recipient, setRecipient] = useState('Ravi · outdoor worker');
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState('');
  const [apiError, setApiError] = useState('');
  const [playgroundPayload, setPlaygroundPayload] = useState('{\n  "nodeId": "ahd-science-rooftop",\n  "temperatureC": 38.7,\n  "humidityPct": 48,\n  "radiantTemperatureC": 44.1,\n  "windSpeedMps": 0.8,\n  "solarExposureLux": 84200,\n  "wbgtC": 31.6,\n  "heatIndexC": 42.8\n}');
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const dashboardQ = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 3200 } });
  const nodesQ = useGetNodes({ query: { queryKey: getGetNodesQueryKey(), refetchInterval: 3200 } });
  const alertsQ = useGetAlerts({ query: { queryKey: getGetAlertsQueryKey(), refetchInterval: 3200 } });
  const heatmapQ = useGetHeatmap({ query: { queryKey: getGetHeatmapQueryKey(), refetchInterval: 4200 } });
  const simulationQ = useGetSimulation({ query: { queryKey: getGetSimulationQueryKey(), refetchInterval: 1800 } });
  const healthQ = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 12000 } });
  const routeId = path.startsWith('/nodes/') && path !== '/nodes/' ? safeDecode(path.slice('/nodes/'.length)) : '';
  const primaryId = dashboardQ.data?.primaryNode.id || nodesQ.data?.[0]?.id || '';
  const activeId = routeId || selectedId || primaryId;
  const nodeQ = useGetNode(activeId, { query: { enabled: !!activeId, queryKey: getGetNodeQueryKey(activeId) } });
  const readingsQ = useGetNodeReadings(activeId, { query: { enabled: !!activeId, queryKey: getGetNodeReadingsQueryKey(activeId) } });
  const forecastQ = useGetForecast(activeId, { query: { enabled: !!activeId, queryKey: getGetForecastQueryKey(activeId), refetchInterval: 3200 } });
  const updateAlert = useUpdateAlert();
  const ingest = useIngestSensorData();
  const updateSimulation = useUpdateSimulation();
  const workerAction = useTriggerWorkerAction();
  const simulation = simulationQ.data;
  const nodes = nodesQ.data || [];
  const alerts = alertsQ.data || [];
  const node = nodeQ.data || nodes.find((n) => n.id === activeId) || dashboardQ.data?.primaryNode;

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  const refreshTelemetry = () => {
    void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetNodesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetHeatmapQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetSimulationQueryKey() });
    if (activeId) {
      void qc.invalidateQueries({ queryKey: getGetNodeQueryKey(activeId) });
      void qc.invalidateQueries({ queryKey: getGetNodeReadingsQueryKey(activeId) });
      void qc.invalidateQueries({ queryKey: getGetForecastQueryKey(activeId) });
    }
  };
  const changeScenario = (scenario: 'NORMAL' | 'HEATWAVE') => updateSimulation.mutate(
    { data: { scenario } },
    { onSuccess: () => { refreshTelemetry(); setNotice(scenario === 'HEATWAVE' ? 'Heatwave demo scenario started. Edge readings are progressing from the API simulation.' : 'Normal demo scenario restored.'); }, onError: () => setNotice('Could not update the scenario. Retry when the API is available.') },
  );
  const toggleNetwork = () => updateSimulation.mutate(
    { data: { networkOnline: !simulation?.networkOnline } },
    { onSuccess: (result) => { refreshTelemetry(); setNotice(result.networkOnline ? 'Cloud link restored. Buffered readings are syncing.' : 'Cloud link interrupted. Edge AI remains active and readings buffer locally.'); }, onError: () => setNotice('Network state could not be changed.') },
  );
  const acknowledge = (alert: HeatAlert) => updateAlert.mutate(
    { alertId: alert.id, data: { status: 'ACKNOWLEDGED' } },
    { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetAlertsQueryKey() }); void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setNotice(`Acknowledged: ${alert.title}`); }, onError: () => setNotice('Alert acknowledgement failed. Try again.') },
  );
  const triggerAction = (action: 'FAN_ON' | 'REST_BREAK') => {
    if (!activeId) return;
    workerAction.mutate({ data: { nodeId: activeId, action, recipient } }, {
      onSuccess: (result) => { refreshTelemetry(); setNotice(`${result.message} — ${result.simulated ? 'simulated demo action' : 'action triggered'}.`); },
      onError: () => setNotice('Worker action could not be triggered.'),
    });
  };
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('weather-now-theme', next ? 'dark' : 'light');
  };
  const submitIngest = () => {
    setApiError('');
    try {
      const raw = JSON.parse(playgroundPayload) as Partial<SensorReadingInput>;
      const payload = { ...raw, nodeId: raw.nodeId || activeId } as SensorReadingInput;
      if (!payload.nodeId || typeof payload.temperatureC !== 'number' || typeof payload.humidityPct !== 'number' ||
          typeof payload.radiantTemperatureC !== 'number' || typeof payload.windSpeedMps !== 'number' ||
          typeof payload.solarExposureLux !== 'number') {
        setApiError('Required: nodeId, temperatureC, humidityPct, radiantTemperatureC, windSpeedMps, solarExposureLux.');
        return;
      }
      ingest.mutate({ data: payload }, {
        onSuccess: (reading) => { refreshTelemetry(); setNotice(`Reading ingested for ${reading.nodeId} at ${timeLabel(reading.observedAt)}.`); },
        onError: () => setApiError('Ingest request failed. Confirm the node ID and API availability, then retry.'),
      });
    } catch {
      setApiError('The request body is not valid JSON.');
    }
  };

  // `id` stays English so the data-testid values do not change with the language.
  const navItems = [
    { href: '/', id: 'overview', label: t('nav.overview'), icon: Gauge },
    { href: '/explore', id: 'explore', label: t('nav.explore'), icon: Compass },
    { href: '/map', id: 'weather-map', label: t('nav.map'), icon: MapIcon },
    { href: '/heatmap', id: 'heatmap', label: t('nav.heatmap'), icon: Layers3 },
    { href: '/alerts', id: 'alert-center', label: t('nav.alerts'), icon: AlertTriangle },
    { href: '/nodes', id: 'edge-nodes', label: t('nav.nodes'), icon: Radio },
    { href: '/api-docs', id: 'api-reference', label: t('nav.api'), icon: Code2 },
  ];
  const pageTitle = path.startsWith('/explore') ? t('nav.explore') : path.startsWith('/map') ? t('nav.map') : path.startsWith('/heatmap') ? t('nav.heatmap') : path.startsWith('/alerts') ? t('nav.alerts') :
    path.startsWith('/api-docs') ? t('nav.api') : path.startsWith('/nodes') ? t('nav.nodes') : t('nav.overview');

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Flame size={20} strokeWidth={2.6} /></div>
        <div><div className="brand-name">Weather Now</div><div className="brand-sub">{t('app.tagline')}</div></div>
      </div>
      <div className="nav-label">{t('nav.group')}</div>
      <nav className="nav-links" aria-label="Main navigation">
        {navItems.map(({ href, id, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${path === href || (href === '/nodes' && path.startsWith('/nodes/')) ? 'active' : ''}`} data-testid={`link-nav-${id}`}>
          <Icon size={16} strokeWidth={1.8} />{label}
        </Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="edge-card">
          <div className="edge-card-head"><span>Edge runtime</span><span className={`status-dot ${simulation?.edgeAiRunning ? '' : 'offline'}`} /></div>
          <p>{simulation?.edgeAiRunning ? 'Local inference active. Safety monitoring continues without cloud connectivity.' : 'Runtime status unavailable. Check system health.'}</p>
        </div>
        <div className="nav-label" style={{ marginTop: 19 }}>Field system · v0.1</div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left">
          <div className="mobile-menu">
            <button className="icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation" aria-expanded={mobileNav} aria-controls="mobile-navigation" data-testid="button-mobile-menu"><Menu size={16} /></button>
            <span className="topbar-title">Weather Now</span>
          </div>
          <span className="topbar-title desktop-title">Weather Now</span>
          <span className="subtle" style={{ fontSize: 10 }}> / {pageTitle}</span>
        </div>
        <div className="topbar-controls">
          <span className="system-pill"><span className={`status-dot ${simulation?.networkOnline ? '' : 'offline'}`} />{simulation?.networkOnline ? t('top.cloudOn') : t('top.cloudOff')}</span>
          {node && node.source !== 'DEMO' ? <span className="demo-pill live-pill">{t('top.live')}</span> : <span className="demo-pill">{t('top.demo')}</span>}
          <span className="header-update">{t('top.updated', { time: timeLabel(node?.updatedAt || dashboardQ.data?.primaryNode.updatedAt) })}</span>
          <select className="select" value={activeId} onChange={(e) => { setSelectedId(e.target.value); if (routeId) setPath(`/nodes/${e.target.value}`); }} aria-label="Select monitoring location" data-testid="select-location">
            {nodes.length === 0 && <option value="">Location</option>}
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.city} · {n.name}</option>)}
          </select>
          <LanguageSelect />
          <button className="icon-button" onClick={toggleTheme} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} data-testid="button-theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
          <span className="system-pill user-pill" title={user?.email || user?.phone || ''} data-testid="text-user"><User size={12} />{user?.name}</span>
          <button className="icon-button" onClick={() => void logout()} aria-label="Sign out" title="Sign out" data-testid="button-logout"><LogOut size={15} /></button>
        </div>
      </header>
      {mobileNav && <nav id="mobile-navigation" className="nav-links mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ href, id, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileNav(false)} className={`nav-link ${path === href || (href === '/nodes' && path.startsWith('/nodes/')) ? 'active' : ''}`} data-testid={`mobile-link-${id}`}><Icon size={15} />{label}</Link>)}
      </nav>}
      <div className="content">
        {notice && <div className="error-box notice-box" role="status" data-testid="status-notice">
          <span>{notice}</span><button className="button small" onClick={() => setNotice('')} data-testid="button-dismiss-notice">Dismiss</button>
        </div>}
        {(dashboardQ.isLoading || nodesQ.isLoading || simulationQ.isLoading) && <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><div className="skeleton" /><div className="skeleton" /></div>}
        {(dashboardQ.isError || nodesQ.isError || simulationQ.isError) && <div className="error-box" style={{ marginBottom: 15 }} role="alert">
          <span>Live API data could not be loaded. The command center will render when the service responds.</span>
          <button className="button small" onClick={() => { void dashboardQ.refetch(); void nodesQ.refetch(); void simulationQ.refetch(); void healthQ.refetch(); }} data-testid="button-retry-api"><RefreshCw size={13} /> Retry</button>
        </div>}
        {path === '/' && <Overview dashboard={dashboardQ.data} node={node} alerts={alerts} alertsLoading={alertsQ.isLoading} alertsError={alertsQ.isError}
          simulation={simulation} onScenario={changeScenario} onNetwork={toggleNetwork} onAction={triggerAction} onAcknowledge={acknowledge}
          recipient={recipient} setRecipient={setRecipient} actionPending={workerAction.isPending} simPending={updateSimulation.isPending}
          forecast={forecastQ.data?.points || dashboardQ.data?.forecast || []} />}
        {path === '/explore' && <ExplorePage />}
        {path === '/map' && <MapPage />}
        {path === '/heatmap' && <Heatmap heatmap={heatmapQ.data} loading={heatmapQ.isLoading} error={heatmapQ.isError} onRetry={() => void heatmapQ.refetch()} />}
        {path === '/alerts' && <Alerts alerts={alerts} loading={alertsQ.isLoading} error={alertsQ.isError} onRetry={() => void alertsQ.refetch()} onAcknowledge={acknowledge} pending={updateAlert.isPending} />}
        {path === '/nodes' && <Nodes nodes={nodes} loading={nodesQ.isLoading} error={nodesQ.isError} onRetry={() => void nodesQ.refetch()} />}
        {routeId && <NodeDetail node={node} readings={readingsQ.data} forecast={forecastQ.data} loading={nodeQ.isLoading || readingsQ.isLoading || forecastQ.isLoading}
          error={nodeQ.isError || readingsQ.isError} onRetry={() => { void nodeQ.refetch(); void readingsQ.refetch(); void forecastQ.refetch(); }}
          onAction={triggerAction} pending={workerAction.isPending} />}
        {path === '/api-docs' && <ApiDocs nodes={nodes} activeId={activeId} payload={playgroundPayload} setPayload={setPlaygroundPayload}
          submit={submitIngest} pending={ingest.isPending} error={apiError} setError={setApiError} success={ingest.data} />}
        {!['/', '/explore', '/map', '/heatmap', '/alerts', '/nodes', '/api-docs'].includes(path) && !routeId && <NotFound />}
        {path === '/' && <div className="footer-note">LAST UPDATE · {timeLabel(dashboardQ.data?.primaryNode.updatedAt)} &nbsp; / &nbsp; {healthQ.data?.status ? `API ${healthQ.data.status}` : 'API STATUS CHECKING'}</div>}
      </div>
    </main>
  </div>;
}

function PageHead({ eyebrow, title, description, hero = false, children }: { eyebrow: string; title: string; description: string; hero?: boolean; children?: ReactNode }) {
  return <div className={`page-head${hero ? ' hero' : ''}`}><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="page-description">{description}</p></div>{children && <div className="actions">{children}</div>}</div>;
}

function TrendComparison({ delta, unit }: { delta?: number; unit: string }) {
  if (delta == null) return <span className="metric-trend steady">No 1h baseline</span>;
  const direction = delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'steady';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return <span className={`metric-trend ${direction}`}>{arrow} {fmt(Math.abs(delta))}{unit} vs 1h</span>;
}

function Metric({ label, value, unit, icon: Icon, delta, status, showTrend = false }: {
  label: string; value: string; unit?: string; icon?: typeof Thermometer; delta?: number; status?: string; showTrend?: boolean;
}) {
  const tone = toneOf(status);
  return <div className={`metric${tone ? ` tone-${tone}` : ''}`} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="metric-label">{Icon && <Icon size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />}{label}</div>
    <div className="metric-value">{value}<span className="metric-unit">{unit}</span></div>
    {showTrend && <div className="metric-foot"><TrendComparison delta={delta} unit={unit || ''} /><span className={`metric-status${tone ? ` tone-${tone}` : ''}`}>{status || '—'}</span></div>}
  </div>;
}

function Risk({ level }: { level?: string }) { return <span className={`risk-tag ${riskClass(level)}`}><span className="status-dot" style={{ background: 'currentColor', boxShadow: 'none' }} />{level || 'UNKNOWN'}</span>; }

function Overview({ dashboard, node, alerts, alertsLoading, alertsError, simulation, onScenario, onNetwork, onAction, onAcknowledge, recipient, setRecipient, actionPending, simPending, forecast }: {
  dashboard?: DashboardSnapshot; node?: NodeSummary; alerts: HeatAlert[]; alertsLoading: boolean; alertsError: boolean;
  simulation?: SimulationState; onScenario: (s: 'NORMAL' | 'HEATWAVE') => void; onNetwork: () => void;
  onAction: (action: 'FAN_ON' | 'REST_BREAK') => void; onAcknowledge: (a: HeatAlert) => void; recipient: string; setRecipient: (s: string) => void; actionPending: boolean; simPending: boolean; forecast: ForecastPoint[];
}) {
  const active = alerts.filter((alert) => alert.status === 'ACTIVE');
  const hasNode = !!node;
  const hist = dashboard?.history || [];
  const previousHour = node?.previousHour;
  const temperatureDelta = deltaFromHour(node?.temperatureC, previousHour?.temperatureC);
  const wbgtDelta = deltaFromHour(node?.wbgtC, previousHour?.wbgtC);
  const humidityDelta = deltaFromHour(node?.humidityPct, previousHour?.humidityPct);
  const heatIndexDelta = deltaFromHour(node?.heatIndexC, previousHour?.heatIndexC);
  const radiantDelta = deltaFromHour(node?.radiantTemperatureC, previousHour?.radiantTemperatureC);
  const windDelta = deltaFromHour(node?.windSpeedMps, previousHour?.windSpeedMps);
  const rapidHeating = simulation?.scenario === 'HEATWAVE' && temperatureDelta != null && temperatureDelta >= 0.5;
  const rapidHeatingDetail = rapidHeating
    ? `Rapid heating alert: temperature is up ${fmt(temperatureDelta)}°C vs the previous hour.`
    : temperatureDelta == null
      ? 'No previous-hour baseline is available for this node yet.'
      : Math.abs(temperatureDelta) < 0.3
        ? 'No rapid-heating alert. Temperature is stable vs the previous hour.'
        : `No rapid-heating alert. Temperature is ${temperatureDelta > 0 ? 'up' : 'down'} ${fmt(Math.abs(temperatureDelta))}°C vs the previous hour.`;
  const live = !!node && node.source !== 'DEMO';
  return <>
    <PageHead hero eyebrow="Live exposure · edge inference" title="Heat, where people are." description="Hyper-local conditions for the places official stations cannot see. Sensor → edge forecast → alert → action.">
      {!live && <><button className={`button ${simulation?.scenario === 'HEATWAVE' ? 'primary' : ''}`} onClick={() => onScenario(simulation?.scenario === 'HEATWAVE' ? 'NORMAL' : 'HEATWAVE')} disabled={simPending} data-testid="button-toggle-heatwave">
        <Flame size={14} />{simulation?.scenario === 'HEATWAVE' ? 'Heatwave active · return to normal' : 'Run heatwave demo'}
      </button>
      <button className="button" onClick={onNetwork} disabled={simPending} data-testid="button-toggle-network">
        {simulation?.networkOnline ? <WifiOff size={14} /> : <Wifi size={14} />}{simulation?.networkOnline ? 'Simulate network failure' : 'Restore cloud link'}
      </button></>}
    </PageHead>
    <div className="grid overview-grid">
      <section className="card card-pad">
        <div className="card-head"><div><h2 className="card-title">Local exposure · {node?.location || node?.city || '—'}</h2><div className="card-kicker">{node?.name || 'Waiting for node data'} · {node?.source === 'DEMO' ? 'Generated sensor values' : node?.source === 'LIVE_WEATHER' ? 'Live weather · Open-Meteo' : node?.source || 'Data source unavailable'}</div></div>{hasNode && <Risk level={node.riskLevel} />}</div>
        {hasNode ? <>
          <div className="temp-hero"><div><div className="temp-value">{fmt(node.temperatureC)}<span className="temp-unit">°C</span></div><div className="card-kicker">Air temperature · observed {timeLabel(node.updatedAt)}</div><TrendComparison delta={temperatureDelta} unit="°C" /></div>
            <div style={{ textAlign: 'right' }}><div className="eyebrow" style={{ marginBottom: 7 }}>HEAT INDEX</div><div className="mono" style={{ fontSize: 22, fontWeight: 500 }}>{fmt(node.heatIndexC)}°</div><div className="card-kicker">Feels like</div></div></div>
          <div className="metric-grid">
            <Metric label="Relative humidity" value={fmt(node.humidityPct, 0)} unit="%" icon={Activity} delta={humidityDelta} status={node.humidityPct >= 65 ? 'HUMID' : node.humidityPct < 25 ? 'DRY' : 'IN RANGE'} showTrend />
            <Metric label="WBGT" value={fmt(node.wbgtC)} unit="°C" icon={Thermometer} delta={wbgtDelta} status={node.riskLevel} showTrend />
            <Metric label="Heat index" value={fmt(node.heatIndexC)} unit="°C" icon={Flame} delta={heatIndexDelta} status={node.heatIndexC >= 42 ? 'EXTREME' : node.heatIndexC >= 39 ? 'HIGH' : 'MODERATE'} showTrend />
            <Metric label="Radiant temperature" value={fmt(node.radiantTemperatureC)} unit="°C" icon={Zap} delta={radiantDelta} status={node.radiantTemperatureC - node.temperatureC >= 5 ? 'ELEVATED' : 'NORMAL'} showTrend />
            <Metric label="Air movement" value={fmt(node.windSpeedMps)} unit="m/s" icon={Wind} delta={windDelta} status={node.windSpeedMps < 0.8 ? 'LOW AIRFLOW' : 'AIRFLOW OK'} showTrend />
          </div>
        </> : <div className="empty">Waiting for an API-backed sensor node.</div>}
        {!live && <div className="comparison"><div><div className="comparison-label">Official station misses this microclimate</div><div className="comparison-label" style={{ marginTop: 4 }}>Station reading vs. this edge node</div></div>
          <div className="comparison-values"><span>{fmt(dashboard?.officialStationTemperatureC)}°</span><ArrowRight size={14} /><strong>{fmt(node?.temperatureC)}°</strong><span className="comparison-delta">{dashboard && dashboard.temperatureDifferenceC > 0 ? '+' : ''}{fmt(dashboard?.temperatureDifferenceC)}°C</span></div>
        </div>}
      </section>
      <section className="card card-pad">
        <div className="card-head"><div><h2 className="card-title">Risk outlook</h2><div className="card-kicker">Edge forecast · local conditions, not airport averages</div></div><span className="plain-pill mono">{live ? 'LIVE FORECAST' : simulation?.scenario === 'HEATWAVE' ? 'HEATWAVE DEMO' : 'NORMAL DEMO'}</span></div>
        <ForecastChart points={forecast} />
         <div className="microclimate" style={{ marginTop: 11 }}><div><div className="eyebrow" style={{ marginBottom: 6 }}>MICROCLIMATE SIGNAL</div><div className="microclimate-stat">{node ? `${fmt(node.radiantTemperatureC)}°C radiant` : '—'}</div><div className="microclimate-caption">Shade and surface heat shift worker exposure.</div></div><div style={{ textAlign: 'right' }}><div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{fmt(node?.windSpeedMps)} m/s</div><div className="microclimate-caption">air movement</div></div><div style={{ textAlign: 'right' }}><div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{fmt(node?.solarExposureLux, 0)} lux</div><div className="microclimate-caption">solar exposure</div></div></div>
        <div className="card-kicker" style={{ marginTop: 12 }}>{live ? 'Forecast comes from the Open-Meteo hourly model, interpolated to 15 minutes. Radiant temperature and WBGT are estimated from sunlight, wind and humidity.' : `Forecast is a generated DEMO value. Current backend: ${forecast.length ? 'edge model output' : 'forecast data unavailable'}.`}</div>
      </section>
    </div>
    <div className="grid section-grid">
      <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Risk triggers</h2><div className="card-kicker">Signals that explain the alert, in plain language.</div></div><Shield size={16} className="subtle" /></div>
        <div className="trigger-list">
          <Trigger icon={<Zap size={14} />} title="Radiant heat" detail={node ? `${fmt(node.radiantTemperatureC)}°C surface exposure · direct solar load can outrun shaded air temperature.` : 'Awaiting radiant-temperature reading.'} />
          <Trigger icon={<ArrowUpRight size={14} />} title={rapidHeating ? 'Rapid heating alert' : 'Rapid heating'} detail={rapidHeatingDetail} />
          <Trigger icon={<Cloud size={14} />} title="Cloud offline · edge running" detail={simulation?.networkOnline === false ? `Network interrupted. ${simulation.bufferedReadings} readings buffered locally; edge inference remains ${simulation.edgeAiRunning ? 'active' : 'unavailable'}.` : 'Edge inference is ready to continue during cloud interruption.'} />
        </div>
      </section>
      <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Exposure → action</h2><div className="card-kicker">The end-to-end safety loop. Actions are simulated in DEMO MODE.</div></div><ArrowRight size={16} className="subtle" /></div>
        <div className="flow">
          <div className="flow-step"><div className="flow-icon"><Radio size={13} /></div><b>Sensor</b><span>Local signals</span></div>
          <div className="flow-step"><div className="flow-icon"><Zap size={13} /></div><b>Edge forecast</b><span>Risk trajectory</span></div>
          <div className="flow-step"><div className="flow-icon"><AlertTriangle size={13} /></div><b>Early warning</b><span>{active.length} active alert{active.length === 1 ? '' : 's'}</span></div>
          <div className="flow-step"><div className="flow-icon"><Shield size={13} /></div><b>Action</b><span>Protect the crew</span></div>
        </div>
      </section>
      <section className="card card-pad">
        <div className="card-head"><div><h2 className="card-title">Early warning & worker action</h2><div className="card-kicker">Send a demo safety instruction from a live alert.</div></div><span className="demo-pill">SIMULATED</span></div>
        {alertsLoading ? <div className="skeleton" /> : alertsError ? <div className="empty">Alerts could not be loaded.</div> : active.length ? <div className="feed">
          {active.slice(0, 2).map((alert) => <div className="feed-row" key={alert.id} data-testid={`alert-preview-${alert.id}`}>
            <div><div className="feed-title">{alert.title}</div><div className="feed-meta">{alert.location} · {alert.recommendation}</div></div>
            <div className="actions"><button className="button small" onClick={() => onAcknowledge(alert)} data-testid={`button-ack-${alert.id}`}><Check size={12} />Acknowledge</button></div>
          </div>)}
        </div> : <div className="empty">No active alerts from the API. An early warning appears here when risk thresholds are reached.</div>}
        <div className="form-field"><label htmlFor="worker-recipient">Worker group</label><input id="worker-recipient" className="input" value={recipient} onChange={(e) => setRecipient(e.target.value)} data-testid="input-worker-recipient" /></div>
        <div className="actions"><button className="button primary" onClick={() => onAction('FAN_ON')} disabled={actionPending || !node} data-testid="button-fan-on"><Fan size={14} />Trigger fan demo</button>
          <button className="button" onClick={() => onAction('REST_BREAK')} disabled={actionPending || !node} data-testid="button-rest-break"><Shield size={14} />Send rest-break alert</button></div>
        {simulation?.scenario === 'HEATWAVE' && <div className="notice" style={{ marginTop: 11 }}>Heatwave progression is API-driven: values and risk levels advance with the simulation step. Current step {simulation.step}.</div>}
      </section>
      <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Recent readings</h2><div className="card-kicker">Observed at the edge · {hist.length} returned samples</div></div><Activity size={16} className="subtle" /></div>
         {hist.length ? <div className="feed">{hist.slice(-4).reverse().map((r) => <div key={r.id} className="feed-row"><div><div className="feed-title">{fmt(r.temperatureC)}°C · WBGT {fmt(r.wbgtC)}°</div><div className="feed-meta">{timeLabel(r.observedAt)} · {r.source === 'DEMO' ? 'Generated demo reading' : r.source === 'LIVE_WEATHER' ? 'Live weather reading' : r.source}</div></div><Risk level={r.riskLevel} /></div>)}</div> : <div className="empty">No recent sensor readings returned.</div>}
      </section>
    </div>
    <div className="footer-note">READINGS, ALERTS AND FORECASTS ARE API-DRIVEN · {live ? 'LIVE WEATHER FROM OPEN-METEO · ACTIONS ARE SIMULATED' : 'GENERATED VALUES AND ACTIONS ARE LABELLED DEMO MODE'} · {dashboard?.monitoredNodeCount ?? '—'} NODES MONITORED</div>
  </>;
}

function ForecastChart({ points }: { points: { time: string; temperatureC: number; wbgtC: number; riskLevel: string }[] }) {
  if (!points?.length) return <div className="empty" style={{ padding: '35px 12px' }}>Forecast points are not available yet.</div>;
  const vals = points.map((p) => p.wbgtC);
  const min = Math.min(...vals) - 1, max = Math.max(...vals) + 1;
  const xy = points.map((point, i) => `${20 + i * (260 / Math.max(1, points.length - 1))},${127 - ((point.wbgtC - min) / Math.max(1, max - min)) * 94}`).join(' ');
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span className="notice">WBGT · next forecast horizon</span><span className="notice mono">{points.length} model points</span></div>
    <svg className="chart" viewBox="0 0 300 150" role="img" aria-label="WBGT forecast trend">
      {[38, 74, 110].map((y) => <line key={y} x1="14" x2="286" y1={y} y2={y} className="chart-grid" />)}
      <polyline points={xy} fill="none" className="chart-line" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={`${p.time}-${i}`} cx={20 + i * (260 / Math.max(1, points.length - 1))} cy={127 - ((p.wbgtC - min) / Math.max(1, max - min)) * 94} r="3.5" className="chart-dot" strokeWidth="2" />)}
      <text x="16" y="146" className="chart-label">{points[0].time}</text><text x="260" y="146" className="chart-label">{points[points.length - 1].time}</text>
      <text x="14" y="21" className="chart-label">WBGT °C</text>
    </svg>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[...new Set(points.map((point) => point.riskLevel))].map((level) => <Risk key={level} level={level} />)}</div>
  </div>;
}

function Trigger({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="trigger"><div className="trigger-icon">{icon}</div><div><strong>{title}</strong><span>{detail}</span></div></div>;
}

function Heatmap({ heatmap, loading, error, onRetry }: { heatmap?: HeatmapSnapshot; loading: boolean; error: boolean; onRetry: () => void }) {
  const nodes = heatmap?.nodes || [];
  // Fixed map of India: longitude 67.5-98.5, latitude 6.5-37.5. The box is
  // 31 x 31 degrees; the container is narrowed by cos(22 deg) so shapes look right.
  const pos = (node: NodeSummary) => ({
    left: `${((node.longitude - INDIA_MAP.lon0) / (INDIA_MAP.lon1 - INDIA_MAP.lon0)) * 100}%`,
    top: `${((INDIA_MAP.lat1 - node.latitude) / (INDIA_MAP.lat1 - INDIA_MAP.lat0)) * 100}%`,
  });
  return <>
    <PageHead eyebrow="Multi-city exposure · live API" title="See the heat between stations." description="City teams can spot street-level hotspots before a regional forecast catches up." />
    {error && <div className="error-box" style={{ marginBottom: 15 }}>Heatmap data failed to load. <button className="button small" onClick={onRetry} data-testid="button-retry-heatmap">Retry</button></div>}
    {loading ? <div className="skeleton" style={{ height: 410 }} /> : <div className="heatmap-layout">
      <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">{heatmap ? `${heatmap.cities} cities · ${nodes.length} monitored nodes` : 'No heatmap data'}</h2><div className="card-kicker">{heatmap ? `Updated ${timeLabel(heatmap.updatedAt)} · generated/demo values are marked` : 'The map is populated by GET /api/heatmap.'}</div></div>{nodes.length > 0 && nodes.every((n) => n.source !== 'DEMO') ? <span className="demo-pill live-pill">LIVE DATA</span> : <span className="demo-pill">DEMO DATA</span>}</div>
        <div className="map-canvas india-map" aria-label="Map of India with monitored locations">
          <svg className="india-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="india-shape" d={INDIA_PATH} />
          </svg>
          {nodes.map((n) => <Link key={n.id} href={`/nodes/${encodeURIComponent(n.id)}`} className={`map-node dense ${riskClass(n.riskLevel)}`} style={pos(n)} title={`${n.city} · ${n.name} · ${n.temperatureC}°C · ${n.riskLevel}`} data-testid={`map-node-${n.id}`}>{fmt(n.temperatureC, 0)}</Link>)}
          {!nodes.length && <div className="empty">No node coordinates returned by the heatmap API.</div>}
        </div>
        <div className="map-legend"><span className="legend-item"><i className="legend-dot" style={{ background: 'var(--risk-caution)' }} />MODERATE</span><span className="legend-item"><i className="legend-dot" style={{ background: 'var(--risk-high)' }} />HIGH</span><span className="legend-item"><i className="legend-dot" style={{ background: 'var(--risk-extreme)' }} />EXTREME</span><span className="legend-item">Select a sensor to inspect details</span></div>
      </section>
      <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Hotspot snapshot</h2><div className="card-kicker">Risk counts supplied by the API.</div></div><Compass size={16} className="subtle" /></div>
        <div className="metric-grid" style={{ gridTemplateColumns: '1fr' }}>
          <Metric label="Moderate risk nodes" value={String(heatmap?.counts.moderate ?? '—')} icon={Activity} />
          <Metric label="High risk nodes" value={String(heatmap?.counts.high ?? '—')} icon={ArrowUpRight} />
          <Metric label="Extreme risk nodes" value={String(heatmap?.counts.extreme ?? '—')} icon={AlertTriangle} />
        </div>
        <div className="feed" style={{ marginTop: 13 }}>{nodes.slice().sort((a, b) => b.temperatureC - a.temperatureC).slice(0, 5).map((n) => <div className="feed-row" key={n.id}><div><div className="feed-title">{n.city} · {n.name}</div><div className="feed-meta">{n.siteType} · {fmt(n.wbgtC)}° WBGT</div></div><Risk level={n.riskLevel} /></div>)}</div>
        {!nodes.length && !loading && <div className="empty">No hotspot nodes to rank yet.</div>}
      </section>
    </div>}
    <div className="footer-note">COORDINATES AND RISK COLORS REFLECT API RESPONSE VALUES · {nodes.length > 0 && nodes.every((n) => n.source !== 'DEMO') ? 'LIVE WEATHER FROM OPEN-METEO' : 'DEMO MODE'}</div>
  </>;
}

function Alerts({ alerts, loading, error, onRetry, onAcknowledge, pending }: { alerts: HeatAlert[]; loading: boolean; error: boolean; onRetry: () => void; onAcknowledge: (a: HeatAlert) => void; pending: boolean }) {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'ACKNOWLEDGED'>('ACTIVE');
  const filtered = alerts.filter((a) => filter === 'ALL' || a.status === filter);
  return <>
    <PageHead eyebrow="Signal → response" title="Alert center" description="Acknowledge the signal, give teams a concrete next step, keep a clear response trail.">
      {(['ACTIVE', 'ACKNOWLEDGED', 'ALL'] as const).map((item) => <button key={item} className={`button small ${filter === item ? 'primary' : ''}`} onClick={() => setFilter(item)} aria-pressed={filter === item} data-testid={`button-filter-${item.toLowerCase()}`}>{item === 'ALL' ? 'All alerts' : item}</button>)}
    </PageHead>
    {error && <div className="error-box" style={{ marginBottom: 14 }}>Alerts are unavailable. <button className="button small" onClick={onRetry} data-testid="button-retry-alerts">Retry</button></div>}
    {loading ? <div className="alert-stack"><div className="skeleton" /><div className="skeleton" /></div> : filtered.length ? <div className="alert-stack">
      {filtered.map((alert) => <article className={`card alert-card sev-${riskClass(alert.severity)}${alert.status === 'ACTIVE' ? '' : ' acked'}`} key={alert.id} data-testid={`card-alert-${alert.id}`}>
        <div className="alert-mark"><AlertTriangle size={17} /></div>
        <div><div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 7 }}><h3>{alert.title}</h3><Risk level={alert.severity} /><span className="plain-pill">{alert.status}</span></div>
          <p>{alert.description}</p><div className="feed-meta" style={{ marginTop: 9 }}>{alert.location} · {alert.type} · {timeLabel(alert.createdAt)}</div>
          <div className="microclimate" style={{ marginTop: 11, padding: 11 }}><div><b style={{ fontSize: 10 }}>Recommended response</b><div className="microclimate-caption">{alert.recommendation}</div></div></div>
        </div>
        <div className="alert-action">{alert.status === 'ACTIVE' ? <button className="button small" disabled={pending} onClick={() => onAcknowledge(alert)} data-testid={`button-ack-${alert.id}`}><Check size={12} />Acknowledge</button> : <span className="plain-pill"><Check size={12} />Acknowledged</span>}</div>
      </article>)}
    </div> : <div className="card empty"><div style={{ color: 'hsl(var(--primary))', marginBottom: 9 }}><Shield size={24} /></div><b>No {filter === 'ALL' ? '' : filter.toLowerCase()} alerts returned</b><div style={{ marginTop: 6 }}>New early warnings will appear when the API reports a risk trigger.</div></div>}
    <div className="footer-note">ALERTS ARE GENERATED FROM EDGE RISK SIGNALS · ALL ACTIONS IN THIS ENVIRONMENT ARE DEMONSTRATIONS</div>
  </>;
}

function Nodes({ nodes, loading, error, onRetry }: { nodes: NodeSummary[]; loading: boolean; error: boolean; onRetry: () => void }) {
  const [search, setSearch] = useState('');
  const filtered = nodes.filter((node) => `${node.name} ${node.city} ${node.location} ${node.siteType}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <PageHead eyebrow="Connected edge hardware" title="Node inventory" description="Every sensor point is a small operational picture: location, exposure, model input and current edge state.">
      <span className="plain-pill"><Radio size={13} />{nodes.length} nodes in API</span>
    </PageHead>
    <div className="card card-pad">
      <div className="card-head"><div><h2 className="card-title">Monitored locations</h2><div className="card-kicker">Open a node to inspect telemetry, recent readings and its local forecast.</div></div>
        <input aria-label="Search nodes" className="input" placeholder="Search city or site" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220 }} data-testid="input-search-nodes" />
      </div>
      {error && <div className="error-box" style={{ marginBottom: 12 }}>Node inventory could not load. <button className="button small" onClick={onRetry} data-testid="button-retry-nodes">Retry</button></div>}
      {loading ? <div className="skeleton" /> : filtered.length ? <div className="table-wrap"><table><thead><tr><th>Node / location</th><th>City · site type</th><th>Air</th><th>WBGT</th><th>Humidity</th><th>Risk</th><th>Source</th><th /></tr></thead><tbody>
        {filtered.map((n) => <tr key={n.id} data-testid={`row-node-${n.id}`}><td><div className="node-name">{n.name}</div><div className="node-sub">{n.location}</div></td><td>{n.city}<div className="node-sub">{n.siteType}</div></td><td className="mono">{fmt(n.temperatureC)}°C</td><td className="mono">{fmt(n.wbgtC)}°C</td><td className="mono">{fmt(n.humidityPct, 0)}%</td><td><Risk level={n.riskLevel} /></td><td><span className="plain-pill">{n.source === 'DEMO' ? 'DEMO' : n.source === 'LIVE_WEATHER' ? 'LIVE' : n.source}</span></td><td><Link className="button small" href={`/nodes/${encodeURIComponent(n.id)}`} data-testid={`link-node-${n.id}`}>Inspect <ArrowRight size={12} /></Link></td></tr>)}
      </tbody></table></div> : <div className="empty">{nodes.length ? 'No nodes match that search.' : 'No nodes returned by the API.'}</div>}
    </div>
    <div className="footer-note">NODE INVENTORY IS API-DRIVEN · DEMO VALUE SOURCES ARE EXPLICITLY MARKED</div>
  </>;
}

function NodeDetail({ node, readings, forecast, loading, error, onRetry, onAction, pending }: {
  node?: NodeSummary; readings?: SensorReading[]; forecast?: ForecastSnapshot; loading: boolean; error: boolean; onRetry: () => void; onAction: (action: 'FAN_ON' | 'REST_BREAK') => void; pending: boolean;
}) {
  if (loading) return <><PageHead eyebrow="Node profile" title="Loading node…" description="Fetching current edge telemetry." /><div className="skeleton" /></>;
  if (error || !node) return <><PageHead eyebrow="Node profile" title="Node unavailable" description="The node endpoint did not return this location." /><div className="error-box">Could not load node details. <button className="button small" onClick={onRetry} data-testid="button-retry-node-detail">Retry</button></div></>;
  return <>
    <PageHead eyebrow={`Node profile · ${node.id}`} title={node.name} description={`${node.location} · ${node.city} · ${node.siteType}`}>
      <span className="plain-pill"><span className={`status-dot ${node.source === 'DEMO' ? 'offline' : ''}`} />{node.source === 'DEMO' ? 'DEMO SENSOR' : node.source === 'LIVE_WEATHER' ? 'LIVE WEATHER' : 'EDGE DEVICE'}</span>
      <Link href="/nodes" className="button"><ArrowRight size={13} />All nodes</Link>
    </PageHead>
    <div className="node-detail-grid">
      <div className="grid">
        <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Current exposure</h2><div className="card-kicker">Reading updated {timeLabel(node.updatedAt)}</div></div><Risk level={node.riskLevel} /></div>
          <div className="metric-grid">
            <Metric label="Air temperature" value={fmt(node.temperatureC)} unit="°C" delta={deltaFromHour(node.temperatureC, node.previousHour?.temperatureC)} status={node.riskLevel} showTrend />
            <Metric label="Relative humidity" value={fmt(node.humidityPct, 0)} unit="%" delta={deltaFromHour(node.humidityPct, node.previousHour?.humidityPct)} status={node.humidityPct >= 65 ? 'HUMID' : 'IN RANGE'} showTrend />
            <Metric label="WBGT" value={fmt(node.wbgtC)} unit="°C" delta={deltaFromHour(node.wbgtC, node.previousHour?.wbgtC)} status={node.riskLevel} showTrend />
            <Metric label="Heat index" value={fmt(node.heatIndexC)} unit="°C" delta={deltaFromHour(node.heatIndexC, node.previousHour?.heatIndexC)} status={node.heatIndexC >= 42 ? 'EXTREME' : node.heatIndexC >= 39 ? 'HIGH' : 'MODERATE'} showTrend />
            <Metric label="Radiant temperature" value={fmt(node.radiantTemperatureC)} unit="°C" delta={deltaFromHour(node.radiantTemperatureC, node.previousHour?.radiantTemperatureC)} status={node.radiantTemperatureC - node.temperatureC >= 5 ? 'ELEVATED' : 'NORMAL'} showTrend />
            <Metric label="Air movement" value={fmt(node.windSpeedMps)} unit="m/s" delta={deltaFromHour(node.windSpeedMps, node.previousHour?.windSpeedMps)} status={node.windSpeedMps < 0.8 ? 'LOW AIRFLOW' : 'AIRFLOW OK'} showTrend />
          </div>
        </section>
        <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Short-range forecast</h2><div className="card-kicker">{forecast?.model || 'Model details unavailable'} · {forecast?.horizonMinutes ?? '—'} minute horizon</div></div><span className="demo-pill">{forecast?.simulated ? 'SIMULATED' : 'LIVE FORECAST'}</span></div>
          <ForecastChart points={forecast?.points || []} />
        </section>
        <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Recent sensor readings</h2><div className="card-kicker">Latest values returned for this node.</div></div></div>
           {readings?.length ? <div className="table-wrap"><table><thead><tr><th>Observed</th><th>Temperature</th><th>WBGT</th><th>Radiant</th><th>Wind</th><th>Risk</th></tr></thead><tbody>{readings.slice().reverse().slice(0, 12).map((r) => <tr key={r.id}><td>{timeLabel(r.observedAt)}</td><td>{fmt(r.temperatureC)}°C</td><td>{fmt(r.wbgtC)}°C</td><td>{fmt(r.radiantTemperatureC)}°C</td><td>{fmt(r.windSpeedMps)} m/s</td><td><Risk level={r.riskLevel} /></td></tr>)}</tbody></table></div> : <div className="empty">No readings returned for this node.</div>}
        </section>
      </div>
      <div className="grid" style={{ alignContent: 'start' }}>
        <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Site context</h2><div className="card-kicker">Coordinate and ambient inputs at sensor position.</div></div><MapPin size={16} className="subtle" /></div>
          <div className="feed"><div className="feed-row"><div className="feed-title">Coordinates</div><span className="mono">{node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}</span></div><div className="feed-row"><div className="feed-title">Solar exposure</div><span className="mono">{fmt(node.solarExposureLux, 0)} lux</span></div><div className="feed-row"><div className="feed-title">Data source</div><span className="plain-pill">{node.source}</span></div></div>
        </section>
        <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Protect this crew</h2><div className="card-kicker">Generated demo actions. Confirm local protocol before use.</div></div><Shield size={16} className="subtle" /></div>
          <button className="button primary" style={{ width: '100%', marginBottom: 8 }} disabled={pending} onClick={() => onAction('FAN_ON')} data-testid="button-node-fan"><Fan size={14} />Trigger fan demo action</button>
          <button className="button" style={{ width: '100%' }} disabled={pending} onClick={() => onAction('REST_BREAK')} data-testid="button-node-rest"><Shield size={14} />Send rest-break alert</button>
        </section>
      </div>
    </div>
  </>;
}

function ApiDocs({ nodes, activeId, payload, setPayload, submit, pending, error, setError, success }: {
  nodes: NodeSummary[]; activeId: string; payload: string; setPayload: (value: string) => void; submit: () => void; pending: boolean; error: string; setError: (value: string) => void;
  success?: SensorReading;
}) {
  const endpoints = [
    ['GET', '/api/healthz', 'Service readiness and basic API status.'],
    ['GET', '/api/dashboard', 'Primary-node snapshot, official-station comparison, history and active alert totals.'],
    ['GET', '/api/nodes', 'Current multi-city edge node inventory.'],
    ['GET', '/api/nodes/:nodeId', 'Latest status and measurements for one edge node.'],
    ['GET', '/api/nodes/:nodeId/readings', 'Recent sensor readings for a node.'],
    ['POST', '/api/sensor-data', 'Ingest a sensor reading from hardware or the DEMO playground.'],
    ['GET', '/api/heatmap', 'City-level hotspots, risk counts and node coordinates.'],
    ['GET', '/api/forecast/:nodeId', 'Short-range edge forecast for one node.'],
    ['GET', '/api/alerts', 'Active and acknowledged heat-risk alerts.'],
    ['PATCH', '/api/alerts/:alertId', 'Acknowledge an alert with { "status": "ACKNOWLEDGED" }.'],
    ['GET', '/api/simulation', 'Current demo scenario, network and edge runtime state.'],
    ['PATCH', '/api/simulation', 'Set scenario to NORMAL or HEATWAVE; set networkOnline true/false.'],
    ['POST', '/api/actions', 'Trigger a simulated FAN_ON or REST_BREAK worker action.'],
  ];
  const copy = (text: string) => { void navigator.clipboard?.writeText(text); };
  let targetId = activeId;
  try {
    const draft = JSON.parse(payload) as unknown;
    if (draft && typeof draft === 'object' && 'nodeId' in draft && typeof draft.nodeId === 'string' && draft.nodeId) {
      targetId = draft.nodeId;
    }
  } catch {
    // Keep the selected node available while the user edits an incomplete JSON draft.
  }
  const example = `curl -X POST http://localhost:8080/api/sensor-data \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify({ nodeId: targetId || '<nodeId>', temperatureC: 38.7, humidityPct: 48, radiantTemperatureC: 44.1, windSpeedMps: 0.8, solarExposureLux: 84200, wbgtC: 31.6, heatIndexC: 42.8 }, null, 2)}'`;
  const selectedNode = nodes.find((n) => n.id === targetId);
  return <>
    <PageHead eyebrow="Integration guide · generated client" title="Connect the edge." description="The same API powers the dashboard and the ingest playground. Examples use demo values only.">
      <span className="demo-pill">DEMO MODE</span>
    </PageHead>
    <div className="grid docs-layout">
      <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Endpoint reference</h2><div className="card-kicker">Useful routes for sensor → forecast → alert → action.</div></div><Code2 size={16} className="subtle" /></div>
        {endpoints.map(([method, path, desc]) => <div className="endpoint" key={`${method}-${path}`}><span className={`method ${method === 'POST' || method === 'PATCH' ? 'post' : ''}`}>{method}</span><div><div className="endpoint-path">{path}</div><div className="endpoint-desc">{desc}</div></div></div>)}
      </section>
      <div className="grid" style={{ alignContent: 'start' }}>
        <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Sensor ingest playground</h2><div className="card-kicker">Submits to the real POST /api/sensor-data mutation.</div></div><span className="demo-pill">GENERATED VALUES</span></div>
          <div className="form-field"><label htmlFor="ingest-node">Target edge node</label><select id="ingest-node" className="select" style={{ width: '100%' }} value={targetId} onChange={(e) => {
            try {
              const draft = JSON.parse(payload || '{}') as unknown;
              if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
                setError('The request body must be a JSON object before changing its target node.');
                return;
              }
              (draft as Record<string, unknown>).nodeId = e.target.value;
              setPayload(JSON.stringify(draft, null, 2));
              setError('');
            } catch {
              setError('Fix the JSON syntax before changing the target node. Your draft was kept.');
            }
          }} data-testid="select-ingest-node">{nodes.map((n) => <option key={n.id} value={n.id}>{n.city} · {n.name}</option>)}{!nodes.length && <option value="">No nodes returned</option>}</select></div>
          <div className="notice">Payload targets <b>{selectedNode?.name || targetId || 'no selected node'}</b>. Required fields: temperatureC, humidityPct, radiantTemperatureC, windSpeedMps, solarExposureLux.</div>
          <div className="form-field"><label htmlFor="ingest-json">JSON request body</label><textarea id="ingest-json" className="textarea" value={payload} onChange={(e) => setPayload(e.target.value)} spellCheck={false} data-testid="textarea-ingest-payload" /></div>
          {error && <div className="error-box" style={{ marginBottom: 10 }} role="alert">{error}</div>}
          {success && <div className="microclimate" style={{ marginBottom: 10 }} role="status"><div><b style={{ fontSize: 10 }}>Ingest accepted</b><div className="microclimate-caption">{success.nodeId} · {fmt(success.temperatureC)}°C · {timeLabel(success.observedAt)}</div></div><Check size={16} /></div>}
          <button className="button primary" style={{ width: '100%' }} onClick={submit} disabled={pending || !targetId} data-testid="button-submit-ingest">{pending ? <RefreshCw size={14} /> : <ArrowRight size={14} />}{pending ? 'Sending reading…' : 'Send sensor reading'}</button>
        </section>
        <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Copyable request</h2><div className="card-kicker">Command-line example (bash / Git Bash; in PowerShell use curl.exe) · generated values.</div></div><button className="button small" onClick={() => copy(example)} data-testid="button-copy-curl">Copy cURL</button></div><pre className="code">{example}</pre></section>
        <section className="card card-pad"><div className="card-head"><div><h2 className="card-title">Data shape</h2><div className="card-kicker">Core exposure measurements from the edge sensor payload.</div></div></div><div className="feed">{[['temperatureC', 'Air temperature · °C'], ['humidityPct', 'Relative humidity · %'], ['wbgtC', 'Wet-bulb globe temperature · °C'], ['heatIndexC', 'Heat index · °C'], ['radiantTemperatureC', 'Radiant temperature · °C'], ['windSpeedMps', 'Air movement · m/s'], ['solarExposureLux', 'Solar exposure · lux']].map(([key, label]) => <div className="feed-row" key={key}><div className="feed-title">{key}</div><div className="feed-meta">{label}</div></div>)}</div></section>
      </div>
    </div>
    <div className="footer-note">ALL EXAMPLE SENSOR VALUES ARE GENERATED FOR DEMONSTRATION · REAL INGEST MUTATION</div>
  </>;
}

function NotFound() {
  return <div className="card empty"><div className="eyebrow">Not found</div><h2 style={{ color: 'hsl(var(--foreground))' }}>No route at this location.</h2><Link href="/" className="button primary" style={{ marginTop: 12 }}>Return to overview</Link></div>;
}

function Router() {
  return <Switch><Route component={AppShell} /></Switch>;
}

function Gate() {
  const { user, status } = useAuth();
  if (status === 'loading') return <div className="auth-page"><div className="skeleton" style={{ width: 'min(430px,100%)', height: 320 }} /></div>;
  return user ? <Router /> : <LoginPage />;
}

function App() {
  return <QueryClientProvider client={queryClient}><LanguageProvider><AuthProvider><WouterRouter><Gate /></WouterRouter></AuthProvider></LanguageProvider></QueryClientProvider>;
}

export default App;