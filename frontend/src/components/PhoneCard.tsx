import { Badge, Button, Card, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { ExternalLink, Layers3, MonitorSmartphone, SlidersHorizontal, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { Phone } from "../types";
import { normalizePhoneBrand } from "../utils/brand";
import { formatPrice, formatScore } from "../utils/format";
import { getDisplayImageUrl } from "../utils/images";

type PhoneCardProps = {
  phone: Phone;
  index?: number;
  onOpenVersions: (phone: Phone) => void;
};

export function PhoneCard({ phone, index = 0, onOpenVersions }: PhoneCardProps) {
  const normalizedBrand = normalizePhoneBrand(phone);
  const [imageFailed, setImageFailed] = useState(false);
  const displayImageUrl = getDisplayImageUrl(phone.image_url);
  const showImage = Boolean(displayImageUrl && !imageFailed);

  return (
    <Card withBorder radius="md" shadow="xs" className="phone-card" style={{ "--item-index": index } as CSSProperties}>
      <div className="phone-image">
        {showImage ? (
          <img src={displayImageUrl ?? ""} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <MonitorSmartphone size={32} />
        )}
      </div>
      <Stack gap="xs" className="phone-content">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text fw={800} lineClamp={2}>
            {phone.name}
          </Text>
          <Badge variant="light" color="teal">
            {normalizedBrand}
          </Badge>
        </Group>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Text fw={800} c={phone.price == null ? "dimmed" : "red"}>
            {formatPrice(phone.price)}
          </Text>
          <Text c={phone.score ? "gray" : "dimmed"} size="sm">
            <Star size={14} style={{ display: "inline", marginRight: 4 }} />
            {formatScore(phone.score)}
          </Text>
        </Group>
        <Text size="sm" c="dimmed" lineClamp={3}>
          {phone.specs || "暂无规格"}
        </Text>
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon size={20} radius="md" variant="light" color="gray">
            <Layers3 size={12} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            {phone.version_count || 0} 个版本
          </Text>
        </Group>
        <Group gap="xs" grow>
          <Button
            size="sm"
            leftSection={<SlidersHorizontal size={14} />}
            data-testid="open-versions"
            type="button"
            onClick={() => onOpenVersions(phone)}
            disabled={!phone.version_count}
            variant="light"
          >
            版本参数
          </Button>
          {phone.source_url && (
            <Button size="sm" component="a" href={phone.source_url} target="_blank" rel="noreferrer" variant="subtle" rightSection={<ExternalLink size={14} />}>
              酷安 #{phone.source_product_id}
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
