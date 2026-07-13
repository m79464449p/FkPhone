import { Check, ExternalLink, Plus, X } from "lucide-react";
import type { Phone, PhoneVersion } from "../types";
import { normalizePhoneBrand } from "../utils/brand";
import { formatPrice } from "../utils/format";
import { pickFeaturedSpecs } from "../utils/phone";

type VersionPanelProps = {
  phone: Phone;
  versions: PhoneVersion[];
  loading: boolean;
  error: string;
  selectedConfigIds: string[];
  onToggleCompare: (phone: Phone, version: PhoneVersion) => void;
  onClose: () => void;
};

export function VersionPanel({
  phone,
  versions,
  loading,
  error,
  selectedConfigIds,
  onToggleCompare,
  onClose
}: VersionPanelProps) {
  const normalizedBrand = normalizePhoneBrand(phone);

  return (
    <div className="detail-overlay" role="dialog" aria-modal="true" aria-label={`${phone.name} 版本参数`}>
      <aside className="detail-panel">
        <header className="detail-header">
          <div>
            <span className="detail-kicker">{normalizedBrand}</span>
            <h2>{phone.name}</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        {loading && <div className="state-box">正在加载版本参数</div>}
        {error && <div className="state-box error-box">版本参数加载失败：{error}</div>}
        {!loading && !error && versions.length === 0 && <div className="state-box">暂无版本参数</div>}

        {!loading && !error && versions.length > 0 && (
          <VersionSummary
            phone={phone}
            versions={versions}
            selectedConfigIds={selectedConfigIds}
            onToggleCompare={onToggleCompare}
          />
        )}
      </aside>
    </div>
  );
}

type VersionSummaryProps = {
  phone: Phone;
  versions: PhoneVersion[];
  selectedConfigIds: string[];
  onToggleCompare: (phone: Phone, version: PhoneVersion) => void;
};

function VersionSummary({ phone, versions, selectedConfigIds, onToggleCompare }: VersionSummaryProps) {
  const representative = versions[0];
  const featuredSpecs = pickFeaturedSpecs(representative.specs);

  return (
    <div className="version-summary">
      <section className="sku-section" aria-label="SKU 版本">
        <div className="section-title">
          <h3>SKU</h3>
          <span>{versions.length} 个版本</span>
        </div>
        <div className="sku-tags">
          {versions.map((version) => {
            const selected = selectedConfigIds.includes(version.config_id);
            return (
              <button
                className={`sku-tag ${selected ? "selected" : ""}`}
                key={version.config_id}
                type="button"
                onClick={() => onToggleCompare(phone, version)}
              >
                {selected ? <Check size={14} /> : <Plus size={14} />}
                <strong>{version.title}</strong>
                <em>{formatPrice(version.price)}</em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="parameter-section" aria-label="参数摘要">
        <div className="section-title">
          <h3>参数</h3>
          <span>{representative.specs.length} 项参数</span>
        </div>
        <dl className="spec-list">
          {featuredSpecs.map((spec) => (
            <div className="spec-row" key={`${representative.config_id}-${spec.group}-${spec.subgroup}-${spec.name}`}>
              <dt>{spec.name}</dt>
              <dd>{spec.value}</dd>
            </div>
          ))}
        </dl>

        {representative.source_url && (
          <a className="source-link" href={representative.source_url} target="_blank" rel="noreferrer">
            参数原页
            <ExternalLink size={14} />
          </a>
        )}
      </section>
    </div>
  );
}
