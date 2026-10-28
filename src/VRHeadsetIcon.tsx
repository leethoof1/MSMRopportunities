import type { SVGProps } from "react";

export default function VRHeadsetIcon({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon="vr-headset"
      {...props}
    >
      <path d="M8.5 5V3.5h7V5" />
      <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4l-1.5-2h-3l-1.5 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
      <path d="M3 9H1v5h2m18-5h2v5h-2" />
      <path d="m6.5 9 2 4 2-4m3 4V9h2a1.2 1.2 0 0 1 0 2.4h-2m2-0.1 1.5 1.7" />
    </svg>
  );
}
