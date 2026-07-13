import { ExternalLink, Layers3, MonitorSmartphone, SlidersHorizontal, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { Phone } from "../types";
import { normalizePhoneBrand } from "../utils/brand";
import { formatPrice, formatScore } from "../utils/format";

type PhoneCardProps = {
  phone: Phone;
  index?: number;
  onOpenVersions: (phone: Phone) => void;
};

export function PhoneCard({ phone, index = 0, onOpenVersions }: PhoneCardProps) {
  const normalizedBrand = normalizePhoneBrand(phone);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(phone.image_url && !imageFailed);

  return (
    <article className="phone-card" style={{ "--item-index": index } as CSSProperties}>
      <div className="phone-image">
        {showImage ? (
          <img src={phone.image_url ?? ""} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <MonitorSmartphone size={32} />
        )}
      </div>
      <div className="phone-content">
        <div className="phone-title-row">
          <h2>{phone.name}</h2>
          <span className="brand-chip">{normalizedBrand}</span>
        </div>
        <div className="phone-value-row">
          <strong className={phone.price == null ? "is-muted-value" : ""}>{formatPrice(phone.price)}</strong>
          <span className={!phone.score ? "is-muted-score" : ""}>
            <Star size={14} />
            {formatScore(phone.score)}
          </span>
        </div>
        <p className="specs">{phone.specs || "暂无规格"}</p>
        <div className="phone-meta">
          <span>
            <Layers3 size={13} />
            {phone.version_count || 0} 个版本
          </span>
        </div>
        <div className="phone-actions">
          <button
            className="text-button"
            type="button"
            onClick={() => onOpenVersions(phone)}
            disabled={!phone.version_count}
          >
            <SlidersHorizontal size={14} />
            版本参数
          </button>
          {phone.source_url && (
            <a className="source-link" href={phone.source_url} target="_blank" rel="noreferrer">
              酷安 #{phone.source_product_id}
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
