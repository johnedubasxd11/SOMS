/**
 * ACD / SOMS school mark: a five-point star (Our Lady of the Assumption,
 * crowned with stars) above a geometric "A", on Assumption blue (#004B87 -
 * the school's official colour). The real ACD seal is a trademark of the
 * college and is not bundled; swap this component for an <img> when the
 * office supplies the image file.
 */
export function SchoolMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Assumption College of Davao"
    >
      <rect width="32" height="32" rx="7.5" fill="#004B87" />
      <path
        d="M16 4.5 16.76 6.55 18.95 6.64 17.24 8 17.82 10.11 16 8.9 14.18 10.11 14.76 8 13.05 6.64 15.24 6.55Z"
        fill="#fff"
      />
      <path
        d="M10.2 25.4 16 13.2 21.8 25.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.9 20h6.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
