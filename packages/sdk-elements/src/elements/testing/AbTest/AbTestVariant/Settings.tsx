/** A variant has nothing of its own to set: its place in the A/B test says whether it is A or B. */
const Settings = () => (
  <div className="flex flex-col gap-4 py-2">
    <span className="text-ui-fg-subtle text-xs">
      The A/B test’s first variant is A, its second B. Choose which the canvas shows in the A/B test’s settings.
    </span>
  </div>
);

export default Settings;
