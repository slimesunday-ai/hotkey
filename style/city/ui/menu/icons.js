// HUMAN LAYER · SECTION 4 · the menu's icons: 16 × 16, currentColor, one stroke weight (1.5) so they sit with the kit's own (kit.js icon()).
const S = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const P = {
  people: `<circle cx="6" cy="5.4" r="2.4" ${S}/><path d="M1.8 13.6c.4-2.5 2.1-3.9 4.2-3.9s3.8 1.4 4.2 3.9" ${S}/><circle cx="11.4" cy="6.1" r="1.9" ${S}/><path d="M11 9.8c1.7.1 2.9 1.3 3.2 3.3" ${S}/>`,
  map: `<path d="M1.8 3.6l4-1.6 4.4 1.8 4-1.6v10.2l-4 1.6-4.4-1.8-4 1.6z" ${S}/><path d="M5.8 2v10.2M10.2 3.8V14" ${S}/>`,
  city: `<path d="M1.8 14.2h12.4M3 14.2V6.4l3.6-2v9.8M6.6 6.2l3.4-3.2 3 2.8v8.4" ${S}/><path d="M8.8 7.4h1.4M8.8 9.6h1.4M4.4 8h.8M4.4 10.2h.8" ${S}/>`,
  tv: `<rect x="1.8" y="4.2" width="12.4" height="8.6" rx="1.4" ${S}/><path d="M5.6 1.8L8 4.2l2.4-2.4M5 14.6h6" ${S}/>`,
  tape: `<rect x="1.6" y="3.6" width="12.8" height="9" rx="1.4" ${S}/><circle cx="5.4" cy="7.8" r="1.4" ${S}/><circle cx="10.6" cy="7.8" r="1.4" ${S}/><path d="M4.2 12.6l1-1.8h5.6l1 1.8" ${S}/>`,
  live: `<circle cx="8" cy="8" r="2.6" fill="currentColor"/><path d="M3.8 3.8a6 6 0 0 0 0 8.4M12.2 3.8a6 6 0 0 1 0 8.4" ${S}/>`,
  bolt: `<path d="M9.2 1.6L3.4 9h4.2l-.8 5.4L12.6 7H8.4z" ${S}/>`,
  gear: `<circle cx="8" cy="8" r="2.1" ${S}/><path d="M8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M3.5 12.5l1.3-1.3M11.2 4.8l1.3-1.3" ${S}/>`,
  search: `<circle cx="7" cy="7" r="4.4" ${S}/><path d="M10.3 10.3l3.9 3.9" ${S}/>`,
  close: `<path d="M4 4l8 8M12 4l-8 8" ${S}/>`,
  star: `<path d="M8 1.9l1.8 3.8 4.1.5-3 2.9.8 4.1L8 11.2l-3.7 2 .8-4.1-3-2.9 4.1-.5z" fill="currentColor"/>`,
  up: `<path d="M4 10l4-4 4 4" ${S}/>`, down: `<path d="M4 6l4 4 4-4" ${S}/>`,
  left: `<path d="M10 4L6 8l4 4" ${S}/>`, right: `<path d="M6 4l4 4-4 4" ${S}/>`,
  pin: `<path d="M8 1.8a4.3 4.3 0 0 1 4.3 4.3c0 3-4.3 8.1-4.3 8.1S3.7 9.1 3.7 6.1A4.3 4.3 0 0 1 8 1.8z" ${S}/><circle cx="8" cy="6.1" r="1.5" fill="currentColor"/>`,
  follow: `<path d="M8 1.8l5.2 12.4L8 11.3l-5.2 2.9z" fill="currentColor"/>`,
};
export function svg(k, cls = '') { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls); s.innerHTML = P[k] || ''; return s; }
