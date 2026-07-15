# VPS-PK — competitive parity

**Target:** DigitalOcean Droplets API

| Feature | Endpoint (`competitive_plane.js`) |
|---------|-----------------------------------|
| Regions / sizes | `GET /v2/regions`, `/v2/sizes` |
| SSH keys | `GET/POST /v2/account/keys` |
| Create droplet | `POST /v2/droplets` |
| Power actions | `POST /v2/droplets/{id}/actions` `{type:reboot|power_off|destroy}` |
| Metrics | `GET /v2/droplets/{id}/metrics` |
| Billing balance | `GET /v2/account` |

```bash
cd apps/api && node competitive_plane.js
# http://127.0.0.1:3001/v2/sizes
```

Existing multi-service `server.js` remains for the 200+ catalog surface.
