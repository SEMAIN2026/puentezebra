# PuenteZebra

Página web de descargas para **PuenteZebra**, el sistema de impresión Zebra ZD220 en red por impresora virtual.

## Arquitectura

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **Base de datos**: Turso (libSQL)
- **Almacenamiento de binarios**: GitHub Releases
- **Hosting**: Vercel

## Páginas

- `/` — Página pública: muestra la última versión disponible y el historial de descargas.
- `/admin` — Panel protegido por contraseña para publicar nuevas versiones.

## Variables de entorno

```env
TURSO_DATABASE_URL=libsql://puentezebra-semain2026.aws-us-east-2.turso.io
TURSO_AUTH_TOKEN=<db auth token>
GITHUB_TOKEN=<ghp_...>
GITHUB_OWNER=SEMAIN2026
GITHUB_REPO=puentezebra
ADMIN_PASSWORD=<contraseña del panel>
```

## Scripts

```bash
bun run dev      # desarrollo local
bun run build    # build de producción
bun run lint     # eslint
```

## Licencia

Uso interno — PuenteZebra.
