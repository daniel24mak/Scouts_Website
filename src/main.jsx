import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles.css";

const authCallbackStorageKey = "scouts-supabase-auth-callback";
const authHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

if (authHash.has("access_token") || authHash.has("error")) {
  window.sessionStorage.setItem(authCallbackStorageKey, window.location.hash.replace(/^#/, ""));
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/accept-invite`);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
