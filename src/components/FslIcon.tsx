import { cn } from "@/lib/utils";
import React from "react";

interface FslIconProps extends React.SVGProps<SVGSVGElement> {
  // You can add any custom props here if needed
}

export function FslIcon({ className, ...props }: FslIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-6 w-6", className)}
      {...props}
    >
      <path d="M3 10h3v4H3z" />
      <path d="M7 10h3v4H7z" />
      <path d="M14 10h3v4h-3z" />
      <path d="M21 10h-3v4h3z" />
      <path d="M10 10v4" />
      <path d="M17.5 10v4" />
      <path d="M3.5 14v2.5" />
      <path d="M14 14v2.5" />
      <path d="M7 14v2.5" />
      <path d="M17.5 14v2.5" />
      <path d="M10 14v2.5" />
      <path d="M20.5 14v2.5" />
      <path d="M3.5 10V8" />
      <path d="M7 10V8" />
      <path d="M10 10V8" />
      <path d="M14 10V8" />
      <path d="M17.5 10V8" />
      <path d="M20.5 10V8" />
    </svg>
  );
}
