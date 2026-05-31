import { describe, it, expect } from 'vitest';

import getSpaceSettingsTool from './schema/getSpaceSettings';
import updateSpaceSettingsTool from './schema/updateSpaceSettings';

describe('getSpaceSettingsTool', () => {
  it('has correct name and adapterName', () => {
    expect(getSpaceSettingsTool.name).toBe('get_space_settings');
    expect(getSpaceSettingsTool.adapterName).toBe('getSpaceSettings');
  });

  it('allows plan and build modes (read)', () => {
    expect(getSpaceSettingsTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts empty object', () => {
      expect(getSpaceSettingsTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(true);
    });
  });
});

describe('updateSpaceSettingsTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateSpaceSettingsTool.name).toBe('update_space_settings');
    expect(updateSpaceSettingsTool.adapterName).toBe('updateSpaceSettings');
  });

  it('allows only build mode (write)', () => {
    expect(updateSpaceSettingsTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts empty object (all fields optional)', () => {
      expect(updateSpaceSettingsTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(true);
    });

    it('accepts path and string value', () => {
      expect(
        updateSpaceSettingsTool.mcpDefinition.inputSchema?.safeParse({ path: 'customCss', value: 'body {}' }).success
      ).toBe(true);
    });

    it('accepts boolean value', () => {
      expect(
        updateSpaceSettingsTool.mcpDefinition.inputSchema?.safeParse({ path: 'keepState', value: true }).success
      ).toBe(true);
    });
  });
});
