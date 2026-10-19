import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "book"
  | "user"
  | "mail"
  | "lock"
  | "eye"
  | "eyeOff"
  | "arrowRight"
  | "arrowUpRight"
  | "chevronRight"
  | "chevronLeft"
  | "check"
  | "shield"
  | "clock"
  | "target"
  | "trophy"
  | "sparkles"
  | "layers"
  | "hash"
  | "alert"
  | "logout"
  | "google"
  | "github"
  | "play"
  | "calendar"
  | "flame";

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3.5 10.6 12 3.5l8.5 7.1" />
      <path d="M5.4 9.5V20.5h13.2V9.5" />
    </>
  ),
  book: (
    <>
      <path d="M5 5.6A2.6 2.6 0 0 1 7.6 3H20v15.4H7.6A2.6 2.6 0 0 0 5 21z" />
      <path d="M5 21a2.6 2.6 0 0 1 2.6-2.6H20V21z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.6" />
      <path d="m4.5 7.5 7.5 5.4 7.5-5.4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
      <path d="M8.2 10V7.6a3.8 3.8 0 0 1 7.6 0V10" />
      <path d="M12 14.4v2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4.8 20 20" />
      <path d="M9.6 6.3A9.9 9.9 0 0 1 12 5.8c5.8 0 9.2 6.2 9.2 6.2a16 16 0 0 1-2.4 3.2" />
      <path d="M6.1 8.5A16.4 16.4 0 0 0 2.8 12S6.2 18.2 12 18.2a10 10 0 0 0 3.5-.65" />
      <path d="M10.2 10.4a2.9 2.9 0 0 0 3.6 3.6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4.5 12h15" />
      <path d="m14 6.5 5.5 5.5L14 17.5" />
    </>
  ),
  arrowUpRight: (
    <>
      <path d="M6.5 17.5 17.5 6.5" />
      <path d="M8.5 6.5h9v9" />
    </>
  ),
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  check: <path d="m4.8 12.4 4.4 4.3L19.2 6.9" />,
  shield: (
    <>
      <path d="M12 3.2 19.5 6v5.3c0 4.4-3 7.7-7.5 9.5-4.5-1.8-7.5-5.1-7.5-9.5V6z" />
      <path d="m8.8 11.9 2.2 2.2 4.3-4.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4v4.9l3.2 1.9" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.7" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v4.6a4 4 0 0 1-8 0z" />
      <path d="M8 5.5H5.2v1.6A3.4 3.4 0 0 0 8.6 10.5" />
      <path d="M16 5.5h2.8v1.6a3.4 3.4 0 0 1-3.4 3.4" />
      <path d="M12 12.6V16" />
      <path d="M8.2 20h7.6" />
      <path d="M9.5 16h5l.8 4H8.7z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5l1.35 3.9 3.9 1.35-3.9 1.35L12 14l-1.35-3.9-3.9-1.35 3.9-1.35z" />
      <path d="M18.4 14.2l.75 2.15 2.15.75-2.15.75-.75 2.15-.75-2.15-2.15-.75 2.15-.75z" />
      <path d="M5.3 14.6l.55 1.55 1.55.55-1.55.55-.55 1.55-.55-1.55-1.55-.55 1.55-.55z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.6 8.4 4.5L12 12.6 3.6 8.1z" />
      <path d="m4.6 12.1 7.4 4 7.4-4" />
      <path d="m4.6 16.1 7.4 4 7.4-4" />
    </>
  ),
  hash: (
    <>
      <path d="M9.2 4.5 7.7 19.5" />
      <path d="M16.3 4.5l-1.5 15" />
      <path d="M4.5 9.2h15" />
      <path d="M4 14.8h15" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.8 21 19H3z" />
      <path d="M12 9v4.6" />
      <circle cx="12" cy="16.5" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4.5H6.2A1.7 1.7 0 0 0 4.5 6.2v11.6a1.7 1.7 0 0 0 1.7 1.7H10" />
      <path d="M14.5 8 18.5 12l-4 4" />
      <path d="M9 12h9" />
    </>
  ),
  google: (
    <path
      d="M21.4 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.27a4.5 4.5 0 0 1-1.95 2.96v2.46h3.16c1.85-1.7 2.92-4.2 2.92-7.22Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  github: (
    <path
      d="M12 3.2a8.8 8.8 0 0 0-2.78 17.15c.44.08.6-.19.6-.42v-1.63c-2.45.53-2.97-1.04-2.97-1.04-.4-1.02-.98-1.3-.98-1.3-.8-.54.06-.53.06-.53.88.06 1.35.9 1.35.9.79 1.35 2.07.96 2.57.73.08-.57.31-.96.56-1.18-1.96-.22-4.02-.98-4.02-4.36 0-.96.34-1.75.9-2.37-.09-.22-.39-1.12.09-2.33 0 0 .74-.24 2.42.9a8.4 8.4 0 0 1 4.4 0c1.68-1.14 2.42-.9 2.42-.9.48 1.21.18 2.11.09 2.33.56.62.9 1.41.9 2.37 0 3.39-2.07 4.14-4.04 4.36.32.28.6.82.6 1.65v2.45c0 .23.16.5.61.42A8.8 8.8 0 0 0 12 3.2Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  play: <path d="M9 6.4 18 12l-9 5.6z" />,
  calendar: (
    <>
      <rect x="3.8" y="5.6" width="16.4" height="14.4" rx="2.4" />
      <path d="M8 3.5v4" />
      <path d="M16 3.5v4" />
      <path d="M4.5 10h15" />
    </>
  ),
  flame: (
    <>
      <path d="M12.4 3.4c.4 3-1.5 4.2-2.9 5.9-1.3 1.6-2.2 3.1-1.4 5.2.6 1.6 2.1 2.5 3.9 2.5 2.4 0 4.2-1.8 4.2-4.2 0-2.9-2.5-4.3-3.8-9.4Z" />
      <path d="M12.2 20.9c-3.9 0-6.6-2.3-6.6-5.6 0-2.4 1.3-4 2.9-5.6" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  ...rest
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
} & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
