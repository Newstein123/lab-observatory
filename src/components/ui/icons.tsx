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
  ChevronDown: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  ),
  Arrow: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
  Eye: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  Sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </Svg>
  ),
  Moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </Svg>
  ),
  Star: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </Svg>
  ),
  Galaxy: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 12c0-3 2.5-5 5.5-4.5M12 12c3 0 5 2.5 4.5 5.5M12 12c0 3-2.5 5-5.5 4.5M12 12c-3 0-5-2.5-4.5-5.5" />
      <circle cx="12" cy="12" r="1.3" />
    </Svg>
  ),
  Nebula: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 15a4 4 0 0 1 1-7.8A5 5 0 0 1 16.6 8 3.5 3.5 0 0 1 18 15z" />
      <path d="M8 19h8M10 22h4" />
    </Svg>
  ),
  Sparkles: (p: IconProps) => (
    <Svg {...p}>
      <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z" />
      <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" />
    </Svg>
  ),
  Pin: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  ),
  Locate: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3.5 11L20.5 3.5 13 20.5l-2-7.5z" />
    </Svg>
  ),
  Calendar: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </Svg>
  ),
  Chart: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 20V11M10 20V5M15 20v-7M20 20V8" />
    </Svg>
  ),
  Cone: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3L5 19M12 3l7 16" />
      <ellipse cx="12" cy="19" rx="7" ry="2" />
    </Svg>
  ),
  Aperture: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.3 3.3L9 12.4M20.4 9.4L9.6 9.2M17.9 18.4l-5.4-9.1M9.7 20.7l5.3-9.1M3.6 14.6l10.8.2M6.1 5.6l5.4 9.1" />
    </Svg>
  ),
  Crosshair: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
    </Svg>
  ),
  Download: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4v11M7 10.5l5 5 5-5" />
      <path d="M4.5 19.5h15" />
    </Svg>
  ),
  Expand: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </Svg>
  ),
  Gear: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  ),
  Sliders: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  ),
  Info: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.5" />
    </Svg>
  ),
  Warning: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 4L2.5 20h19z" />
      <path d="M12 10v4.5M12 17.5v.5" />
    </Svg>
  ),
  Image: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M20.5 16l-5-5-9 8.5" />
    </Svg>
  ),
};
