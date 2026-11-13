// Shown in the detail panel when it's pinned open but no element is selected, so the column never reads as broken.
const SidebarEmpty = () => (
  <div className="text-ui-fg-subtle flex h-full flex-col items-center justify-center gap-2 px-2 text-center">
    <i className="fa-solid fa-arrow-pointer text-xl opacity-30" />
    <span className="text-[10px] leading-relaxed">Select an element to inspect its timing and why it rendered</span>
  </div>
);

export default SidebarEmpty;
