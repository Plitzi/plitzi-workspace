import Modal from '@plitzi/plitzi-ui/Modal';

import KeyboardKey from '@pmodules/Keyboard';

import { SHORTCUT_GROUPS } from '../../helpers';

export type ShortcutsHelpProps = {
  open: boolean;
  onClose: () => void;
};

const KEY_CLASS = 'border-gray-200 bg-gray-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

/** Every key the builder answers to, grouped by where it acts. Opened with `?` from anywhere but a text field. */
const ShortcutsHelp = ({ open, onClose }: ShortcutsHelpProps) => (
  <Modal open={open} onClose={onClose} size="sm" className={{ card: 'w-120' }}>
    <Modal.Header>
      <Modal.HeaderIcon>
        <i className="fa-solid fa-keyboard" />
      </Modal.HeaderIcon>
      Keyboard shortcuts
    </Modal.Header>
    <Modal.Body className="flex flex-col gap-5 text-sm">
      {SHORTCUT_GROUPS.map(group => (
        <section key={group.title} className="flex flex-col gap-2">
          <h3 className="m-0 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {group.title}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {group.shortcuts.map(shortcut => (
              <li key={shortcut.label} className="flex items-center justify-between gap-3">
                <span className="text-zinc-700 dark:text-zinc-200">{shortcut.label}</span>
                <span className="flex gap-1">
                  {shortcut.keys.map(key => (
                    <KeyboardKey key={key.char} className={KEY_CLASS} commandChar={!!key.command} char={key.char} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Modal.Body>
  </Modal>
);

export default ShortcutsHelp;
