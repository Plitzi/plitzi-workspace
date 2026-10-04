// src/plugins/ClientInfo.tsx
import { useEffect, useState } from "react";
import { RootElement } from "@plitzi/plitzi-sdk";

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

// src/plugins/ClientInfo.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var ClientInfo = () => {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    setInfo({
      viewport: `${window.innerWidth} \xD7 ${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  }, []);
  return /* @__PURE__ */ jsxs(RootElement, { style: card("client"), children: [
    /* @__PURE__ */ jsx("div", { style: title("client"), children: '\u{1F310} Client Info \u2014 runtime: "client"' }),
    !info && /* @__PURE__ */ jsx("span", { style: { color: "#9ca3af" }, children: "Reading browser APIs\u2026" }),
    info && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { style: row, children: [
        /* @__PURE__ */ jsx("span", { style: label, children: "Viewport" }),
        /* @__PURE__ */ jsx("span", { children: info.viewport })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: row, children: [
        /* @__PURE__ */ jsx("span", { style: label, children: "Language" }),
        /* @__PURE__ */ jsx("span", { children: info.language })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: row, children: [
        /* @__PURE__ */ jsx("span", { style: label, children: "Timezone" }),
        /* @__PURE__ */ jsx("span", { children: info.timezone })
      ] })
    ] })
  ] });
};
var ClientInfo_default = ClientInfo;
export {
  ClientInfo_default as default
};
