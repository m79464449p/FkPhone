import { Braces, RefreshCw } from "lucide-react";

type AppHeaderProps = {
  syncing: boolean;
  onSync: () => void;
  onOpenSocmark: () => void;
};

export function AppHeader({ syncing, onSync, onOpenSocmark }: AppHeaderProps) {
  return (
    <section className="topbar app-hero">
      <div className="hero-copy">
        <p className="eyebrow">FkPhone</p>
        <h1>手机数据看板</h1>
      </div>
      <div className="header-actions">
        <a
          className="header-sync-button"
          href="/socmark"
          onClick={(event) => {
            event.preventDefault();
            onOpenSocmark();
          }}
        >
          <Braces size={16} />
          接口
        </a>
        <button className="header-sync-button" onClick={onSync} type="button" disabled={syncing}>
          <RefreshCw size={16} />
          {syncing ? "同步中" : "同步"}
        </button>
      </div>
    </section>
  );
}
