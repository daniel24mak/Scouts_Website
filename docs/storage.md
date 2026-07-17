# Storage Workspace

Storage covers inventory, serialized assets, kits, locations, movement history, requests, reservations, loans and returns, suppliers, deliveries, maintenance, audits, and reports. Availability is derived from posted movements and active reservations, not an editable quantity field.

Reservations lock and validate available stock. Loans support partial returns and overdue states. Strict audits prevent the counter from approving their own count. Run `supabase-storage-core.sql` before `supabase-storage-workflows.sql`.
