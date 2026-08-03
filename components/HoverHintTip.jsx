/** Animated hover hint — pair with `.hub-hover-hint` on the clickable parent. */
export default function HoverHintTip({ label }) {
  if (!label) return null;
  return (
    <span className="hub-hover-hint-tip" role="tooltip">
      {label}
    </span>
  );
}
