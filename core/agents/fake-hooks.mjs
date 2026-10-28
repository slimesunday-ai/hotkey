// The fake model's hooks (R2-6 left them for R2-7; GAME.md §18, §33): a seat's own bot speaking through the reply
// format, and the four faults only the action table can build; R8, any of them as native tool calls. $0: nothing here
// calls a model.
// const { observe, hooks } = fakeHooks({ bots, seed, rounds }); then fakeModel({ hooks }) and, for each seat,
// makeSeat({ observe }): before each request the seat tells the hooks what it was briefed with (its raw view, the deal,
// the day and the round), keyed by seat and call number, so a hook answers the call it was asked.
// - bot: the seat's bot (bench/bots.mjs's day and night, with the runner's context) plays the seat's view, and its
//   errands and play become the reply's actions, each copy named by its handle in that briefing (seat.mjs's actionsOf).
//   The bot is asked once a call point: the retry hears the same answer, so the bot's memory moves as the runner's would.
// - illegalPlay: the bot's reply with its play swapped for a number past the end of tonight's menu.
// - unknownErrand: the bot's reply and an action the table doesn't have.
// - staleHandle: the bot's reply and a dress naming one of the seat's own pieces by its handle in the seat's older
//   briefing, which reads as not yet now (R2-3's handles number on).
// - canaries: the bot's reply with a canary in every free-text slot its actions have (each action's table row says
//   which fields are free text: a line, a crew's name, a play's reason).
import { rng } from '../rng.mjs';
import { ACTIONS, TYPES } from './tools.mjs';
import { actionsOf } from './seat.mjs';
import { toolCallsOf } from './tool-calls.mjs';

// R9b, the dawn journal (journal.mjs): the fake's entry, short and the same every time for the same view, read off the
// seat's own view (last night's play, cash, pieces and heat). The bot isn't asked, so its memory moves as it would
// with no journal.
export function fakeEntry(view) {
  const me = view.me;
  const night = view.day - 1;
  const play = (view.events || []).filter(e => e.type === 'play' && e.agent === me.id && e.day === night).at(-1);
  const did = play ? `I played ${play.kind}${play.place ? ` at ${play.place}` : ''}` : 'I saw no play of mine';
  return `Night ${night}: ${did}. Now $${me.cash}, ${(me.pieces || []).length} pieces, heat ${me.heat}. Today I work my trade.`;
}

const freeText = act => {
  const row = ACTIONS.find(a => a.act === act);
  return row ? Object.entries(row.fields).filter(([, t]) => TYPES[t.replace('?', '')].free).map(([f]) => f) : [];
};

export function fakeHooks({ bots, seed, rounds = 3 }) {
  // Per seat: this briefing's deal, the one before it, the calls made on this briefing, and the bot's answer to it.
  const seats = new Map();

  function observe(info) {
    const k = seats.get(info.seat) || { deal: null, prior: null, calls: new Map(), said: null };
    if (k.deal !== info.deal) Object.assign(k, { prior: k.deal, deal: info.deal, calls: new Map(), said: null });
    k.calls.set(info.call, info);
    seats.set(info.seat, k);
  }

  const briefed = ({ seat, call }) => {
    const info = seats.get(seat) && seats.get(seat).calls.get(call);
    if (!info) throw new Error(`no briefing was seen for ${seat}'s call ${call}`);
    return info;
  };

  function bot(request) {
    const info = briefed(request);
    const k = seats.get(info.seat);
    // R9b: a dawn call's reply is the entry's text, not actions.
    if (!k.said && info.round === 'dawn') k.said = fakeEntry(info.view);
    if (!k.said) {
      const b = bots[info.seat];
      if (!b) throw new Error(`no bot plays ${info.seat}`);
      const { seat, day, round, view, deal } = info;
      k.said = round === 'lock'
        ? { actions: actionsOf(b.night(view, { seed, day, round: 'night', rng: rng(seed, 'bot', seat, day, 'night') }), deal) }
        : { actions: actionsOf({ errands: b.day(view, { seed, day, round, rounds, rng: rng(seed, 'bot', seat, day, round) }) }, deal) };
    }
    return k.said;
  }

  const hooks = {
    bot,
    async illegalPlay(request, ctx) {
      const { deal } = briefed(request);
      const { actions } = await ctx.bot();
      const own = actions.find(a => a.act === 'play');
      const off = { act: 'play', menu: deal.menu.length + 1, ...(own && own.reason !== undefined ? { reason: own.reason } : {}) };
      return { actions: [...actions.filter(a => a.act !== 'play'), off] };
    },
    async unknownErrand(request, ctx) {
      const { actions } = await ctx.bot();
      return { actions: [...actions, { act: 'teleport', place: 'docks' }] };
    },
    async staleHandle(request, ctx) {
      const { seat, view, deal } = briefed(request);
      const { prior } = seats.get(seat);
      if (!prior) throw new Error(`${seat} has no older briefing for a handle to be stale from`);
      const mine = view.me.pieces.find(p => Object.hasOwn(prior.byCopy, p.copy));
      const [slot, handle] = mine ? [mine.slot, prior.byCopy[mine.copy]] : [deal.view.board.list[0].slot, `P${deal.from - 1}`];
      const { actions } = await ctx.bot();
      return { actions: [...actions, { act: 'dress', fit: { [slot]: handle } }] };
    },
    // R8: a reply's actions as a model calls them in tools mode, one tool call each (tool-calls.mjs).
    toolCalls(request, ctx) {
      if (!ctx.value || !Array.isArray(ctx.value.actions)) throw new Error(`${request.seat}'s call ${request.call}: no actions to call as tools`);
      return toolCallsOf(ctx.value.actions);
    },
    async canaries(request, ctx) {
      const { actions } = await ctx.bot();
      return { actions: actions.map(a => ({ ...a, ...Object.fromEntries(freeText(a.act).map(f => [f, ctx.canary(`${a.act}.${f}`)])) })) };
    },
  };
  return { observe, hooks };
}
