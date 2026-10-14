import { apiClient } from "@/lib/apiClient";
import { registerOfflineExecutor, runOrQueue } from "@/lib/offlineSyncQueue";
import type { KnowledgeTemplate } from "../types";

import {
  requireLockVersion,
  type VersionedEntity,
} from "./types";

function asTimestamp(val: unknown): number {
  if (!val) return Date.now();
  if (typeof val === "number") return val;
  return new Date(val as string).getTime();
}

function parseTemplateContent(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (/^[A-Za-z0-9+/=]{8,}$/.test(trimmed)) {
      try {
        const decoded = atob(trimmed);
        if (decoded.startsWith("{") || decoded.startsWith("[")) {
          return parseTemplateContent(JSON.parse(decoded));
        }
        return decoded;
      } catch {
        // Not base64
      }
    }
    return content;
  }
  if (typeof content === "object") {
    const raw = (content as any)?.raw;
    if (typeof raw === "string") {
      return raw;
    }
    return JSON.stringify(content);
  }
  return String(content);
}

export type SavedTemplate = {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
  lockVersion: number;
};

export async function remoteUpsertTemplate(template: KnowledgeTemplate): Promise<SavedTemplate> {
  let contentPayload: any = { raw: template.content };
  if (typeof template.content === "string") {
    try {
      contentPayload = JSON.parse(template.content);
    } catch {
      contentPayload = { raw: template.content };
    }
  }

  const saved = await apiClient.post<any>("/api/v1/templates", {
    id: template.id,
    name: template.name,
    content: contentPayload,
    lock_version: template.lockVersion ?? 1,
  });
  return {
    id: saved.id || template.id,
    name: saved.name || template.name,
    content: parseTemplateContent(saved.content),
    updatedAt: asTimestamp(saved.updated_at || saved.updatedAt),
    lockVersion: Number(saved.lock_version || saved.lockVersion || 1),
  };
}

export async function remoteDeleteTemplate(entity: VersionedEntity): Promise<void> {
  requireLockVersion(entity, "删除模板");
  await apiClient.delete(`/api/v1/templates/${entity.id}`);
}

registerOfflineExecutor("template:save", async (p) => {
  await remoteUpsertTemplate(p as KnowledgeTemplate);
});
registerOfflineExecutor("template:delete", async (p) => {
  await remoteDeleteTemplate(p as VersionedEntity);
});

export async function loadTemplates(): Promise<KnowledgeTemplate[]> {
  const data = await apiClient.get<any[]>("/api/v1/templates");
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    content: parseTemplateContent(t.content),
    lockVersion: Number(t.lock_version ?? t.lockVersion ?? 1),
  }));
}

export function upsertTemplate(template: KnowledgeTemplate): Promise<SavedTemplate | undefined> {
  return runOrQueue(
    { kind: "template:save", key: "template:" + template.id, payload: template },
    () => remoteUpsertTemplate(template),
  );
}

export function deleteTemplate(entity: VersionedEntity): Promise<void | undefined> {
  return runOrQueue(
    { kind: "template:delete", key: "template:" + entity.id, payload: entity },
    () => remoteDeleteTemplate(entity),
  );
}
