const routeParamsParserToCollection = params => {
  const paramsParsed = {};
  Object.keys(params).forEach(paramKey => {
    paramsParsed[paramKey] = { eq: params[paramKey] };
  });

  return paramsParsed;
};

export { routeParamsParserToCollection };
