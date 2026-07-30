import { Alert, Button, Center, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { ArrowDownUp, SearchX } from "lucide-react";
import type { Phone, SortKey } from "../types";
import { sortLabel } from "../utils/phone";
import { PhoneCard } from "./PhoneCard";

type PhoneResultsProps = {
  phones: Phone[];
  totalCount: number;
  visibleCount: number;
  sortKey: SortKey;
  loading: boolean;
  error: string;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onOpenVersions: (phone: Phone) => void;
};

export function PhoneResults({
  phones,
  totalCount,
  visibleCount,
  sortKey,
  loading,
  error,
  canLoadMore,
  onLoadMore,
  onOpenVersions
}: PhoneResultsProps) {
  return (
    <>
      <Group justify="space-between" align="center" className="result-header" aria-label="列表状态">
        <Text fw={800}>
          {totalCount.toLocaleString("zh-CN")} <Text span c="dimmed" fw={400}>条结果</Text>
        </Text>
        <Group gap="md" className="result-meta">
          <Text c="dimmed" size="sm">
            已展示 {Math.min(visibleCount, totalCount).toLocaleString("zh-CN")}
          </Text>
          <Text c="dimmed" size="sm">
            <ArrowDownUp size={15} style={{ display: "inline", marginRight: 4 }} />
            {sortLabel(sortKey)}
          </Text>
        </Group>
      </Group>

      {loading && <Alert variant="light" color="gray" title="正在加载数据" />}
      {error && (
        <Alert variant="light" color="red" title="接口连接失败">
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <>
          {totalCount === 0 ? (
            <Center mih={200}>
              <Stack align="center" gap="xs">
                <SearchX size={24} />
                <Title order={4}>没有匹配机型</Title>
                <Text c="dimmed" size="sm">
                  换一个关键词或品牌筛选
                </Text>
              </Stack>
            </Center>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" className="phone-grid" aria-label="手机列表">
              {phones.map((phone, index) => (
                <PhoneCard key={phone.id} phone={phone} index={index} onOpenVersions={onOpenVersions} />
              ))}
            </SimpleGrid>
          )}

          {canLoadMore && (
            <Center mt="md">
              <Button size="sm" variant="light" onClick={onLoadMore}>
                加载更多
              </Button>
            </Center>
          )}
        </>
      )}
    </>
  );
}
