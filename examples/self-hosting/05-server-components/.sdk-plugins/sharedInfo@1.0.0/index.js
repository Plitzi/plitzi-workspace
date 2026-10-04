// src/plugins/SharedInfo.tsx
import { useEffect, useState } from "react";
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

// src/plugins/SharedInfo.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var SharedInfo = () => {
  const { elementData } = useRscData();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return /* @__PURE__ */ jsxs(RootElement, { style: card("shared"), children: [
    /* @__PURE__ */ jsxs("div", { style: title("shared"), children: [
      '\u{1F504} Shared Info \u2014 runtime: "shared" \u2014 ',
      hydrated ? "hydrated" : "SSR"
    ] }),
    elementData && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { style: row, children: [
        /* @__PURE__ */ jsx("span", { style: label, children: "Server time" }),
        /* @__PURE__ */ jsx("span", { children: elementData.serverTimestamp })
      ] }),
      /* @__PURE__ */ jsxs("div", { style: row, children: [
        /* @__PURE__ */ jsx("span", { style: label, children: "Uptime" }),
        /* @__PURE__ */ jsxs("span", { children: [
          elementData.uptimeSeconds,
          "s"
        ] })
      ] })
    ] })
  ] });
};
var SharedInfo_default = SharedInfo;
export {
  SharedInfo_default as default
};
