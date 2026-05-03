# Feishu Agent - QR 扫码注册设计

## 概述

参考 Hermes Agent 的设计，用户只需扫描 QR 码即可完成飞书 Bot 配置，无需手动创建应用或配置 `app_id`/`app_secret`。

## 流程

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户操作流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 运行 `npm run cli`                                           │
│  2. 选择 "Feishu (Lark)" → "Auth with QR Code"                  │
│  3. 终端显示 QR 码                                               │
│  4. 用户用飞书 App 扫码                                          │
│  5. 自动获取 app_id 和 app_secret                               │
│  6. 服务自动启动连接                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## API 调用序列

### 1. 初始化注册环境

```
POST https://accounts.feishu.cn/oauth/v1/app/registration
Content-Type: application/x-www-form-urlencoded

action=init

Response:
{
  "supported_auth_methods": ["client_secret", ...]
}
```

### 2. 开始注册流程

```
POST https://accounts.feishu.cn/oauth/v1/app/registration
Content-Type: application/x-www-form-urlencoded

action=begin
archetype=PersonalAgent
auth_method=client_secret
request_user_info=open_id

Response:
{
  "device_code": "xxx",
  "verification_uri_complete": "https://open.feishu.cn/xxx?user_code=XXX",
  "user_code": "XXXX",
  "interval": 5,
  "expire_in": 600
}
```

### 3. 轮询等待扫码

```
POST https://accounts.feishu.cn/oauth/v1/app/registration
Content-Type: application/x-www-form-urlencoded

action=poll
device_code=xxx

Response (pending):
{
  "error": "authorization_pending"
}

Response (success):
{
  "app_id": "cli_xxx",
  "app_secret": "xxx",
  "open_id": "ou_xxx"
}
```

## 数据存储

注册成功后，将凭证存储到 `~/.lark-cli/config.json`（复用 lark-cli 的配置格式）：

```json
{
  "apps": [{
    "appId": "cli_xxx",
    "appSecret": "xxx",
    "brand": "feishu",
    "lang": "zh"
  }]
}
```

## 终端 UI

```
 ┌────────────────────────────────────┐
 │        Feishu QR Auth              │
 └────────────────────────────────────┘

 █████████████████████████████████████
 ██ ▄▄▄▄▄ █▀▄█▀▀█ ▀█▄█ ▄▄▄▄▄ ██
 ██ █   █ █▀▀▀█ ▀█▀██ █   █ ██
 ██ █▄▄▄█ █ ▀▀▀▀ ▀▀▀█ █▄▄▄█ ██
 ... (QR Code ASCII Art) ...
 █████████████████████████████████████

  Scan with Feishu App to authenticate

  Or open: https://open.feishu.cn/xxx?user_code=XXXX

  Waiting for scan... (expires in 10:00)

  ESC Cancel
```

## 错误处理

| 错误 | 处理 |
|------|------|
| `authorization_pending` | 继续轮询 |
| `expired_token` | 重新开始注册 |
| `access_denied` | 用户拒绝，显示提示 |
| 网络错误 | 重试或提示检查网络 |

## 与 lark-cli 的关系

- CLI 只提供 QR 扫码注册入口，不再提供 `lark-cli config init` 认证入口
- `lark-cli config show` 的 appSecret 可能是脱敏值，不能作为后端长连接凭证来源
- QR 注册成功后，凭证存储为兼容 lark-cli 的格式，供 oh-my-feishu 后台服务读取

## 文件结构

```
src/feishu/
├── qr-onboarding.ts    # QR 扫码注册逻辑
├── websocket-connector.ts  # WebSocket 连接器
└── lark-auth.ts        # 认证状态检查
```

## 参考

- Hermes 实现: `/Users/chihayaanon/IdeaProjects/hermes-agent-ref/gateway/platforms/feishu.py`
- 飞书开放平台: https://open.feishu.cn/document/common-capabilities/sso/bot-qr-register
