/**
 * Bill Art
 *
 * Background of the piano keys: a photo of the real note (public/bills,
 * rotated upright, see CREDITS.md there) over a drawn SVG fallback used when
 * a denomination has no photo.
 *
 * @package    albe-currency
 * @author     kekefreedog <kevin.zarshenas@gmail.com>
 * @copyright  2026 Kévin Zarshenas
 */

// Dependencies
import {formatBillValue} from "../utils/Format";
import type {Bill} from "../Types";

/** Dominant tint per note: [paper, ink] */
const TINTS:Record<string, [string, string]> = {
    "usd-1": ["#d3dcc0", "#2f4a2a"],
    "usd-2": ["#cbd8b6", "#2c4a2e"],
    "usd-5": ["#ddd3e4", "#4a3a5c"],
    "usd-10": ["#f0dcbc", "#7a4a1c"],
    "usd-20": ["#dde5c8", "#3b5530"],
    "usd-50": ["#e6d4e1", "#5a3050"],
    "usd-100": ["#cfe3e0", "#1f4f55"],
    "lbp-1000": ["#bcd9e6", "#1d4b66"],
    "lbp-5000": ["#efc0c0", "#7a1f24"],
    "lbp-10000": ["#f4d796", "#7a4d0a"],
    "lbp-20000": ["#e3c4a0", "#6a3d1a"],
    "lbp-50000": ["#cbbde6", "#3c2a6e"],
    "lbp-100000": ["#bfe0c0", "#1f5a2a"],
};

const FALLBACK:[string, string] = ["#e0e0d8", "#444444"];

const WIDTH = 60;
const HEIGHT = 140;

const cache = new Map<string, string>();

/** Notes having a photo in public/bills */
const PHOTOS = new Set([
    "usd-1", "usd-2", "usd-5", "usd-10", "usd-20", "usd-50", "usd-100",
    "lbp-1000", "lbp-5000", "lbp-10000", "lbp-20000", "lbp-50000", "lbp-100000",
]);

/**
 * Bill Art Url
 *
 * @param bill Banknote
 * @return CSS background-image value: photo over the SVG, cached per note
 */
export const billArtUrl = (bill:Bill):string => {

    const key = `${bill.currency}-${bill.value}`;

    // Cached
    if(!cache.has(key)){

        const svg = `url('data:image/svg+xml,${encodeURIComponent(billSvg(bill))}')`;

        cache.set(key, PHOTOS.has(key) ? `url('${import.meta.env.BASE_URL}bills/${key}.jpg'), ${svg}` : svg);

    }

    return cache.get(key)!;

};

/**
 * Bill Svg
 *
 * @param bill Banknote
 * @return SVG markup
 */
export const billSvg = (bill:Bill):string => {

    // Prepare colours and label
    const [paper, ink] = TINTS[`${bill.currency}-${bill.value}`] ?? FALLBACK;
    const label = formatBillValue(bill);
    const isUsd = bill.currency === "usd";

    // Guilloche: interleaved sine waves along the note
    const waves = Array.from({length: 7}, (_, i) => wave(8 + i * 7, 3 + (i % 3), 18 + i * 2)).join("");

    // Return SVG
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid slice">
        <defs>
            <radialGradient id="g" cx="50%" cy="45%" r="60%">
                <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/>
                <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="${paper}"/>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
        <g fill="none" stroke="${ink}" stroke-opacity=".22" stroke-width=".6">${waves}</g>
        <rect x="3" y="3" width="${WIDTH - 6}" height="${HEIGHT - 6}" rx="2" fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width="1.2"/>
        <rect x="5.5" y="5.5" width="${WIDTH - 11}" height="${HEIGHT - 11}" rx="1.5" fill="none" stroke="${ink}" stroke-opacity=".3" stroke-width=".5" stroke-dasharray="1.5 1"/>
        ${isUsd ? portrait(ink) : cedar(ink)}
        <text x="9" y="17" font-family="Georgia, serif" font-size="9" font-weight="700" fill="${ink}" fill-opacity=".8">${label}</text>
        <text x="${WIDTH - 9}" y="17" font-family="Georgia, serif" font-size="9" font-weight="700" fill="${ink}" fill-opacity=".8" text-anchor="end">${isUsd ? "$" : "LL"}</text>
    </svg>`;

};

/**
 * Wave
 *
 * @param x Horizontal centre of the wave
 * @param amplitude Horizontal swing
 * @param period Vertical period
 */
const wave = (x:number, amplitude:number, period:number):string => {

    let d = `M${x} 0`;

    for(let y = 0; y <= HEIGHT; y += period / 2)
        d += ` Q${x + ((y / (period / 2)) % 2 ? -amplitude : amplitude) * 2} ${y + period / 4} ${x} ${y + period / 2}`;

    return `<path d="${d}"/>`;

};

/**
 * Portrait
 *
 * Oval medallion with a generic bust, the USD signature motif.
 *
 * @param ink Ink colour
 */
const portrait = (ink:string):string => `
    <ellipse cx="30" cy="62" rx="17" ry="22" fill="${ink}" fill-opacity=".12" stroke="${ink}" stroke-opacity=".6" stroke-width="1"/>
    <ellipse cx="30" cy="62" rx="14" ry="19" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width=".5"/>
    <circle cx="30" cy="56" r="6.5" fill="${ink}" fill-opacity=".45"/>
    <path d="M18 78 Q19 66 30 65 Q41 66 42 78 Z" fill="${ink}" fill-opacity=".45"/>
`;

/**
 * Cedar
 *
 * Stylised Lebanese cedar in a roundel.
 *
 * @param ink Ink colour
 */
const cedar = (ink:string):string => `
    <circle cx="30" cy="62" r="19" fill="${ink}" fill-opacity=".1" stroke="${ink}" stroke-opacity=".55" stroke-width="1"/>
    <g fill="${ink}" fill-opacity=".55">
        <path d="M30 46 L37 54 L33 54 L41 62 L35 62 L44 71 L16 71 L25 62 L19 62 L27 54 L23 54 Z"/>
        <rect x="28.5" y="71" width="3" height="7"/>
    </g>
`;
