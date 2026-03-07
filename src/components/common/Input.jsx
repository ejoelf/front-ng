import "./Input.css";

export default function Input({ label, ...props }) {
  return (
    <label className="field">
      {label ? <div className="fieldLabel">{label}</div> : null}
      <input className="fieldInput" {...props} />
    </label>
  );
}
