import { useEffect, useState, type KeyboardEvent } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { googleMapsLink, searchPlaces, SEARCH_ATTRIBUTION, type Place } from '../lib/geocode';

export const NEWTOWN = { lat: 22.58, lng: 88.47 };

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(7)), Number(e.latlng.lng.toFixed(7))) });
  return null;
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (zoom) map.setView([lat, lng], Math.max(map.getZoom(), zoom));
    else map.panTo([lat, lng]);
  }, [lat, lng, zoom, map]);
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

/** Search box above the map: type an address or landmark, press Enter, pick a result. */
function AddressSearch({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function run() {
    // A pasted Google Maps link or "lat, lng" is used directly.
    const coords = parseCoords(q);
    if (coords) { onPick({ label: '', ...coords }); setResults(null); setQ(''); return; }
    if (q.trim().length < 3) return;
    setBusy(true);
    setErr('');
    try {
      setResults(await searchPlaces(q));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Search failed');
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); run(); }
    if (e.key === 'Escape') setResults(null);
  };

  return (
    <div className="addr-search">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input className="input" placeholder="Search address or landmark, or paste a Google Maps link" value={q}
          onChange={(e) => { setQ(e.target.value); setErr(''); }} onKeyDown={onKey} aria-label="Search address" />
        <button type="button" className="btn" disabled={busy || q.trim().length < 3} onClick={run}>{busy ? 'Searching…' : 'Search'}</button>
      </div>
      {err && <small style={{ color: 'var(--red)' }}>{err}</small>}
      {results && (
        <div className="addr-results" role="listbox">
          {results.length === 0 ? (
            <div className="muted small" style={{ padding: '8px 10px' }}>No matches. Try a nearby landmark or area name, or drop the pin on the map.</div>
          ) : results.map((p) => (
            <button type="button" role="option" key={`${p.lat},${p.lng},${p.label}`} className="addr-result"
              onClick={() => { onPick(p); setResults(null); }}>{p.label}</button>
          ))}
          <div className="muted" style={{ fontSize: 11, padding: '4px 10px' }}>{SEARCH_ATTRIBUTION}</div>
        </div>
      )}
    </div>
  );
}

export default function MapPicker({ lat, lng, radiusKm, onChange, onAddressFound, readOnly }: {
  lat: number | null; lng: number | null; radiusKm?: number;
  onChange?: (lat: number, lng: number) => void;
  /** Called with the full address text when the pin is set from a search result. */
  onAddressFound?: (address: string) => void;
  readOnly?: boolean;
}) {
  const [jumpZoom, setJumpZoom] = useState<number | undefined>(undefined);
  const has = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const center = has ? { lat: lat!, lng: lng! } : NEWTOWN;
  const editable = !readOnly && !!onChange;

  return (
    <div className="stack" style={{ gap: 8 }}>
      {editable && (
        <AddressSearch onPick={(p) => {
          setJumpZoom(17);
          onChange!(p.lat, p.lng);
          if (p.label) onAddressFound?.(p.label);
        }} />
      )}
      <div className="map-box">
        <MapContainer center={[center.lat, center.lng]} zoom={has ? 15 : 13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {has && (
            <>
              {radiusKm ? <Circle center={[lat!, lng!]} radius={radiusKm * 1000} pathOptions={{ color: '#6423C9', weight: 1, fillOpacity: 0.08 }} /> : null}
              <CircleMarker center={[lat!, lng!]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#4B18A6', fillOpacity: 1 }} />
              <Recenter lat={lat!} lng={lng!} zoom={jumpZoom} />
            </>
          )}
          {editable && <ClickToPlace onPick={(a, b) => { setJumpZoom(undefined); onChange!(a, b); }} />}
        </MapContainer>
      </div>
      <div className="row between small">
        <span className="muted">
          {editable
            ? <>Search, or click the map to drop the kitchen pin exactly on the building{radiusKm ? `. The shaded circle is the ${radiusKm} km delivery radius` : ''}.</>
            : has ? <span className="mono">{lat!.toFixed(6)}, {lng!.toFixed(6)}</span> : 'No location set'}
        </span>
        {has && <a href={googleMapsLink(lat!, lng!)} target="_blank" rel="noreferrer">Check in Google Maps ↗</a>}
      </div>
    </div>
  );
}
