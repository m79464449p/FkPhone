import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { Braces, RefreshCw } from "lucide-react";

type AppHeaderProps = {
  syncing: boolean;
  onSync: () => void;
  onOpenSocmark: () => void;
};

export function AppHeader({ syncing, onSync, onOpenSocmark }: AppHeaderProps) {
  return (
    <Paper className="topbar app-hero" withBorder radius="md" p="md">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Stack gap={2} className="hero-copy">
          <Text size="xs" fw={800} tt="uppercase" c="teal.7">
            FkPhone
          </Text>
          <Title order={1}>手机数据看板</Title>
        </Stack>
        <Group gap="xs" className="header-actions" wrap="nowrap">
          <Button
            component="a"
            href="/socmark"
            variant="light"
            color="teal"
            leftSection={<Braces size={16} />}
            onClick={(event) => {
              event.preventDefault();
              onOpenSocmark();
            }}
          >
            接口
          </Button>
          <Button leftSection={<RefreshCw size={16} />} onClick={onSync} loading={syncing}>
            同步
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
