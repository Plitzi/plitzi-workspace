const { createContext } = require('react');

const NavigationContext = createContext({});
const CollectionContext = createContext({});
const plitziSdkFederation = createContext({});
const DataSourceContext = createContext({})

module.exports = {
  __esModule: true,
  default: jest.fn(() => ({ CollectionContext, NavigationContext, DataSourceContext })),
  PlitziServiceProvider: plitziSdkFederation.Provider
};
