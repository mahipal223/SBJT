# ServiceDesk Angular application

Angular 22 frontend for ServiceDesk. Phase 1 includes a responsive application shell, development login, route guard, API interceptor and tenant-aware overview screen.

```powershell
npm install
npm start
```

`npm start` uses `proxy.conf.json` to forward `/api` and `/health` to `http://localhost:5080`.

The demo button stores only fixed development IDs. Its `X-Dev-User-Id` header is accepted by the API only when `ASPNETCORE_ENVIRONMENT=Development`. Replace this flow with an OIDC authorization-code-with-PKCE client before production.

```powershell
npm run build
npm test -- --watch=false
```
