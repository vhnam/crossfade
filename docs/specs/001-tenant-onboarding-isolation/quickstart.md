# Quickstart: Validate Tenant Onboarding & Isolation

Prerequisites: `apps/api` running locally (`vp run api#dev` or `vp dev` per
project scripts) against a local PostgreSQL instance with Prisma migrations
applied.

## 1. Register a tenant (User Story 1)

```bash
curl -s -X POST http://localhost:3000/operator/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Windwise","slug":"windwise","webhookUrl":"https://windwise.example.com/crossfade/callback"}'
```

**Expect**: `201`, response includes `apiKey` (save it — shown once) and
`webhookSecret`. Re-running the same request with the same `slug` →
`409 Conflict` (FR-003). Omitting `webhookUrl` → `400 Bad Request` (FR-002).

## 2. Authenticate as the tenant (User Story 2)

```bash
export CF_API_KEY="<apiKey from step 1>"
curl -s http://localhost:3000/tenants/me \
  -H "Authorization: Bearer $CF_API_KEY"
```

**Expect**: `200`, returns the resolved tenant's own record. Repeat with a
garbage key → `401 Unauthorized`. Repeat with no header → `401 Unauthorized`.

## 3. Confirm isolation (User Story 3)

```bash
# Register a second tenant
curl -s -X POST http://localhost:3000/operator/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Other Co","slug":"other-co","webhookUrl":"https://other.example.com/hook"}'
# Save its id as OTHER_TENANT_ID and its apiKey as separate credential

# As Windwise, try to fetch the other tenant's record directly (if such an endpoint existed on a later feature)
curl -s http://localhost:3000/tenants/$OTHER_TENANT_ID \
  -H "Authorization: Bearer $CF_API_KEY"
```

**Expect**: `404 Not Found` — never the other tenant's data, never a `403` that
would confirm existence (per
[contracts/tenant-authentication.md](contracts/tenant-authentication.md)).

## 4. Suspend and reactivate (User Story 4)

```bash
curl -s -X POST http://localhost:3000/operator/tenants/<windwise-id>/suspend
curl -s http://localhost:3000/tenants/me -H "Authorization: Bearer $CF_API_KEY"   # expect 403
curl -s -X POST http://localhost:3000/operator/tenants/<windwise-id>/reactivate
curl -s http://localhost:3000/tenants/me -H "Authorization: Bearer $CF_API_KEY"   # expect 200 again
```

**Expect**: request rejected with `403` while suspended, accepted again after
reactivation, same API key both times — no data lost (FR-010, verify by
re-fetching the tenant record via `GET /operator/tenants/{tenantId}` throughout
and confirming fields other than `status` are unchanged).

## 5. Rotate credential (edge case)

```bash
curl -s -X POST http://localhost:3000/operator/tenants/<windwise-id>/rotate-key
# old $CF_API_KEY now returns 401; new key returned in response works
```

See [contracts/operator-api.md](contracts/operator-api.md) and
[contracts/tenant-authentication.md](contracts/tenant-authentication.md) for
full request/response shapes, and [data-model.md](data-model.md) for the
underlying `Tenant` schema.
