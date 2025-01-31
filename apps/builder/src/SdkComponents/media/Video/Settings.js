// Packages
import React from 'react';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';

/**
 * @param {{
 *   src?: string;
 *   autoPlay?: boolean;
 *   playsInline?: boolean;
 *   loop?: boolean;
 *   muted?: boolean;
 *   onUpdate?: (key: string, value: any) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Settings = props => {
  const { src = '', autoPlay = false, playsInline = false, loop = false, muted = true, onUpdate = noop } = props;

  const handleChange = key => e => onUpdate(key, e.target.value);

  const handleChangeChecked = key => e => onUpdate(key, e.target.checked);

  return (
    <div className="flex flex-col">
      <div className="bg-blue-400 px-4 py-2 flex items-center justify-center">
        <h1 className="text-white m-0">Video Settings</h1>
      </div>
      <div className="flex flex-col p-2">
        <div className="flex flex-col">
          <label>Video</label>
          <div className="flex flex-col">
            <span>URL</span>
            <Input value={src} onChange={handleChange('src')} inputClassName="rounded-sm" />
            {src && (
              <div className="flex items-center justify-center p-2 mt-2 border rounded-sm border-gray-300 relative">
                <div className="bg-white text-xs absolute top-2 left-2 p-1 rounded-br rounded-tl border border-gray-300">
                  Preview
                </div>
                <video className="w-full h-full rounded-sm" src={src} autoPlay playsInline loop muted>
                  <track kind="captions" />
                </video>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="auto-play"
            checked={autoPlay}
            onChange={handleChangeChecked('autoPlay')}
            className="rounded-sm mr-2"
          />
          <label htmlFor="auto-play" className="cursor-pointer select-none">
            Auto Play
          </label>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox
            id="plays-inline"
            checked={playsInline}
            onChange={handleChangeChecked('playsInline')}
            className="rounded-sm mr-2"
          />
          <label htmlFor="plays-inline" className="cursor-pointer select-none">
            Plays Inline
          </label>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox id="loop" checked={loop} onChange={handleChangeChecked('loop')} className="rounded-sm mr-2" />
          <label htmlFor="loop" className="cursor-pointer select-none">
            Loop
          </label>
        </div>
        <div className="flex items-center mt-4">
          <Checkbox id="muted" checked={muted} onChange={handleChangeChecked('muted')} className="rounded-sm mr-2" />
          <label htmlFor="muted" className="cursor-pointer select-none">
            Muted
          </label>
        </div>
      </div>
    </div>
  );
};

export default Settings;
