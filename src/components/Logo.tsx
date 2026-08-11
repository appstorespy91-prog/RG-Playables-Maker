export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pf-logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#pf-logo-grad)" />
      <rect x="10" y="17" width="28" height="14" rx="7" fill="white" />
      <rect x="14.5" y="21" width="2.6" height="6" rx="1.3" fill="#4f46e5" />
      <rect x="11.7" y="22.7" width="8.2" height="2.6" rx="1.3" fill="#4f46e5" />
      <circle cx="29" cy="21.5" r="1.8" fill="#4f46e5" />
      <circle cx="29" cy="26.5" r="1.8" fill="#4f46e5" />
      <circle cx="26.5" cy="24" r="1.8" fill="#4f46e5" />
      <circle cx="31.5" cy="24" r="1.8" fill="#4f46e5" />
    </svg>
  );
}
