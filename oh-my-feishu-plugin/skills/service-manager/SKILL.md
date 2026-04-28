---
name: service-manager
description: "管理服务注册表：读取、添加、删除、启用/禁用 traceback 监控服务。操作 workspace/.claude/services.json。"
metadata:
  category: "devops"
  requires:
    files: ["workspace/.claude/services.json"]
---

# Service Manager

管理服务注册表，配置需要被 TracebackMonitor 监控的 GitHub 仓库和日志地址。

## 数据位置

`workspace/.claude/services.json`

## ServiceEntry 结构

```typescript
interface ServiceEntry {
  name: string;              // 服务唯一标识，如 "my-api"
  githubOwner: string;       // GitHub 组织/用户，如 "myorg"
  githubRepo: string;        // GitHub 仓库名，如 "my-api"
  tracebackUrl: string;      // 日志接口地址，如 "https://logs.example.com/api/tracebacks"
  notifyChatId: string;      // 飞书群 chat_id（可选）
  tracebackUrlType: "json" | "text" | "html";
  pollIntervalSec?: number;  // 轮询间隔秒数（可选，默认 60）
  enabled: boolean;          // 是否启用监控
  addedAt: string;           // ISO 时间戳
  addedBy: string;           // 添加者标识
  lastErrorHash?: string;    // 上次错误哈希（系统自动维护）
  lastCheckedAt?: string;    // 上次检查时间（系统自动维护）
}
```

## 操作指令

### 1. 列出所有服务

```bash
cat workspace/.claude/services.json
```

### 2. 添加服务

1. 读取当前的 `services.json`
2. 在 `services` 数组追加新条目：

```json
{
  "name": "<service-name>",
  "githubOwner": "<owner>",
  "githubRepo": "<repo>",
  "tracebackUrl": "<url>",
  "notifyChatId": "<chat-id-or-empty>",
  "tracebackUrlType": "json",
  "enabled": true,
  "addedAt": "<current-iso-time>",
  "addedBy": "claude"
}
```

3. 写回文件
4. 验证 JSON 格式正确

**校验规则：**
- `name` 唯一，不能与现有服务重复
- `githubOwner/githubRepo` 格式正确（不含 `/`）
- `tracebackUrl` 必须以 `http://` 或 `https://` 开头

### 3. 删除服务

1. 读取 `services.json`
2. 从 `services` 数组中移除指定 `name` 的条目
3. 写回文件

### 4. 启用 / 禁用服务

1. 读取 `services.json`
2. 找到对应服务，修改 `enabled` 字段
3. 写回文件

### 5. 修改服务配置

支持修改以下字段：
- `tracebackUrl`
- `githubOwner` / `githubRepo`
- `notifyChatId`
- `pollIntervalSec`

**注意：** `name` 字段不可修改，如需改名请删除后重新添加。

## 安全规则

1. **备份原则**：修改前先读取确认当前内容
2. **格式校验**：写回后确保 JSON 有效（`services` 是数组，`version` 为 1）
3. **最小权限**：只修改用户明确要求的字段，不动其他服务
4. **命名规范**：服务名使用 kebab-case 或 snake_case，避免空格和特殊字符

## 输出格式

操作完成后汇报：
- 操作类型（添加/删除/启用/禁用/修改）
- 受影响的服务名
- 当前注册服务总数
