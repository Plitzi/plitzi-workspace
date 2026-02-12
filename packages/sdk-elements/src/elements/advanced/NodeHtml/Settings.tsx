import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { JSX } from 'react';

type SettingsProps = {
  subType?: keyof JSX.IntrinsicElements;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'span', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="Node Tag" value={subType} onChange={handleChange('subType')}>
        <option value="div">Div (Container)</option>
        <option value="section">Section</option>
        <option value="article">Article</option>
        <option value="main">Main (Page Content)</option>
        <option value="aside">Aside (Sidebar)</option>
        <option value="header">Header</option>
        <option value="footer">Footer</option>
        <option value="nav">Navigation</option>

        <option value="p">Paragraph</option>
        <option value="span">Span (Inline)</option>
        <option value="strong">Strong (Bold)</option>
        <option value="em">Emphasis (Italic)</option>
        <option value="small">Small Text</option>
        <option value="blockquote">Block Quote</option>
        <option value="pre">Preformatted Text</option>
        <option value="code">Code Block</option>

        <option value="ul">Unordered List</option>
        <option value="ol">Ordered List</option>
        <option value="li">List Item</option>
        <option value="dl">Description List</option>
        <option value="dt">Term</option>
        <option value="dd">Description</option>

        <option value="img">Image</option>
        <option value="figure">Figure</option>
        <option value="figcaption">Figure Caption</option>
        <option value="video">Video</option>
        <option value="audio">Audio</option>

        <option value="form">Form</option>
        <option value="label">Label</option>
        <option value="input">Input Field</option>
        <option value="textarea">Textarea</option>
        <option value="select">Select (Dropdown)</option>
        <option value="option">Option</option>
        <option value="button">Button</option>

        <option value="a">Link</option>
        <option value="details">Details</option>
        <option value="summary">Summary</option>

        <option value="table">Table</option>
        <option value="thead">Table Head</option>
        <option value="tbody">Table Body</option>
        <option value="tr">Table Row</option>
        <option value="th">Table Header Cell</option>
        <option value="td">Table Data Cell</option>

        <option value="hr">Horizontal Rule</option>
        <option value="br">Line Break</option>
      </Select>
    </div>
  );
};

export default Settings;
