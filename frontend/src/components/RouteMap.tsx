import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  paid: boolean;
  amount?: string;
}

// Colored numbered pin (divIcon → no external marker image assets needed).
function pinIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};
      transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;">${label}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function meIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#06b6d4;border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(6,182,212,.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

/**
 * Real OpenStreetMap (Leaflet) map — free, no API key. Plots customer stops at
 * their real coordinates plus the agent's live position, and fits the view.
 */
export function RouteMap({ stops, me }: { stops: MapStop[]; me: { lat: number; lng: number } | null }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Init once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Container often mounts at 0 height inside cards — nudge Leaflet to remeasure.
    setTimeout(() => map.invalidateSize(), 60);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  // Re-plot markers whenever stops or my position change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const pts: L.LatLngExpression[] = [];

    // De-overlap: customers that share (nearly) identical coordinates would stack
    // on the exact same spot — fan them out in a small ring so each pin is visible.
    const groupTotal = new Map<string, number>();
    const groupSeen = new Map<string, number>();
    const keyOf = (s: MapStop) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
    stops.forEach((s) => groupTotal.set(keyOf(s), (groupTotal.get(keyOf(s)) ?? 0) + 1));

    stops.forEach((s, i) => {
      const key = keyOf(s);
      const total = groupTotal.get(key) ?? 1;
      let lat = s.lat;
      let lng = s.lng;
      if (total > 1) {
        const idx = groupSeen.get(key) ?? 0;
        groupSeen.set(key, idx + 1);
        const angle = (2 * Math.PI * idx) / total;
        const r = 0.0007; // ~75 m ring so the pins clearly separate at street zoom
        lat = s.lat + r * Math.cos(angle);
        lng = s.lng + r * Math.sin(angle);
      }
      const color = s.paid ? '#10b981' : '#f43f5e';
      L.marker([lat, lng], { icon: pinIcon(String(i + 1), color) })
        .addTo(layer)
        // Always-visible name label so you can see which customer is where.
        .bindTooltip(s.name, {
          permanent: true,
          direction: 'top',
          offset: [0, -30],
          className: 'route-pin-label',
        })
        .bindPopup(
          `<b>${s.name}</b>${s.amount ? `<br/>${s.amount}` : ''}<br/>` +
          // Navigation always uses the customer's real coordinates, not the fan-out offset.
          `<a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}" target="_blank" rel="noopener">Navigate →</a>`,
        );
      pts.push([lat, lng]);
    });

    if (me) {
      L.marker([me.lat, me.lng], { icon: meIcon() }).addTo(layer).bindPopup('You are here');
      pts.push([me.lat, me.lng]);
    }

    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
    setTimeout(() => map.invalidateSize(), 60);
  }, [stops, me]);

  return <div ref={elRef} className="h-72 sm:h-80 w-full" style={{ zIndex: 0 }} />;
}
