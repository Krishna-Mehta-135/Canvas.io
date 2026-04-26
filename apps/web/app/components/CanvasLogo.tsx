import { SVGProps } from "react";

export function CanvasLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M 74 32 A 30 30 0 0 0 26 68" stroke="currentColor" strokeWidth="28" strokeLinecap="round" />
      <path d="M 78.5 59.5 A 30 30 0 0 1 59.5 78.5" stroke="currentColor" strokeWidth="28" strokeLinecap="round" />
    </svg>
  );
}
