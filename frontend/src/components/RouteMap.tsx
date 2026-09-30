import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapStop {
  sequence: number;
  latitude: number;
  longitude: number;
  label: string;
  address?: string;
}

interface RouteMapProps {
  warehouse?: { latitude: number; longitude: number; name?: string } | null;
  stops: MapStop[];
  height?: number;
}

/** Fix default Leaflet marker icons under Vite bundling. */
const warehouseIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:6px;background:#0f766e;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;">W</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const stopIcon = (seq: number) =>
  L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:#1d4ed8;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">${seq}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export default function RouteMap({ warehouse, stops, height = 280 }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const points: L.LatLngExpression[] = [];
    if (warehouse) points.push([warehouse.latitude, warehouse.longitude]);
    for (const s of stops) points.push([s.latitude, s.longitude]);

    if (points.length === 0) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const latLngs: L.LatLngExpression[] = [];

    if (warehouse) {
      const wh: L.LatLngExpression = [warehouse.latitude, warehouse.longitude];
      latLngs.push(wh);
      L.marker(wh, { icon: warehouseIcon })
        .addTo(map)
        .bindPopup(`<strong>${warehouse.name ?? 'Warehouse'}</strong><br/>Depot`);
    }

    for (const s of stops) {
      const pos: L.LatLngExpression = [s.latitude, s.longitude];
      latLngs.push(pos);
      L.marker(pos, { icon: stopIcon(s.sequence) })
        .addTo(map)
        .bindPopup(
          `<strong>#${s.sequence} ${s.label}</strong>${s.address ? `<br/>${s.address}` : ''}`
        );
    }

    if (latLngs.length >= 2) {
      L.polyline(latLngs, {
        color: '#0f766e',
        weight: 3,
        opacity: 0.85,
        dashArray: '6 8',
      }).addTo(map);
    }

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [36, 36] });
    }

    // Leaflet needs a tick after container layout
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [warehouse, stops]);

  if (!warehouse && stops.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f1f5f9',
        borderRadius: 10,
        color: '#64748b',
        fontSize: '0.85rem',
      }}>
        No coordinates available for this route
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: '100%',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        zIndex: 0,
      }}
    />
  );
}
