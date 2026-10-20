# OAuth 2.1 Resource Server Hardening for P31 Remote MCP Servers

## Overview

Per the MCP 2026-07-28 authorization specification, every remote MCP server
is an OAuth 2.1 resource server. It must publish Protected Resource Metadata
(RFC 9728), validate tokens were issued specifically for it, and reject
everything else.

## Required Endpoints

### 1. Protected Resource Metadata (RFC 9728)

```
GET /.well-known/oauth-protected-resource
```

Response:
```json
{
  "resource": "https://mcp.p31ca.org",
  "authorization_servers": ["https://auth.p31ca.org"],
  "scopes_supported": ["love:read", "love:write", "truth:read", "truth:write", "oasis:read", "oasis:write"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://p31ca.org/docs/mcp"
}
```

### 2. Token Validation (RFC 8707 + RFC 9207)

Every incoming request must:
1. Extract Bearer token from Authorization header
2. Validate JWT signature against authorization server JWKS
3. Verify `aud` claim matches this resource's URL (RFC 8707)
4. Verify `iss` claim matches expected authorization server (RFC 9207)
5. Verify token has not expired
6. Verify required scope is present for the requested tool

### 3. Per-Tool Scopes

| Tool | Required Scope |
|------|---------------|
| `love_balance` | `love:read` |
| `love_anchor` | `love:write` |
| `truth_lookup` | `truth:read` |
| `truth_register_fact` | `truth:write` |
| `oasis_status` | `oasis:read` |
| `oasis_execute` | `oasis:write` |
| `crisis_check` | `oasis:read` |

### 4. Client Registration

Dynamic Client Registration (DCR) is formally deprecated in MCP 2026-07-28.
Use Client ID Metadata Documents instead: an HTTPS URL pointing to a JSON
document the authorization server fetches.

### 5. Defense Against Common Flaws

| Flaw Class | Prevalence | Defense |
|-----------|-----------|---------|
| DCR flaws | 96.6% of servers | Disable DCR, use Client ID Metadata Documents |
| No authentication | 38% of servers | Require Bearer token on every request |
| Token passthrough | Common | Validate `aud` claim matches this resource |
| Confused deputy | Common | Validate `iss` claim matches expected AS |
| Over-scoped tokens | Common | Per-tool scopes, not blanket admin |

### Implementation Checklist

- [ ] Publish `/.well-known/oauth-protected-resource`
- [ ] Validate `aud` on every token
- [ ] Validate `iss` on every token
- [ ] Enforce per-tool scopes
- [ ] Disable DCR
- [ ] Add rate limiting per client
- [ ] Add audit logging for all tool calls
- [ ] Test with MCP Inspector OAuth flow
