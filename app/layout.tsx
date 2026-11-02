import type { Metadata } from "next";
import "./globals.css";
import "./workspace-system.css";
import "./shadcn.css";
import "./review-workspace2.css";
import "./strategy-design.css";
import "./catalog-report-design.css";
import "./record-id.css";
import "./form-table-design.css";
import "./control-states.css";
import "./evidence-audio.css";
import "./6003-refinements.css";
export const metadata: Metadata = {
  description: "三核心角色、七个业务模块的银行呼入客服质检高保真原型",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
