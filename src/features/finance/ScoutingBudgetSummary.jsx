import { AlertTriangle, Banknote, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getScoutingGroupBudgetSummaries } from "../../services/scoutingServices.js";

const aed = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 });

export default function ScoutingBudgetSummary({ onOpenReports }) {
  const [state, setState] = useState({ loading: true, error: "", rows: [] });

  useEffect(() => {
    let active = true;
    getScoutingGroupBudgetSummaries()
      .then((rows) => { if (active) setState({ loading: false, error: "", rows }); })
      .catch((error) => { if (active) setState({ loading: false, error: error.message, rows: [] }); });
    return () => { active = false; };
  }, []);

  if (state.loading) return <article className="admin-panel scouting-budget-summary"><div className="dashboard-inline-loader" aria-label="Loading group budget" /></article>;
  if (state.error || !state.rows.length) return null;

  return <section className="scouting-budget-section" aria-labelledby="scouting-budget-heading">
    <div className="panel-heading compact-heading"><div><h2 id="scouting-budget-heading">Group Budget</h2><p>Read-only Finance summary for groups you lead.</p></div></div>
    <div className="scouting-budget-grid">{state.rows.map((budget) => {
      const revised = Number(budget.revised_budget || 0);
      const spent = Number(budget.spent || 0);
      const committed = Number(budget.committed || 0);
      const pendingReimbursements = Number(budget.pending_reimbursements || 0);
      const pendingPurchases = Number(budget.pending_purchase_requests || 0);
      const pending = pendingReimbursements + pendingPurchases;
      const categories = Array.isArray(budget.categories) ? budget.categories.slice(0, 4) : [];
      const remaining = revised - spent - committed - pending;
      const used = revised > 0 ? Math.min(100, Math.max(0, ((spent + committed + pending) / revised) * 100)) : 0;
      return <article className="admin-panel scouting-budget-summary" key={budget.id}>
        <div className="scouting-budget-title"><div><span>{budget.group_name}</span><h3>{budget.name}</h3></div>{remaining < revised * 0.15 ? <AlertTriangle size={20} aria-label="Budget warning" /> : <Banknote size={20} aria-hidden="true" />}</div>
        <div className="scouting-budget-amount"><strong>{aed.format(remaining)}</strong><span>remaining</span></div>
        <div className="scouting-budget-progress" aria-label={`${used.toFixed(0)} percent used`}><i style={{ width: `${used}%` }} /></div>
        <dl>
          <div><dt>Approved</dt><dd>{aed.format(Number(budget.approved_budget || 0))}</dd></div>
          <div><dt>Revised</dt><dd>{aed.format(revised)}</dd></div>
          <div><dt>Spent</dt><dd>{aed.format(spent)}</dd></div>
          <div><dt>Committed</dt><dd>{aed.format(committed)}</dd></div>
          <div><dt>Pending reimbursements</dt><dd>{aed.format(pendingReimbursements)}</dd></div>
          <div><dt>Pending purchases</dt><dd>{aed.format(pendingPurchases)}</dd></div>
          <div><dt>Used</dt><dd>{used.toFixed(0)}%</dd></div>
        </dl>
        {categories.length ? <div className="scouting-budget-categories">
          <span>Top categories</span>
          {categories.map((category) => {
            const categoryBudget = Number(category.budget || 0);
            const categorySpent = Number(category.spent || 0);
            const categoryUsed = categoryBudget > 0 ? Math.min(100, (categorySpent / categoryBudget) * 100) : 0;
            return <div key={category.id ?? category.label}>
              <p><strong>{category.label}</strong><span>{aed.format(categorySpent)} / {aed.format(categoryBudget)}</span></p>
              <i><b style={{ width: `${categoryUsed}%` }} /></i>
            </div>;
          })}
        </div> : null}
        {onOpenReports ? <button type="button" className="inline-action" onClick={onOpenReports}>View linked expenses <ChevronRight size={16} /></button> : null}
      </article>;
    })}</div>
  </section>;
}
