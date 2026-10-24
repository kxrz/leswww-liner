import type { AnchorHTMLAttributes } from "react";

/**
 * A link to another site: opens in a new tab and says so to screen readers (RGAA 13.2).
 * `sponsored` marks affiliate links for search engines.
 */
export function Ext({ children, sponsored, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { sponsored?: boolean }) {
  return (
    <a {...props} target="_blank" rel={sponsored ? "sponsored noopener" : "noopener"}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
