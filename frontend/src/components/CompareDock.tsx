import { Columns3, Trash2, X } from "lucide-react";
import type { CompareSelection } from "../types";

type CompareDockProps = {
  selection: CompareSelection[];
  onOpen: () => void;
  onRemove: (configId: string) => void;
  onClear: () => void;
};

export function CompareDock({ selection, onOpen, onRemove, onClear }: CompareDockProps) {
  return (
    <section className="compare-dock" aria-label="对比栏">
      <div className="compare-dock-items">
        {selection.map((item) => (
          <span className="compare-chip" key={item.config_id}>
            <strong>{item.phone_name}</strong>
            <em>{item.title}</em>
            <button type="button" onClick={() => onRemove(item.config_id)} aria-label="移除">
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="compare-dock-actions">
        <button className="text-button" type="button" onClick={onClear}>
          <Trash2 size={14} />
          清空
        </button>
        <button className="icon-button" type="button" onClick={onOpen} disabled={selection.length < 2}>
          <Columns3 size={16} />
          对比 {selection.length}
        </button>
      </div>
    </section>
  );
}
