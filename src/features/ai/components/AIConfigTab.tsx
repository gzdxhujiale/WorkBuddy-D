import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Server,
  Activity,
  Kanban,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { aiApi } from "../api/aiApi";
import type { AIChannel, ChannelCreateInput, PingResult, AIProvider } from "../types";

export function AIConfigTab() {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AIChannel | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});
  const [pingingMap, setPingingMap] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"gateway" | "metrics" | "mcp">("gateway");

  // Form State
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState<AIProvider>("deepseek");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formModels, setFormModels] = useState("");
  const [formPriority, setFormPriority] = useState(10);
  const [formIsActive, setFormIsActive] = useState(true);

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
      toast.success("渠道创建成功");
      setModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["ai-channels"] });
    },
    onError: (err: Error) => {
      toast.error("创建失败: " + err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChannelCreateInput }) =>
      aiApi.updateChannel(id, data),
    onSuccess: () => {
      toast.success("渠道更新成功");
      setModalVisible(false);
      setEditingChannel(null);
      queryClient.invalidateQueries({ queryKey: ["ai-channels"] });
    },
    onError: (err: Error) => {
      toast.error("更新失败: " + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: aiApi.deleteChannel,
    onSuccess: () => {
      toast.success("渠道已删除");
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ["ai-channels"] });
    },
    onError: (err: Error) => {
      toast.error("删除失败: " + err.message);
    },
  });

  const handleOpenEdit = (channel: AIChannel | null) => {
    setEditingChannel(channel);
    if (channel) {
      setFormName(channel.name);
      setFormProvider(channel.provider);
      setFormBaseUrl(channel.base_url || "");
      setFormApiKey(channel.api_key || "");
      setFormModels(channel.models ? channel.models.join(", ") : "");
      setFormPriority(channel.priority ?? 10);
      setFormIsActive(channel.is_active);
    } else {
      setFormName("");
      setFormProvider("deepseek");
      setFormBaseUrl("https://api.deepseek.com/v1");
      setFormApiKey("");
      setFormModels("deepseek-chat, deepseek-coder");
      setFormPriority(10);
      setFormIsActive(true);
    }
    setModalVisible(true);
  };

  const handleSaveChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("请输入渠道名称");
      return;
    }

    const modelsArr = formModels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: ChannelCreateInput = {
      name: formName.trim(),
      provider: formProvider,
      base_url: formBaseUrl.trim(),
      api_key: formApiKey.trim() ? formApiKey.trim() : undefined,
      models: modelsArr,
      priority: Number(formPriority) || 0,
      is_active: formIsActive,
    };

    if (editingChannel) {
      updateMutation.mutate({ id: editingChannel.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handlePing = async (channel: AIChannel) => {
    setPingingMap((prev) => ({ ...prev, [channel.id]: true }));
    try {
      const res = await aiApi.pingChannel(channel.id);
      setPingResults((prev) => ({ ...prev, [channel.id]: res }));
      if (res.status === "online") {
        toast.success(`${channel.name} 连通正常 (${res.latency_ms}ms)`);
      } else {
        toast.error(`${channel.name} 离线: ${res.error || "未知异常"}`);
      }
    } catch (e: any) {
      setPingResults((prev) => ({
        ...prev,
        [channel.id]: { status: "offline", latency_ms: 0, error: e.message },
      }));
      toast.error(`测试失败: ${e.message}`);
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
    toast.success("MCP 配置已复制到剪贴板！");
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
        <Activity className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="leading-relaxed">
          WorkBuddy-D AI 模块支持轻量级统一模型网关管理、业务 Skill 编排与标准 MCP 开放服务能力。
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("gateway")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "gateway"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Server className="size-3.5" />
          <span>模型网关</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("metrics")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "metrics"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="size-3.5" />
          <span>监控与日志</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("mcp")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "mcp"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Kanban className="size-3.5" />
          <span>MCP 服务</span>
        </button>
      </div>

      {/* 1. 渠道与模型网关 */}
      {activeTab === "gateway" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI 供应渠道 (Channels)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                按优先级自动降级调用。支持 OpenAI、DeepSeek、Ollama 及第三方兼容中继。
              </p>
            </div>
            <Button size="sm" onClick={() => handleOpenEdit(null)} className="gap-1.5">
              <Plus className="size-3.5" />
              <span>添加渠道</span>
            </Button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground select-none">
                <tr>
                  <th className="py-2.5 px-3 font-medium">渠道名称</th>
                  <th className="py-2.5 px-3 font-medium">供应商</th>
                  <th className="py-2.5 px-3 font-medium">支持模型</th>
                  <th className="py-2.5 px-3 font-medium">优先级</th>
                  <th className="py-2.5 px-3 font-medium">健康状态</th>
                  <th className="py-2.5 px-3 font-medium">启停</th>
                  <th className="py-2.5 px-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {channelsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="size-4 animate-spin inline-block mr-2" />
                      加载渠道列表中...
                    </td>
                  </tr>
                ) : channels.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      暂无已配置的 AI 渠道，点击右上角添加
                    </td>
                  </tr>
                ) : (
                  channels.map((ch) => {
                    const ping = pingResults[ch.id];
                    const isPinging = pingingMap[ch.id];

                    return (
                      <tr key={ch.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-foreground">{ch.name}</div>
                          <div className="text-[11px] text-muted-foreground">{ch.base_url}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="uppercase font-mono text-[10px]">
                            {ch.provider}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {ch.models && ch.models.length > 0 ? (
                              ch.models.map((m) => (
                                <span
                                  key={m}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-mono"
                                >
                                  {m}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-[11px]">全部默认</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          P{ch.priority}
                        </td>
                        <td className="py-2.5 px-3">
                          {isPinging ? (
                            <Badge variant="outline" className="text-amber-500 border-amber-300">
                              检测中...
                            </Badge>
                          ) : !ping ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => handlePing(ch)}
                            >
                              <RefreshCw className="size-3 mr-1" /> 测试
                            </Button>
                          ) : ping.status === "online" ? (
                            <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="size-3" />
                              <span>{ping.latency_ms}ms</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-destructive border-destructive/40 flex items-center gap-1 w-fit">
                              <AlertCircle className="size-3" />
                              <span>离线</span>
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <Switch
                            checked={ch.is_active}
                            onCheckedChange={(val) => {
                              updateMutation.mutate({
                                id: ch.id,
                                data: {
                                  name: ch.name,
                                  provider: ch.provider,
                                  base_url: ch.base_url,
                                  api_key: ch.api_key,
                                  models: ch.models,
                                  is_active: val,
                                  priority: ch.priority,
                                },
                              });
                            }}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-7 p-0"
                              onClick={() => handleOpenEdit(ch)}
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(ch.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. 调用监控与审计 */}
      {activeTab === "metrics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground">7天调用次数</div>
              <div className="text-xl font-bold text-foreground mt-1">
                {metrics?.summary?.total_calls ?? 0}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground">总消耗 Tokens</div>
              <div className="text-xl font-bold text-foreground mt-1">
                {(metrics?.summary?.total_prompt_tokens ?? 0) +
                  (metrics?.summary?.total_completion_tokens ?? 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground">平均首字延迟 (TTFT)</div>
              <div className="text-xl font-bold text-foreground mt-1">
                {metrics?.summary?.avg_ttft_ms ?? 0}
                <span className="text-xs font-normal text-muted-foreground ml-1">ms</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-xs text-muted-foreground">平均总响应耗时</div>
              <div className="text-xl font-bold text-foreground mt-1">
                {metrics?.summary?.avg_latency_ms ?? 0}
                <span className="text-xs font-normal text-muted-foreground ml-1">ms</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-foreground mb-2">最近调用审计日志</h4>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground select-none">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">调用时间</th>
                    <th className="py-2.5 px-3 font-medium">技能/类型</th>
                    <th className="py-2.5 px-3 font-medium">执行模型</th>
                    <th className="py-2.5 px-3 font-medium">耗时 (TTFT / 总)</th>
                    <th className="py-2.5 px-3 font-medium">消耗 Tokens</th>
                    <th className="py-2.5 px-3 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {metricsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="size-4 animate-spin inline-block mr-2" />
                        加载审计日志中...
                      </td>
                    </tr>
                  ) : !metrics?.logs || metrics.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        暂无近期调用记录
                      </td>
                    </tr>
                  ) : (
                    metrics.logs.slice(0, 10).map((log: any) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline">{log.skill_code || "chat"}</Badge>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{log.model_name}</td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {log.ttft_ms}ms / {log.total_latency_ms}ms
                        </td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {log.prompt_tokens} + {log.completion_tokens} ={" "}
                          {log.prompt_tokens + log.completion_tokens}
                        </td>
                        <td className="py-2.5 px-3">
                          {log.status_code === 200 ? (
                            <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                              200 OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-destructive border-destructive/40">
                              {log.status_code} Error
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. MCP 开放协议集成 */}
      {activeTab === "mcp" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Model Context Protocol 服务</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                开放任务中心、项目中心与每日复盘 CRUD 工具，供 Cursor、Claude Desktop 或外部 AI Agent 直接调用。
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleCopyMCP} className="gap-1.5">
              <Copy className="size-3.5" />
              <span>复制配置片段</span>
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-foreground">服务状态：已就绪</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5">
              <div>• HTTP SSE 端口：<code className="text-primary font-mono px-1 py-0.5 rounded bg-muted">http://localhost:8080/api/v1/mcp/sse</code></div>
              <div>• 本地 Stdio 管道：<code className="text-primary font-mono px-1 py-0.5 rounded bg-muted">server.exe mcp</code></div>
              <div>• 数据联动：外部工具写入实时触发 WebSocket 广播，当前桌面窗口毫秒级自动刷新。</div>
            </div>
          </div>
        </div>
      )}

      {/* Channel Create / Edit Modal */}
      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingChannel ? "编辑渠道" : "添加 AI 渠道"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveChannel} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-foreground mb-1">渠道名称 *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如: DeepSeek 官方"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1">供应商</label>
              <select
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value as AIProvider)}
                className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
                <option value="ollama">Ollama (本地)</option>
                <option value="siliconflow">SiliconFlow</option>
                <option value="custom">自定义中继 (Custom)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1">API Base URL</label>
              <Input
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1">API Key</label>
              <Input
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="sk-..."
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-foreground mb-1">支持模型 (逗号分隔)</label>
              <Input
                value={formModels}
                onChange={(e) => setFormModels(e.target.value)}
                placeholder="如: deepseek-chat, deepseek-coder"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-medium text-foreground mb-1">调度优先级</label>
                <Input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col justify-end pb-1.5">
                <div className="flex items-center gap-2">
                  <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                  <span className="text-foreground">启用该渠道</span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除渠道</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确认删除该 AI 渠道吗？删除后相关调用将无法使用该渠道。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
