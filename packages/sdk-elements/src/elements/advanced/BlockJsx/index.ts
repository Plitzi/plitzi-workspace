import BaseBlockJsx from './BlockJsx';

const BlockJsx = Object.assign(BaseBlockJsx, {
  type: 'blockJsx',
  content: {
    attributes: {
      content:
        'import { useCallback } from "react";\nimport { JsxManager } from "@plitzi/plitzi-sdk";\n\nconst BlockJsx = ({ internalProps, content, content2 }) => {\n  const handleClick = useCallback(() => {\n    alert("Hello World");\n  }, []);\n\n  return (\n    <div style={{ display: "flex", gap: "4px" }}>\n      <JsxManager\n        as="Heading"\n        internalProps={internalProps}\n        content={`${content} ${content2}`}\n      />\n      <button onClick={handleClick} style={{ border: "1px gray solid", cursor: "pointer" }}>\n        Click Me\n      </button>\n    </div>\n  );\n};\n\nexport default BlockJsx;',
      props: '{"content": "Hello", "content2": "World"}',
      contentCache:
        'aW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnOwppbXBvcnQgeyB1c2VDYWxsYmFjayB9IGZyb20gInJlYWN0IjsKaW1wb3J0IHsgSnN4TWFuYWdlciB9IGZyb20gIkBwbGl0emkvcGxpdHppLXNkayI7CnZhciBCbG9ja0pzeCA9IGZ1bmN0aW9uIEJsb2NrSnN4KF9yZWYpIHsKICB2YXIgaW50ZXJuYWxQcm9wcyA9IF9yZWYuaW50ZXJuYWxQcm9wcywKICAgIGNvbnRlbnQgPSBfcmVmLmNvbnRlbnQsCiAgICBjb250ZW50MiA9IF9yZWYuY29udGVudDI7CiAgdmFyIGhhbmRsZUNsaWNrID0gdXNlQ2FsbGJhY2soZnVuY3Rpb24gKCkgewogICAgYWxlcnQoIkhlbGxvIFdvcmxkIik7CiAgfSwgW10pOwogIHJldHVybiAvKiNfX1BVUkVfXyovUmVhY3QuY3JlYXRlRWxlbWVudCgiZGl2IiwgewogICAgc3R5bGU6IHsKICAgICAgZGlzcGxheTogImZsZXgiLAogICAgICBnYXA6ICI0cHgiCiAgICB9CiAgfSwgLyojX19QVVJFX18qL1JlYWN0LmNyZWF0ZUVsZW1lbnQoSnN4TWFuYWdlciwgewogICAgYXM6ICJIZWFkaW5nIiwKICAgIGludGVybmFsUHJvcHM6IGludGVybmFsUHJvcHMsCiAgICBjb250ZW50OiAiIi5jb25jYXQoY29udGVudCwgIiAiKS5jb25jYXQoY29udGVudDIpCiAgfSksIC8qI19fUFVSRV9fKi9SZWFjdC5jcmVhdGVFbGVtZW50KCJidXR0b24iLCB7CiAgICBvbkNsaWNrOiBoYW5kbGVDbGljaywKICAgIHN0eWxlOiB7CiAgICAgIGJvcmRlcjogIjFweCBncmF5IHNvbGlkIiwKICAgICAgY3Vyc29yOiAncG9pbnRlcicKICAgIH0KICB9LCAiQ2xpY2sgTWUiKSk7Cn07CmV4cG9ydCBkZWZhdWx0IEJsb2NrSnN4Ow==',
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
      style: {
        base: {
          default: {}
        }
      }
    },
    settings: {}
  }
});

export default BlockJsx;
