// src/plugins/ServerInfo.tsx
import { RootElement, useRscData } from "@plitzi/plitzi-sdk";

// src/plugins/styles.ts
var palette = {
  server: { background: "#f0fdf4", border: "#86efac", title: "#15803d" },
  client: { background: "#eff6ff", border: "#93c5fd", title: "#1d4ed8" },
  shared: { background: "#faf5ff", border: "#c4b5fd", title: "#7e22ce" }
};
var card = (tone) => ({
  padding: "1.25rem 1.5rem",
  borderRadius: "10px",
  background: palette[tone].background,
  border: `1px solid ${palette[tone].border}`,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.82rem",
  lineHeight: 1.65,
  marginBottom: "0.5rem"
});
var title = (tone) => ({
  fontWeight: 700,
  color: palette[tone].title,
  marginBottom: "0.75rem",
  fontSize: "0.88rem"
});
var row = { display: "flex", gap: "0.5rem", marginBottom: "0.15rem" };
var label = { color: "#6b7280", minWidth: "130px", flexShrink: 0 };

// src/plugins/ServerInfo.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var ServerInfo = () => {
  const { loaded, elementData } = useRscData();
  if (!loaded || !elementData) {
    return /* @__PURE__ */ jsxs(RootElement, { style: card("server"), children: [
      /* @__PURE__ */ jsx("div", { style: title("server"), children: '\u{1F5A5} Server Info \u2014 runtime: "server"' }),
      /* @__PURE__ */ jsx("span", { style: { color: "#9ca3af" }, children: "No slice for this element yet." })
    ] });
  }
  return /* @__PURE__ */ jsxs(RootElement, { style: card("server"), children: [
    /* @__PURE__ */ jsx("div", { style: title("server"), children: '\u{1F5A5} Server Info \u2014 runtime: "server"' }),
    /* @__PURE__ */ jsxs("div", { style: row, children: [
      /* @__PURE__ */ jsx("span", { style: label, children: "Message" }),
      /* @__PURE__ */ jsx("span", { children: elementData.message })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: row, children: [
      /* @__PURE__ */ jsx("span", { style: label, children: "Rendered at" }),
      /* @__PURE__ */ jsx("span", { children: elementData.renderedAt })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: row, children: [
      /* @__PURE__ */ jsx("span", { style: label, children: "Node.js" }),
      /* @__PURE__ */ jsx("span", { children: elementData.nodeVersion })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: row, children: [
      /* @__PURE__ */ jsx("span", { style: label, children: "Signed in" }),
      /* @__PURE__ */ jsx("span", { children: elementData.authenticated ? "yes" : "no" })
    ] })
  ] });
};
var ServerInfo_default = ServerInfo;
export {
  ServerInfo_default as default
};
