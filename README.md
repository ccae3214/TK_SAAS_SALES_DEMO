# TK SaaS Sales Demo

## Docker Deploy Verify

Run the full containerized verification flow:

```powershell
npm run docker:verify
```

The script will:

1. Build the Docker images
2. Recreate the containers
3. Verify the homepage responds with `200`
4. Verify `/api/products` responds with `200`
5. Verify `/api/admin/dashboard` responds with `401` when unauthenticated
6. Print recent app logs

Environment variables used by Docker verification:

- `NEXTAUTH_URL`
- `APP_ORIGIN`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAILS`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_ISSUER`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`

If they are not already set, the script falls back to safe local verification defaults.

## Secure environment configuration

This project uses an `.env` file for sensitive values so they are not hard-coded in `docker-compose.yml`.

- Keep `.env` out of version control.
- `.gitignore` already excludes `.env` and `.env.*`.
- Use `.env.example` as a template for production values.

## HTTPS and TLS with Let's Encrypt

The docker-compose stack includes automatic certificate management via **Certbot**.

### Automated HTTPS Setup

1. **Configure environment variables** in `.env`:
   ```env
   LETSENCRYPT_EMAIL=your_email@example.com
   LETSENCRYPT_DOMAIN=yourdomain.com
   ```

2. **Run the initialization script** (one-time setup):
   ```powershell
   # Windows PowerShell
   .\scripts\init-certbot.ps1
   
   # Or specify domain/email as parameters
   .\scripts\init-certbot.ps1 -Domain yourdomain.com -Email you@example.com
   ```
   
   Or for Linux/macOS:
   ```bash
   bash ./scripts/init-certbot.sh
   ```

3. **Start the full stack**:
   ```powershell
   docker-compose up -d
   ```

### How It Works

- **Nginx** listens on ports 80 and 443; redirects HTTP → HTTPS
- **Certbot service** runs continuously and:
  - Automatically renews expiring certificates daily
  - Uses webroot validation (no downtime during renewal)
  - Stores certificates in Docker volume `letsencrypt`
- **ACME challenges** handled via `/.well-known/acme-challenge/` routing

### Certificate Locations

- **Inside containers**: `/etc/letsencrypt/live/{domain}/`
- **On host**: `./certs/live/{domain}/`

### Troubleshooting

Check Certbot logs:
```powershell
docker-compose logs certbot
```

Manually renew certificates:
```powershell
docker-compose run --rm certbot renew
```


## Fly.io Deploy

This project includes a starter [fly.toml](C:\Users\ccae3\Documents\GitHub\TK_SAAS_SALES_DEMO\fly.toml) for a single-machine Fly.io deployment with a persistent volume for SQLite.

Before first deploy:

1. Install and log in to `flyctl`
2. Change the `app` name in `fly.toml`
3. Update `APP_ORIGIN` and `NEXTAUTH_URL` in `fly.toml`
4. Create a volume in your target region:

```powershell
fly volumes create data --region hkg --size 5
```

5. Set secrets:

```powershell
fly secrets set NEXTAUTH_SECRET=your-long-random-secret ADMIN_EMAILS=you@example.com OIDC_CLIENT_ID=... OIDC_CLIENT_SECRET=... OIDC_ISSUER=https://accounts.google.com
```

6. Deploy:

```powershell
fly deploy
```

Fly volume and configuration references:

- [Fly app configuration docs](https://fly.io/docs/reference/configuration/)
- [Fly volumes docs](https://fly.io/docs/volumes/volume-manage/)
- [Fly SQLite guidance](https://fly.io/docs/js/prisma/sqlite/)
