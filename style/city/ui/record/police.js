import { createPoliceSigns } from '../../simstate/record/police-signs.js';
import { boardAt } from '../../simstate/record/board-data.js';
import { sameInputs } from './view.js';

// The public set() is also used to clear/rebuild signs. Remember what was drawn
// as well as the board inputs; the scene graph may be replaced independently.
export function createPoliceView({ THREE, scene }) {
  let signs = createPoliceSigns({ THREE, scene }), inputs = null, drawn = null, revision = 0, paintedRevision = -1;
  const topology = () => [signs.group.parent, ...signs.group.children.flatMap(node =>
    [node, node.parent, node.material, node.material?.map, node.material?.map?.image])];
  const visibility = () => signs.group.children.map(node => node.visible);
  let visible = null, nodes = [];
  function rebuild() {
    signs.group.removeFromParent();
    const previous = new Set(nodes);
    signs.group.traverse(node => previous.add(node));
    for (const node of previous) { node.geometry?.dispose(); node.material?.map?.dispose(); node.material?.dispose(); }
    for (const node of [...scene.children]) if (node.name === 'police-signs') scene.remove(node);
    signs = createPoliceSigns({ THREE, scene });
  }
  function update(force = false, s) {
    const k = [s.board?.police, s.board?.tonight], intact = sameInputs(drawn, topology());
    if (!force && sameInputs(inputs, k) && intact && revision === paintedRevision && sameInputs(visible, visibility())) return;
    if (drawn && !intact) rebuild();
    const B = boardAt(s, s.minute); signs.set(B.police, B.tonight);
    inputs = k; drawn = topology(); visible = visibility(); nodes = [...signs.group.children]; paintedRevision = revision;
  }
  return { update, set(police, tonight) { revision++; signs.set(police, tonight); },
    frame: (camera, o) => signs.frame(camera, o), stats: () => signs.stats(), get group() { return signs.group; } };
}
