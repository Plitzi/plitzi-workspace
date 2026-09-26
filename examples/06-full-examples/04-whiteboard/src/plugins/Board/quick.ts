import { holdsText, isAuthored, takesLabel } from '../../board/model.ts';
import { connectorBetween } from './connectors.ts';
import { anchorPoint, boundsOf } from './geometry.ts';
import { newId, newSeed } from './values.ts';

import type { Core } from './core.ts';
import type { Box } from './geometry.ts';
import type { Anchor, Binding, BoardElement } from '../../board/model.ts';

/**
 * Growing a diagram a click at a time: a click on one of a shape's connection points puts another like it that way,
 * connected by an arrow and ready to be written on — how a mind map or a flow is laid out without drawing a single
 * arrow by hand.
 */

/** How far the new one stands from the one it grew from. */
const GAP = 90;

const OUTWARD: Record<Anchor, [number, number]> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

const OPPOSITE: Record<Anchor, Anchor> = { n: 's', e: 'w', s: 'n', w: 'e' };

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const createQuick = (core: Core) => {
  const grow = (from: Binding): void => {
    const source = core.current().get(from.id);
    if (!source || !core.editable()) {
      return;
    }

    const box = boundsOf(source);
    const [dx, dy] = OUTWARD[from.anchor];
    const place: Box = {
      x: source.x + dx * (box.width + GAP),
      y: source.y + dy * (box.height + GAP),
      width: source.width,
      height: source.height
    };
    // Something already there — the second branch of the same point — and the new one steps aside, along the side.
    const shown = core.displayed();
    for (let tries = 0; tries < 8 && shown.some(element => overlaps(place, boundsOf(element))); tries += 1) {
      if (dx === 0) {
        place.x += box.width + 30;
      } else {
        place.y += box.height + 30;
      }
    }

    const {
      votes: _votes,
      text: _text,
      done: _done,
      group: _group,
      parent: _parent,
      author: _author,
      ...shape
    } = source;
    const { author } = core.state.props;
    const grown: BoardElement = core.measured({
      ...shape,
      ...place,
      id: newId(),
      seed: newSeed(),
      z: core.scene.topZ + 2,
      version: 0,
      nonce: 0,
      ...(holdsText(source.type) ? { text: '' } : {}),
      ...(isAuthored(source.type) && author ? { author } : {})
    });
    const end: Binding = { id: grown.id, anchor: OPPOSITE[from.anchor] };
    const arrow = connectorBetween(
      core.newElement('arrow', [0, 0]),
      anchorPoint(source, from.anchor),
      anchorPoint(grown, end.anchor),
      from,
      end
    );
    core.sounds.play('connect');
    core.commit([grown, arrow]);
    core.setSelection([grown.id]);
    if (holdsText(grown.type) || takesLabel(grown.type)) {
      core.startEditing({ ...(core.scene.element(grown.id) ?? grown), text: '' });
    }
  };

  return { grow };
};

export type Quick = ReturnType<typeof createQuick>;
