// Packages
import React, { use, useMemo, useState } from 'react';
import get from 'lodash/get';
import PlitziSdk from '@plitzi/plitzi-sdk';
import Button from '@plitzi/plitzi-ui-components/Button';
import ContainerAutoScale from '@plitzi/plitzi-ui-components/ContainerAutoScale';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Dropdown from '@plitzi/plitzi-ui-components/Dropdown';
import Modal from '@plitzi/plitzi-ui-components/Modal';
import useModal from '@plitzi/plitzi-ui-components/Modal/useModal';

// Monorepo
import EventBridgeContext from '@plitzi/sdk-event-bridge/EventBridgeContext';
import { EventBridgeTypes, EventBridgeModuleTypes } from '@plitzi/sdk-event-bridge/EventBridgeHelper';
import FlatMap from '@plitzi/sdk-schema/FlatMap';

// Alias
import TemplateForm from '@pmodules/Templates/Models/TemplateForm';
import NetworkContext from '@pmodules/Network/NetworkContext';

// Relatives
import TemplatesContext from './TemplatesContext';

/** @returns {React.ReactElement} */
const Templates = () => {
  const { showModal } = useModal();
  const [filter, setFilter] = useState('');
  const { eventBridge } = use(EventBridgeContext);
  const { templates, templatesAddMutation, templatesUpdateMutation, templatesRemoveMutation } = use(TemplatesContext);
  const { webKey, server } = use(NetworkContext);

  const handleDragStart = template => e => {
    e.stopPropagation();
    eventBridge.emit(EventBridgeModuleTypes.BUILDER, EventBridgeTypes.BUILDER_SET_SELECTED, null);
    const flat = get(template, 'schema.flat', {});
    const variables = get(template, 'schema.variables', []);
    const templateBaseElementId = get(template, 'definition.baseElementId');
    const itemsToAdd = FlatMap.getNested(templateBaseElementId, flat);
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
  };

  const handleChange = e => setFilter(e.target.value);

  const handleClickAddTemplate = async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Add Template</h4>
      </Modal.Header>,
      <Modal.Body>
        <TemplateForm />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const {
        data: { name, description }
      } = response;
      await templatesAddMutation(name, description);
    }
  };

  const handleClickUpdateTemplate = template => async () => {
    const {
      definition: { name, description }
    } = template;
    const response = await showModal(
      <Modal.Header>
        <h4>Update Template</h4>
      </Modal.Header>,
      <Modal.Body>
        <TemplateForm name={name} description={description} />
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: false }
    );

    if (response.result) {
      const {
        data: { name, description }
      } = response;
      await templatesUpdateMutation({
        ...template,
        definition: { ...template.definition, name, description }
      });
    }
  };

  const handleClickRemove = id => async () => {
    const response = await showModal(
      <Modal.Header>
        <h4>Remove Template</h4>
      </Modal.Header>,
      <Modal.Body>
        <div className="p-4">
          <h4>Do you want to remove this item ?</h4>
        </div>
      </Modal.Body>,
      null,
      { placement: 'center', renderFooter: true }
    );

    if (response.result) {
      await templatesRemoveMutation(id);
    }
  };

  const templatesMemo = useMemo(() => {
    const templatesFiltered = Object.values(templates).filter(template => {
      return template.definition.name.toLowerCase().includes(filter.toLowerCase());
    });

    const temp = [];
    templatesFiltered.forEach(template => {
      const {
        schema: { flat, variables },
        style
      } = template;

      temp.push({
        ...template,
        offlineData: { style, schema: { settings: { title: 'Default', customCss: '' }, flat, variables } }
      });
    });

    return temp;
  }, [templates, filter]);

  return (
    <div className="w-full flex flex-col overflow-y-auto grow basis-0">
      <Button
        intent="custom"
        size="custom"
        onClick={handleClickAddTemplate}
        className="px-4 py-3 bg-gray-600 text-white"
      >
        <i className="fas fa-cube fa-2x mr-4" />
        Add Template
      </Button>
      <div className="px-4 my-2">
        <FormControl value={filter} type="text" placeholder="Search Templates" onChange={handleChange} />
      </div>
      <div className="flex flex-col items-center overflow-auto px-4">
        {templatesMemo &&
          templatesMemo.map(template => {
            const {
              id,
              definition: { name, baseElementId },
              offlineData
            } = template;

            return (
              <div
                key={id}
                className="group flex flex-col w-full my-2 cursor-grabbing"
                onDragStart={handleDragStart(template)}
                draggable
              >
                <div className="flex flex-col relative overflow-hidden rounded-lg border">
                  <ContainerAutoScale className="page-list-item__content flex items-center justify-center h-[150px] w-full overflow-hidden">
                    <PlitziSdk
                      className="h-full w-full pointer-events-none"
                      offlineMode
                      renderMode="widget"
                      currentPageId={baseElementId}
                      previewMode={false}
                      offlineData={offlineData}
                      server={server}
                      webKey={webKey}
                    />
                  </ContainerAutoScale>
                  <div className="hidden group-hover:flex">
                    <div className="bg-black opacity-50 absolute top-0 bottom-0 left-0 right-0" />
                    <div className="flex bg-white rounded-lg absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]">
                      <div className="py-2 px-4 text-blue-400 w-full flex items-center font-bold select-none text-center">
                        {name}
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0">
                    <Dropdown showIcon={false} containerTopOffset={5} containerLeftOffset={0}>
                      <Dropdown.Content>
                        <div className="h-7 w-8 hover:text-blue-400 flex items-center justify-center border-b border-l rounded-bl-lg bg-white ">
                          <i className="fa-solid fa-ellipsis" />
                        </div>
                      </Dropdown.Content>
                      <Dropdown.Container className="rounded-none rounded-tl-lg rounded-bl-lg">
                        <div className="flex flex-col">
                          <Button
                            intent="custom"
                            size="custom"
                            className="h-7 w-8 hover:text-blue-400"
                            title="Settings"
                            onClick={handleClickUpdateTemplate(template)}
                          >
                            <i className="fas fa-cog" />
                          </Button>
                          <Button
                            intent="custom"
                            size="custom"
                            className="h-7 w-8 text-red-400 hover:text-red-500"
                            title="Remove"
                            onClick={handleClickRemove(id)}
                          >
                            <i className="fas fa-trash-alt" />
                          </Button>
                        </div>
                      </Dropdown.Container>
                    </Dropdown>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default Templates;
