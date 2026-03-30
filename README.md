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

If they are not already set, the script falls back to safe local verification defaults.

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
