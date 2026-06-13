import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="page-section narrow">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>This route is not part of the scouts app skeleton yet.</p>
      <Link className="inline-action" to="/">
        Back home
      </Link>
    </section>
  );
}
