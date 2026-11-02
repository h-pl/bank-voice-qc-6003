"use client";
import type { ComponentProps } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "./ui/button";

/** Appears only while filters differ from the page defaults. */
export function ResetFiltersButton({ active = true, onClick }: {
  active?: boolean;
  onClick: ComponentProps<typeof Button>["onClick"];
}) {
  if (!active) return null;
  return <Button type="button" variant="outline" className="btn reset-filters-button" onClick={onClick}>
    <RotateCcw size={16} aria-hidden="true"/><span>重置筛选</span>
  </Button>;
}
