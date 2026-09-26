import { defineAction } from '@plitzi/sdk-authoring';

import { restaurant } from '../content.ts';
import { checkEmail, SMTP_CREDENTIAL } from './rules.ts';

import type { ActionStepSpec } from '@plitzi/sdk-authoring';

export const NEWSLETTER_ACTION = 'suscribir-newsletter';

const onlyIf = (field: string, value: string | number): ActionStepSpec['when'] => ({
  combinator: 'and',
  rules: [{ field, operator: '=', value }]
});

/** The address as it is kept and compared: without the spaces somebody typed around it, and in one case. */
const ADDRESS = 'input.email|trim|lower';

const welcome = [
  '¡Hola!',
  '',
  'Ya estás en la lista de Ceniza. Te escribiremos cuando cambie la estación: la carta nueva, las cenas con productores y las próximas catas.',
  '',
  `Si no te has apuntado tú, escríbenos a ${restaurant.email} y te quitamos de la lista.`,
  '',
  `${restaurant.name} · ${restaurant.address}`
].join('\n');

/**
 * The seasonal newsletter's list.
 *
 * `kv.increment` is the dedupe: the first sign-up of an address makes its counter 1, every later one makes it more, and
 * the two are told apart without a read that a second sign-up could race. Only the first keeps the address and sends
 * the welcome — somebody already on the list hears "you were already in", which is the answer they need, and nobody
 * gets the same welcome twice.
 *
 * A welcome that cannot leave takes the address back off the list, so trying again welcomes it instead of saying it
 * was already in.
 */
export const newsletterAction = defineAction({
  id: NEWSLETTER_ACTION,
  name: 'Suscribir a la newsletter',
  description: 'Añade un email a la lista de la carta de temporada, una sola vez, y le da la bienvenida.',
  trigger: {
    type: 'call',
    access: 'public',
    input: { email: { type: 'text', required: true, label: 'Email' } }
  },
  steps: [
    {
      id: 'review',
      task: 'transform.template',
      params: { template: `{% set email = ${ADDRESS} %}${checkEmail('email')}{{ emailValid ? "yes" : "no" }}` }
    },
    {
      id: 'signup',
      task: 'kv.increment',
      params: { key: `newsletter:{{ ${ADDRESS}|md5 }}`, amount: '1' },
      when: onlyIf('review.value', 'yes')
    },
    {
      id: 'kept',
      task: 'kv.set',
      params: { key: `suscriptor:{{ ${ADDRESS}|md5 }}`, value: `{{ ${ADDRESS} }}` },
      when: onlyIf('signup.value', 1)
    },
    {
      id: 'welcome',
      task: 'email.send',
      params: {
        credential: SMTP_CREDENTIAL,
        to: `{{ ${ADDRESS} }}`,
        subject: 'Bienvenido a la carta de temporada de Ceniza',
        text: welcome
      },
      when: onlyIf('signup.value', 1)
    },
    {
      id: 'reply',
      task: 'transform.template',
      params: {
        template: [
          '{% if review.value == "no" %}{"ok": false, "message": "Revisa el email: parece que le falta algo."}',
          '{% elseif signup.value == 1 %}{"ok": true, "message": "Te escribiremos cuando cambie la estación."}',
          '{% else %}{"ok": true, "message": "Ya estabas en la lista. Nos vemos en la próxima estación."}{% endif %}'
        ].join('')
      }
    },
    { id: 'result', task: 'transform.json', params: { value: '{{ reply.value }}' } }
  ],
  output: '{{ result.value }}',
  onFailure: [
    {
      id: 'unlisted',
      task: 'kv.delete',
      params: { key: `newsletter:{{ ${ADDRESS}|md5 }}` },
      when: onlyIf('signup.value', 1)
    },
    {
      id: 'dropped',
      task: 'kv.delete',
      params: { key: `suscriptor:{{ ${ADDRESS}|md5 }}` },
      when: onlyIf('signup.value', 1)
    }
  ]
});
