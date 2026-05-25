# Plitzi

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPLv3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0.en.html)
[![Build Status](https://img.shields.io/github/actions/workflow/status/plitzi/plitzi-workspace/ci.yml?branch=main)](https://github.com/plitzi/plitzi-workspace/actions)
[![Coverage Status](https://img.shields.io/coveralls/github/plitzi/plitzi-workspace/main.svg?style=flat)](https://coveralls.io/github/plitzi/plitzi-workspace?branch=main)
[![npm version](https://img.shields.io/npm/v/@plitzi/plitzi-sdk.svg)](https://www.npmjs.com/package/@plitzi/plitzi-sdk)
[![Community Chat](https://img.shields.io/badge/chat-on%20discord-7289da.svg)](https://discord.gg/plitzi)

**English:** [README.md](./README.md)

---

## Acerca de Plitzi

Plitzi es un **constructor de aplicaciones web** de código abierto pensado para que desarrolladores y comunidades creen, modifiquen y compartan apps web modernas con facilidad. Diseñado con extensibilidad y transparencia, fomenta la colaboración bajo la [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.es.html).

---

## Características ![Features Badge](https://img.shields.io/badge/-Características-4caf50?style=flat-square&logo=awesome-lists&logoColor=white)

- 🔧 **SDK y Builder modulares:** Kit abierto y extensible para diseñar y personalizar aplicaciones web.
- 🌐 **Nube y autoalojamiento:** Despliega en la nube oficial de Plitzi o en tu propia infraestructura.
- 🤝 **Impulsado por la comunidad:** Las contribuciones y mejoras son bienvenidas.
- 📚 **Documentación:** Guías en [español](./docs/es/README.md) e [inglés](./docs/en/README.md).
- 🛠 **Herramientas de desarrollo:** Depuración y utilidades para iterar con rapidez.

---

## Estructura del repositorio

```
/
├─ apps/
│  ├─ sdk/              # App del SDK Plitzi
│  ├─ builder/          # Interfaz y lógica del builder
│  ├─ server/           # Servidor SSR / RSC / MCP
├─ packages/
│  ├─ sdk-auth/         # Autenticación
│  ├─ sdk-collections/  # Colecciones
│  ├─ sdk-data-source/  # Fuentes de datos
│  ├─ sdk-dev-tools/    # Utilidades de desarrollo
│  ├─ sdk-elements/     # Elementos y componentes UI
│  ├─ sdk-event-bridge/ # Puente de eventos
│  ├─ sdk-interactions/ # Interacciones de usuario
│  ├─ sdk-navigation/   # Navegación
│  ├─ sdk-plugins/      # Sistema de plugins
│  ├─ sdk-schema/       # Utilidades de esquema
│  ├─ sdk-shared/       # Utilidades y tipos compartidos
│  ├─ sdk-state/        # Gestión de estado
│  ├─ sdk-store/        # Store global
│  ├─ sdk-style/        # Sistema de estilos
│  └─ sdk-variables/    # Variables
├─ docs/
│  ├─ en/               # Documentación en inglés
│  └─ es/               # Documentación en español
├─ LICENSE              # Licencia AGPL-3.0
├─ README.md            # Versión en inglés
├─ README.es.md         # Este archivo
├─ claude.md
├─ CODE_OF_CONDUCT.md
├─ CONTRIBUTOR_TOS.md / CONTRIBUTOR_TOS.es.md
└─ COMMERCIAL_LICENSE.md / COMMERCIAL_LICENSE.es.md
```

---

## Documentación

| Idioma  | Guía                                     |
| ------- | ---------------------------------------- |
| Español | [docs/es/README.md](./docs/es/README.md) |
| English | [docs/en/README.md](./docs/en/README.md) |

Enlaces rápidos: [Primeros pasos](./docs/es/getting-started.md) · [Getting started (EN)](./docs/en/getting-started.md) · [Configuración local](./docs/es/local-setup.md) · [Local setup (EN)](./docs/en/local-setup.md)

---

## Primeros pasos

1. **Clonar el repositorio**

```bash
git clone https://github.com/plitzi/plitzi-workspace.git
cd plitzi-workspace
```

2. **Instalar dependencias** (Yarn 4)

```bash
yarn install
```

3. **Ejecutar las apps en local**

```bash
yarn start
```

4. **Explorar y contribuir**

Consulta [docs/es/getting-started.md](./docs/es/getting-started.md) o [docs/en/getting-started.md](./docs/en/getting-started.md). El código está en `apps/sdk`, `apps/builder` y `apps/server`.

---

## Ejemplo rápido ![Quick Start](https://img.shields.io/badge/-Inicio%20rápido-2196f3?style=flat-square&logo=thunder&logoColor=white) En progreso

Ejemplo mínimo de uso del SDK de Plitzi (próximamente):

<!-- ```js
import { PlitziApp } from '@plitzi/plitzi-sdk';

const app = new PlitziApp({
  target: document.getElementById('app'),
  config: {
    title: 'Mi primera app Plitzi',
    // ...otras opciones
  }
});

app.start();
``` -->

Más detalles en [docs/es/](./docs/es/README.md), [docs/en/](./docs/en/README.md) o la [wiki de GitHub](https://github.com/plitzi/plitzi-workspace/wiki).

---

## Guía de contribución ![Contribute](https://img.shields.io/badge/-Contribuir-fbc02d?style=flat-square&logo=github&logoColor=black)

¡Las contribuciones son bienvenidas! Para mantener el proyecto sano y colaborativo:

- Lee el [código de conducta](./CODE_OF_CONDUCT.md) (inglés).
- Abre issues para bugs, funcionalidades o dudas antes de enviar PRs cuando sea posible.
- Haz fork del repositorio y trabaja en ramas de feature.
- Escribe mensajes de commit claros y descriptivos.
- Incluye tests y documentación en cambios de comportamiento.
- Envía pull requests contra la rama `main`.
- Todas las contribuciones se licencian bajo AGPL-3.0.
- **Seguridad:** revisa la [política de seguridad](https://github.com/plitzi/plitzi-workspace/security/policy) para reportar vulnerabilidades.

---

## Comunidad y soporte ![Community](https://img.shields.io/badge/-Comunidad%20y%20soporte-8e24aa?style=flat-square&logo=discord&logoColor=white)

- **Discord:** [https://discord.gg/plitzi](https://discord.gg/plitzi)
- **GitHub Discussions:** [https://github.com/plitzi/plitzi-workspace/discussions](https://github.com/plitzi/plitzi-workspace/discussions)
- **Email:** crodriguez@plitzi.com

### Obtener ayuda

- **Documentación:** [Español](./docs/es/README.md) · [English](./docs/en/README.md)
- **Wiki de GitHub** para guías y FAQ adicionales.
- **Issues** para bugs o solicitudes de funcionalidades.
- **Discussions** o **Discord** para preguntas.

---

## Licencia

Este proyecto está bajo la GNU Affero General Public License v3.0 (AGPL-3.0).

Las licencias comerciales están pensadas para empresas que quieren mantener su código privado, crear productos propietarios o evitar obligaciones de la AGPL. Si lo necesitas, debes obtener una licencia comercial.

Consulta [COMMERCIAL_LICENSE.es.md](./COMMERCIAL_LICENSE.es.md) ([English](./COMMERCIAL_LICENSE.md)) para más detalles.

---

## Agradecimientos

Gracias a la comunidad open source y a todos los contribuidores que hacen de Plitzi una plataforma colaborativa.

---

_Crea y haz crecer tus apps web con Plitzi: libertad para crear, libertad para compartir._

---

## Contribuidores ![Contributors](https://img.shields.io/badge/-Contribuidores-00bcd4?style=flat-square&logo=github&logoColor=white)

Gracias a quienes han mejorado Plitzi con su trabajo.

![GitHub contributors](https://contrib.rocks/image?repo=plitzi/plitzi-workspace)

---

## Hoja de ruta ![Roadmap](https://img.shields.io/badge/-Hoja%20de%20ruta-ff7043?style=flat-square&logo=roadmap&logoColor=white) En progreso

- [ ] **Release v1.0:** Servidor, builder y núcleo del SDK estables

Consulta [GitHub Projects](https://github.com/plitzi/plitzi-workspace/projects) para issues y planificación.

### Aviso de autoalojamiento

Plitzi puede autoalojarse con los componentes open source de este repositorio.

Algunas funcionalidades (gestión avanzada de datos, servicios en la nube y ciertas capacidades de backend) requieren servicios adicionales que no están incluidos aquí.

La versión open source es plenamente funcional para desarrollo y personalización local; despliegues de producción pueden necesitar infraestructura adicional.
