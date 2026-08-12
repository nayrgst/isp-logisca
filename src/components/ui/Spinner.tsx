interface Props {
  className?: string;
  label?: string;
}

export function Spinner({ className = 'h-4 w-4', label }: Props) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V1C5.9 1 1 5.9 1 12h3z"
      />
    </svg>
  );
}
