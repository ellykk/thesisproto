import { Link } from 'react-router-dom';

/**
 * The top bar of the public pages (landing, sample surveys): logo, a few links, one button.
 * @param home   where the logo goes: '#top' on the landing page, a route elsewhere
 * @param links  [{ href, label }] in-page anchors, or [{ to, label }] routes
 * @param cta    { to, label } for the one primary button, or null for none
 */
export default function PublicHeader({ home, links, cta }) {
  const brand = (
    <>
      <img src="/oculubak-icon-mono.svg" alt="" width="44" height="28" />
      <span className="brand-name">OcuLubak</span>
    </>
  );
  return (
    <header className="landing-header">
      <div className="landing-bar">
        {home.startsWith('#')
          ? <a href={home} className="brand">{brand}</a>
          : <Link to={home} className="brand">{brand}</Link>}
        <nav className="landing-nav" aria-label="Site">
          <ul>
            {links.map(l => (
              <li key={l.label}>{l.to ? <Link to={l.to}>{l.label}</Link> : <a href={l.href}>{l.label}</a>}</li>
            ))}
          </ul>
        </nav>
        {cta && <Link to={cta.to} className="btn btn-primary landing-cta">{cta.label}</Link>}
      </div>
    </header>
  );
}
