# Configuración local

Para trabajar en Plitzi con hostnames locales y APIs del navegador que requieren contexto seguro, configura tu máquina así.

## Archivo hosts

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

## HTTPS

Habilita HTTPS en tu entorno de desarrollo local. Es necesario para:

- Web Crypto (`crypto`) en contexto seguro
- Comportamiento correcto con los hostnames anteriores

Usa los certificados y la configuración del servidor de desarrollo definidos en cada app (builder, SDK, servidor), según su configuración Vite o del servidor.

## Comprobar

Tras `yarn start`, abre las URLs configuradas en cada app (por ejemplo `https://app.plitzi.local`) y confirma que el certificado es de confianza en el navegador o el sistema operativo.

## Ver también

- [Primeros pasos](./getting-started.md)
- [Desarrollo](./development.md)
