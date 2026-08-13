# Reliability

Writes are optimistic and may be queued when a network failure is retryable. Conflicts remain visible rather than silently overwriting remote data. Broadcast events are batched for 500 ms and per-query throttled for 2 seconds; they invalidate precise Query Keys, after which active views refetch.

Broadcast is not durable state replication. A reconnect or missed event is recovered by normal query loading.

编辑器保存采用本地状态、内容去重与防抖。缓存写入必须对相同字段值返回 no-op，且卸载保存不能因父组件回调引用变化而被反复触发；详见[同步、版本与编辑器一致性](design-docs/sync-and-editor-consistency.md)。
