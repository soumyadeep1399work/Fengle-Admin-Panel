import { useEffect, useState } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export const NEWTOWN = { lat: 22.58, lng: 88.47 };

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(7)), Number(e.latlng.lng.toFixed(7))) });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.panTo([lat, lng]); }, [lat, lng, map]);
  return null;
}

/** Pulls "lat,lng" out of pasted text or a Google Maps link (…/@22.58,88.47,… or ?q=22.58,88.47). */
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const m = text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export default function MapPicker({ lat, lng, radiusKm, onChange, readOnly }: {
  lat: number | null; lng: number | null; radiusKm?: number;
  onChange?: (lat: number, lng: number) => void; readOnly?: boolean;
}) {
  const [paste, setPaste] = useState('');
  const has = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const center = has ? { lat: lat!, lng: lng! } : NEWTOWN;

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="map-box">
        <MapContainer center={[center.lat, center.lng]} zoom={has ? 14 : 13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {has && (
            <>
              {radiusKm ? <Circle center={[lat!, lng!]} radius={radiusKm * 1000} pathOptions={{ color: '#6423C9', weight: 1, fillOpacity: 0.08 }} /> : null}
              <CircleMarker center={[lat!, lng!]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#4B18A6', fillOpacity: 1 }} />
              <Recenter lat={lat!} lng={lng!} />
            </>
          )}
          {!readOnly && onChange && <ClickToPlace onPick={onChange} />}
        </MapContainer>
      </div>
      {!readOnly && onChange && (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" placeholder="Paste a Google Maps link or “22.5801, 88.4712”" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button type="button" className="btn" disabled={!parseCoords(paste)}
            onClick={() => { const c = parseCoords(paste); if (c) { onChange(c.lat, c.lng); setPaste(''); } }}>Use</button>
        </div>
      )}
      {!readOnly && <small className="muted">Click the map to drop the kitchen pin{radiusKm ? `; the shaded circle is its ${radiusKm} km delivery radius` : ''}.</small>}
    </div>
  );
}
