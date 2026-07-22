# Despliegue en Liquid Web (Ubuntu)

Guía para publicar **Daddy Game Chicken** en un VPS Ubuntu de Liquid Web con
Nginx, PM2, Certbot y Neon PostgreSQL.

> Reemplaza todos los placeholders antes de ejecutar los comandos:
>
> | Placeholder | Significado |
> | --- | --- |
> | `SERVER_IP` | IP pública del VPS |
> | `SSH_USER` | Usuario SSH (por ejemplo `deploy`) |
> | `REPO_URL` | URL del repositorio Git |
> | `DOMAIN` | Dominio definitivo (ej. `juego.daddypollo.com`) |
> | `NEON_DATABASE_URL` | Cadena pooled de Neon |
> | `NEON_DIRECT_URL` | Cadena direct de Neon |

Dominio de ejemplo: **juego.daddypollo.com** · Puerto interno API: **3005**.

---

## 1. Preparar el servidor

```bash
ssh SSH_USER@SERVER_IP

# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar utilidades
sudo apt install -y git curl ufw nginx

# Instalar Node.js LTS (20.x) vía NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2 global
sudo npm install -g pm2

# Verificar versiones
node --version && npm --version && pm2 --version
```

## 2. Clonar el repositorio

```bash
sudo mkdir -p /var/www
sudo chown -R SSH_USER:SSH_USER /var/www
cd /var/www
git clone REPO_URL daddy-game-chicken
cd daddy-game-chicken
```

## 3. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Valores mínimos de producción:

```env
NODE_ENV=production
PORT=3005
DATABASE_URL=NEON_DATABASE_URL
DIRECT_URL=NEON_DIRECT_URL
CORS_ORIGIN=https://DOMAIN
PUBLIC_GAME_URL=https://DOMAIN
REWARD_SECRET=<genera-un-valor-largo-y-aleatorio>
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
```

Genera un secreto seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Conectar Neon y ejecutar migraciones

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy   # NO destructivo
npm run prisma:seed             # Carga configuración pública inicial
```

## 5. Compilar

```bash
npm run build   # Genera server/dist y game/dist
```

El frontend queda en `/var/www/daddy-game-chicken/game/dist`.

## 6. Configurar PM2

```bash
pm2 start ecosystem.config.cjs --only daddy-game-chicken-api
pm2 save
pm2 startup            # Sigue las instrucciones que imprime
pm2 status
```

La API se ejecuta como `daddy-game-chicken-api` en el puerto `3005`.

## 7. Configurar Nginx

```bash
# Copiar la configuración incluida en el repo
sudo cp nginx/daddy-game-chicken.conf /etc/nginx/sites-available/daddy-game-chicken.conf

# Editar server_name con tu dominio real
sudo nano /etc/nginx/sites-available/daddy-game-chicken.conf

# Habilitar el sitio
sudo ln -s /etc/nginx/sites-available/daddy-game-chicken.conf /etc/nginx/sites-enabled/

# (Opcional) quitar el sitio por defecto
sudo rm -f /etc/nginx/sites-enabled/default

# Validar y recargar
sudo nginx -t
sudo systemctl reload nginx
```

Nginx sirve el frontend compilado, redirige `/api` a `http://127.0.0.1:3005`,
comprime estáticos, cachea imágenes/audio/JS/CSS y **no** cachea la API.

## 8. Configurar DNS

En tu proveedor DNS, crea un registro **A**:

```
Tipo: A
Nombre: juego   (o el subdominio deseado)
Valor: SERVER_IP
TTL: 300
```

Espera a que propague antes de emitir el certificado.

## 9. Instalar certificado SSL (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d DOMAIN
# Certbot configura HTTPS y la redirección 80 -> 443 automáticamente.

# Verificar renovación automática
sudo certbot renew --dry-run
```

## 10. Configurar el firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 11. Revisar logs

```bash
pm2 logs daddy-game-chicken-api      # Logs de la API
pm2 monit                            # Monitor en vivo
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Prueba la salud de la API:

```bash
curl https://DOMAIN/api/health
```

## 12. Actualizar versiones futuras

Usa el script de despliegue seguro incluido (no ejecuta comandos
destructivos sobre la base de datos):

```bash
cd /var/www/daddy-game-chicken
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

El script: entra al proyecto, hace `git pull origin main`, `npm ci`, genera
Prisma Client, aplica migraciones de producción, compila y reinicia la API con
PM2, mostrando el estado final.

## 13. Restaurar una versión anterior

```bash
cd /var/www/daddy-game-chicken

# Ver el historial de commits
git log --oneline -n 20

# Volver a un commit específico (reemplaza COMMIT_HASH)
git checkout COMMIT_HASH

# Reconstruir y reiniciar
npm ci
npm run prisma:generate
npm run build
pm2 reload daddy-game-chicken-api

# Para regresar a la última versión
git checkout main
```

Respaldos de base de datos (opcional):

```bash
chmod +x scripts/backup-database.sh
./scripts/backup-database.sh   # Crea un dump con pg_dump en ./backups
```

## Comandos destructivos prohibidos

Nunca ejecutes en producción:

- `prisma migrate reset`
- `DROP DATABASE` / `DROP TABLE`
- Eliminación automática de tablas
- Sobrescritura del archivo `.env`

## Commits sugeridos

```
1. chore: initialize daddy game chicken monorepo
2. feat: add phaser game scenes
3. feat: add scoring and power ups
4. feat: add express api
5. feat: add neon prisma database
6. feat: add leaderboard and rewards
7. chore: add liquid web deployment configuration
8. docs: add installation and deployment guides
```

Ramas: `main` (producción) y `develop` (desarrollo). No hacer push a GitHub
hasta que el repositorio remoto esté autorizado.
