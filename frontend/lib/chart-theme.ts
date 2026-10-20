export const CHART_COLORS = ["#F5B94A", "#6EA8FE", "#3DDC97", "#C084FC", "#FF8FA3", "#4FD1C5", "#94A3B8"];
export const CASH_COLOR = "#3A3F4B";
export const GRID_STROKE = "rgba(255,255,255,0.06)";
export const AXIS_STROKE = "#5D626E";
export const UP = "#3DDC97";
export const DOWN = "#FF6B6B";
export const GOLD = "#F5B94A";

export const tooltipStyle = {
  contentStyle: {
    background: "#10131A",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "#F3F0E8",
    boxShadow: "0 18px 50px -18px rgba(0,0,0,0.9)",
    fontSize: 12,
    padding: "8px 12px",
  },
  itemStyle: { color: "#F3F0E8" },
  labelStyle: { color: "#8E93A0", marginBottom: 2 },
  cursor: { stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 },
} as const;
