export default function EvenlyLogo({
  width = 100,
  height = 70,
  color = "#5F7D6A",
  className = "",
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 24 Q30 21, 50 24 Q70 21, 90 24 Q93 24, 90 28 Q70 31, 50 28 Q30 31, 10 28 Q7 28, 10 24 Z"
        fill={color}
      />
      <path
        d="M10 46 Q30 49, 50 46 Q70 49, 90 46 Q93 46, 90 50 Q70 47, 50 50 Q30 47, 10 50 Q7 50, 10 46 Z"
        fill={color}
      />
    </svg>
  );
}
