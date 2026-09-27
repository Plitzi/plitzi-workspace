import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PluginInUse from './PluginInUse';

describe('PluginInUse', () => {
  it('says nothing about a plugin no page uses', () => {
    const { container } = render(<PluginInUse usage={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('names every page that would be left with elements it cannot render', () => {
    const { getByText } = render(
      <PluginInUse
        usage={[
          { page: 'Home', elements: 2 },
          { page: 'Pricing', elements: 1 }
        ]}
      />
    );

    expect(getByText(/still in use/)).toBeTruthy();
    expect(getByText('Home: 2')).toBeTruthy();
    expect(getByText('Pricing: 1')).toBeTruthy();
  });
});
