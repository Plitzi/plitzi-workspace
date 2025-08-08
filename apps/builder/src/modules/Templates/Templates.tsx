/* eslint-disable @typescript-eslint/no-dynamic-delete */
import Button from '@plitzi/plitzi-ui/Button';
import Flex from '@plitzi/plitzi-ui/Flex';
import Input from '@plitzi/plitzi-ui/Input';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import get from 'lodash/get';
import { use, useCallback, useMemo, useState } from 'react';

import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import FlatMap from '@plitzi/sdk-schema/helpers/FlatMap';
import TemplateForm from '@pmodules/Templates/Models/TemplateForm';

import Template from './Template';
import TemplatesContext from './TemplatesContext';

import type { Template as TTemplate } from './TemplatesContext';
import type { Schema, Style } from '@plitzi/sdk-shared';
import type { DragEvent } from 'react';

const Templates = () => {
  const { showModal, showDialog } = useModal();
  const [filter, setFilter] = useState('');
  const { eventBridge } = use(EventBridgeContext);
  const { templates, templatesAddMutation, templatesUpdateMutation, templatesRemoveMutation } = use(TemplatesContext);

  const handleDragStart = useCallback(
    (template: TTemplate) => (e: DragEvent) => {
      e.stopPropagation();
      void eventBridge.emit('builder', 'builderSetSelected', null);
      const flat = get(template, 'schema.flat', {});
      const variables = get(template, 'schema.variables', []);
      const templateBaseElementId = get(template, 'definition.baseElementId', '');
      const itemsToAdd = FlatMap.cloneElements(flat, templateBaseElementId);
      if (!itemsToAdd.item) {
        return;
      }

      delete itemsToAdd.acum[itemsToAdd.item.id];
      e.dataTransfer.setDragImage(e.currentTarget.getElementsByClassName('page-list-item__content')[0], -5, -5);
      e.dataTransfer.setData(
        'add##plitzi-template',
        JSON.stringify({
          elements: itemsToAdd.acum,
          baseElement: itemsToAdd.item,
          style: get(template, 'style', {}),
          variables
        })
      );
    },
    [eventBridge]
  );

  const handleChange = useCallback((value: string) => setFilter(value), []);

  const handleClickAddTemplate = async () => {
    const response = await showModal<{ name: string; description?: string }>(
      <Modal.Header>
        <h4>Add Template</h4>
      </Modal.Header>,
      ({ onSubmit, onClose }) => (
        <Modal.Body>
          <TemplateForm onSubmit={onSubmit} onClose={onClose} />
        </Modal.Body>
      )
    );

    if (response) {
      const { name, description } = response;
      void templatesAddMutation(name, description ?? '');
    }
  };

  const handleClickUpdateTemplate = useCallback(
    (template: TTemplate) => async () => {
      const {
        definition: { name, description }
      } = template;
      const response = await showModal<{ name: string; description?: string }>(
        <Modal.Header>
          <h4>Update Template</h4>
        </Modal.Header>,
        ({ onSubmit, onClose }) => (
          <Modal.Body>
            <TemplateForm onSubmit={onSubmit} onClose={onClose} name={name} description={description} />
          </Modal.Body>
        )
      );

      if (response) {
        const { name, description } = response;
        void templatesUpdateMutation({
          ...template,
          definition: { ...template.definition, name, description: description ?? '' }
        });
      }
    },
    [showModal, templatesUpdateMutation]
  );

  const handleClickRemove = useCallback(
    (id?: string) => async () => {
      if (!id) {
        return;
      }

      const response = await showDialog(
        <Modal.Header>
          <h4>Remove Template</h4>
        </Modal.Header>,
        <Modal.Body>
          <div className="p-4">
            <h4>Do you want to remove this item ?</h4>
          </div>
        </Modal.Body>,
        undefined,
        undefined,
        id
      );

      if (response) {
        void templatesRemoveMutation(id);
      }
    },
    [showDialog, templatesRemoveMutation]
  );

  const templatesMemo = useMemo(() => {
    const templatesFiltered = Object.values(templates).filter(template => {
      return template.definition.name.toLowerCase().includes(filter.toLowerCase());
    });

    const temp: (TTemplate & { offlineData: { style: Style; schema: Schema } })[] = [];
    templatesFiltered.forEach(template => {
      const {
        schema: { flat, variables },
        style
      } = template;

      temp.push({
        ...template,
        offlineData: { style, schema: { settings: { customCss: '' }, flat, variables, pages: [], pageFolders: [] } }
      });
    });

    return temp;
  }, [templates, filter]);

  return (
    <div className="flex w-full grow basis-0 flex-col gap-3 overflow-y-auto">
      <Flex gap={2} direction="column">
        <Button size="sm" onClick={handleClickAddTemplate} iconPlacement="before">
          <Button.Icon icon="fa-solid fa-plus" />
          New Template
        </Button>
        <Input placeholder="Search Variables" value={filter} onChange={handleChange} label="">
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
      </Flex>
      <div className="h-px bg-gray-200" />
      <div className="flex flex-col items-center overflow-auto px-4">
        {templatesMemo.map(template => {
          const {
            id,
            definition: { name, baseElementId },
            offlineData: { schema, style }
          } = template;

          return (
            <Template
              key={id}
              name={name}
              baseElementId={baseElementId}
              schema={schema}
              style={style}
              onDragStart={handleDragStart(template)}
              onSettings={handleClickUpdateTemplate(template)}
              onRemove={handleClickRemove(id)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Templates;
