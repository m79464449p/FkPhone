import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";

type RankingView = {
  key: string;
  label: string;
  title: string;
};

const RANKING_VIEWS: RankingView[] = [
  { key: "allperf", label: "综合", title: "综合性能排行" },
  { key: "cpu", label: "CPU", title: "CPU 性能排行" },
  { key: "gpu", label: "GPU", title: "GPU 性能排行" },
  { key: "cpueffcrank", label: "能效", title: "CPU 能效排行" }
];

type RankingPanelProps = {
  headerContent?: ReactNode;
};

export function RankingPanel({ headerContent }: RankingPanelProps) {
  const [rankingPath, setRankingPath] = useState("allperf");
  const activeView = RANKING_VIEWS.find((view) => view.key === rankingPath) ?? RANKING_VIEWS[0];
  const rankingUrl = rankingPath === "allperf" ? "https://www.socpk.com/" : `https://www.socpk.com/${rankingPath}/`;

  return (
    <Paper component="section" withBorder radius="md" p="md" className="ranking-panel" aria-label="性能排行">
      {headerContent && <div className="workspace-dashboard-header ranking-dashboard-header">{headerContent}</div>}

      <Group justify="space-between" align="center" className="ranking-header">
        <Stack gap={0}>
          <Text size="xs" fw={800} tt="uppercase" c="teal.7">
            SOCPK
          </Text>
          <Title order={3}>{activeView.title}</Title>
        </Stack>
        <Button
          className="ranking-open-link"
          component="a"
          href={rankingUrl}
          target="_blank"
          rel="noreferrer"
          variant="light"
          rightSection={<ExternalLink size={16} />}
        >
          原页
        </Button>
      </Group>

      <Group className="ranking-tabs" aria-label="性能榜单切换" gap="xs">
        {RANKING_VIEWS.map((view) => (
          <Button
            className={view.key === rankingPath ? "active" : ""}
            key={view.key}
            type="button"
            variant={view.key === rankingPath ? "filled" : "light"}
            onClick={() => setRankingPath(view.key)}
          >
            {view.label}
          </Button>
        ))}
      </Group>

      <div className="ranking-frame-shell">
        <iframe className="ranking-frame" title={activeView.title} src={rankingUrl} loading="lazy" />
      </div>
    </Paper>
  );
}
