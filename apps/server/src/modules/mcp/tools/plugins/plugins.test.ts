import { describe, it, expect } from 'vitest';

import listPluginsTool from './listPlugins';

describe('listPluginsTool', () => {
  it('has correct name and adapterName', () => {
    expect(listPluginsTool.name).toBe('list_plugins');
    expect(listPluginsTool.adapterName).toBe('listPlugins');
  });

  it('allows plan and build modes (read)', () => {
    expect(listPluginsTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts empty object', () => {
      expect(listPluginsTool.mcpDefinition.inputSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('outputSchema', () => {
    it('validates a list of plugins', () => {
      expect(
        listPluginsTool.mcpDefinition.outputSchema.safeParse({
          data: [{ name: '@plitzi/plitzi-sdk', version: '1.0.0', description: 'Core SDK' }]
        }).success
      ).toBe(true);
    });

    it('validates a plugin without optional fields', () => {
      expect(listPluginsTool.mcpDefinition.outputSchema.safeParse({ data: [{ name: 'my-plugin' }] }).success).toBe(true);
    });

    it('validates an empty plugin list', () => {
      expect(listPluginsTool.mcpDefinition.outputSchema.safeParse({ data: [] }).success).toBe(true);
    });

    it('rejects missing data field', () => {
      expect(listPluginsTool.mcpDefinition.outputSchema.safeParse({}).success).toBe(false);
    });

    it('rejects plugin without name', () => {
      expect(
        listPluginsTool.mcpDefinition.outputSchema.safeParse({ data: [{ version: '1.0.0' }] }).success
      ).toBe(false);
    });
  });
});
