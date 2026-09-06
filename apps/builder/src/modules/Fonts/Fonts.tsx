import { ContainerTabs } from '@plitzi/plitzi-ui';
import Flex from '@plitzi/plitzi-ui/Flex';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { use, useCallback, useMemo } from 'react';

import BuilderContext from '@plitzi/sdk-shared/builder/contexts/BuilderContext';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { familiesInCss, primaryFamily } from '@plitzi/sdk-shared/style';

import AddGoogleFont from './components/AddGoogleFont';
import AddRemoteFont from './components/AddRemoteFont';
import AddSystemFont from './components/AddSystemFont';
import FontRow from './components/FontRow';

import type { SpaceFont } from '@plitzi/sdk-shared';

/** Module-level, so a space that declares nothing keeps one reference across every render. */
const NO_FONTS: SpaceFont[] = [];

const tabs = [{ label: 'Google' }, { label: 'External' }, { label: 'System' }];

/**
 * What this space loads, and where each family comes from.
 *
 * A space-level panel rather than something under an element's typography, because a font is a resource: it costs
 * a request, it belongs to the space, and the element inspector only ever picks from what is declared here.
 */
const Fonts = () => {
  const { showDialog } = useModal();
  const { addToast } = useToast();
  const { builderHandler } = use(BuilderContext);
  const [[fonts = NO_FONTS, cache = '']] = useBuilderStore(['style.fonts', 'style.cache']);

  /**
   * How many rules name each family.
   *
   * Read off the compiled stylesheet, which is the only place that knows: a family is named by selectors all over
   * the space, and dropping one that is in use does not break those rules — it drops them to their fallback, which
   * is worth saying out loud before it happens.
   */
  const uses = useMemo(() => {
    const named = familiesInCss(cache).map(family => primaryFamily(family));

    return named.reduce<Record<string, number>>((acum, family) => ({ ...acum, [family]: (acum[family] ?? 0) + 1 }), {});
  }, [cache]);

  const declared = useMemo(() => fonts.map(font => font.family), [fonts]);

  const handleAdd = useCallback(
    (font: SpaceFont) => {
      if (fonts.some(item => item.family === font.family)) {
        addToast(
          <span>
            <b>{font.family}</b> is already declared
          </span>,
          { appeareance: 'warning', autoDismiss: true, placement: 'top-right' }
        );

        return;
      }

      builderHandler('styleAddFont', font);
    },
    [addToast, builderHandler, fonts]
  );

  const handleRemove = useCallback(
    async (family: string) => {
      const used = uses[family] ?? 0;
      const response = await showDialog(
        <Modal.Header>
          <h4>Stop loading {family}?</h4>
        </Modal.Header>,
        <Modal.Body>
          {used > 0 ? (
            <p>
              {used} rule{used === 1 ? '' : 's'} still name this family. They will keep their declaration and render in
              the fallback, because nothing will be loading the face any more.
            </p>
          ) : (
            <p>Nothing in this space names it.</p>
          )}
        </Modal.Body>,
        undefined,
        { size: 'sm' },
        family
      );

      if (response) {
        builderHandler('styleRemoveFont', family);
      }
    },
    [builderHandler, showDialog, uses]
  );

  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <Flex direction="column" gap={1} className="max-h-[45%] min-h-0 overflow-y-auto">
        {fonts.length === 0 && (
          <span className="text-grayviolet-500 text-xs">
            This space declares no font of its own, so it renders in the stacks every machine already has.
          </span>
        )}
        {fonts.map(font => (
          <FontRow key={font.family} font={font} uses={uses[font.family] ?? 0} onRemove={handleRemove} />
        ))}
      </Flex>
      <ContainerTabs className="min-h-0 grow basis-0 gap-4" size="xs">
        <ContainerTabs.Tabs items={tabs} />
        <ContainerTabs.TabContent className="min-h-0 grow basis-0">
          <AddGoogleFont declared={declared} onAdd={handleAdd} />
        </ContainerTabs.TabContent>
        <ContainerTabs.TabContent>
          <AddRemoteFont onAdd={handleAdd} />
        </ContainerTabs.TabContent>
        <ContainerTabs.TabContent>
          <AddSystemFont onAdd={handleAdd} />
        </ContainerTabs.TabContent>
      </ContainerTabs>
    </div>
  );
};

export default Fonts;
