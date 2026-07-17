# Workspace Security

- The frontend hides unavailable workspaces, but PostgreSQL RLS and trusted functions remain authoritative.
- Workspace selection never changes permissions.
- High-risk Finance actions require granular permissions and may require MFA according to the access catalogue.
- Workflow decisions preserve immutable history and prevent self-approval.
- Finance and Storage files are private. The Edge Function validates the user, workspace permission, path, type, and size before issuing a short-lived URL.
- Cross-workspace links are immutable references with idempotency keys; neither workspace can edit the other domain's authoritative record through a link.
- Service-role credentials exist only in Supabase Edge Function secrets and must never be exposed to Vite or committed.
