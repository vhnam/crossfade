# Contract: Operator Tenant Management API

Internal endpoints for the Crossfade operator to manage tenants (FR-001, FR-009,
FR-011, FR-012). Not exposed to tenants. Authenticated separately from tenant
API keys (operator credential mechanism is an implementation detail for the
tasks phase, not specified here).

## `POST /operator/tenants`

Register a new tenant (FR-001, FR-002, FR-003).

**Request body**:

```json
{
  "name": "Windwise",
  "slug": "windwise",
  "webhookUrl": "https://windwise.example.com/crossfade/callback"
}
```

**Responses**:

- `201 Created` —
  ```json
  {
    "id": "uuid",
    "slug": "windwise",
    "name": "Windwise",
    "status": "active",
    "apiKey": "cf_live_<raw-key-shown-once>",
    "webhookUrl": "https://windwise.example.com/crossfade/callback",
    "webhookSecret": "<raw-secret-shown-once>",
    "createdAt": "2026-08-18T00:00:00Z"
  }
  ```
  `apiKey` and `webhookSecret` are returned in plaintext only in this response;
  never retrievable again.
- `400 Bad Request` — missing/malformed `webhookUrl`, missing `name`/`slug`
  (FR-002).
- `409 Conflict` — `slug` already registered (FR-003).

## `POST /operator/tenants/{tenantId}/suspend`

Suspend a tenant (FR-009). Idempotent — suspending an already-suspended tenant
returns `200` unchanged.

**Response**: `200 OK` — updated tenant record (`status: "suspended"`), no
`apiKey`/`webhookSecret` fields.

## `POST /operator/tenants/{tenantId}/reactivate`

Reactivate a suspended tenant (FR-011). Idempotent.

**Response**: `200 OK` — updated tenant record (`status: "active"`).

## `POST /operator/tenants/{tenantId}/rotate-key`

Issue a new API credential for the tenant, invalidating the old one (FR-012).

**Response**: `200 OK` —

```json
{
  "id": "uuid",
  "apiKey": "cf_live_<new-raw-key-shown-once>"
}
```

## `GET /operator/tenants/{tenantId}`

Fetch a tenant's record (for operator inspection, e.g., confirming historical
data survived suspension — FR-010). Never includes `apiKey` or `webhookSecret`
in plaintext.

**Response**: `200 OK` — tenant record without secrets.
