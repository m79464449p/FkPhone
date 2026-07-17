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
  const rankingUrl = `https://www.socpk.com/${rankingPath}/`;

  return (
    <section className="ranking-panel" aria-label="性能排行">
      {headerContent && <div className="workspace-dashboard-header ranking-dashboard-header">{headerContent}</div>}

      <header className="ranking-header">
        <div>
          <span className="detail-kicker">SOCPK</span>
          <h2>{activeView.title}</h2>
        </div>
        <a className="ranking-open-link" href={rankingUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          原页
        </a>
      </header>

      <div className="ranking-tabs" aria-label="性能榜单切换">
        {RANKING_VIEWS.map((view) => (
          <button
            className={view.key === rankingPath ? "active" : ""}
            key={view.key}
            type="button"
            onClick={() => setRankingPath(view.key)}
          >
            {view.label}
          </button>
        ))}
      </div>

      <iframe className="ranking-frame" title={activeView.title} src={rankingUrl} loading="lazy" />
    </section>
  );
}
