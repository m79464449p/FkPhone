import { Badge, Button, Drawer, Group, Stack, Table, Text, Title } from "@mantine/core";
import { Check, ExternalLink, Plus, X } from "lucide-react";
import type { Phone, PhoneVersion } from "../types";
import { normalizePhoneBrand } from "../utils/brand";
import { formatPrice } from "../utils/format";

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
    <Drawer opened onClose={onClose} title={phone.name} position="right" size="xl">
      <Stack gap="md">
        <Badge variant="light" color="teal" w="fit-content">
          {normalizedBrand}
        </Badge>
        {loading && <Text c="dimmed">正在加载版本参数</Text>}
        {error && <Text c="red">版本参数加载失败：{error}</Text>}
        {!loading && !error && versions.length === 0 && <Text c="dimmed">暂无版本参数</Text>}
        {!loading && !error && versions.length > 0 && (
          <VersionSummary
            phone={phone}
            versions={versions}
            selectedConfigIds={selectedConfigIds}
            onToggleCompare={onToggleCompare}
          />
        )}
      </Stack>
    </Drawer>
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

  return (
    <Stack gap="md" className="version-summary">
      <section className="sku-section" aria-label="SKU 版本">
        <Group justify="space-between" align="center">
          <Title order={4}>SKU</Title>
          <Text size="sm" c="dimmed">
            {versions.length} 个版本
          </Text>
        </Group>
        <Group gap="xs" className="sku-tags" wrap="wrap">
          {versions.map((version) => {
            const selected = selectedConfigIds.includes(version.config_id);
            return (
              <Button
                key={version.config_id}
                type="button"
                onClick={() => onToggleCompare(phone, version)}
                variant={selected ? "filled" : "light"}
                leftSection={selected ? <Check size={14} /> : <Plus size={14} />}
              >
                {version.title}
                <Text span ml={8} size="xs">
                  {formatPrice(version.price)}
                </Text>
              </Button>
            );
          })}
        </Group>
      </section>

      <section className="parameter-section" aria-label="参数摘要">
        <Group justify="space-between" align="center">
          <Title order={4}>参数</Title>
          <Text size="sm" c="dimmed">
            {representative.specs.length} 项参数
          </Text>
        </Group>
        <Table withTableBorder withColumnBorders className="spec-list">
          <Table.Tbody>
            {representative.specs.map((spec, index) => (
              <Table.Tr key={`${representative.config_id}-${index}-${spec.group}-${spec.subgroup}-${spec.name}`}>
                <Table.Th>{spec.name}</Table.Th>
                <Table.Td>{spec.value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {representative.source_url && (
          <Button component="a" href={representative.source_url} target="_blank" rel="noreferrer" variant="subtle" rightSection={<ExternalLink size={14} />}>
            参数原页
          </Button>
        )}
      </section>
    </Stack>
  );
}
