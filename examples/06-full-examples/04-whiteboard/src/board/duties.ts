import type { Duty, DutyRole } from './model.ts';

/**
 * The duties an agent can be given in a frame: what each is called, and what it is asked to do when the people on the
 * board say nothing more. Read by the canvas that labels the frame, the page that sets the duty and the agent that
 * takes it — one wording for all three.
 */
export const DUTY_PRESETS: Record<DutyRole, { label: string; instruction: string }> = {
  scribe: {
    label: 'Scribe',
    instruction:
      'Keep one card at the top of this frame that sums up what is decided here, and update it whenever that changes.'
  },
  guardian: {
    label: 'Guardian',
    instruction:
      'Watch this frame and say so in the chat, briefly, when something breaks its rules — too many cards, one left ' +
      'without an owner, something done that is still here.'
  },
  organizer: {
    label: 'Organizer',
    instruction:
      'Group what lands in this frame by theme: put related notes together, and a short title over each group.'
  },
  custom: { label: 'Custom', instruction: '' }
};

/** The instruction an agent works to: the one written for this frame, or its role's own. */
export const instructionOf = (duty: Duty): string => duty.instruction.trim() || DUTY_PRESETS[duty.role].instruction;

/** A duty in a few words, for a frame's badge: its role, and who took it — or that nobody has yet. */
export const dutyBadge = (duty: Duty): string =>
  `✦ ${DUTY_PRESETS[duty.role].label} · ${duty.paused ? 'paused' : (duty.agent ?? 'waiting for an agent')}`;
