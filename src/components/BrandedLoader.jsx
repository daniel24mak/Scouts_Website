import scoutLogo from "../assets/smscouts_logo.png";

export default function BrandedLoader({ label = "Loading" }) {
  return (
    <section className="branded-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="branded-loader-mark" aria-hidden="true">
        <img src={scoutLogo} alt="" />
      </div>
      <span>{label}</span>
    </section>
  );
}