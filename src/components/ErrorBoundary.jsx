import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Scouts app render error:", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-screen">
          <p className="eyebrow">App error</p>
          <h1>The scouts app hit a render error.</h1>
          <pre>{this.state.error.message}</pre>
        </main>
      );
    }

    return this.props.children;
  }
}
