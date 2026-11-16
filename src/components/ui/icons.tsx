/** Small line icons (24×24, currentColor). Decorative unless labelled. */
type IconProps = { className?: string };

function Svg({ className = "size-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export const Icons = {
  Logo: ({ className = "size-8" }: IconProps) => (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="uo-planet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9b4ff" />
          <stop offset="1" stopColor="#5162ff" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="8.5" fill="url(#uo-planet)" />
      <ellipse cx="16" cy="16" rx="14.5" ry="5" fill="none" stroke="#c9b8ff" strokeWidth="1.4" transform="rotate(-24 16 16)" />
      <path d="M8.2 12.4a8.5 8.5 0 0 1 15.6 0" fill="url(#uo-planet)" />
    </svg>
  ),
  Telescope: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3.5 13.5l13-6 1.7 3.6-13 6z" />
      <path d="M16.5 7.5l3-1.4 1.7 3.6-3 1.4" />
      <path d="M10 15l-3 6M11.5 14.5l3 6.5M10.7 14.6V21" />
    </Svg>
  ),
  Wrench: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14.5 6.5a4 4 0 0 0 5 5l-8.5 8.5a2.1 2.1 0 0 1-3-3z" />
      <path d="M14.5 6.5L17 4l3 3-2.5 2.5" />
    </Svg>
  ),
  Home: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 11l8-6 8 6v9H4z" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  ),
  Mount: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4v8M7 21l5-9 5 9M12 12v9" />
      <circle cx="12" cy="4" r="1.5" />
    </Svg>
  ),
  Eyepiece: (p: IconProps) => (
    <Svg {...p}>
      <rect x="7" y="3" width="10" height="9" rx="2" />
      <path d="M9 12h6v9H9z" />
    </Svg>
  ),
  Camera: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <circle cx="12" cy="13" r="3" />
      <path d="M9 7l1.5-3h3L15 7" />
    </Svg>
  ),
  Barlow: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 3h8v5H8zM9 8h6v13H9z" />
    </Svg>
  ),
  Filter: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5" />
    </Svg>
  ),
  Layers: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </Svg>
  ),
  Play: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l5 3.5-5 3.5z" />
    </Svg>
  ),
  Compare: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="5" width="7" height="14" rx="1.5" />
      <rect x="14" y="5" width="7" height="14" rx="1.5" />
    </Svg>
  ),
  Folder: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  ),
  Grid: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Svg>
  ),
  Building: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20h16M6 20v-8a6 6 0 0 1 12 0v8" />
      <path d="M12 6V3M10 20v-4h4v4" />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </Svg>
  ),
  Target: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  Bookmark: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </Svg>
  ),
  Chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  Back: (p: IconProps) => (
    <Svg {...p}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  ),
  Rotate: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4h-4" />
    </Svg>
  ),
};
