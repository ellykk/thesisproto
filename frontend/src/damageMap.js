import { DAMAGE_NAMES } from './labels';
import { cssVar } from './theme';

// Map data palette. These four hues encode the RDD2022 damage classes and are used only on maps
// (dots, legend, close-up swatch). The values are the --damage-* tokens in index.css: four hues
// far apart (teal, amber, violet, red) that stay distinct on the OpenStreetMap base.
export const DAMAGE_CLASSES = ['D00', 'D10', 'D20', 'D40'].map(code => (
  { code, label: DAMAGE_NAMES[code], token: `--damage-${code.toLowerCase()}` }));
const CLASS_BY_CODE = Object.fromEntries(DAMAGE_CLASSES.map(c => [c.code, c]));
const UNKNOWN_CLASS = { code: '', label: 'Unclassified damage', token: '--damage-unknown' };

export const DOT_RADIUS = 8;
export const DOT_RADIUS_SELECTED = 11;

export const classFor = (d) => CLASS_BY_CODE[d.damage_type] || UNKNOWN_CLASS;

// GPS-measured: solid dot with a 2px white halo. Placed by hand: dashed class-colour stroke over a
// 35% fill. The selected dot is larger with an ink ring. Clicks on a dot do not reach the map.
export const dotStyle = (d, selected) => {
  const color = cssVar(classFor(d).token);
  const base = d.position_source === 'georeferenced'
    ? { color, weight: 2.5, dashArray: '3 3', fillColor: color, fillOpacity: 0.35 }
    : { color: cssVar('--map-casing'), weight: 2, fillColor: color, fillOpacity: 1 };
  return { ...base, ...(selected ? { color: cssVar('--color-ink'), weight: 3, dashArray: null } : {}), bubblingMouseEvents: false };
};
