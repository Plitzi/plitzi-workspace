import {
  apiContainer,
  bindTemplate,
  channel,
  container,
  delay,
  list,
  on,
  onPageLoad,
  reloadApi,
  styles,
  text,
  variantFrom,
  whileRunning
} from '@plitzi/sdk-authoring';

import { LIST_ACTION } from '../../actions.ts';
import { COLLAB_COLOURS } from '../../board/people.ts';
import { GALLERY_PROVIDER } from '../ids.ts';
import { identity } from '../state.ts';
import { featured, recent, templates } from './catalogue.ts';
import { footnote, page, shell, siteBar } from './chrome.ts';
import { callToAction } from './cta.ts';
import { features } from './features.ts';
import { hero } from './hero.ts';
import { together } from './together.ts';
import { guideLink } from '../guide/agents.ts';

import type { CssProps, ElementSpec, PageSpec } from '@plitzi/sdk-authoring';

/**
 * The front page — where people arrive, so it shows what this is by letting them do it: a canvas to scribble on
 * before anything else, the boards being drawn right now, templates drawn small, the featured boards to walk into,
 * and who else is here with you.
 *
 * It stays current by itself. Every commit anywhere is announced on the `boards` topic and the page reads the list
 * again — at most once every second and a half, however busy the boards are — and the `lobby` channel says who is
 * on this page with you.
 */

const here = styles('hereNow', {
  display: 'flex',
  'align-items': 'center',
  gap: '10px',
  padding: '4px 12px 4px 6px',
  'border-radius': '999px',
  border: '1px solid var(--edge)',
  'background-color': 'var(--surface)',
  'font-size': '13px',
  'font-weight': '600',
  'white-space': 'nowrap'
});

/** On a phone the faces say it: the words would push the theme switch off the screen. */
const hereLabel = styles('hereLabel', { css: { desktop: {}, mobile: { display: 'none' } } });

const faces = styles('faces', { display: 'flex', margin: '0px', padding: '0px', 'list-style-type': 'none' });

const FACE: CssProps = {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '26px',
  height: '26px',
  'margin-left': '-6px',
  'border-radius': '50%',
  border: '2px solid var(--surface)',
  'font-size': '11px',
  'font-weight': '700',
  color: '#ffffff',
  'background-color': 'var(--muted)'
};

const face = styles('face', {
  css: FACE,
  variants: Object.fromEntries(
    COLLAB_COLOURS.map(colour => [colour, { 'background-color': `var(--collab-${colour})` }])
  )
});

/** Everyone on the front page right now, this visitor among them: faces, and how many. */
const hereNow = (): ElementSpec =>
  container({
    class: here,
    children: [
      list({
        id: 'visitors',
        source: 'controlled',
        class: faces,
        bind: [
          bindTemplate(
            'items',
            'lobby.members',
            '{{ source|filter(member => member.state.name is defined)|slice(0, 6) }}',
            {
              returns: 'value'
            }
          )
        ],
        children: [
          container({
            subType: 'li',
            children: [
              text({
                content: '',
                class: face,
                bind: [
                  bindTemplate('content', 'visitors.item.state.name', '{{ source|first|upper }}'),
                  variantFrom(face, 'visitors.item.state.color')
                ]
              })
            ]
          })
        ]
      }),
      text({
        content: '',
        class: hereLabel,
        bind: [
          bindTemplate(
            'content',
            'lobby.members',
            "{{ (source|length) <= 1 ? 'Just you here' : (source|length) ~ ' people here now' }}"
          )
        ]
      })
    ]
  });

export const galleryPage: PageSpec = {
  name: 'Boards',
  slug: '',
  seoTitle: 'Pizarra — draw together',
  seoDescription:
    'An infinite whiteboard in a hand-drawn stroke: templates, sticky piles, live cursors, voting and a shared timer. Start a board and send the link.',
  class: page,
  flows: [[onPageLoad(), ...identity]],
  body: [
    // Who is on the front page: this visitor announces its name and colour, and hears everyone else's.
    channel({
      id: 'lobby',
      topic: 'lobby',
      keep: 0,
      bind: { presence: 'computed.me' },
      children: [
        apiContainer({
          id: GALLERY_PROVIDER,
          subType: 'div',
          runtime: 'server',
          action: LIST_ACTION,
          renderWhileLoading: true,
          children: [
            /**
             * Somebody drew somewhere: read the list again. `skip` while the wait runs, so a burst of commits across
             * every board is one re-read, a second and a half after the first of them.
             */
            channel({
              id: 'changes',
              topic: 'boards',
              keep: 0,
              flows: [[whileRunning('skip', on('onMessage')), delay(1500), reloadApi(GALLERY_PROVIDER)]]
            }),
            container({
              class: shell,
              children: [
                siteBar('gallery', [guideLink(), hereNow()]),
                hero(),
                // Who is drawing right now comes first: it is what people come back for, and it shows the place is alive.
                recent(),
                together(),
                features(),
                templates(),
                featured(),
                callToAction()
              ]
            }),
            text({ content: 'Boards live in this server’s memory — a restart clears them.', class: footnote })
          ]
        })
      ]
    })
  ]
};
