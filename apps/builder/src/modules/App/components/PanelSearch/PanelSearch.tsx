import Input from '@plitzi/plitzi-ui/Input';

export type PanelSearchProps = {
  value: string;
  onChange: (value: string) => void;
  /** What it finds, in a few words: "Search elements". */
  placeholder: string;
};

/** A panel's one search field: the same size, icon and place in every panel of the sidebar. */
const PanelSearch = ({ value, onChange, placeholder }: PanelSearchProps) => (
  <Input placeholder={placeholder} aria-label={placeholder} value={value} size="sm" onChange={onChange}>
    <Input.Icon icon="fa-solid fa-magnifying-glass" />
  </Input>
);

export default PanelSearch;
