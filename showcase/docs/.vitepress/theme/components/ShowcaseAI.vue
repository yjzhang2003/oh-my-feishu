<script setup>
const asset = (name) => `/pics/${name}`;

const scrollToSection = (id) => {
  const target = document.getElementById(id);
  const reader = target?.closest('.value-reader');
  if (!target || !reader) return;
  reader.scrollTo({ top: target.offsetTop - 12, behavior: 'smooth' });
  window.history.replaceState(null, '', `#${id}`);
};

const beforeAfter = [
  ['原来怎么做的', [
    '必须守在终端前等 Claude Code 跑完。',
    '飞书和代码仓库各管各的，分析结果传不到团队里。',
    '服务报错靠人工发现，复制日志再切回本地分析。',
  ]],
  ['现在怎么做', [
    '飞书里随时问、随时改，手机也能跟进。',
    'AI 在绑定的真实目录里工作，改的是本地代码。',
    '后台错误自动触发分析，结果直接发回飞书。',
  ]],
];

const capabilities = [
  ['01', '仓库级 Coding Agent', 'Claude Code 不只是生成文本。它能进入指定目录，运行命令、读取文件、修改代码、执行测试。', 'src/trigger/invoker.ts'],
  ['02', '飞书 Tool Use', 'Claude 按需调用消息、文档、日历、表格、任务、云盘等飞书能力，把分析结果写回协作工具。', 'oh-my-feishu-plugin/skills/lark-chat-guide/SKILL.md'],
  ['03', '上下文持续', '把飞书会话、本地目录和 Claude session 绑定。换设备也能继续之前的工作，不需要重新解释背景。', 'src/feishu/interactions/session-store.ts'],
  ['04', '流式可见', 'Claude 的流式输出被转成飞书卡片实时更新。长任务有进度感，不会让人觉得"卡住了"。', 'src/feishu/card-kit.ts'],
  ['05', '事件驱动', 'Web Monitor 轮询 traceback，发现新错误后自动触发 Claude 分析或修复。AI 从被动问答变成主动响应。', 'src/gateway/features/web-monitor/feature.ts'],
  ['06', '安全确认', '自动修复前先分析、再确认、再执行。skills 约束修改范围，超限则阻断并要求人工介入。', 'workspace/.claude/skills/web-monitor-auto-repair/SKILL.md'],
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

const coreSkills = [
  ['lark-chat-guide', '飞书聊天助手的入口规则。判断用户是在普通问答，还是需要调用飞书能力，并把任务路由到对应 skill。'],
  ['lark-shared', '所有飞书 skill 的公共约束，集中说明认证、权限、身份选择、安全边界和通用参数。'],
  ['gateway-guide', 'Gateway 的技能入口，用于查询或触发后台 feature，例如 status、service-admin、repair、web-monitor。'],
];

const webMonitorSkills = [
  ['web-monitor-service-manager', '通过 web-monitor CLI 管理监控服务，不直接编辑 services.json。'],
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

const reusable = [
  ['Plugin 化', '飞书能力以 Claude plugin 和 skills 形式沉淀，可安装到其他项目。'],
  ['Feature 化', 'Gateway 把触发、执行、回传拆开，方便扩展日报、CI 修复等任务。'],
  ['Skill 协议', '不同任务用不同 skill 描述边界，降低 AI 调用工具时的随意性。'],
  ['真实链路', 'CLI 引导、菜单、会话绑定、Web Monitor 都是能操作的入口，不是概念图。'],
];
</script>

<template>
  <section class="showcase-legacy value-doc-page">
    <aside class="value-sidebar" aria-label="AI 亮点目录">
      <p class="eyebrow">AI Highlights</p>
      <h2>AI 亮点</h2>
      <nav>
        <a href="#use" @click.prevent="scrollToSection('use')">飞书里用 Claude Code</a>
        <a href="#problem" @click.prevent="scrollToSection('problem')">解决了什么问题</a>
        <a href="#auto" @click.prevent="scrollToSection('auto')">后台自动化</a>
        <a href="#capabilities" @click.prevent="scrollToSection('capabilities')">AI 能做什么</a>
        <a href="#skills" @click.prevent="scrollToSection('skills')">飞书能力接入</a>
        <a href="#repair" @click.prevent="scrollToSection('repair')">自动修复机制</a>
        <a href="#safety" @click.prevent="scrollToSection('safety')">安全边界</a>
        <a href="#reusable" @click.prevent="scrollToSection('reusable')">可复用设计</a>
      </nav>
    </aside>

    <article class="value-reader">
      <header class="value-intro">
        <p class="eyebrow">AI Highlights</p>
        <h1>AI 亮点</h1>
        <p>Claude Code 不用只待在终端。在飞书里直接唤起它，结果发回聊天窗口。AI 在本地仓库里跑代码、改文件，你在飞书里看进度、收结果。</p>
      </header>

      <section class="value-section" id="use">
        <div class="value-copy">
          <p class="eyebrow">入口</p>
          <h2>飞书里用 Claude Code</h2>
          <p>用户在飞书聊天里发送自然语言消息，系统把 chatId、本地目录和 Claude session 关联起来，AI 在真实项目里执行命令、修改代码，结果以消息或卡片形式发回聊天窗口。</p>
          <div class="point-list">
            <p>飞书入口：用户在聊天或菜单卡片里发起请求。</p>
            <p>上下文绑定：系统关联 chatId、本地目录和 Claude session。</p>
            <p>AI 执行：Claude Code 分析代码、运行命令、读取 skills。</p>
            <p>飞书回传：结果发回聊天窗口，团队在飞书里就能看到。</p>
          </div>
        </div>
        <figure class="media-frame">
          <img :src="asset('talk-demo.gif')" alt="飞书内与 Claude Code 对话演示" loading="lazy" />
          <figcaption>飞书消息触发 Claude Code，结果以卡片形式返回。</figcaption>
        </figure>
      </section>

      <section class="value-section full" id="problem">
        <div class="section-title-row">
          <div><p class="eyebrow">痛点</p><h2>这个项目解决了什么问题</h2></div>
        </div>
        <div class="before-after">
          <article v-for="[title, items] in beforeAfter" :key="title">
            <h3>{{ title }}</h3>
            <p v-for="item in items" :key="item">{{ item }}</p>
          </article>
        </div>
      </section>

      <section class="value-section" id="auto">
        <figure class="media-frame">
          <img :src="asset('web服务监控.png')" alt="Web Monitor 后台监控演示" loading="lazy" />
          <figcaption>后台轮询 traceback，发现新错误后自动触发 Claude 分析或修复。</figcaption>
        </figure>
        <div class="value-copy">
          <p class="eyebrow">自动化</p>
          <h2>后台自动化</h2>
          <p>Web Monitor 注册 traceback URL 后，后台持续轮询日志变化。发现新错误时，自动触发 Claude Code 分析根因、生成修复方案，按配置执行修复或创建 PR，结果发回飞书。</p>
          <div class="point-list">
            <p>错误自己找上来，不用等人发现。</p>
            <p>分析、修复、验证、回传形成闭环。</p>
            <p>结果沉淀在飞书，团队可见。</p>
          </div>
        </div>
      </section>

      <section class="value-section full" id="capabilities">
        <div class="section-title-row">
          <div><p class="eyebrow">Capabilities</p><h2>AI 能做什么</h2></div>
        </div>
        <div class="engineering-list">
          <article v-for="[icon, title, desc, detail] in capabilities" :key="title" class="engineering-card">
            <span class="eng-icon">{{ icon }}</span>
            <div class="eng-content">
              <h3>{{ title }}</h3>
              <p class="eng-desc">{{ desc }}</p>
              <p class="eng-detail">{{ detail }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="value-section full" id="skills">
        <div class="section-title-row">
          <div><p class="eyebrow">Skills</p><h2>飞书能力接入</h2></div>
          <p class="section-lead">项目把飞书能力拆成多个业务域 skill。Claude 不需要一次性记住所有 API，而是在用户请求进入某个场景时读取对应 skill。</p>
        </div>
        <div class="skill-domain-grid">
          <article v-for="[name, text] in larkDomains" :key="name">
            <strong>{{ name }}</strong>
            <p>{{ text }}</p>
          </article>
        </div>
      </section>

      <section class="value-section full" id="repair">
        <div class="section-title-row">
          <div><p class="eyebrow">Auto Repair</p><h2>自动修复机制</h2></div>
          <p class="section-lead">Web Monitor 不是简单让 AI 自由改代码，而是把服务管理、只读分析、自动修复、安全检查和结果通知拆成清晰的协议。</p>
        </div>
        <div class="auto-repair-layout">
          <div class="auto-repair-column">
            <h3>输入从哪里来</h3>
            <div class="mini-list">
              <article v-for="[title, text] in autoRepairInputs" :key="title">
                <strong>{{ title }}</strong>
                <p>{{ text }}</p>
              </article>
            </div>
          </div>
          <div class="auto-repair-column">
            <h3>执行顺序</h3>
            <div class="repair-flow-list">
              <article v-for="([title, text], index) in repairFlow" :key="title">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <strong>{{ title }}</strong>
                <p>{{ text }}</p>
              </article>
            </div>
          </div>
          <div class="auto-repair-column">
            <h3>安全边界</h3>
            <div class="mini-list">
              <article v-for="[title, text] in repairGuards" :key="title">
                <strong>{{ title }}</strong>
                <p>{{ text }}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="value-section full" id="safety">
        <div class="section-title-row">
          <div><p class="eyebrow">Safety</p><h2>安全边界与分工</h2></div>
        </div>
        <div class="before-after">
          <article>
            <h3>安全边界</h3>
            <p>项目没有把权限全交给 AI，而是把复杂分析交给 Agent，把授权、确认和审核留给人。</p>
            <p>PathGuard：只能修改指定目录内的文件。</p>
            <p>DiffGuard：超过 10 个文件或 500 行时停止。</p>
            <p>TestGuard：修改后必须运行验证命令。</p>
            <p>No Secrets：不能写入敏感信息。</p>
            <p>No Auto Push：默认不自动推送代码。</p>
          </article>
          <article>
            <h3>谁负责什么</h3>
            <p><strong>人</strong>：授权飞书、选择目录、提出目标、确认修复、审核改动。</p>
            <p><strong>AI</strong>：理解请求，分析代码和日志，调用工具，生成修复方案。</p>
            <p><strong>系统</strong>：消息路由、状态保存、会话恢复、事件分发、结果回传。</p>
          </article>
        </div>
      </section>

      <section class="value-section full" id="reusable">
        <div class="section-title-row">
          <div><p class="eyebrow">Reusable</p><h2>这些设计还能复用</h2></div>
        </div>
        <div class="engineering-list grid-2col">
          <article v-for="[title, text], index in reusable" :key="title" class="engineering-card">
            <span class="eng-icon">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="eng-content">
              <h3>{{ title }}</h3>
              <p class="eng-desc">{{ text }}</p>
            </div>
          </article>
        </div>
      </section>
    </article>
  </section>
</template>
