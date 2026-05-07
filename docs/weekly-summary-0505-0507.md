# oh-my-feishu 开发周期总结

> 开发周期：2026.05.05 — 2026.05.07
> 项目：oh-my-feishu — 在飞书中使用 Claude Code 的自动化助手

---

## 一、核心产出

**交付成果：v0.6.5 版本发布、Showcase 展示网站、npm 全局安装优化**

这三天的核心工作是完善项目的分发和使用体验。之前通过 npm 全局安装后，用户数据和配置会混在 npm 包目录里，每次更新都会丢失。现在改为使用用户主目录下的专用文件夹，数据独立于包本身，更新时不会丢失。

同时完成了项目展示网站的建设，把项目亮点、核心代码、Gateway 架构、Skills 设计等内容整理成静态网站，部署到 GitHub Pages。

主要成果：
- 发布 v0.6.5 版本，包含两阶段确认流程、清空 hash 按钮、结构化结果存储等特性。
- 修复 npm 全局安装后的 workspace 目录问题，用户数据现在存储在 ~/.oh-my-feishu/ 目录。
- 设计结构化的 Claude 运行结果存储格式，包含状态、根因、修改内容、验证结果、PR 信息、后续建议等字段。
- 优化 Web Monitor 卡片，添加轮询间隔和最后检查时间展示，新增"清空 Hash"按钮让用户可以手动触发重新检测。
- 修复飞书卡片图标问题，改用飞书官方文档中推荐的图标名称。
- 精简 CI 配置，移除冗余步骤，统一工作流。
- 新建 Showcase 静态展示网站，包含项目亮点、核心代码、Gateway、AI 应用、Skills 五个页面。
- 修复 .gitignore 规则过于宽泛导致 showcase 数据文件未跟踪的问题。

---

## 二、量化指标

| 指标 | 数值 |
|------|------|
| 三天主要提交 | 16 次 |
| 重点功能 | 4 个（npm 全局安装、结构化结果、展示网站、清空 hash 按钮） |
| 重点修复 | 6 个以上（卡片图标、CI 配置、gitignore、部署权限等） |
| 文档更新 | README、Showcase 网站 |
| 版本发布 | v0.6.5 |

**AI 协作统计：**
- Claude Code 负责了大部分实现和调试工作。
- 人工主要集中在功能验收、网站内容审核、部署问题排查。
- 调试成本最高的部分是 GitHub Pages 部署权限和 gitignore 规则。

---

## 三、过程复盘与沉淀

### 1. 每天主要搞定的事

**5月5日：结构化结果和卡片优化**
- 将 Claude 运行结果从纯文本改为结构化对象，包含状态、根因、修改、验证、PR、后续建议等字段。
- 优化 Web Monitor 详情卡片，增加轮询间隔和最后检查时间。
- 增加"清空 Hash"按钮，让用户可以手动清除去重缓存，触发重新检测。
- 修复 traceback 预览截断方向，改为从头部截取保留尾部。

**5月6日：npm 全局安装修复和 CI 优化**
- 修复 npm 全局安装后的 workspace 目录问题，改为使用 ~/.oh-my-feishu/ 目录。
- 确保用户数据（服务配置、日志、会话历史）独立于 npm 包目录，更新时不会丢失。
- 精简 CI 配置，移除冗余步骤，统一构建流程。
- 修复飞书卡片图标问题，使用飞书官方文档推荐的图标名称。
- 发布 v0.6.5 版本。

**5月7日：Showcase 展示网站**
- 新建 Showcase 静态展示网站，使用 Astro 框架构建。
- 完成项目亮点、核心代码、Gateway 架构、AI 应用、Skills 设计五个页面。
- 配置 GitHub Pages 自动部署工作流。
- 修复 .gitignore 规则过于宽泛的问题，让 showcase 数据文件正确跟踪。
- 修复 GitHub Pages 部署权限问题，添加 main 分支到部署策略。
- 更新 README 添加 Showcase 链接。

### 2. 卡住很久的情况及破局

**问题：npm 全局安装后数据存储位置不对**

现象是通过 npm 安装后，用户的 workspace 数据存储在 npm 包目录下，每次 npm update 都会覆盖丢失。

破局方式是检测是否为 npm 全局安装，如果是则使用用户主目录下的 ~/.oh-my-feishu/ 作为 workspace。这样用户数据和包本身分离，更新包不会影响用户数据。

**问题：Showcase 网站构建失败，找不到数据文件**

现象是 GitHub Actions 构建时报错"Rollup failed to resolve import '@/data/codeDocs'"，但本地构建正常。

根因是 .gitignore 中的 `data/` 规则匹配了所有名为 data 的目录，包括 showcase/src/data/，导致数据文件没有被提交到仓库。

破局方式是将 `data/` 改为 `/data/`，只匹配根目录下的 data 目录，不影响子目录中的 data 文件夹。

**问题：GitHub Pages 部署被拒绝**

现象是 workflow 构建成功但部署失败，错误信息是"Branch 'main' is not allowed to deploy to github-pages due to environment protection rules"。

根因是 GitHub Pages 环境默认只允许 gh-pages 分支部署，main 分支不在允许列表中。

破局方式是通过 GitHub API 添加 main 分支到 github-pages 环境的部署分支策略中。

### 3. 可复用的东西

**npm 全局安装检测规则**
- 通过检查可执行文件路径判断是否为 npm 全局安装。
- npm 全局安装时 workspace 使用 ~/.oh-my-feishu/ 目录。
- 本地开发时 workspace 使用项目目录。
- 启动时自动创建所需目录结构。

**gitignore 规则编写规则**
- `data/` 匹配所有目录下的 data 文件夹，包括子目录。
- `/data/` 只匹配根目录下的 data 文件夹。
- 编写忽略规则时要考虑对子目录的影响。

**GitHub Pages 部署配置**
- 需要在环境的 Deployment branches 中添加目标分支。
- 可以通过 API 添加部署分支策略。
- workflow 需要配置 pages 和 id-token 权限。

**Claude 运行结果结构化格式**
- 结果对象包含 status、rootCause、changes、verification、pr、followUp 字段。
- 各字段使用中文内容，方便飞书卡片展示。
- 支持从 JSON 文件或 Markdown 文件解析。

---

## 四、随手记

### 技术踩坑

1. npm 全局安装后工作目录在 npm 包目录下，用户数据会随更新丢失。
2. .gitignore 中的目录名规则会匹配所有层级的同名目录。
3. GitHub Pages 环境默认只允许特定分支部署，需要手动添加。
4. Astro 项目的路径别名需要在 tsconfig.json 中配置。
5. 结构化结果比纯文本更容易在卡片中展示和格式化。

### AI 用在了哪些环节

| 环节 | AI 贡献 |
|------|---------|
| 结构化结果设计 | 高，Claude Code 负责字段设计和解析逻辑 |
| npm 安装检测实现 | 高，Claude Code 完成检测函数和目录初始化 |
| Showcase 网站搭建 | 高，Claude Code 负责页面结构和样式 |
| CI 配置精简 | 中，人工确定目标，Claude Code 执行修改 |
| 部署问题排查 | 高，Claude Code 帮助定位 gitignore 和权限问题 |

### 调试方法论沉淀

npm 全局安装问题要考虑包目录和用户数据目录的分离。用户数据应该存储在独立位置，不受包更新影响。可以通过检测安装位置来决定使用哪个目录。

gitignore 规则要考虑对子目录的影响。不带前导斜杠的目录名会匹配所有层级的同名目录，如果只想匹配根目录要加前导斜杠。

GitHub Pages 部署失败要检查环境保护规则。默认只允许特定分支部署，新分支需要手动添加到部署策略中。

---

## 五、项目架构变化

| 层级 | 变化 |
|------|------|
| 配置层 | 新增 isNpmGlobalInstall 检测，workspace 目录动态确定 |
| 结果存储层 | 从纯文本改为 ClaudeRunResult 结构化对象 |
| Web Monitor 层 | 详情卡片增加轮询信息，新增清空 hash 按钮 |
| CI 层 | 精简配置，统一构建流程 |
| 展示层 | 新增 Showcase 静态网站，GitHub Pages 自动部署 |

---

**总结**：这三天的核心收获是完善了项目的分发体验，npm 安装后数据不再丢失，同时建立了项目展示网站。最大的工程挑战是 gitignore 规则和 GitHub Pages 部署权限问题。核心教训是：gitignore 规则要考虑对子目录的影响，GitHub Pages 部署要检查环境保护规则，npm 全局安装要分离用户数据和包目录。
