/**
 * SVG / PNG export utilities for publication-ready figure downloads.
 *
 * Handles:
 *  - Cloning SVG elements with inlined computed styles
 *  - Resolving CSS custom properties (hsl(var(--…))) to concrete values
 *  - Adding proper XML namespace declarations
 *  - High-resolution PNG export via off-screen canvas (2× DPI)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve all `hsl(var(--…))` and `var(--…)` references to concrete values. */
function resolveCSS(value: string, computed: CSSStyleDeclaration): string {
  // Match hsl(var(--xyz)) or hsl(var(--xyz), fallback)
  return value.replace(/hsl\(var\(--([^)]+)\)\)/g, (_match, name) => {
    const raw = computed.getPropertyValue(`--${name}`).trim();
    return raw ? `hsl(${raw})` : _match;
  }).replace(/var\(--([^),]+)(?:,\s*([^)]+))?\)/g, (_match, name, fallback) => {
    const raw = computed.getPropertyValue(`--${name}`).trim();
    return raw || fallback || _match;
  });
}

/** Inline critical styles from computed style onto each SVG element. */
function inlineStyles(source: SVGElement, target: SVGElement): void {
  const computed = window.getComputedStyle(source);
  const el = target as SVGElement & ElementCSSInlineStyle;

  // Properties that matter for SVG rendering
  const props = [
    'fill', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'text-anchor', 'dominant-baseline', 'opacity',
  ];

  for (const prop of props) {
    const val = computed.getPropertyValue(prop);
    if (val && val !== 'none' && val !== 'normal' && val !== '') {
      el.style.setProperty(prop, resolveCSS(val, computed));
    }
  }

  // Recurse into children
  const srcChildren = source.children;
  const tgtChildren = target.children;
  for (let i = 0; i < srcChildren.length; i++) {
    if (srcChildren[i] instanceof SVGElement && tgtChildren[i] instanceof SVGElement) {
      inlineStyles(srcChildren[i] as SVGElement, tgtChildren[i] as SVGElement);
    }
  }
}

/** Wrap SVG element HTML in a proper standalone SVG document. */
function wrapSVGDocument(svgEl: SVGSVGElement): string {
  const serializer = new XMLSerializer();
  let svgStr = serializer.serializeToString(svgEl);

  // Ensure xmlns is present
  if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${svgStr}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Trigger a browser file download. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export an SVG element as a standalone .svg file.
 * Inlines all computed styles so the file renders correctly outside the app.
 */
export function exportSVG(svgElement: SVGSVGElement, filename: string): void {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Set explicit dimensions
  const bbox = svgElement.getBoundingClientRect();
  clone.setAttribute('width', String(Math.ceil(bbox.width)));
  clone.setAttribute('height', String(Math.ceil(bbox.height)));

  // Add white background for publication use
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', 'white');
  clone.insertBefore(bg, clone.firstChild);

  // Inline computed styles
  inlineStyles(svgElement, clone);

  const svgDoc = wrapSVGDocument(clone);
  const blob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename.endsWith('.svg') ? filename : `${filename}.svg`);
}

/**
 * Export an SVG element as a high-resolution PNG.
 * Uses 2× DPI for publication quality (configurable via scale param).
 */
export function exportPNG(
  svgElement: SVGSVGElement,
  filename: string,
  scale = 2,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    const bbox = svgElement.getBoundingClientRect();
    const w = Math.ceil(bbox.width);
    const h = Math.ceil(bbox.height);

    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));

    // White background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', 'white');
    clone.insertBefore(bg, clone.firstChild);

    inlineStyles(svgElement, clone);

    const svgDoc = wrapSVGDocument(clone);
    const svgBlob = new Blob([svgDoc], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context not available'));
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, filename.endsWith('.png') ? filename : `${filename}.png`);
          resolve();
        } else {
          reject(new Error('PNG blob creation failed'));
        }
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG to image conversion failed'));
    };
    img.src = url;
  });
}
