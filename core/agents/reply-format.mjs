// The action table remains the authority for both parsing and presentation. No independently maintained schema.
// The rows an audience may send: built, its own, and for a seat never read (its briefing is its read). The native tool
// definitions (tool-calls.mjs) present the same rows.
export const replyRows = (audience, actions) => actions.filter(a => a.built === true && a.who.includes(audience) && !(audience === 'seat' && a.act === 'read'));
export function formatReply({ audience, actions, types, tools }) {
  const base = spec => spec.replace('?', '');
  const rows = replyRows(audience, actions);
  const fields = a => Object.entries(a.fields).filter(([, t]) => !(audience !== 'seat' && types[base(t)].free));
  const used = [...new Set(rows.flatMap(a => fields(a).map(([, t]) => base(t))))];
  for (const t of used) for (const u of types[t].uses || []) if (!used.includes(u)) used.push(u);
  return [
    audience === 'seat' ? 'Reply JSON {"actions":[...]}; run in order; first play stands.' : 'Call one JSON action at a time.',
    'Add listed fields to each action; ? optional; enums are strings. Use only applicable play fields.',
    ...rows.flatMap((a, i) => [
      ...(i && rows[i - 1].tool === a.tool ? [] : [`${tools[a.tool]}:`]),
      `- {"act": "${a.act}"} ${fields(a).map(([f, t]) => `"${f}"${t.endsWith('?') ? '?' : ''}:${base(t)}`).join(',')}: ${a.about}.`,
    ]),
    ...used.map(t => `- ${t}: ${types[t].show}`),
  ].join('\n');
}
