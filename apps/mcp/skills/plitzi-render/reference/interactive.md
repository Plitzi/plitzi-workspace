# Making it interactive

Widgets are not only static: `upsertInteractionFlow` attaches a flow to an element — a `trigger` node first
(`onClick`), then the steps that run after it, in order.

**To show and hide, use `toggleState`.** Every element registers `setState` and `toggleState` as `callback`
actions, and `elementId` names the element they act on — the flow's own element by default, or another element's
ref to act on that one. `toggleState` with `category: "state"` and `key: "visibility"` is the show/hide toggle;
there is no separate `toggleVisibility` action. The element starts hidden with `initialState: { "visibility":
false }` on the element itself.

```json
{
  "operations": [
    {
      "type": "upsertElement",
      "pageRef": "render",
      "element": {
        "ref": "card",
        "type": "container",
        "children": [
          { "ref": "card-head", "type": "button", "props": { "content": "Details" } },
          {
            "ref": "card-body",
            "type": "container",
            "initialState": { "visibility": false },
            "children": [
              { "ref": "card-text", "type": "paragraph", "props": { "content": "The hidden detail." } }
            ]
          }
        ]
      }
    },
    {
      "type": "upsertInteractionFlow",
      "pageRef": "render",
      "ref": "card-head",
      "nodes": [
        { "title": "On click", "nodeType": "trigger", "action": "onClick" },
        {
          "title": "Toggle body",
          "nodeType": "callback",
          "action": "toggleState",
          "elementId": "card-body",
          "params": { "category": "state", "key": "visibility" }
        }
      ]
    }
  ]
}
```

Expand/collapse is **one step on one trigger** — never two `setState` branches under opposite `when` conditions,
which read the state as it was when the flow started and so are always one click behind. For several flows on one
element (an `onClick` and an `onMouseEnter`, or two independent clicks), call `upsertInteractionFlow` again with
the same `ref` and **omit `flowId`**; passing an existing `flowId` replaces that flow instead.

Two things routinely go wrong. Events **bubble**, so a clickable element inside another clickable element runs
BOTH flows — put the trigger on one of them (the render warns you and names the pair). And a `globalCallback`
(`addNotification`, `navigate`, app-level `setState`) is provided by a module, not by an element, so **omit
`elementId`** on those; a step with the wrong node type resolves against nothing and silently does nothing.

For data-driven widgets, an `apiContainer` fetches at runtime and `upsertBinding` wires the result into elements —
see "Data & interactivity" in `plitzi://render/guide`, which is also the full reference for everything above.
