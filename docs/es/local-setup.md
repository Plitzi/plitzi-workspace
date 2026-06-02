# Configuración local

Cómo ejecutar Plitzi en local depende de tu rol en el proyecto.

## Contribuidores (por defecto)

La mayoría de contribuidores **no** necesitan editar `/etc/hosts` ni levantar todo el backend en local.

Tras [Primeros pasos](./getting-started.md):

1. Clona el repo y ejecuta `yarn install`.
2. Ejecuta `yarn start` (o una sola app en `apps/`).
3. Usa los **servidores de desarrollo** a los que las apps apuntan ya en modo dev, por ejemplo:
   - `https://server-dev.plitzi.com` (GraphQL / API)
   - `https://api-dev.plitzi.com`
   - `https://ssr-dev.plitzi.com`

Con eso basta para trabajar en UI, paquetes del SDK y la mayoría de cambios del monorepo. Pregunta al equipo en [Discord](https://discord.gg/plitzi) o [GitHub Discussions](https://github.com/plitzi/plitzi-workspace/discussions) si necesitas credenciales o una URL concreta.

## Maintainers: stack local completo (opcional)

Solo necesario si ejecutas **todos** los servicios en tu máquina con hostnames personalizados (`*.plitzi.local`) en lugar de los servidores dev compartidos.

### Archivo hosts

Añade estas entradas en `/etc/hosts` (Linux/macOS) o en `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
127.0.0.1       plitzi.local
::1             plitzi.local
127.0.0.1       server.plitzi.local
::1             server.plitzi.local
127.0.0.1       ssr.plitzi.local
::1             ssr.plitzi.local
127.0.0.1       api.plitzi.local
::1             api.plitzi.local
127.0.0.1       app.plitzi.local
::1             app.plitzi.local
```

### HTTPS

Habilita HTTPS en tu entorno de desarrollo local. Es necesario para:

- Web Crypto (`crypto`) en contexto seguro
- Comportamiento correcto con los hostnames anteriores

Usa los certificados y la configuración del servidor de desarrollo definidos en cada app (builder, SDK, servidor), según su configuración Vite o del servidor.

### Comprobar

Tras `yarn start`, abre las URLs configuradas en cada app (por ejemplo `https://app.plitzi.local`) y confirma que el certificado es de confianza en el navegador o el sistema operativo.

## Ver también

- [Primeros pasos](./getting-started.md)
- [Desarrollo](./development.md)
