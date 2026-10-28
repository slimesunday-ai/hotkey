// Drop 02: art is authored independently; geometry and fitting remain centralized.
import { DESIGNS as PANTS } from './drop-designs/pants.js';
import { DESIGNS as SHORTS } from './drop-designs/shorts.js';
import { DESIGNS as SHOES } from './drop-designs/shoes.js';
import { DESIGNS as SOCKS } from './drop-designs/socks.js';
import { CARD_SHOES, installCardShoes } from './opus-pants/index.js';
const catalog = rows => Object.fromEntries(rows.map(t => [t.id, { ...t, tier: t.tier === 'G' ? 'grail' : t.tier, collection: 'drop02' }]));
export const DROP_BOTTOMS = catalog([...PANTS, ...SHORTS]);
export const DROP_SHOES = catalog(SHOES);
export const DROP_SOCKS = catalog(SOCKS);
export const colorway = (t, cw) => t.cw[((cw | 0) % t.cw.length + t.cw.length) % t.cw.length];

// Exactly the approved tongue study. The ankle is a dressed part of the rigid
// foot, painted separately from shoe art. All new designs share these cells.
const cells = [];
for (const [y, z0, z1, width, region] of [[0,-3,5,5,'outsole'],[1,-3,5,5,'midsole'],[2,-2,4,4,'upper'],[3,2,2,3,'tongue']])
  for(let u=0;u<width;u++)for(let z=z0;z<=z1;z++)cells.push({u,y,z,width,region});
const occupied = new Set(cells.map(q=>`${q.u},${q.y},${q.z}`));
for(let u=0;u<3;u++)for(let z=-1;z<=1;z++)occupied.add(`${u},3,${z}`);
export const DROP_SHOE_CELLS = cells.map(q=>Object.freeze({...q,
  outer:!occupied.has(`${q.u+1},${q.y},${q.z}`),front:!occupied.has(`${q.u},${q.y},${q.z+1}`),
  back:!occupied.has(`${q.u},${q.y},${q.z-1}`),top:!occupied.has(`${q.u},${q.y+1},${q.z}`),
}));

export function installDropTraits({ SHOES: registry, NEWT, NEWI, NAMES }) {
  for(const [slot, list] of [['shoes',DROP_SHOES],['socks',DROP_SOCKS]]) {
    NEWT[slot] ||= {}; NAMES[slot] ||= {};
    for(const [id,t] of Object.entries(list)) {
      NEWT[slot][id]=[t.name,t.tier,t.cw,t.why];
      NEWI[id]={...t,id,slot,new:true,origin:'lower'};NAMES[slot][id]=t.name;
      if(slot!=='shoes')continue;
      registry[id]=(grid,p)=>{
        const colors=colorway(t,p.cw),index=t.cw.indexOf(colors);
        for(const side of [-1,1]) {
          for(const q of DROP_SHOE_CELLS){const [c,l=0]=t.paint({...q,side},colors.slice(1),index);grid.set(side<0?-2-q.u:1+q.u,q.y,q.z,c,l);}
          for(let u=0;u<3;u++)for(let z=-1;z<=1;z++)grid.set(side<0?-2-u:1+u,3,z,colors[1],0);
        }
      };
    }
  }
  installCardShoes(registry, DROP_SHOE_CELLS); // review-only plain shoe for pants cards
}

// Called after the lower garment is composed, before its top. This does not cut
// the shoe or paint an overlapping shell. It dresses the existing socket cells.
export function dressDropAnkle(SH, B, L, lower, skin) {
  if(!DROP_SHOES[L.shoes.id]&&!CARD_SHOES[L.shoes.id])return;
  const shorts = lower.form === 'shorts' || lower.form === 'longshorts';
  const bare = shorts && (lower.sock === 'none' || !lower.sock);
  for(const side of [-1,1])for(let u=0;u<3;u++)for(let z=-1;z<=1;z++) {
    const x=side<0?-2-u:1+u, key=((x+256)<<18)|((4+256)<<9)|(z+256);
    let color;
    if(bare)color=[skin.c(x,3,z),skin.layer];
    else if(shorts&&lower.sockPaint)color=lower.sockPaint({x,y:3,z,u,side,width:3,z0:-1,z1:1,covered:false,socks:true,c:lower.sockColor,l:0});
    else color=[B.get(x,4,z)??skin.c(x,3,z),Math.max(0,B.L.findIndex(layer=>layer.has(key)))];
    SH.set(x,3,z,...color);
  }
}
