# Daddy Game Chicken: Atrapa el Sabor

Videojuego web 2D para la marca **Daddy Pollo**. El jugador controla a
*Daddy Pollo*, atrapa los platillos buenos, esquiva lo quemado y consigue el
mayor puntaje en 60 segundos. Funciona en celulares, tabletas y computadoras.

## Tecnologías

**Frontend (juego)**
- Phaser 3, TypeScript, Vite, HTML5 y CSS (responsive, sin React).

**Backend (API)**
- Node.js, Express, TypeScript, API REST.
- Validación con Zod, Helmet, CORS configurable, rate limiting y logs.

**Base de datos**
- Neon PostgreSQL con Prisma ORM y migraciones.
- Prisma se usa **solo** en el backend; el navegador nunca se conecta a Neon.

**Infraestructura**
- Liquid Web VPS (Ubuntu), PM2, Nginx, Certbot y UFW.

## Requisitos

- Node.js LTS (>= 18, probado con Node 20).
- npm 10+.
- Una base de datos Neon PostgreSQL (para persistencia real).

## Instalación local

```bash
# 1. Instalar dependencias (monorepo con workspaces)
npm install

# 2. Crear el archivo de entorno
cp .env.example .env
# Edita .env y coloca tus valores (ver más abajo)

# 3. Generar el cliente de Prisma
npm run prisma:generate

# 4. (Opcional) Ejecutar migraciones y seed cuando tengas Neon configurado
npm run prisma:migrate
npm run prisma:seed
```

> El juego es totalmente jugable sin base de datos: usa configuración por
> defecto y placeholders automáticos. La base de datos se necesita para
> guardar puntajes, leaderboard y premios reales.

## Configuración de Neon

1. Crea un proyecto en [Neon](https://neon.tech).
2. Copia la cadena de conexión **pooled** a `DATABASE_URL`.
3. Copia la cadena de conexión **direct** a `DIRECT_URL` (usada por migraciones).
4. Ejecuta `npm run prisma:migrate` para crear las tablas.
5. Ejecuta `npm run prisma:seed` para cargar la configuración pública inicial.

## Variables de entorno

Definidas en `.env` (ver `.env.example`):

| Variable | Descripción |
| --- | --- |
| `NODE_ENV` | `development`, `production` o `test`. |
| `PORT` | Puerto de la API (por defecto `3005`). |
| `DATABASE_URL` | Conexión pooled de Neon (runtime). |
| `DIRECT_URL` | Conexión directa de Neon (migraciones). |
| `CORS_ORIGIN` | Orígenes permitidos (separados por coma). |
| `PUBLIC_GAME_URL` | URL pública del juego (compartir por WhatsApp). |
| `REWARD_SECRET` | Secreto para códigos de premio y hash de IP. |
| `RATE_LIMIT_WINDOW_MS` | Ventana de rate limit en ms. |
| `RATE_LIMIT_MAX` | Máximo de solicitudes por ventana. |

**Nunca** subas `.env` ni secretos al repositorio.

## Migraciones

```bash
npm run prisma:generate        # Genera el cliente de Prisma
npm run prisma:migrate         # Crea/aplica migraciones en desarrollo
npm run prisma:migrate:deploy  # Aplica migraciones en producción
npm run prisma:seed            # Carga la configuración pública
npm run prisma:studio          # Abre Prisma Studio
```

## Ejecución local

```bash
npm run dev          # Levanta juego (5173) + API (3005)
npm run dev:game     # Solo el juego  -> http://localhost:5173
npm run dev:server   # Solo la API    -> http://localhost:3005
```

Vite redirige `/api` a `http://localhost:3005` durante el desarrollo.

## Compilación

```bash
npm run build          # Compila API y juego
npm run build:game     # Solo el juego -> game/dist
npm run build:server   # Solo la API   -> server/dist
```

## Pruebas y verificación

```bash
npm run typecheck   # TypeScript en juego y API
npm run lint        # ESLint en juego y API
npm run test        # Pruebas del backend (Vitest)
```

Las pruebas cubren: cálculo de promociones, validación de puntajes,
prevención de `clientSessionId` duplicado, endpoint de health, leaderboard y
generación de códigos de recompensa.

## Estructura del proyecto

```
daddy-game-chicken/
├── game/          # Cliente Phaser (TypeScript + Vite)
│   ├── public/assets/{images,audio,fonts}/
│   └── src/{config,scenes,objects,services,utils,styles}/
├── server/        # API Express (TypeScript)
│   └── src/{config,controllers,middleware,routes,services,validators,utils}/
├── prisma/        # schema.prisma + seed.ts
├── scripts/       # deploy.sh, backup-database.sh
├── nginx/         # daddy-game-chicken.conf
├── ecosystem.config.cjs
├── .env.example
├── README.md
└── DEPLOYMENT.md
```

## Imágenes y audio

- Coloca tus imágenes en `game/public/assets/images/` usando los nombres
  documentados en el README de esa carpeta (por ejemplo `daddy-pollo.png`,
  `papas-con-pollo.png`, `logo-daddy-game-chicken.png`).
- Si falta una imagen, el juego genera un **placeholder** automático y no se
  rompe.
- El audio se sintetiza con la Web Audio API (no requiere archivos). Puedes
  agregar audio real en `game/public/assets/audio/` y ampliar
  `game/src/services/audio.ts`.

## Cómo jugar

- **Computadora:** flechas ← → o teclas **A** / **D**. **P** para pausar.
- **Celular/tableta:** botones táctiles grandes o arrastra al personaje.
- Atrapa productos buenos (+100 / +200), evita objetos malos (restan vida).
- Combos de 3 (x2) y de 5 (x3). Poderes: escudo, doble puntos, cámara lenta,
  imán (moto de reparto) y combo Daddy.

## Comandos Git

```bash
git init
git checkout -b main
# ... primer commit ...
git checkout -b develop
```

Ramas: `main` (producción) y `develop` (desarrollo). No se realiza push a
GitHub hasta autorizarlo. Ver el historial de commits sugerido en la sección
de despliegue.

## Contacto

Daddy Pollo · Tel: **6241548148**
