# Finance Workspace

Finance provides accounts, funds, periods, immutable double-entry journals, versioned budgets, purchase requests, reimbursements, collections, reconciliation, and reports. Posted journals cannot be silently edited or deleted; corrections use reversals. Approval and posting permissions are separate, and creators cannot approve or pay their own requests.

Amounts are stored as fixed-precision values and displayed in AED. Attachments use the private Finance bucket through short-lived signed access. Run `supabase-finance-core.sql` before `supabase-finance-workflows.sql`.
