import { X } from "lucide-react";
import type { PhoneCompare } from "../types";
import { formatPrice } from "../utils/format";

type ComparePanelProps = {
  data: PhoneCompare | null;
  loading: boolean;
  error: string;
  onClose: () => void;
};

export function ComparePanel({ data, loading, error, onClose }: ComparePanelProps) {
  return (
    <div className="detail-overlay" role="dialog" aria-modal="true" aria-label="参数对比">
      <aside className="compare-panel">
        <header className="detail-header">
          <div>
            <span className="detail-kicker">Compare</span>
            <h2>参数对比</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        {loading && <div className="state-box">正在生成对比</div>}
        {error && <div className="state-box error-box">对比加载失败：{error}</div>}
        {!loading && !error && data && <CompareTable data={data} />}
      </aside>
    </div>
  );
}

function CompareTable({ data }: { data: PhoneCompare }) {
  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th>参数</th>
            {data.columns.map((column) => (
              <th key={column.config_id}>
                <strong>{column.phone_name}</strong>
                <span>{column.title}</span>
                <em>{formatPrice(column.price)}</em>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={`${row.group}-${row.subgroup}-${row.name}`}>
              <th>
                <strong>{row.name}</strong>
                <span>{[row.group, row.subgroup].filter(Boolean).join(" / ")}</span>
              </th>
              {data.columns.map((column) => (
                <td key={`${row.name}-${column.config_id}`}>{row.values[column.config_id] || "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
