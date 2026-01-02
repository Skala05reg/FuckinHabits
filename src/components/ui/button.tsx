"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-primary text-primary-foreground shadow-soft hover:opacity-90",
        variant === "secondary" &&
          "bg-muted text-foreground hover:bg-muted/80",
        variant === "ghost" && "bg-transparent hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
