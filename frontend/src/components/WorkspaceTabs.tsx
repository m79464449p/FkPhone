import { ChartNoAxesColumnIncreasing, ShoppingBag, SlidersHorizontal } from "lucide-react";
import type { WorkspaceTab } from "../types";

type WorkspaceTabsProps = {
  activeTab: WorkspaceTab;
  phoneCount: number;
  goofishCount: number;
  onChange: (tab: WorkspaceTab) => void;
};

export function WorkspaceTabs({ activeTab, phoneCount, goofishCount, onChange }: WorkspaceTabsProps) {
  return (
    <nav className="workspace-tabs" aria-label="功能切换">
      <button
        className={activeTab === "parameters" ? "active" : ""}
        type="button"
        onClick={() => onChange("parameters")}
        aria-current={activeTab === "parameters" ? "page" : undefined}
      >
        <SlidersHorizontal size={17} />
        参数
        <span>{phoneCount.toLocaleString("zh-CN")}</span>
      </button>
      <button
        className={activeTab === "ranking" ? "active" : ""}
        type="button"
        onClick={() => onChange("ranking")}
        aria-current={activeTab === "ranking" ? "page" : undefined}
      >
        <ChartNoAxesColumnIncreasing size={17} />
        排行
        <span>4</span>
      </button>
      <button
        className={activeTab === "goofish" ? "active" : ""}
        type="button"
        onClick={() => onChange("goofish")}
        aria-current={activeTab === "goofish" ? "page" : undefined}
      >
        <ShoppingBag size={17} />
        闲鱼
        <span>{goofishCount.toLocaleString("zh-CN")}</span>
      </button>
    </nav>
  );
}
