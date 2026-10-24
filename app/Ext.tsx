import type { AnchorHTMLAttributes } from "react";

/** A link to another site: opens in a new tab and says so to screen readers (RGAA 13.2). */
export function Ext({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...props} target="_blank" rel="noopener">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
