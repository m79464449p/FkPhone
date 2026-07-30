import { Badge, Tabs, Text } from "@mantine/core";
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
    <Tabs value={activeTab} onChange={(value) => onChange((value ?? "parameters") as WorkspaceTab)} className="workspace-tab-control">
      <Tabs.List aria-label="功能切换">
        <Tabs.Tab value="parameters" leftSection={<SlidersHorizontal size={16} />}>
          <Text span fw={700}>
            参数
          </Text>
          <Badge variant="light" color="gray" size="sm" ml={8}>
            {phoneCount.toLocaleString("zh-CN")}
          </Badge>
        </Tabs.Tab>
        <Tabs.Tab value="ranking" leftSection={<ChartNoAxesColumnIncreasing size={16} />}>
          <Text span fw={700}>
            排行
          </Text>
          <Badge variant="light" color="gray" size="sm" ml={8}>
            4
          </Badge>
        </Tabs.Tab>
        <Tabs.Tab value="goofish" leftSection={<ShoppingBag size={16} />}>
          <Text span fw={700}>
            闲鱼
          </Text>
          <Badge variant="light" color="gray" size="sm" ml={8}>
            {goofishCount.toLocaleString("zh-CN")}
          </Badge>
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}
