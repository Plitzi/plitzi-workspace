# RFC 0001 — Renderer nativo para mobile (React Native)

- **Estado:** Propuesta (no implementado)
- **Autor:** Carlos Rodriguez
- **Fecha:** 2026-06-21
- **Ámbito:** `@plitzi/plitzi-sdk` y sus paquetes de render (`sdk-elements`, `sdk-style`)

---

## 1. Resumen

Evaluar y planear un PoC que permita renderizar UI generada por Plitzi en
**aplicaciones móviles nativas** mediante React Native (RN), reutilizando el
motor de datos del SDK y reemplazando únicamente la **capa de presentación**.

El SDK actual está en React pero es **web/DOM puro**: no puede correr tal cual
en RN. Esta RFC documenta el camino "nativo real" (Opción 3 del análisis
previo), por qué es viable y cómo abordarlo cuando se priorice.

> Alternativas más baratas descartadas para esta RFC (pero válidas a corto
> plazo): **Capacitor/WebView** (empaquetar el build web sin cambios) y **PWA**.
> Esta RFC se enfoca en el renderer nativo porque es el único que da
> look-and-feel y rendimiento nativos reales.

---

## 2. Motivación

- Construir apps móviles nativas a partir de los mismos schemas/páginas que ya
  produce el builder de Plitzi.
- Reutilizar al máximo la lógica existente (store, schema, variables,
  interacciones) sin duplicar el motor.
- Evitar el costo de mantener dos modelos de datos distintos.

---

## 3. Por qué el SDK actual no corre en RN

React es solo el reconciliador (agnóstico de plataforma); todo lo construido
encima es web. Evidencia en el código:

| Dependencia web | Ubicación | Problema en RN |
|---|---|---|
| JSX con tags HTML (`<div>`, `<span>`, `className`) | ~221 usos en `sdk-elements/src` | RN solo entiende `<View>`, `<Text>`, `<Image>` |
| Sistema de estilos = CSS | todo `sdk-style` | RN usa objetos `StyleSheet` (subset flexbox), sin cascada ni `className` |
| `react-dom` (peerDependency) | `apps/sdk/package.json` | RN usa el renderer `react-native` |
| HTML crudo (`BlockHtml`, `NodeHtml`, `BlockJsx`, Twig, `innerHTML`) | `sdk-elements/src/elements/advanced/*` | RN no renderiza strings de HTML |
| `@plitzi/plitzi-ui` | librería de componentes | construida con DOM/CSS |
| `react-router-dom`, `react-helmet`, `document.*`, `window.*` | router, SSR shell, Dropdown | APIs de navegador inexistentes en RN |

---

## 4. Por qué la arquitectura SÍ habilita el PoC

Tres propiedades del SDK hacen esto viable con esfuerzo acotado:

### 4.1 Punto único de traducción a HTML: `RootElement`

`sdk-elements/src/Element/RootElement.tsx` es el **único** lugar que emite el
`<Tag>` HTML. Los elementos visuales delegan en él. Ejemplo (`Container`):

```tsx
const Container = (...) => (
  <RootElement tag={subType} className={...}>{children}</RootElement>
);
```

> Implicación: reescribir `RootElement` → `RootElementNative` (mapear
> `tag`→`<View>`/`<Text>` y estilo→`StyleSheet`) cambia el render de casi todos
> los elementos de un solo golpe.

### 4.2 Árbol data-driven, no JSX hardcodeado

Los elementos se resuelven por `type` desde un registry
(`Element/helpers/loadComponent.ts` + `register`). La página es un schema JSON.
Se pueden registrar implementaciones nativas para los mismos `type` y el motor
las consume sin cambios.

### 4.3 `parseStyle` ya produce un objeto camelCase

`Element/helpers/parseStyle.ts` convierte CSS string → `{ camelKey: value }`.
RN's `StyleSheet` también usa objetos camelCase: **la forma coincide**. Lo que
no coincide es el contenido (unidades, shorthands, pseudo-selectores,
media queries) — pero para flexbox básico el mapeo es directo.

### 4.4 Lógica portable sin cambios

Es JS puro y portable a RN: `@plitzi/nexus` (store), `sdk-schema`,
`sdk-variables`, `sdk-interactions`, y la lógica del HOC `withElement`.

---

## 5. Alcance del PoC

**Objetivo:** tomar un schema JSON real de una página Plitzi simple
(containers, texto, imagen, un botón con una interacción) y renderizarlo en una
app **Expo** corriendo en iOS/Android, reutilizando el motor de datos del SDK.

| Reutilizar tal cual | Reescribir para RN | Excluir del PoC |
|---|---|---|
| nexus, sdk-schema, sdk-variables, sdk-interactions, registry / `withElement` | `RootElement`→`RootElementNative`, `parseStyle`→subset RN, 4–5 elementos básicos | BlockHtml / NodeHtml / Twig, plitzi-ui, FontAwesome web, CSS avanzado (grid, pseudo, media queries) |

Elementos mínimos del PoC:

| Tipo Plitzi | Componente RN |
|---|---|
| Container / Structure | `<View>` |
| Text / Paragraph / Heading | `<Text>` |
| Image | `<Image>` |
| Button | `<Pressable>` + `<Text>` |

---

## 6. Decisiones pendientes (a resolver al arrancar)

> Quedaron sin definir; se documentan para retomarlas.

1. **Entorno:** Expo nuevo (recomendado) vs bare RN vs solo `RootElementNative`
   con test sin device.
2. **Nivel de estilos:** flexbox básico vs +tipografía/bordes vs máximo posible.
   (Aquí es donde se va el tiempo si se busca paridad total.)

---

## 7. Plan de implementación (cuando se priorice)

1. **Setup**: app Expo nueva que consuma los packages portables del workspace
   vía portal/resolutions, sin tocar el SDK web.
2. **`RootElementNative`**: equivalente de `RootElement` que mapee `tag`→
   primitivo RN y delegue estilo a un `parseStyleNative`.
3. **`parseStyleNative`**: subset de CSS→`StyleSheet` (alcance según decisión §6.2).
4. **Registry nativo**: registrar los 4–5 elementos básicos para los mismos
   `type` que usa el builder.
5. **Pantalla de demo**: cargar un schema JSON real y renderizarlo.
6. **Interacción**: cablear una interacción simple (ej. tap→navegación o cambio
   de estado en nexus) para probar que el motor no-visual funciona en RN.

---

## 8. Estimación y riesgo

- **Esfuerzo:** ~1–2 semanas para un PoC convincente.
- **Riesgo bajo** en el motor (store/registry/interactions ya funcionan).
- **Riesgo / costo concentrado** en el style engine: el tiempo escala con la
  paridad de estilos buscada.

### Qué probaría / qué NO

- ✅ Que el modelo de datos + registry + interactions del SDK son portables y
  que se puede renderizar nativo real.
- ❌ Paridad completa de estilos ni elementos HTML-crudos (`BlockHtml`,
  `NodeHtml`, Twig) — esos nunca tendrán equivalente nativo limpio.

---

## 9. Siguiente paso

Cuando se priorice: resolver las decisiones de §6 y ejecutar el plan de §7,
empezando por `RootElementNative` + `parseStyleNative` sobre un schema de demo.
