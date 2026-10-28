// A cached input only describes a drawing while its targets still exist.
// Observe mutations, not the rendered facts, and keep the static shell so a
// replaced/detached target can be restored before its current values repaint.
import { sameInputs } from './view.js';

const children = node => Array.from(node.childNodes ?? node.children ?? []);
export function watchDrawing(root, el, targets) {
  const mutable = new Set(targets), shell = [];
  function remember(node) {
    if (mutable.has(node)) return;
    const kids = children(node), text = Number(node.nodeType) === 3 ? node.textContent : null;
    shell.push({ node, kids, text }); kids.forEach(remember);
  }
  remember(el);
  const mounts = root.parentNode ? [[root, root.parentNode], [el, root]] : [[el, root]];
  let dirty = true, stamp = null;
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => { dirty = true; });
  observer?.observe(el, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-k', 'data-row', 'data-ev', 'data-type', 'data-scope', 'data-path', 'data-agent', 'data-name', 'data-badge', 'data-i', 'data-kind', 'width', 'height'] });
  // The node-only probe has no MutationObserver. Its small display windows can
  // be checked directly; browsers use the observer's constant-time dirty bit.
  function fingerprint() {
    const out = [];
    function visit(node) {
      const kids = children(node); out.push(node, kids.length);
      if (!kids.length) out.push(node.textContent);
      kids.forEach(visit);
    }
    targets.forEach(visit); return out;
  }
  function intact() {
    if (observer?.takeRecords().length) dirty = true;
    if (dirty || mounts.some(([node, parent]) => !children(parent).includes(node))) return false;
    if (!observer && (shell.some(({ node, kids }) => !sameInputs(kids, children(node))) || !sameInputs(stamp, fingerprint()))) return false;
    return true;
  }
  function repair() {
    for (const [node, parent] of mounts) {
      if (children(parent).includes(node)) continue;
      const replacement = node.id && children(parent).find(n => n.id === node.id);
      if (replacement) replacement.replaceWith(node); else parent.append(node);
    }
    for (const { node, kids, text } of shell) {
      if (!sameInputs(kids, children(node))) node.replaceChildren(...kids);
      if (text !== null && node.textContent !== text) node.textContent = text;
    }
  }
  function painted() { observer?.takeRecords(); dirty = false; if (!observer) stamp = fingerprint(); }
  return { intact, repair, painted };
}
