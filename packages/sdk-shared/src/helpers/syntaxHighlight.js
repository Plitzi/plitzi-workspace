const regexCallback = match => {
  let cls = 'number';
  if (/^"/.test(match)) {
    if (/:$/.test(match)) {
      cls = 'text-red-700';
    } else {
      cls = 'text-green-700';
    }
  } else if (/true|false/.test(match)) {
    cls = 'text-blue-700';
  } else if (/null/.test(match)) {
    cls = '';
  }

  return `<span class="${cls}">${match}</span>`;
};

const regexJson =
  /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

const syntaxHighlight = json => json.replace(regexJson, regexCallback);

export default syntaxHighlight;
