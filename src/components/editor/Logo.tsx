export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0643f" />
          <stop offset="1" stopColor="#b8341f" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#logo-g)" />
      <path d="M8 9h9a5 5 0 0 1 0 10h-3l5 5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9v15" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24.5" cy="9" r="2" fill="#ffd66b" />
    </svg>
  );
}
