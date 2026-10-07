# The shape of a good call

Everything the widget needs travels in ONE call, as `operations`. Three ops carry almost every widget:

- **`upsertDefinitions`** — declare ALL the CSS classes at once, one class per *look* (not per property).
- **`upsertElement`** — build the whole tree in a single op, nesting with `children` under `pageRef: "render"`.
- **`repeatElement`** — the moment two siblings differ only in data, write the row ONCE as a template with
  `{{item.field}}` placeholders and pass `items`. Rows come out numbered (`tile-1`, `tile-2`…). A list inside each
  row is the same op: give a template node `repeat: { items: "{{item.<field>}}", template: … }`.

```json
{
  "operations": [
    {
      "type": "upsertDefinitions",
      "definitions": {
        "panel": {
          "desktop": {
            "display": "flex",
            "flex-direction": "column",
            "gap": "12px",
            "padding": "16px",
            "color": "var(--color-text-primary, light-dark(#0f172a, #e8eaed))"
          }
        },
        "row": {
          "desktop": { "display": "flex", "flex-wrap": "wrap", "gap": "12px" },
          "mobile": { "flex-direction": "column" }
        },
        "tile": {
          "desktop": {
            "flex": "1 1 0%",
            "min-width": "160px",
            "padding": "12px",
            "border-radius": "10px",
            "border": "1px solid var(--color-border-primary, light-dark(#e2e8f0, #333a48))",
            "background-color": "var(--color-background-secondary, light-dark(#ffffff, #1f2430))"
          }
        },
        "tile-title": { "desktop": { "margin": "0", "font-size": "15px" } },
        "tile-price": { "desktop": { "margin": "0", "font-size": "13px", "opacity": "0.75" } }
      }
    },
    {
      "type": "upsertElement",
      "pageRef": "render",
      "element": {
        "ref": "panel",
        "type": "container",
        "style": { "base": ["panel"] },
        "children": [{ "ref": "title", "type": "heading", "subType": "h3", "props": { "content": "Plans" } }]
      }
    },
    {
      "type": "repeatElement",
      "pageRef": "render",
      "parentRef": "panel",
      "ref": "plans",
      "style": { "base": ["row"] },
      "template": {
        "ref": "tile",
        "type": "container",
        "style": { "base": ["tile"] },
        "children": [
          {
            "ref": "name",
            "type": "heading",
            "subType": "h4",
            "props": { "content": "{{item.name}}" },
            "style": { "base": ["tile-title"] }
          },
          {
            "ref": "price",
            "type": "paragraph",
            "props": { "content": "{{item.price}}" },
            "style": { "base": ["tile-price"] }
          }
        ]
      },
      "items": [
        { "name": "Starter", "price": "$0 / month" },
        { "name": "Team", "price": "$19 / month" },
        { "name": "Business", "price": "$49 / month" }
      ]
    }
  ]
}
```
