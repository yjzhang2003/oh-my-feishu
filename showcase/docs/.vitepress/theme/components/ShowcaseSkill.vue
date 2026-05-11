<script setup>
const installCommands = `claude plugin marketplace add https://github.com/yjzhang2003/oh-my-feishu
claude plugin install oh-my-feishu@oh-my-feishu-marketplace --scope project`;

const coreSkills = [
  ['lark-chat-guide', '飞书聊天助手的入口规则。它判断用户是在普通问答，还是需要调用飞书能力，并把任务路由到对应 lark skill。'],
  ['lark-shared', '所有飞书 skill 的公共约束，集中说明认证、权限、身份选择、安全边界和通用参数。'],
  ['gateway-guide', 'oh-my-feishu Gateway 的技能入口，用于查询或触发后台 feature，例如 status、service-admin、repair、web-monitor。'],
];

const larkDomains = [
  ['lark-im', '即时通讯：发消息、回复、搜索聊天、管理群成员、处理聊天中的图片和文件。'],
  ['lark-doc', '云文档：创建、读取、局部拉取、编辑、插入图片和搜索云空间文档。'],
  ['lark-sheets', '电子表格：读写单元格、管理工作表、处理表格数据。'],
  ['lark-base', '多维表格：表、字段、记录、视图、仪表盘、表单和数据分析。'],
  ['lark-calendar', '日历日程：创建会议、查日程、查忙闲、管理参会人和会议室。'],
  ['lark-drive', '云盘：上传下载、导入本地文件、管理文件夹、权限、评论和标题。'],
  ['lark-task', '任务：创建任务、查看任务列表、管理任务状态。'],
  ['lark-wiki', '知识库：空间、成员、节点层级和知识库文档组织。'],
  ['lark-vc / lark-minutes', '视频会议与妙记：查询会议记录、获取会议纪要、下载转录内容。'],
  ['lark-mail', '邮箱：起草、发送、回复、转发、搜索邮件和管理草稿。'],
  ['lark-whiteboard / lark-slides', '画板和幻灯片：可视化表达结构、生成演示内容。'],
  ['lark-workflow-*', '组合工作流：会议纪要汇总、日程待办摘要等跨域任务。'],
];

const webMonitorSkills = [
  ['web-monitor-service-manager', '通过 oh-my-feishu web-monitor CLI 管理监控服务，不直接编辑 services.json。'],
  ['web-monitor-analyze-only', '只读分析 traceback，给出根因和修复计划，等待用户确认。'],
  ['web-monitor-auto-repair', '在目标仓库内执行最小修复、运行验证，并把最终结果交回 Gateway。'],
  ['web-monitor-safety-check', '检查路径越界、diff 规模、测试缺失和敏感信息。'],
  ['web-monitor-notify-feishu', '在需要时发送飞书通知卡片，正常情况下由 Gateway 统一发布结果。'],
  ['web-monitor-analyze-log', '解析日志和 traceback，定位异常类型、调用栈、影响文件和最小修复方向。'],
];

const autoRepairInputs = [
  ['结构化上下文', 'Gateway 触发时传入服务名、GitHub 仓库、traceback URL、本地仓库路径和 PR 配置。'],
  ['环境变量', 'SERVICE_NAME、TARGET_REPO_PATH、TRACEBACK_URL、WEB_MONITOR_AUTO_PR 等作为兜底输入。'],
  ['触发器文件', '必要时读取 .claude/triggers/latest.json 或 workspace/.claude/triggers/latest.json。'],
];

const repairFlow = [
  ['Detect', '确认服务、目标仓库、错误类型和受影响文件。'],
  ['Fetch Log', '读取 traceback URL、日志文件或内联错误文本。'],
  ['Analyze', '定位根因，判断最小修复点。'],
  ['Propose Diff', '生成聚焦、可解释的最小变更。'],
  ['Safety Review', '检查路径、diff 规模、密钥和测试要求。'],
  ['Apply & Test', '应用改动并运行最相关验证命令。'],
  ['Report', '保留本地修复，按配置决定是否创建 PR，并把结果交回 Gateway。'],
];

const repairGuards = [
  ['PathGuard', '只能修改 TARGET_REPO_PATH / localRepoPath 内的文件。'],
  ['DiffGuard', '超过 10 个文件或 500 行时停止，要求人工介入。'],
  ['TestGuard', '修改后必须运行可发现的最相关验证命令。'],
  ['No Secrets', '不能写入 token、password、secret、api_key 等敏感信息。'],
  ['No Auto Push', '除非 WEB_MONITOR_AUTO_PR=true，否则不 push、不创建 PR。'],
];
</script>

<template>
  <div class="showcase-legacy standalone-showcase">
    <section class="skill-hero">
      <div>
        <p class="eyebrow">Claude Plugin</p>
        <h1>把飞书能力安装进 Claude Code</h1>
        <p>oh-my-feishu 不只是主应用，也可以作为 Claude Code plugin 安装到任意项目。安装后，Claude Code 能按需读取飞书 skills，用 lark-cli 操作消息、文档、日程、表格、任务、云盘和 Gateway 自动化能力。</p>
      </div>
      <div class="skill-install">
        <p class="eyebrow">Install from marketplace</p>
        <pre><code>{{ installCommands }}</code></pre>
      </div>
    </section>

    <section class="skill-section">
      <div class="section-header">
        <div><p class="eyebrow">Core skills</p><h2>三个入口 skill 决定 Claude 怎么行动</h2></div>
        <p class="section-lead">这些不是 API 清单，而是给 Claude Code 的行为规则：什么时候回答、什么时候调用工具、什么时候进入后台自动化。</p>
      </div>
      <div class="skill-list primary">
        <article v-for="[name, text] in coreSkills" :key="name"><strong>{{ name }}</strong><p>{{ text }}</p></article>
      </div>
    </section>

    <section class="skill-section">
      <div class="section-header">
        <div><p class="eyebrow">Lark domains</p><h2>飞书业务域 skills</h2></div>
        <p class="section-lead">项目把飞书能力拆成多个业务域。Claude 不需要一次性记住所有 API，而是在用户请求进入某个场景时读取对应 skill。</p>
      </div>
      <div class="skill-domain-grid">
        <article v-for="[name, text] in larkDomains" :key="name"><strong>{{ name }}</strong><p>{{ text }}</p></article>
      </div>
    </section>

    <section class="skill-section">
      <div class="section-header">
        <div><p class="eyebrow">Web Monitor skills</p><h2>自动化服务的专用 skills</h2></div>
        <p class="section-lead">Web Monitor 不是简单让 AI 自由改代码，而是把服务管理、只读分析、自动修复、安全检查和结果通知拆成清晰的协议。</p>
      </div>
      <div class="skill-list web-monitor">
        <article v-for="[name, text] in webMonitorSkills" :key="name"><strong>{{ name }}</strong><p>{{ text }}</p></article>
      </div>
    </section>

    <section class="skill-section auto-repair-detail">
      <div class="section-header">
        <div><p class="eyebrow">web-monitor-auto-repair</p><h2>自动修复不是放任 AI 改代码</h2></div>
        <p class="section-lead">这个 skill 把 traceback 修复拆成可审计的后台协议：先确认上下文，再分析根因，最后用最小 diff 修复并验证。</p>
      </div>
      <div class="auto-repair-layout">
        <div class="auto-repair-column">
          <h3>输入从哪里来</h3>
          <div class="mini-list"><article v-for="[title, text] in autoRepairInputs" :key="title"><strong>{{ title }}</strong><p>{{ text }}</p></article></div>
        </div>
        <div class="auto-repair-column">
          <h3>执行顺序</h3>
          <div class="repair-flow-list">
            <article v-for="([title, text], index) in repairFlow" :key="title">
              <span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ title }}</strong><p>{{ text }}</p>
            </article>
          </div>
        </div>
        <div class="auto-repair-column">
          <h3>安全边界</h3>
          <div class="mini-list"><article v-for="[title, text] in repairGuards" :key="title"><strong>{{ title }}</strong><p>{{ text }}</p></article></div>
        </div>
      </div>
    </section>
  </div>
</template>
