let PlitziLogInternal;
const setPlitziLog = callback => {
  PlitziLogInternal = callback;
};

const PlitziLog = (...args) => {
  if (!PlitziLogInternal) {
    return;
  }

  PlitziLogInternal(...args);
};

export default PlitziLog;

export { setPlitziLog };
