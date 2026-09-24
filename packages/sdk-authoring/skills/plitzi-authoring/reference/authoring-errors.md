# When `authorSpace` refuses

`authorSpace` checks the whole declaration before it writes anything, and stops at the first thing that would not
render as written. The message names the element (`Element "text" (price) at shop/home/0/2`) and what to write
instead. **Do what the message says.** Never cast past a check, silence it, or move the logic into a plugin to avoid
it — the check exists because that declaration renders something other than what it says.

The one exception is a TEST fixture whose subject is the break itself — how the runtime copes with a document no author
would write. It names that break, and only that one: `authorSpace(spec, { allow: [{ code, element, why }] })`. See
[testing](testing.md#spaces-written-for-a-test). A space anybody visits never has an `allow`.

## Refused

| The message says | What was wrong | Write instead |
| --- | --- | --- |
| `has "x", which it does not take` | a field the space, a page, an element, a binding or a step does not have | the field it suggests; an element's attribute goes inside the factory's props (`button({ content })`) |
| `sets "x", which a "button" never reads` | an attribute the element does not have | one it lists; an event (`onClick`) is a flow: `flows: [[onClick(), …]]` |
| `` `subType` is "h7" … It is one of `` | a value outside the attribute's list | one of the listed values |
| `reads it as true or false` / `as a list` | text where a flag or a list is read | `disabled: true`, not `'true'`; `items: [ … ]` |
| `holds none` | children on a type that renders only its own attributes | a `container` (for a heading made of parts, `container({ subType: 'h1', children })`) |
| `the template … cannot be read as written` | a template with an operator, filter or function that does not exist, or broken syntax | see [templates](templates.md) for what exists; `matches` never does |
| `reads "x", which nothing here answers to` | a name in a template that is not a source, a variable or a route param | the full source name (`list_rows.item`), `navigation.queryParams.x` for a query param, `source` for the bound value |
| `is not around it` | a source read by an element that is not inside the element publishing it | move the element inside it, or share the value through `state` |
| `lands on "x", which a "text" never reads` | a binding onto an attribute the element does not have — the value arrives and nothing shows it | one it lists (`content`); to follow data with a class, bind `styleSelectors.base` in `initialState` |
| `no element answers to the name "x"` | a binding whose source names an element that does not exist | the id of the element that publishes it |
| `renders text — and "items" holds a list` | a text template feeding a list | `bindTemplate('items', src, '{{ … }}', { returns: 'value' })` |
| `does not start with its trigger` | a flow whose first step is not the event that runs it | `[onClick(), setState(…)]` |
| `step "x" has the param "y"` / `"type" is "string"` | a step param that does not exist or a value outside its options | the params and values it lists |
| `step "setState" sets "x" on "y", which a "z" never reads` | an element `setState`/`toggleState` writing a field the element does not have | an attribute it lists, or for `category: 'state'` `visibility` / `styleSelectors.<selector>` |
| `names the page "x", and no page has that id` | a link or `navigate` to a page id that does not exist | an existing page id, or a path with its slash (`'/about'`) |
| `a full URL, in page mode` | a URL, `mailto:` or `tel:` in a link left in page mode | `mode: 'external'` |
| `is a controlled list with no items` | a list with nothing to render | `items: [ … ]` or `bind: { items: 'provider.data.rows' }` |
| `answers at /x for the same visitors as page` | two pages at one address | another slug — or `accessLevel` `'public'` on one and `'authenticated'` on the other |
| `is not one CSS value` | an empty CSS value, or one with `;` or `{}` | one value per property; leave a property out instead of writing it empty |
| `computed … declared after it` / `does not compute` | a computed value read before it is declared, or never declared | declare it in `computed`, above the one that reads it |

## Warned

A warning means the space renders, and renders something you probably did not mean. Fix every one.

| Code | Meaning | Fix |
| --- | --- | --- |
| `condition-starts-visible` | a computed visibility shows until its data answers | `visible: { source, template }` |
| `template-never-resolved` | a condition in an attribute, used as written | move it into `bindTemplate` |
| `tablet-rule-skips-mobile` | a tablet rule phones never get | write it under `compact` |
| `default-content-beside-children` | a button prints "Button" beside its children | `content: ''` |
| `overlay-starts-open` | a modal or dialog is open when the page loads | `visible: false`, opened by `openModal` |
| `provider-without-source` | an `apiContainer` asks nothing | give it a `query` (or `action`, `connector`, `resource`) |
| `unknown-element-type` | a type no built-in element has | the built-in it suggests; a plugin's type goes in `authorSpace(space, { pluginTypes: ['name'] })` |
| `colour-without-dark` | a colour token with no dark value | `{ light, dark, default }` |
| `FORM_SUBMIT_UNMANAGED` | a form the browser would submit itself | `managedByInteractions: true` |
| `STYLE_WITHOUT_TAG` | style on a provider that renders no element | `subType: 'div'` on the provider, or style its parent |
| `server-data-without-rsc` | a `runtime: 'server'` provider with a `connector` or `action` in a space that does not turn server data on — it renders its mock data | `rsc: { enabled: true }` on the space |
| `route-param-undeclared` | `navigation.routeParams.x` read on a page whose slug has no `:x` — always empty | add `:x` to the slug, or read `navigation.queryParams.x` |
| `form-control-unnamed` | a control in a form with no `name` — its value never reaches `values` | `formControl({ name: 'email', … })` |
| `form-control-name-taken` | two controls in one form with one name — one overwrites the other | a name each |
| `overlay-never-opened` | a modal or dialog that starts hidden and that no step opens | a flow with `openModal('id')` / `openDialog('id')` |
