import type { ReactNode } from "react";
export type IconName =
  | "grid"
  | "headset"
  | "phone"
  | "bell"
  | "sliders"
  | "database"
  | "chart"
  | "package"
  | "search"
  | "chevron"
  | "play"
  | "pause"
  | "check"
  | "close"
  | "filter"
  | "download"
  | "plus"
  | "upload"
  | "clock"
  | "shield"
  | "more"
  | "menu"
  | "arrow"
  | "spark"
  | "file"
  | "refresh"
  | "eye"
  | "mic"
  | "info"
  | "edit";
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
    edit: <><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/></>,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    headset: (
      <>
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <path d="M18 19c0 1.1-.9 2-2 2h-3" />
        <rect x="3" y="13" width="4" height="6" rx="2" />
        <rect x="17" y="13" width="4" height="6" rx="2" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="11" cy="18" r="2" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5M4 19h16m-13-4 4-4 3 2 5-6" />
      </>
    ),
    package: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4.5 7.5l7.5 4 7.5-4M12 21v-9.5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    play: <path d="m8 5 11 7-11 7z" />,
    pause: (
      <>
        <path d="M9 5v14M15 5v14" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12m0-12L6 18" />,
    filter: <path d="M4 5h16l-6 7v6l-4 2v-8z" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    upload: <path d="M12 21V9m-5 5 5-5 5 5M5 3h14" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6zm-3 9 2 2 4-4" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    spark: (
      <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5zm7 13 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />
    ),
    file: <path d="M6 3h8l4 4v14H6zm8 0v5h5M9 13h6M9 17h6" />,
    refresh: (
      <path d="M20 7v5h-5M4 17v-5h5M6.1 9A7 7 0 0 1 18 7l2 5m-2.1 3A7 7 0 0 1 6 17l-2-5" />
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
