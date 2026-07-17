import { Sparkles } from "lucide-react";

export default function WorkspaceAssistant({ workspaceLabel }) {
  return (
    <section className="focused-assistant" aria-labelledby="focused-assistant-title">
      <div aria-hidden="true"><Sparkles size={32} /></div>
      <span>Coming Soon</span>
      <h1 id="focused-assistant-title">{workspaceLabel} AI Assistant</h1>
      <p>Workspace-aware summaries, guidance, and quick answers will appear here without exposing records outside your permissions.</p>
      <div aria-hidden="true">Ask about this workspace...</div>
    </section>
  );
}
