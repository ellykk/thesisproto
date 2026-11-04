import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapResizeFix, { OSM_ATTRIBUTION, OSM_TILES } from '../components/MapResizeFix';
import { FitBounds, Legend, Route } from './DamageMapPage';
import { DOT_RADIUS, DOT_RADIUS_SELECTED, classFor, dotStyle } from '../damageMap';
import { SAMPLES_ONLY } from '../api';
import { damageName, formatDate, formatDuration } from '../labels';
import { cssVar } from '../theme';
import Icon from '../icons';
import PublicHeader from '../components/PublicHeader';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import EmptyState from '../components/EmptyState';
import SkeletonRows from '../components/SkeletonRows';
import Footer from '../components/Footer';

// Demo surveys shipped with the website (frontend/public/samples/), written by
// backend/export_samples.py. Edit samples.json to retitle, reorder or drop one.
const INDEX_URL = '/samples/samples.json';
const AI_THRESHOLD = 0.6;   // backend services/damage_verifier.py VERIFY_THRESHOLD

const clipTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

const getJson = (url) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
});

/** GPX track points as { t: seconds from the first fix, lat, lon }, as the backend reads them. */
function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const pts = [...doc.getElementsByTagName('trkpt')]
    .map(p => ({ lat: +p.getAttribute('lat'), lon: +p.getAttribute('lon'),
                 time: Date.parse(p.getElementsByTagName('time')[0]?.textContent) }))
    .filter(p => !Number.isNaN(p.time))
    .sort((a, b) => a.time - b.time);
  return pts.map(p => ({ t: (p.time - pts[0].time) / 1000, lat: p.lat, lon: p.lon }));
}

/** Position at GPS time t, interpolated between the two fixes around it. */
function positionAt(track, t) {
  const i = track.findIndex(p => p.t >= t);
  if (i <= 0) return track[Math.max(i, 0)];
  if (i === -1) return track[track.length - 1];
  const a = track[i - 1], b = track[i], r = (t - a.t) / (b.t - a.t || 1);
  return { lat: a.lat + r * (b.lat - a.lat), lon: a.lon + r * (b.lon - a.lon) };
}

export default function SamplesPage({ user }) {
  const { id } = useParams();
  const [samples, setSamples] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson(INDEX_URL).then(setSamples).catch(() => setError('The sample surveys could not be loaded. Reload the page to try again.'));
  }, []);

  const sample = id && samples?.find(s => s.id === id);
  const cta = SAMPLES_ONLY ? null : user ? { to: '/', label: 'Open dashboard' } : { to: '/login', label: 'Log in' };

  return (
    <div className="landing">
      <a className="skip-link" href="#main">Skip to main content</a>
      <PublicHeader home="/" cta={cta} links={[{ to: '/', label: 'About OcuLubak' }, { to: '/samples', label: 'Sample surveys' }]} />
      <main id="main" tabIndex={-1} className="page samples-page">
        {error ? <Notice kind="error" title="Something went wrong">{error}</Notice>
          : !samples ? <SkeletonRows rows={4} />
          : !id ? <SamplePicker samples={samples} />
          : sample ? <SampleViewer key={sample.id} sample={sample} />
          : <EmptyState title="This sample survey does not exist"
              action={<Link to="/samples" className="btn btn-secondary">See all sample surveys</Link>} />}
      </main>
      <Footer />
    </div>
  );
}

// Which model produced the sample; samples.json says whether it is the team's own.
function ModelNotice({ model, standIn }) {
  if (!standIn) return model ? <p className="muted">Detection model: <span className="code">{model}</span></p> : null;
  return (
    <Notice title="These results come from a stand-in model">
      OcuLubak’s own detection model is still being trained, so these drives were checked with a publicly
      available road damage model{model ? ` (${model})` : ''}. Expect some marks that are not road damage:
      the ones a second AI check doubts are labelled “Likely not road damage”.
    </Notice>
  );
}

function SamplePicker({ samples }) {
  return (
    <>
      <PageHeader title="Sample surveys"
        meta="Real drives in Cavite, recorded with the OcuLubak phone app. Pick one to watch the video with each damage marked and follow the drive on the map." />
      <div className="stack">
        <ModelNotice model={samples[0]?.model} standIn={samples.some(s => s.stand_in_model)} />
        <ul className="card-grid sample-grid">
          {samples.map(s => (
            <li key={s.id} className="card sample-card">
              <Link to={`/samples/${s.id}`} className="sample-link">
                <img src={s.poster} alt="" className="landing-img" loading="lazy" />
                <h2 className="panel-title">{s.title}</h2>
              </Link>
              <p className="muted">{[s.location !== s.title && s.location, formatDate(s.date)].filter(Boolean).join(' · ')}</p>
              <p className="num">{s.damage_count} damages in {formatDuration(s.duration_s)} of video</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function SampleViewer({ sample }) {
  const videoRef = useRef();
  const [data, setData] = useState(null);   // { dets, track }
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);          // video time, seconds
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([getJson(sample.detections), fetch(sample.gpx).then(r => r.text())])
      .then(([rows, gpx]) => setData({
        dets: rows.map((r, i) => ({ ...r, id: i, damage_type: r.code, position_source: 'gps_file' })),
        track: parseGpx(gpx),
      }))
      .catch(() => setError('The damage list or the GPS track for this survey could not be loaded. Reload the page to try again.'));
  }, [sample]);

  // The stretch of the GPS track this clip covers, as [lat, lon] for the map.
  const route = useMemo(() => data?.track
    .filter(p => p.t >= sample.gps_offset_s - 1 && p.t <= sample.gps_offset_s + sample.duration_s + 1)
    .map(p => [p.lat, p.lon]) ?? [], [data, sample]);
  const here = data && positionAt(data.track, now + sample.gps_offset_s);

  const counts = useMemo(() => (data?.dets ?? []).reduce((c, d) => ({ ...c, [d.code]: (c[d.code] || 0) + 1 }), {}), [data]);
  const shown = (data?.dets ?? []).filter(d => !filter || d.code === filter);
  const codes = Object.keys(counts).sort();

  const jumpTo = (d) => {
    setActiveId(d.id);
    const v = videoRef.current;
    if (v) { v.pause(); v.currentTime = d.t; v.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    // Bring the row into view inside the list only; scrolling the page would hide the video on phones.
    const row = document.getElementById(`damage-${d.id}`);
    const list = row?.closest('.damage-list');
    if (list) list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientHeight / 2;
  };

  return (
    <>
      <PageHeader title={sample.title} back={{ to: '/samples', label: 'All sample surveys' }}
        meta={<span className="num">{[sample.location !== sample.title && sample.location, formatDate(sample.date),
          `${formatDuration(sample.duration_s)} of a ${formatDuration(sample.full_duration_s)} drive`].filter(Boolean).join(' · ')}</span>} />
      <div className="stack">
        <ModelNotice model={sample.model} standIn={sample.stand_in_model} />
        {error && <Notice kind="error" title="Something went wrong">{error}</Notice>}
        <div className="viewer-grid">
          <div className="stack">
            <div className="video-frame">
              <video ref={videoRef} src={sample.video} poster={sample.poster} controls playsInline preload="metadata"
                onTimeUpdate={e => setNow(e.currentTarget.currentTime)} />
            </div>
            <div className="map-frame sample-map">
              {data && route.length > 0 && (
                <MapContainer center={route[0]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} />
                  <MapResizeFix />
                  <FitBounds points={route} fitKey={sample.id} />
                  <Route track={{ points: route }} label="" />
                  {[...data.dets.filter(d => d.id !== activeId), ...data.dets.filter(d => d.id === activeId)].map(d => (
                    <CircleMarker key={d.id} center={[d.lat, d.lon]} pathOptions={dotStyle(d, d.id === activeId)}
                      radius={d.id === activeId ? DOT_RADIUS_SELECTED : DOT_RADIUS}
                      eventHandlers={{ click: () => jumpTo(d) }}>
                      <Tooltip>{classFor(d).label} · {clipTime(d.t)}</Tooltip>
                    </CircleMarker>
                  ))}
                  {here && (
                    <CircleMarker center={[here.lat, here.lon]} radius={9} interactive={false}
                      pathOptions={{ color: cssVar('--map-casing'), weight: 3, fillColor: cssVar('--color-primary'), fillOpacity: 1 }} />
                  )}
                </MapContainer>
              )}
            </div>
            <div className="panel">
              <Legend counts={counts} hasRoute />
              <p className="legend-route"><span className="legend-vehicle" /> Where the video is now</p>
              <p className="muted legend-note">Click a dot or a row to jump to that moment in the video.</p>
            </div>
          </div>

          <section className="panel damage-panel" aria-labelledby="damage-title">
            <h2 id="damage-title" className="panel-title">Damage found (<span className="num">{data?.dets.length ?? 0}</span>)</h2>
            {!data && !error && <SkeletonRows rows={6} />}
            {codes.length > 1 && (
              <div className="chips" role="group" aria-label="Show damage of one kind">
                <button type="button" className="chip" aria-pressed={!filter} onClick={() => setFilter('')}>
                  All <span className="num">{data.dets.length}</span>
                </button>
                {codes.map(c => (
                  <button type="button" key={c} className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                    {damageName(c)} <span className="code">{c}</span> <span className="num">{counts[c]}</span>
                  </button>
                ))}
              </div>
            )}
            {data && (
              <ul className="damage-list">
                {shown.map(d => (
                  <li key={d.id} id={`damage-${d.id}`}>
                    <button type="button" className="damage-row" aria-current={activeId === d.id ? 'true' : undefined}
                      onClick={() => jumpTo(d)}>
                      <span className="num damage-time">{clipTime(d.t)}</span>
                      <span className="damage-name">
                        {damageName(d.code)} <span className="code">{d.code}</span>
                        {d.ai != null && d.ai < AI_THRESHOLD && (
                          <span className="damage-flag"><Icon name="alert-triangle" size={16} />AI check: likely not road damage</span>
                        )}
                      </span>
                      <span className="num damage-conf">{Math.round(d.conf * 100)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
