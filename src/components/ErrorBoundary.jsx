import React from "react";
import { logSiteError } from "../services/siteErrorService.js";
import { reloadWithRecoveryLimit } from "./SiteRecoveryPrompt.jsx";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, isAutoReloading: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Scouts app render error:", error, errorInfo);
    logSiteError(error, {
      source: "react-error-boundary",
      metadata: {
        componentStack: errorInfo?.componentStack || ""
      }
    });

    window.setTimeout(() => {
      const reloading = reloadWithRecoveryLimit(error, "react-error-boundary");
      if (!reloading) return;
      this.setState({ isAutoReloading: true });
    }, 1200);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-screen">
          <p className="eyebrow">App error</p>
          <h1>The scouts app hit a render error.</h1>
          <p>
            {this.state.isAutoReloading
              ? "Trying to reload the page..."
              : "Please reload the page. If the issue keeps happening, the error has been saved for review."}
          </p>
          <pre>{this.state.error.message}</pre>
          <button type="button" className="primary-action" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
