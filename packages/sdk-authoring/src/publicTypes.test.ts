import { describe, expect, it } from 'vitest';

import type * as authoring from './index';

/**
 * The types a project is handed, importable from this package. Written as a type that names each one: one that stops
 * being exported fails to compile, here, rather than in a project that wrote \`NonNullable<SpaceSpec['fonts']>\`.
 */
type Reachable = [
  authoring.ActionAccess,
  authoring.ActionDocument,
  authoring.ActionEntry,
  authoring.ActionField,
  authoring.ActionFieldType,
  authoring.ActionLimits,
  authoring.BindingCategory,
  authoring.BindingTransformer,
  authoring.ChannelDeclaration,
  authoring.ChannelDeclarations,
  authoring.ColorScheme,
  authoring.ComponentProp,
  authoring.DisplayMode,
  authoring.Element,
  authoring.ElementBinding,
  authoring.ElementDefinition,
  authoring.ElementFlagGate,
  authoring.ElementInteraction,
  authoring.ElementLoadStrategy,
  authoring.ElementRuntime,
  authoring.FontBase,
  authoring.FontDisplay,
  authoring.FontFace,
  authoring.FontStyle,
  authoring.GoogleFont,
  authoring.HostedFont,
  authoring.InteractionCallback,
  authoring.InteractionCallbackContext,
  authoring.InteractionCallbackParam,
  authoring.InteractionCallbackParamValues,
  authoring.InteractionCallbackPreview,
  authoring.InteractionCallbackPreviews,
  authoring.InteractionCallbackType,
  authoring.InteractionParamType,
  authoring.InteractionPostCallback,
  authoring.ManifestAsset,
  authoring.PageFolder,
  authoring.PluginBuilder,
  authoring.PluginManifest,
  authoring.PluginSchema,
  authoring.RemoteFont,
  authoring.Schema,
  authoring.SchemaFlag,
  authoring.SchemaFlagRule,
  authoring.SchemaRsc,
  authoring.SchemaVariable,
  authoring.SpaceComponent,
  authoring.SpaceCredentialProvider,
  authoring.SpaceFont,
  authoring.Style,
  authoring.StyleAncestor,
  authoring.StyleAncestors,
  authoring.StyleAttributes,
  authoring.StyleBlock,
  authoring.StyleCategory,
  authoring.StyleItem,
  authoring.StyleMode,
  authoring.StyleObject,
  authoring.StyleState,
  authoring.StyleStates,
  authoring.StyleThemeValue,
  authoring.StyleValue,
  authoring.StyleVariableCategory,
  authoring.StyleVariableGroup,
  authoring.StyleVariableValue,
  authoring.StyleVariables,
  authoring.StyleVariants,
  authoring.SystemFont,
  authoring.TagType,
  authoring.Theme,
  authoring.WhileRunning,
  authoring.SchemaValidationError,
  authoring.SchemaValidationOptions,
  authoring.SchemaValidationResult
];

describe('the public types', () => {
  it('names every document type its API hands out', () => {
    const count: Reachable['length'] = 74;

    expect(count).toBe(74);
  });
});
