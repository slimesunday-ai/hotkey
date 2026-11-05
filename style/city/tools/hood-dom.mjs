// Minimal text DOM for hoodcheck. No layout, picking, WebGL or browser claims.
export class Node {
  constructor(tag = 'div', text = null) {
    this.nodeType = text === null ? 1 : 3; this.nodeName = tag.toUpperCase(); this.tagName = this.nodeName;
    this.children = []; this.attrs = {}; this.dataset = {}; this.style = { setProperty(k, v) { this[k] = v; } };
    this.className = ''; this.parentNode = null; this.hidden = false; this.events = {}; this._text = text;
    this.classList = {
      contains: c => this.className.split(' ').includes(c),
      add: (...cs) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...cs])].join(' '); },
      remove: (...cs) => { this.className = this.className.split(' ').filter(c => !cs.includes(c)).join(' '); },
      toggle: (c, on = !this.classList.contains(c)) => { this.classList[on ? 'add' : 'remove'](c); return on; },
    };
  }
  get childNodes() { return this.children; }
  get firstChild() { return this.children[0]; }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === 'class') this.className = String(v);
    if (k === 'id') this.id = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
  }
  getAttribute(k) {
    if (k === 'class') return this.className;
    if (k.startsWith('data-')) return this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null;
    return this.attrs[k] ?? null;
  }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(k, fn) { (this.events[k] ??= []).push(fn); }
  append(...kids) { for (let n of kids) { if (typeof n !== 'object') n = new Node('#text', String(n)); n.remove?.(); n.parentNode = this; this.children.push(n); } }
  replaceChildren(...kids) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...kids); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
  get textContent() { return this._text ?? this.children.map(n => n.textContent).join(''); }
  set textContent(s) { this._text = this.nodeType === 3 ? String(s) : null; this.replaceChildren(...(this.nodeType === 3 ? [] : [new Node('#text', String(s))])); }
  matches(selector) {
    if (selector.includes(' > ')) { const [parent, child] = selector.split(' > '); return this.matches(child) && !!this.parentNode?.matches(parent); }
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    const a = /^\[([^=\]]+)(?:="?([^"\]]+)"?)?\]$/.exec(selector);
    if (a) return this.getAttribute(a[1]) !== null && (a[2] === undefined || this.getAttribute(a[1]) === a[2]);
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }
  querySelectorAll(s) { return this.children.flatMap(n => [...(n.matches(s) ? [n] : []), ...n.querySelectorAll(s)]); }
  querySelector(s) { return this.querySelectorAll(s)[0] ?? null; }
  getContext() { return new Proxy({ canvas: this, measureText: s => ({ width: String(s).length * 6 }), createPattern: () => null }, { get: (o, k) => o[k] ?? (() => {}) }); }
  getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, bottom: 800, right: 1200, width: 1200, height: 800 }; }
}
export function installDOM() {
  const body = new Node('body'), head = new Node('head');
  globalThis.document = { body, head, createElement: t => new Node(t), createElementNS: (_, t) => new Node(t), createTextNode: s => new Node('#text', String(s)),
    querySelector: s => head.querySelector(s) ?? body.querySelector(s), querySelectorAll: s => [...head.querySelectorAll(s), ...body.querySelectorAll(s)] };
  globalThis.location = { href: 'http://localhost/?sim=record' };
  globalThis.history = { state: null, replaceState: (_, __, u) => { location.href = String(u); } };
  globalThis.addEventListener = () => {};
  globalThis.requestAnimationFrame = fn => { fn(0); return 0; };
  globalThis.devicePixelRatio = 1;
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.Path2D = class { constructor() { return new Proxy({}, { get: () => () => {} }); } };
  return { body, head };
}
export const visibleText = n => n.hidden || n.style?.display === 'none' ? '' : n.nodeType === 3 ? n.textContent : n.children.map(visibleText).join('');
