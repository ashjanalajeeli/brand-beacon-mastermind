"use client";

import { cn } from "@/lib/utils";
import type { ElementType } from "react";
import { memo } from "react";

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
}: TextShimmerProps) => {
  return (
    <Component
      className={cn(
        "animate-shimmer relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg,#0000_calc(50%-100px),var(--color-background),#0000_calc(50%+100px)), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        animationDuration: `${duration}s`,
      }}
    >
      {children}
    </Component>
  );
};

export const Shimmer = memo(ShimmerComponent);
