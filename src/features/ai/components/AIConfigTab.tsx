import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Modal,
  Form,
  Tag,
  Banner,
  Typography,
  Switch,
  Toast,
  Popconfirm,
  Tabs,
  TabPane,
  Card,
} from "@douyinfe/semi-ui";
import {
  IconPlus,
  IconRefresh,
  IconDelete,
  IconEdit,
  IconCheckCircleStroked,
  IconAlertCircle,
  IconCopy,
  IconServer,
  IconActivity,
  IconKanban,
} from "@douyinfe/semi-icons";
import { aiApi } from "../api/aiApi";
import type { AIChannel, ChannelCreateInput, PingResult, AIProvider } from "../types";

const { Text, Title, Paragraph } = Typography;

export function AIConfigTab() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AIChannel | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});
  const [pingingMap, setPingingMap] = useState<Record<string, boolean>>({});

  // 1. Fetch Channels
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["ai-channels"],
    queryFn: aiApi.listChannels,
  });

  // 2. Fetch Observability Metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["ai-metrics"],
    queryFn: () => aiApi.getMetrics(7),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: aiApi.createChannel,
    onSuccess: () => {
      Toast.success("渠道创建成功");
      setModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["ai-channels"] });
    },
    onError: (err: Error) => {
      Toast.error("创建失败: " + err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChannelCreateInput }) =>
      aiApi.updateChannel(id, data),
    onSuccess: () => {
      Toast.success("渠道更新成功");
      setModalVisible(false);
      setEditingChannel(null);
      queryClient.invalidateQueries({ queryKey: ["ai-channels"] });
    },
    onError: (err: Error) => {
      Toast.error("更新失败: " + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: aiApi.deleteChannel,
    onSuccess: () => {
      Toast.success("渠道已删除");
      queryClient.invalidateQueries({ queryKey: ["ai-channels"] });
    },
    onError: (err: Error) => {
      Toast.error("删除失败: " + err.message);
    },
  });

  const handlePing = async (channel: AIChannel) => {
    setPingingMap((prev) => ({ ...prev, [channel.id]: true }));
    try {
      const res = await aiApi.pingChannel(channel.id);
      setPingResults((prev) => ({ ...prev, [channel.id]: res }));
      if (res.status === "online") {
        Toast.success(`${channel.name} 连通正常 (${res.latency_ms}ms)`);
      } else {
        Toast.error(`${channel.name} 离线: ${res.error || "未知异常"}`);
      }
    } catch (e: any) {
      setPingResults((prev) => ({
        ...prev,
        [channel.id]: { status: "offline", latency_ms: 0, error: e.message },
      }));
      Toast.error(`测试失败: ${e.message}`);
    } finally {
      setPingingMap((prev) => ({ ...prev, [channel.id]: false }));
    }
  };

  const handleCopyMCP = () => {
    const config = {
      mcpServers: {
        "workbuddy-d": {
          url: "http://localhost:8080/api/v1/mcp/sse",
          command: "server.exe",
          args: ["mcp"],
        },
      },
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    Toast.success("MCP 配置已复制到剪贴板！");
  };

  const columns = [
    {
      title: "渠道名称",
      dataIndex: "name",
      key: "name",
      render: (text: string, r: AIChannel) => (
        <div>
          <Text strong>{text}</Text>
          <div className="text-xs text-muted-foreground mt-0.5">{r.base_url}</div>
        </div>
      ),
    },
    {
      title: "供应商",
      dataIndex: "provider",
      key: "provider",
      render: (p: string) => {
        const colorMap: Record<string, "blue" | "green" | "purple" | "orange" | "cyan"> = {
          openai: "green",
          deepseek: "blue",
          claude: "purple",
          ollama: "orange",
          siliconflow: "cyan",
        };
        return <Tag color={colorMap[p] || "grey"}>{p.toUpperCase()}</Tag>;
      },
    },
    {
      title: "支持模型",
      dataIndex: "models",
      key: "models",
      render: (models: string[]) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {models.length > 0 ? (
            models.map((m) => (
              <Tag key={m} size="small" color="light-blue">
                {m}
              </Tag>
            ))
          ) : (
            <Text type="tertiary" size="small">全部默认</Text>
          )}
        </div>
      ),
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      render: (pri: number) => <Tag color="amber">P{pri}</Tag>,
    },
    {
      title: "健康状态",
      key: "status",
      render: (_: any, r: AIChannel) => {
        const ping = pingResults[r.id];
        const isPinging = pingingMap[r.id];

        if (isPinging) {
          return <Tag color="yellow">检测中...</Tag>;
        }
        if (!ping) {
          return (
            <Button
              size="small"
              theme="borderless"
              icon={<IconRefresh />}
              onClick={() => handlePing(r)}
            >
              测试
            </Button>
          );
        }
        return ping.status === "online" ? (
          <Tag color="green" prefixIcon={<IconCheckCircleStroked />}>
            {ping.latency_ms}ms
          </Tag>
        ) : (
          <Tag color="red" prefixIcon={<IconAlertCircle />}>
            离线
          </Tag>
        );
      },
    },
    {
      title: "启停",
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean, r: AIChannel) => (
        <Switch
          checked={active}
          onChange={(val) => {
            updateMutation.mutate({
              id: r.id,
              data: {
                name: r.name,
                provider: r.provider,
                base_url: r.base_url,
                api_key: r.api_key,
                models: r.models,
                is_active: val,
                priority: r.priority,
              },
            });
          }}
        />
      ),
    },
    {
      title: "操作",
      key: "actions",
      render: (_: any, r: AIChannel) => (
        <div className="flex items-center gap-1">
          <Button
            size="small"
            theme="borderless"
            icon={<IconEdit />}
            onClick={() => {
              setEditingChannel(r);
              setModalVisible(true);
            }}
          />
          <Popconfirm
            title="确认删除该渠道？"
            content="删除后相关调度将无法使用该渠道。"
            onConfirm={() => deleteMutation.mutate(r.id)}
          >
            <Button size="small" theme="borderless" type="danger" icon={<IconDelete />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Banner
        type="info"
        description="WorkBuddy-D AI 模块由 ByteDance Eino 驱动，具备轻量级统一模型网关管理、业务 Skill 编排与标准 MCP 开放服务能力。"
      />

      <Tabs defaultActiveKey="gateway">
        {/* 1. 渠道与模型网关 */}
        <TabPane
          tab={
            <span>
              <IconServer className="mr-1" /> 模型网关
            </span>
          }
          itemKey="gateway"
        >
          <div className="py-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Title heading={5}>AI 供应渠道 (Channels)</Title>
                <Paragraph type="secondary" size="small">
                  按优先级自动降级调用。支持 OpenAI、DeepSeek、Ollama 及第三方兼容中继。
                </Paragraph>
              </div>
              <Button
                type="primary"
                icon={<IconPlus />}
                onClick={() => {
                  setEditingChannel(null);
                  setModalVisible(true);
                }}
              >
                添加渠道
              </Button>
            </div>

            <Table
              columns={columns}
              dataSource={channels}
              loading={channelsLoading}
              pagination={false}
              rowKey="id"
              size="small"
            />
          </div>
        </TabPane>

        {/* 2. 调用监控与审计 */}
        <TabPane
          tab={
            <span>
              <IconActivity className="mr-1" /> 监控与日志
            </span>
          }
          itemKey="metrics"
        >
          <div className="py-2 space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <Card bodyStyle={{ padding: "12px 16px" }}>
                <Text type="secondary" size="small">7天调用次数</Text>
                <Title heading={3} style={{ margin: "4px 0 0" }}>
                  {metrics?.summary?.total_calls ?? 0}
                </Title>
              </Card>
              <Card bodyStyle={{ padding: "12px 16px" }}>
                <Text type="secondary" size="small">总消耗 Tokens</Text>
                <Title heading={3} style={{ margin: "4px 0 0" }}>
                  {(metrics?.summary?.total_prompt_tokens ?? 0) +
                    (metrics?.summary?.total_completion_tokens ?? 0)}
                </Title>
              </Card>
              <Card bodyStyle={{ padding: "12px 16px" }}>
                <Text type="secondary" size="small">平均首字延迟 (TTFT)</Text>
                <Title heading={3} style={{ margin: "4px 0 0" }}>
                  {metrics?.summary?.avg_ttft_ms ?? 0}
                  <span className="text-xs font-normal text-muted-foreground ml-1">ms</span>
                </Title>
              </Card>
              <Card bodyStyle={{ padding: "12px 16px" }}>
                <Text type="secondary" size="small">平均总响应耗时</Text>
                <Title heading={3} style={{ margin: "4px 0 0" }}>
                  {metrics?.summary?.avg_latency_ms ?? 0}
                  <span className="text-xs font-normal text-muted-foreground ml-1">ms</span>
                </Title>
              </Card>
            </div>

            <div>
              <Title heading={6} style={{ marginBottom: 8 }}>
                最近调用审计日志
              </Title>
              <Table
                dataSource={metrics?.logs || []}
                loading={metricsLoading}
                pagination={{ pageSize: 8 }}
                rowKey="id"
                size="small"
                columns={[
                  {
                    title: "调用时间",
                    dataIndex: "created_at",
                    key: "created_at",
                    render: (t: string) => (
                      <Text size="small">{new Date(t).toLocaleString()}</Text>
                    ),
                  },
                  {
                    title: "技能/类型",
                    dataIndex: "skill_code",
                    key: "skill_code",
                    render: (s: string) => <Tag color="blue">{s || "chat"}</Tag>,
                  },
                  {
                    title: "执行模型",
                    dataIndex: "model_name",
                    key: "model_name",
                  },
                  {
                    title: "耗时 (TTFT / 总)",
                    key: "latency",
                    render: (_: any, r: any) => (
                      <Text size="small">
                        {r.ttft_ms}ms / {r.total_latency_ms}ms
                      </Text>
                    ),
                  },
                  {
                    title: "消耗 Tokens",
                    key: "tokens",
                    render: (_: any, r: any) => (
                      <Text size="small">
                        {r.prompt_tokens} + {r.completion_tokens} ={" "}
                        {r.prompt_tokens + r.completion_tokens}
                      </Text>
                    ),
                  },
                  {
                    title: "状态",
                    dataIndex: "status_code",
                    key: "status_code",
                    render: (code: number) =>
                      code === 200 ? (
                        <Tag color="green">200 OK</Tag>
                      ) : (
                        <Tag color="red">{code} Error</Tag>
                      ),
                  },
                ]}
              />
            </div>
          </div>
        </TabPane>

        {/* 3. MCP 开放协议集成 */}
        <TabPane
          tab={
            <span>
              <IconKanban className="mr-1" /> MCP 服务
            </span>
          }
          itemKey="mcp"
        >
          <div className="py-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Title heading={5}>Model Context Protocol 服务</Title>
                <Paragraph type="secondary" size="small">
                  开放任务中心、项目中心与每日复盘 CRUD 工具，供 Cursor、Claude Desktop 或外部 AI Agent 直接调用。
                </Paragraph>
              </div>
              <Button icon={<IconCopy />} onClick={handleCopyMCP}>
                复制配置片段
              </Button>
            </div>

            <Card style={{ background: "var(--semi-color-fill-0)" }}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Text strong>服务状态：已就绪</Text>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>• HTTP SSE 端口：<code className="text-primary font-mono">http://localhost:8080/api/v1/mcp/sse</code></div>
                  <div>• 本地 Stdio 管道：<code className="text-primary font-mono">server.exe mcp</code></div>
                  <div>• 数据联动：外部工具写入实时触发 WebSocket 广播，当前桌面窗口毫秒级自动刷新。</div>
                </div>
              </div>
            </Card>
          </div>
        </TabPane>
      </Tabs>

      {/* Channel Create / Edit Modal */}
      <Modal
        title={editingChannel ? "编辑渠道" : "添加 AI 渠道"}
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingChannel(null);
        }}
        footer={null}
      >
        <Form
          initValues={
            editingChannel
              ? {
                  name: editingChannel.name,
                  provider: editingChannel.provider,
                  base_url: editingChannel.base_url,
                  api_key: editingChannel.api_key || "",
                  priority: editingChannel.priority,
                  is_active: editingChannel.is_active,
                  models: editingChannel.models.join(", "),
                }
              : {
                  name: "",
                  provider: "deepseek" as AIProvider,
                  base_url: "https://api.deepseek.com/v1",
                  api_key: "",
                  priority: 10,
                  is_active: true,
                  models: "deepseek-chat, deepseek-coder",
                }
          }
          onSubmit={(values: Record<string, any>) => {
            const modelsArr = (String(values.models || ""))
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);

            const payload: ChannelCreateInput = {
              name: String(values.name || ""),
              provider: (values.provider || "custom") as AIProvider,
              base_url: String(values.base_url || ""),
              api_key: values.api_key ? String(values.api_key) : undefined,
              models: modelsArr,
              priority: Number(values.priority) || 0,
              is_active: Boolean(values.is_active),
            };

            if (editingChannel) {
              updateMutation.mutate({ id: editingChannel.id, data: payload });
            } else {
              createMutation.mutate(payload);
            }
          }}
        >
          <Form.Input field="name" label="渠道名称" rules={[{ required: true, message: "请输入渠道名称" }]} />
          <Form.Select field="provider" label="供应商">
            <Form.Select.Option value="deepseek">DeepSeek</Form.Select.Option>
            <Form.Select.Option value="openai">OpenAI</Form.Select.Option>
            <Form.Select.Option value="claude">Claude</Form.Select.Option>
            <Form.Select.Option value="ollama">Ollama (本地)</Form.Select.Option>
            <Form.Select.Option value="siliconflow">SiliconFlow</Form.Select.Option>
            <Form.Select.Option value="custom">自定义中继 (Custom)</Form.Select.Option>
          </Form.Select>
          <Form.Input field="base_url" label="API Base URL" placeholder="留空则自动选用官方默认端点" />
          <Form.Input field="api_key" label="API Key" mode="password" placeholder="sk-..." />
          <Form.Input field="models" label="支持模型 (逗号分隔)" placeholder="如: deepseek-chat, gpt-4o" />
          <Form.InputNumber field="priority" label="调度优先级 (越大越先使用)" />
          <Form.Switch field="is_active" label="启用状态" />
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending}>
              保存
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
