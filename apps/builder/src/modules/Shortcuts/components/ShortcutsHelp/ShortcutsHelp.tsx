import Modal from '@plitzi/plitzi-ui/Modal';

import KeyboardKey from '@pmodules/Keyboard';

import { SHORTCUT_GROUPS } from '../../helpers';

export type ShortcutsHelpProps = {
  open: boolean;
  onClose: () => void;
};

const KEY_CLASS = 'border-ui-line bg-ui-raised text-ui-fg-muted';

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
          <h3 className="text-ui-fg-subtle m-0 text-xs font-semibold tracking-wide uppercase">{group.title}</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {group.shortcuts.map(shortcut => (
              <li key={shortcut.label} className="flex items-center justify-between gap-3">
                <span className="text-ui-fg">{shortcut.label}</span>
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
