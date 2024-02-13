const callback = ({ time }) =>
  new Promise(res => {
    setTimeout(res, time);
  });

const delayTime = {
  action: 'delayTime',
  title: 'Delay Time',
  type: 'utility',
  params: { time: {label: 'Time (Milliseconds)'} },
  preview: {},
  callback
};

export default delayTime;
