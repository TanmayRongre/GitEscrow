import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Shared layout container for all GitEscrow home page sections.
 * Automatically adapts max-width and horizontal gutters based on device viewport.
 */
export function Container({ children, className = "", style }: ContainerProps) {
  return (
    <div
      className={`home-container ${className}`}
      style={{
        width: "100%",
        maxWidth: "var(--container-max-width, 1200px)",
        marginInline: "auto",
        paddingInline: "var(--container-gutter, 24px)",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
