/* eslint-disable quotes -- the signatures quote code, which reads best in the other quotes */
/**
 * How a step or trigger builder is CALLED, for the ones not called with their params as one object — `delay(ms)`, not
 * `delay({ time })`. `explain` lists a step's params as the document stores them; without this, an agent writes the
 * builder with the document's keys and is refused. A builder missing here takes one object of the params listed.
 * `explain.test.ts` holds every name to an export, and the arguments to the builder's own.
 */
export const BUILDER_SIGNATURES: Readonly<Record<string, string>> = {
  delay: 'delay(ms)',
  copyToClipboard: "copyToClipboard('{{ navigation.href }}')",
  authLogout: 'authLogout()',
  authRefreshDetails: 'authRefreshDetails()',
  on: "on('onArrival', params?)",
  onKey: "onKey('mod+k, escape')",
  onInterval: 'onInterval(ms)',
  resetForm: "resetForm('form-id')",
  setFieldValue: "setFieldValue('form-id', 'field', value)",
  reloadApi: "reloadApi('provider-id', input?)",
  cancelApi: "cancelApi('provider-id')",
  openModal: "openModal('modal-id', data?)",
  closeModal: "closeModal('modal-id')",
  openDialog: "openDialog('dialog-id', data?)",
  closeDialog: "closeDialog('dialog-id')",
  publishOn: "publishOn('channel-id', type, data?)",
  announceOn: "announceOn('channel-id', state)",
  scrollBy: "scrollBy('row-id', { x: '80%' })",
  scrollTo: "scrollTo('row-id', { x: 'end' })",
  scrollIntoView: "scrollIntoView('element-id', { block: 'center' }?)",
  carouselNext: "carouselNext('carousel-id')",
  carouselPrevious: "carouselPrevious('carousel-id')",
  carouselGoTo: "carouselGoTo('carousel-id', index)",
  carouselPlay: "carouselPlay('carousel-id')",
  carouselPause: "carouselPause('carousel-id')",
  updateElement: "updateElement({ category, key, value }, 'element-id'?)",
  toggleElement: "toggleElement({ category, key }, 'element-id'?)"
};

/** How a builder is written: its own signature, or its params as one object (`setState({ … })`). */
export const builderCall = (builder: string): string => BUILDER_SIGNATURES[builder] ?? `${builder}({ … })`;
