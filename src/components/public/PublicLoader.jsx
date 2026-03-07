import "./PublicLoader.css";

export default function PublicLoader({ title = "Cargando…", subtitle = "" }) {
  return (
    <div className="pubLoader" role="status" aria-live="polite">
      <div className="pubSpinner" aria-hidden="true" />
      <div className="pubLoaderText">
        <div className="pubLoaderTitle">{title}</div>
        {subtitle ? <div className="pubLoaderSub">{subtitle}</div> : null}
      </div>
    </div>
  );
}