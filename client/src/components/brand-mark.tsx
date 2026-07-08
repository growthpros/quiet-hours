export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Quiet Hours"
      role="img"
    >
      {/* crescent moon */}
      <path d="M20.5 6.5a8 8 0 1 0 3.2 12.4A9.2 9.2 0 0 1 20.5 6.5Z" />
      {/* horizon line */}
      <path d="M4 25h24" />
      <path d="M9 21.5h6" opacity="0.55" />
    </svg>
  );
}
