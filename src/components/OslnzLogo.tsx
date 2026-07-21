interface Props {
  className?: string;
  size?: number;
}

export function OslnzLogo({ className, size = 32 }: Props) {
  return (
    <div
      className={"inline-flex items-center gap-2.5 select-none " + (className ?? "")}
      aria-label="OSLNZ"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect x="1" y="1" width="38" height="38" rx="10" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="2.5" fill="currentColor" />
        <circle cx="30" cy="10.5" r="1.25" fill="currentColor" />
      </svg>
      <span className="font-display font-semibold tracking-[0.28em] text-[0.95rem]">
        OSLNZ
      </span>
    </div>
  );
}