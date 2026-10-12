// Leaflet is loaded from a CDN the first time the map page opens. That keeps it
// out of package.json, so the lockfile and the hosted build stay unchanged.

const VERSION = '1.9.4';
const BASE = `https://cdn.jsdelivr.net/npm/leaflet@${VERSION}/dist`;

export interface LatLng { lat: number; lng: number }
export interface LatLngBounds {
  getSouth(): number; getNorth(): number; getWest(): number; getEast(): number;
}
export interface LeafletLayer { addTo(map: LeafletMap): LeafletLayer; remove(): void }
export interface LeafletMap {
  setView(center: [number, number], zoom: number, options?: object): LeafletMap;
  flyTo(center: [number, number], zoom: number): LeafletMap;
  getBounds(): LatLngBounds;
  getZoom(): number;
  on(event: string, handler: (e: { latlng: LatLng }) => void): LeafletMap;
  remove(): void;
  invalidateSize(): void;
}
export interface Leaflet {
  map(el: HTMLElement, options?: object): LeafletMap;
  tileLayer(url: string, options?: object): LeafletLayer;
  imageOverlay(url: string, bounds: [[number, number], [number, number]], options?: object): LeafletLayer & { setUrl(url: string): void };
  circleMarker(center: [number, number], options?: object): LeafletLayer & { setLatLng(center: [number, number]): void };
  control: { scale(options?: object): LeafletLayer };
}

declare global { interface Window { L?: Leaflet } }

let pending: Promise<Leaflet> | null = null;

export function loadLeaflet(): Promise<Leaflet> {
  if (window.L) return Promise.resolve(window.L);
  if (pending) return pending;

  pending = new Promise<Leaflet>((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css';
      css.rel = 'stylesheet';
      css.href = `${BASE}/leaflet.css`;
      document.head.appendChild(css);
    }
    const script = document.createElement('script');
    script.src = `${BASE}/leaflet.js`;
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Map library did not start.')));
    script.onerror = () => { pending = null; reject(new Error('Could not load the map library. Check your internet connection.')); };
    document.body.appendChild(script);
  });
  return pending;
}
