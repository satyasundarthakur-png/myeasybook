import type { CoverConfig } from '../types/book';
import { escapeXml } from './shared';

const PALETTES: Record<CoverConfig['palette'], { bg: string; bg2: string; fg: string; accent: string }> = {
  leather: { bg: '#4E1B27', bg2: '#6B2737', fg: '#F2EEE1', accent: '#D6A75A' },
  brass: { bg: '#2A2825', bg2: '#1C1B19', fg: '#F2EEE1', accent: '#D6A75A' },
  moss: { bg: '#26403A', bg2: '#3F6659', fg: '#F2EEE1', accent: '#D6A75A' },
  ink: { bg: '#111110', bg2: '#1C1B19', fg: '#E8E2D0', accent: '#B8873B' },
};

function wrapLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxCharsPerLine && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

/**
 * Generates a print-ready SVG cover (1600x2400, standard 2:3 ebook ratio).
 * No external image generation dependency — pure vector layout, so it
 * always works and can be re-themed instantly.
 */
export function generateCoverSVG(config: CoverConfig): string {
  const p = PALETTES[config.palette];
  const W = 1600;
  const H = 2400;
  const titleLines = wrapLines(config.title.toUpperCase(), 16);
  const titleSize = titleLines.some((l) => l.length > 12) ? 92 : 110;
  const lineHeight = titleSize * 1.15;
  const titleBlockHeight = titleLines.length * lineHeight;
  const titleStartY = H * 0.42 - titleBlockHeight / 2;

  const frameInset = config.layout === 'classic' ? 70 : 0;
  const showFrame = config.layout === 'classic';
  const showRule = config.layout !== 'modern';

  const titleTspans = titleLines
    .map(
      (line, i) =>
        `<tspan x="${W / 2}" y="${titleStartY + i * lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.bg2}" />
      <stop offset="100%" stop-color="${p.bg}" />
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgGrad)" />
  <rect width="${W}" height="${H}" filter="url(#grain)" />
  ${showFrame ? `<rect x="${frameInset}" y="${frameInset}" width="${W - frameInset * 2}" height="${H - frameInset * 2}" fill="none" stroke="${p.accent}" stroke-width="3" />` : ''}

  <text x="${W / 2}" y="${H * 0.16}" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="34" letter-spacing="10" fill="${p.accent}">${escapeXml(config.subtitle ? 'A BOOK' : '')}</text>

  <text text-anchor="middle" font-family="'Fraunces', serif" font-weight="600" font-size="${titleSize}" fill="${p.fg}">${titleTspans}</text>

  ${showRule ? `<line x1="${W / 2 - 140}" y1="${titleStartY + titleBlockHeight + 50}" x2="${W / 2 + 140}" y2="${titleStartY + titleBlockHeight + 50}" stroke="${p.accent}" stroke-width="4" />` : ''}

  ${
    config.subtitle
      ? `<text x="${W / 2}" y="${titleStartY + titleBlockHeight + 130}" text-anchor="middle" font-family="'Fraunces', serif" font-style="italic" font-size="46" fill="${p.accent}">${escapeXml(config.subtitle)}</text>`
      : ''
  }

  <text x="${W / 2}" y="${H * 0.9}" text-anchor="middle" font-family="'Inter', sans-serif" font-weight="600" font-size="52" letter-spacing="4" fill="${p.fg}">${escapeXml(config.author.toUpperCase())}</text>
</svg>`;
}

/**
 * Generates the back cover: same palette/canvas as the front (1600x2400,
 * 2:3 ratio) so both sides of the export are visually one cohesive jacket,
 * with the blurb text as the focal content and a small colophon mark
 * standing in for a barcode block, like a real back cover's imprint area.
 */
export function generateBackCoverSVG(config: CoverConfig): string {
  const p = PALETTES[config.palette];
  const W = 1600;
  const H = 2400;
  const margin = 180;
  const blurbLines = config.backCoverText ? wrapLines(config.backCoverText, 42) : [];
  const lineHeight = 54;
  const maxLines = Math.floor((H - margin * 2 - 260) / lineHeight);
  const shownLines = blurbLines.slice(0, maxLines);
  const blurbStartY = H * 0.5 - (shownLines.length * lineHeight) / 2;

  const blurbTspans = shownLines
    .map((line, i) => `<tspan x="${margin}" y="${blurbStartY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bgGradBack" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.bg2}" />
      <stop offset="100%" stop-color="${p.bg}" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgGradBack)" />

  <text text-anchor="start" font-family="'Fraunces', serif" font-size="38" fill="${p.fg}" opacity="0.95">${blurbTspans}</text>

  <line x1="${margin}" y1="${H - 260}" x2="${W - margin}" y2="${H - 260}" stroke="${p.accent}" stroke-width="2" opacity="0.6" />

  <text x="${margin}" y="${H - 190}" font-family="'Inter', sans-serif" font-weight="600" font-size="30" letter-spacing="2" fill="${p.accent}">${escapeXml(config.author.toUpperCase())}</text>

  <text x="${margin}" y="${H - 140}" font-family="'IBM Plex Mono', monospace" font-size="22" letter-spacing="4" fill="${p.fg}" opacity="0.6">${escapeXml(config.title.toUpperCase())}</text>

  <rect x="${W - margin - 200}" y="${H - 210}" width="200" height="80" fill="${p.fg}" opacity="0.08" />
  <text x="${W - margin - 100}" y="${H - 165}" text-anchor="middle" font-family="'IBM Plex Mono', monospace" font-size="16" letter-spacing="2" fill="${p.fg}" opacity="0.5">PAGEBOUND</text>
</svg>`;
}

/**
 * Rasterizes the generated cover as JPEG rather than PNG. The grain-texture
 * filter in the SVG produces high-frequency per-pixel noise once rasterized
 * — noise that PNG's lossless compression handles terribly (measured: a
 * 1600x2400 cover with the grain filter came out to 1.4MB as PNG, vs 30KB
 * as JPEG at quality 0.92 — smaller than the *same cover with no texture
 * at all* as PNG). This is what caused DOCX exports to balloon to several
 * megabytes for a single cover image.
 */
export function svgToJpegDataUrl(svg: string, width = 1600, height = 2400, quality = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      // JPEG has no alpha channel — paint a background first so transparent
      // SVG regions don't render as black.
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/** Mime type embedded in a data URL, e.g. "image/png" from "data:image/png;base64,...". */
export function mimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : 'image/png';
}

/**
 * Resolves the actual cover image to use in an export: the author's
 * uploaded image if they provided one, otherwise the procedurally
 * generated SVG cover rendered to JPEG. Every export builder (EPUB, DOCX,
 * print) calls this instead of deciding for itself, so "use the custom
 * image if present" only has to be correct in one place.
 */
export async function resolveCoverImageDataUrl(cover: CoverConfig): Promise<string> {
  if (cover.customImage) return cover.customImage;
  const svg = generateCoverSVG(cover);
  return svgToJpegDataUrl(svg);
}

/** Same resolution logic as the front cover: author's uploaded image takes
 * priority, otherwise the procedurally generated back cover. */
export async function resolveBackCoverImageDataUrl(cover: CoverConfig): Promise<string> {
  if (cover.backCoverImage) return cover.backCoverImage;
  const svg = generateBackCoverSVG(cover);
  return svgToJpegDataUrl(svg);
}
