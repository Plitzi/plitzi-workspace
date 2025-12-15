import BaseBlockJsx from './BlockJsx';

const BlockJsx = Object.assign(BaseBlockJsx, {
  type: 'blockJsx',
  content: {
    attributes: {
      content:
        'import { useCallback } from "react";\nimport { JsxManager } from "@plitzi/plitzi-sdk";\n\nconst BlockJsx = ({ internalProps, content, content2 }) => {\n  const handleClick = useCallback(() => {\n    alert("Hello World");\n  }, []);\n\n  return (\n    <div style={{ display: "flex", gap: "4px" }}>\n      <JsxManager\n        as="Heading"\n        internalProps={internalProps}\n        content={`${content} ${content2}`}\n      />\n      <button onClick={handleClick} style={{ border: "1px gray solid", cursor: "pointer" }}>\n        Click Me\n      </button>\n    </div>\n  );\n};\n\nexport default BlockJsx;',
      props: '{"content": "Hello", "content2": "World"}',
      contentCache:
        'aW1wb3J0IHsgdXNlQ2FsbGJhY2sgfSBmcm9tICJyZWFjdCI7CmltcG9ydCB7IEpzeE1hbmFnZXIgfSBmcm9tICJAcGxpdHppL3BsaXR6aS1zZGsiOwoKY29uc3QgQmxvY2tKc3ggPSAoeyBpbnRlcm5hbFByb3BzLCBjb250ZW50LCBjb250ZW50MiB9KSA9PiB7CiAgY29uc3QgaGFuZGxlQ2xpY2sgPSB1c2VDYWxsYmFjaygoKSA9PiB7CiAgICBhbGVydCgiSGVsbG8gV29ybGQiKTsKICB9LCBbXSk7CgogIHJldHVybiAoCiAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICJmbGV4IiwgZ2FwOiAiNHB4IiB9fT4KICAgICAgPEpzeE1hbmFnZXIKICAgICAgICBhcz0iSGVhZGluZyIKICAgICAgICBpbnRlcm5hbFByb3BzPXtpbnRlcm5hbFByb3BzfQogICAgICAgIGNvbnRlbnQ9e2Ake2NvbnRlbnR9ICR7Y29udGVudDJ9YH0KICAgICAgLz4KICAgICAgPGJ1dHRvbiBvbkNsaWNrPXtoYW5kbGVDbGlja30gc3R5bGU9e3sgYm9yZGVyOiAiMXB4IGdyYXkgc29saWQiLCBjdXJzb3I6ICJwb2ludGVyIiB9fT4KICAgICAgICBDbGljayBNZQogICAgICA8L2J1dHRvbj4KICAgIDwvZGl2PgogICk7Cn07CgpleHBvcnQgZGVmYXVsdCBCbG9ja0pzeDs=',
      allowEmptyRender: false
    },
    definition: {
      label: 'Block JSX',
      type: 'blockJsx',
      bindings: {},
      styleSelectors: {
        base: ''
      },
      initialState: {
        visibility: true
      }
    },
    builder: {
      canDelete: true,
      canSelect: true,
      canDragDrop: true,
      canMove: true,
      canTemplate: true,
      itemsAllowed: [],
      itemsNotAllowed: []
    },
    market: {
      category: 'advanced',
      owner: 'Plitzi',
      verified: true,
      license: 'MIT',
      website: 'https://plitzi.com',
      backgroundColor: '#4422ee',
      icon: 'fa-solid fa-code'
    },
    defaultStyle: {
      name: 'Block JSX',
      displayMode: 'desktop',
      style: {}
    },
    settings: {}
  }
});

export default BlockJsx;
