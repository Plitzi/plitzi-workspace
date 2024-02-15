// Packages
import upperFirst from 'lodash/upperFirst';
import set from 'lodash/set';
import pick from 'lodash/pick';
import get from 'lodash/get';
import omit from 'lodash/omit';
import { produce } from 'immer';

// Monorepo
import EventBridge from '@repo/event-bridge-shared';

// Alias
import FlatMap from '@modules/Schema/SchemaHelper';

class DataSourceManager {
  constructor(dataSource = {}) {
    this.dataSources = dataSource;
    this.rootId = undefined;
    this.schema = undefined;
    this.parentManager = undefined;
    this.childManagers = [];
    this.eventBridge = new EventBridge();
  }

  // basic

  triggerCallback = data => {
    const { referenceId } = data;
    const [id, uniqueId] = referenceId.split('-');
    if (!id || !uniqueId) {
      throw new Error('Id cannot be empty');
    }

    const currentTime = new Date().getTime();
    let childIds = Object.keys(get(this.eventBridge, 'events.dataSource-receiver', {}));
    if (this.schema?.flat && id !== 'global') {
      childIds = FlatMap.getChildTree(this.schema.flat, id);
    }

    this.eventBridge.emit('dataSource-receiver', childIds, currentTime);
    this.childManagers
      .filter(manager => id === 'global' || childIds.includes(manager.rootId))
      .forEach(manager => manager.triggerCallback({ referenceId }));
  };

  registerSource(referenceId, source, name, value = undefined, fields = []) {
    const [id, uniqueId] = referenceId.split('-');
    if (!id || !uniqueId) {
      throw new Error('Id cannot be empty');
    }

    this.dataSources = produce(this.dataSources, draft => {
      set(draft, `${id}.${source}`, { name: upperFirst(name), fields, uniqueId, value });
    });

    this.eventBridge.on('dataSource-source', referenceId, this.triggerCallback);
  }

  updateSource(referenceId, source, name) {
    const [id, uniqueId] = referenceId.split('-');
    if (!id || !uniqueId) {
      throw new Error('Id cannot be empty');
    }

    const item = get(this.dataSources, id);
    if (item && item[source] && get(item, `${source}.uniqueId`) === uniqueId) {
      this.dataSources = produce(this.dataSources, draft => {
        set(draft, `${id}.${source}.name`, upperFirst(name));
      });
    }
  }

  refreshSourceFields(id, source, fields = []) {
    const item = get(this.dataSources, id);
    if (item && item[source]) {
      this.dataSources = produce(this.dataSources, draft => {
        set(draft, `${id}.${source}.fields`, fields);
      });
    }
  }

  setSourceValue(referenceId, source, value) {
    const [id, uniqueId] = referenceId.split('-');
    if (!id || !uniqueId) {
      throw new Error('Id cannot be empty');
    }

    const currentValue = get(this.dataSources, `${id}.${source}.value`);
    if (currentValue === value) {
      return false;
    }

    this.dataSources = produce(this.dataSources, draft => {
      set(draft, `${id}.${source}.value`, value);
    });

    return true;
  }

  getParentSources(extraElements = [], asValues = true) {
    if (this.parentManager) {
      return this.parentManager.getSources(this.rootId, [...extraElements, this.rootId], asValues);
    }

    return {};
  }

  getSources(id, extraElements = [], asValues = true) {
    const sourceIds = ['global'];
    if (id && this.schema?.flat) {
      sourceIds.push(...FlatMap.getParentTree(this.schema.flat, id));
    }

    if (Array.isArray(extraElements) && extraElements.length > 0) {
      sourceIds.push(...extraElements);
    }

    const sources = pick(this.dataSources, sourceIds);
    const parentSources = this.getParentSources(extraElements, asValues);

    return {
      ...parentSources,
      ...Object.keys(sources).reduce((acum, parentId) => {
        const source = sources[parentId];
        if (!source) {
          return acum;
        }

        return {
          ...acum,
          ...Object.keys(source).reduce((acum2, sourceKey) => {
            if (asValues) {
              return { ...acum2, [sourceKey]: get(source, `${sourceKey}.value`, {}) };
            }

            return { ...acum2, [sourceKey]: get(source, sourceKey, {}) };
          }, {})
        };
      }, {})
    };
  }

  unregisterSource(referenceId, source) {
    const [id, uniqueId] = referenceId.split('-');
    if (!get(this.dataSources, `${id}.${source}`) || get(this.dataSources, `${id}.${source}.uniqueId`) !== uniqueId) {
      return;
    }

    this.dataSources = omit(this.dataSources, [`${id}.${source}`]);
    const dataSource = get(this.dataSources, id);
    if (dataSource && Object.keys(dataSource).length === 0) {
      this.dataSources = omit(this.dataSources, [id]);
    }

    this.eventBridge.off('source', referenceId);
  }

  // receiver

  registerReceiver = (referenceId, retrigger) => {
    const [id, uniqueId] = referenceId.split('-');
    if (!id || !uniqueId) {
      throw new Error('Id cannot be empty');
    }

    this.eventBridge.on('dataSource-receiver', id, retrigger);
  };

  refreshReceivers(referenceId) {
    const [id, uniqueId] = referenceId.split('-');
    if (!id || !uniqueId) {
      throw new Error('Id cannot be empty');
    }

    this.eventBridge.emit('dataSource-source', referenceId, { referenceId });
  }

  unregisterReceiver = (referenceId, retrigger) => {
    const [id, uniqueId] = referenceId.split('-');
    if (!id || !uniqueId) {
      throw new Error('Id cannot be empty');
    }

    this.eventBridge.off('dataSource-receiver', id, retrigger);
  };

  // child managers

  createChildManager = (id, schema, dataSource) => {
    const childManager = new DataSourceManager(dataSource);
    childManager.schema = schema ?? this.schema;
    childManager.rootId = id;
    childManager.parentManager = this;
    this.childManagers.push(childManager);

    return childManager;
  };

  removeChildManager = childManager => {
    this.childManagers = this.childManagers.filter(manager => manager !== childManager);
  };
}

export default DataSourceManager;
