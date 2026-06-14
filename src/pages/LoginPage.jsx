import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useState } from "react";
import { useAuth } from "../auth/AuthProvider.jsx";
import BrandedLoader from "../components/BrandedLoader.jsx";
import { isSupabaseConfigured } from "../services/supabaseClient.js";

export default function LoginPage() {
  const { user, users, login, loginWithPassword, refreshUsers, isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? "/chiefs";
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  if (isAuthLoading) {
    return <BrandedLoader label="Checking your session" />;
  }

  if (user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/chiefs"} replace />;
  }

  const handlePasswordLogin = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      const nextUser = await loginWithPassword(credentials.email, credentials.password);
      navigate(nextUser.role === "admin" ? "/admin" : from, { replace: true });
    } catch (error) {
      setErrorMessage(error.message || "Login failed.");
    }
  };

  const handleLogin = (userId) => {
    const selectedUser = users.find((demoUser) => demoUser.id === userId);
    if ((selectedUser?.accountStatus ?? "active") !== "active") {
      return;
    }

    login(userId);
    navigate(selectedUser?.role === "admin" ? "/admin" : from, { replace: true });
  };

  return (
    <section className="page-section narrow">
      <p className="eyebrow">Internal login</p>
      <h1>Sign in to the scouts portal</h1>
      <form className="editor-panel" onSubmit={handlePasswordLogin}>
        <label>
          Email
          <input
            type="email"
            required
            value={credentials.email}
            onChange={(event) =>
              setCredentials((current) => ({ ...current, email: event.target.value }))
            }
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={credentials.password}
            onChange={(event) =>
              setCredentials((current) => ({ ...current, password: event.target.value }))
            }
          />
        </label>
        <button type="submit">Log in</button>
        {errorMessage && <p className="helper-text">{errorMessage}</p>}
      </form>
      {!isSupabaseConfigured && (
        <>
          <p className="eyebrow">Local demo accounts</p>
          <div className="card-list">
            {users.map((demoUser) => (
              <article className="card login-card" key={demoUser.id}>
                <div>
                  <h2>{demoUser.name}</h2>
                  <p>
                    {demoUser.role === "admin"
                      ? "Admin access and publishing tools"
                      : demoUser.permissions.canPublish
                        ? "Chief access with publishing tools"
                        : "Chief access only"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={(demoUser.accountStatus ?? "active") !== "active"}
                  onClick={() => handleLogin(demoUser.id)}
                >
                  {(demoUser.accountStatus ?? "active") === "active" ? "Log in" : "Disabled"}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
