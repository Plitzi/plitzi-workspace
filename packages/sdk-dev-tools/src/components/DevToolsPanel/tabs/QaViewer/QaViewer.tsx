import QaCheckRow from './QaCheckRow';
import QaGroup from './QaGroup';
import QaRescanButton from './QaRescanButton';
import QaSettingSwitch from './QaSettingSwitch';
import QaVisionPicker from './QaVisionPicker';

/**
 * Tools for checking a build in the browser it will be used in — a pre-production deployment, say — rather than in the
 * builder: lining things up, motion, colour, and the problems a tester looks for on every page. All of it stays on
 * while the panel is folded away, and in this browser only.
 */
const QaViewer = () => (
  <div className="flex w-full flex-col gap-4 overflow-y-auto p-3">
    <QaGroup title="Layout" icon="fa-solid fa-table-columns">
      <QaSettingSwitch
        setting="grid"
        label="Layout grid"
        description="The columns the page is laid out on — 12, 8 or 4 at the breakpoint showing — as the builder draws them"
      />
      <QaSettingSwitch
        setting="outlines"
        label="Element outlines"
        description="Every element's box; point at a heading, a line or a control for its type and id"
      />
      <QaSettingSwitch
        setting="viewport"
        label="Viewport and breakpoint"
        description="The window's size and which breakpoint's rules show at it"
      />
    </QaGroup>
    <QaGroup title="Motion and colour" icon="fa-solid fa-eye">
      <QaSettingSwitch
        setting="paused"
        label="Pause animations"
        description="Every animation held where it is, to look at a moment of it"
      />
      <QaSettingSwitch
        setting="reducedMotion"
        label="Reduced motion"
        description="The page as a visitor who asked their system for less motion gets it"
      />
      <QaVisionPicker />
    </QaGroup>
    <QaGroup title="Checks" icon="fa-solid fa-list-check" end={<QaRescanButton />}>
      <QaCheckRow
        check="overflow"
        label="Sticks out sideways"
        description="Whatever reaches past the page's sides — what makes a phone scroll sideways"
      />
      <QaCheckRow
        check="names"
        label="Nameless controls and pictures"
        description="A button, link or field with no words for a screen reader or a browser agent; a picture with no alt"
      />
      <QaCheckRow
        check="targets"
        label="Small touch targets"
        description="Controls under 24 × 24 px, the least a finger can be asked to aim at (WCAG 2.2)"
      />
    </QaGroup>
  </div>
);

export default QaViewer;
