import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Shared layout container for all GitEscrow home page sections.
 * Enforces strict 1200px max-width, auto margins, and 24px gutters.
 */
export function Container({ children, className = "", style }: ContainerProps) {
  return (
    <div
      className={`home-container ${className}`}
      style={{
        width: "100%",
        maxWidth: "1200px",
        marginInline: "auto",
        paddingInline: "24px",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
