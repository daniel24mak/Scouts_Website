import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandedLoader from "../components/BrandedLoader.jsx";
import { consumeInvitationCallback, signOut, updateCurrentUserPassword } from "../services/authService.js";

export default function AcceptInvitationPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [passwords, setPasswords] = useState({ password: "", confirmation: "" });

  useEffect(() => {
    let active = true;
    consumeInvitationCallback()
      .then(() => active && setStatus("ready"))
      .catch((error) => {
        if (!active) return;
        setMessage(error.message || "This invitation link is invalid or has expired.");
        setStatus("error");
      });
    return () => { active = false; };
  }, []);

  if (status === "loading") return <BrandedLoader label="Checking your invitation" />;

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (passwords.password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }
    if (passwords.password !== passwords.confirmation) {
      setMessage("The passwords do not match.");
      return;
    }
    setStatus("saving");
    try {
      await updateCurrentUserPassword(passwords.password);
      await signOut();
      navigate("/login", { replace: true, state: { invitationAccepted: true } });
    } catch (error) {
      setMessage(error.message || "Your password could not be saved.");
      setStatus("ready");
    }
  };

  return (
    <section className="page-section narrow invitation-page">
      <p className="eyebrow">Scouts dashboard access</p>
      <h1>{status === "error" ? "Invitation link unavailable" : "Finish setting up your account"}</h1>
      {status === "error" ? (
        <div className="editor-panel invitation-error" role="alert">
          <p>{message}</p>
          <p>Ask an administrator to send a new invitation. Invitation links are single-use and expire for security.</p>
          <Link className="button-link" to="/login">Return to login</Link>
        </div>
      ) : (
        <form className="editor-panel login-form" onSubmit={submit}>
          <p className="helper-text">Create the password you will use to sign in to the dashboard.</p>
          <label>New password<input type="password" autoComplete="new-password" required minLength={8} value={passwords.password} onChange={(event) => setPasswords((current) => ({ ...current, password: event.target.value }))} /></label>
          <label>Confirm password<input type="password" autoComplete="new-password" required minLength={8} value={passwords.confirmation} onChange={(event) => setPasswords((current) => ({ ...current, confirmation: event.target.value }))} /></label>
          <button type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving password..." : "Activate account"}</button>
          {message && <p className="helper-text form-error" role="alert">{message}</p>}
        </form>
      )}
    </section>
  );
}
