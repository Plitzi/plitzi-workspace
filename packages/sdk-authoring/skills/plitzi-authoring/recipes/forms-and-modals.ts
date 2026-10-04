/**
 * Do something on a click or a submit: a flow is `[trigger, steps…]`. A form manages its own submit and hands its
 * values to the flow; a modal starts hidden and a step opens it.
 */
import {
  button,
  closeModal,
  form,
  formControl,
  modalContainer,
  named,
  onClick,
  onSubmit,
  openModal,
  setState,
  text,
  toggleState
} from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

export const recipe: SpaceSpec = {
  name: 'Flows',
  permanentUrl: 'flows',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        button({ content: 'Save', flows: [[onClick(), setState({ key: 'saved', type: 'boolean', value: true })]] }),
        // A switch is named for how it leaves its default: shown until somebody hides it.
        button({ content: 'Hide details', flows: [[onClick(), toggleState({ key: 'detailsHidden' })]] }),
        form({
          id: 'signup',
          managedByInteractions: true,
          flows: [
            [named('sent', onSubmit()), setState({ key: 'email', type: 'text', value: '{{ sent.values.email }}' })]
          ],
          children: [
            formControl({ name: 'email', label: 'Email', subType: 'email' }),
            button({ content: 'Sign up', subType: 'submit' })
          ]
        }),
        modalContainer({
          id: 'details',
          visible: false,
          title: 'Details',
          children: [
            text('What the modal says.'),
            button({
              content: '',
              title: 'Close',
              icon: 'fa-solid fa-xmark',
              flows: [[onClick(), closeModal('details')]]
            })
          ]
        }),
        button({ content: 'Open', flows: [[onClick(), openModal('details')]] })
      ]
    }
  ]
};
