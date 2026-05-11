<script setup>
const asset = (name) => `/pics/${name}`;
const scrollToSection = (id) => {
  const target = document.getElementById(id);
  const reader = target?.closest('.value-reader');
  if (!target || !reader) return;
  reader.scrollTo({ top: target.offsetTop - 12, behavior: 'smooth' });
  window.history.replaceState(null, '', `#${id}`);
};

const productHighlights = [
  ['飞书内直接使用 Claude Code', '用户在飞书聊天中发送自然语言消息即可触发 Claude Code，结果以飞书消息或卡片返回，降低终端依赖。', '这个入口让 Claude Code 不再只存在于本地终端。团队成员可以在飞书里发起分析、查看过程、接收结论，移动端也能跟进任务状态。', 'talk-demo.gif'],
  ['低门槛 CLI onboarding', 'Ink TUI、二维码注册、PM2 服务管理让部署和演示流程更完整。', '从首次配置、扫码注册到后台服务启动都有明确入口，降低项目展示时的环境风险。', 'cli-demo.png'],
  ['/menu 管理工作上下文', '菜单卡片提供新建会话、历史会话、自动化技能、指令菜单等入口，适合移动端操作。', '菜单把复杂命令收拢成可点击入口，减少用户记忆成本，也让演示时可以稳定进入关键流程。', 'menu-demo.jpeg'],
  ['支持绑定本地目录', '目录会话会把 chatId 与本机项目路径绑定，Claude Code 在该目录作为 cwd 执行。', '绑定目录后，AI 面对的是实际项目文件，而不是孤立聊天上下文，适合代码修改、构建、调试和仓库级问答。', '本地目录.png'],
  ['恢复历史 Claude Code 会话', 'listSessions() 读取本地 Claude session jsonl，用户可从飞书卡片继续历史上下文。', '用户可以延续电脑上已有的 Claude Code 工作，不需要重新解释背景，也更适合跨设备继续处理任务。', 'resume-pic.png'],
  ['Web Monitor 自动化服务', '注册 traceback URL 后，后台轮询日志变化，发现新错误后触发 Claude Code 分析或修复。', 'Web Monitor 把 AI 从被动问答扩展为事件驱动：错误出现后自动进入分析链路，减少人工复制日志和切换工具。', 'web-monitor.png'],
  ['与 lark-cli 生态结合', '项目内置飞书 IM、文档、日历、表格、多维表格、任务、云盘等 skills，使 Claude Code 能按需调用飞书能力。', 'Claude Code 不只返回文本，还能按技能规范调用飞书业务能力，把代码分析结果继续沉淀到协作工具里。', 'auto-feishu.png'],
  ['插件化和 skills 设计', 'oh-my-feishu-plugin 可作为 Claude plugin 安装到项目，复用飞书能力，不必只依赖主应用。', '飞书能力被封装为可安装的 plugin/skills，后续项目可以复用这套协议，而不是复制主应用逻辑。', '自动化服务菜单.png'],
];

const engineeringHighlights = [
  ['PKG', '12,600+ 行 TypeScript', '从 CLI 入口到飞书 WebSocket，从 Claude 调用到后台自动化，完整工程闭环。', 'src/ 目录下 60+ 个模块，涵盖入口、路由、会话、执行、卡片、网关、监控等核心能力。'],
  ['TST', '19 个测试文件', '核心路径都有测试覆盖：消息路由、卡片分发、Gateway runner、Traceback monitor、Invoker 等。', '测试即文档，每个 test.ts 都是对应模块的使用示例和边界验证。'],
  ['EVT', '事件驱动 Gateway', 'GatewayEvent 统一飞书命令、timer、webhook、CLI 等触发源，Feature Registry 按类型匹配处理器。', '新增自动化能力只需实现 GatewayFeature 接口，无需改动入口代码。'],
  ['SEC', '四重安全 Guard', 'Path Guard、Diff Size Guard、Secret Scan、Test Guard 控制自动修复风险。', '自动修复前先跑安全检查，超限则阻断并要求人工确认。'],
  ['CRD', '飞书 Card 2.0 组件库', 'menu-cards.ts 封装 interactive_container、markdown、标准图标等组件。', '卡片即 UI，复杂交互流程通过卡片按钮驱动，降低用户学习成本。'],
  ['SKL', '插件化 Skills 设计', 'Web Monitor 拆分为分析、修复、通知、服务管理、安全检查、日志分析等独立 skill。', '每个 skill 单一职责，可独立维护、测试、升级。'],
];

const painPoints = [
  'Claude Code 主要依赖终端，用户离开电脑或在移动端时很难继续已有工作。',
  '执行结果停留在本地终端，不容易沉淀到飞书这样的团队协作工具里。',
  '飞书消息、文档、任务和本地代码仓库割裂，AI 分析结果难以自然回到团队沟通场景。',
  'Web 服务报错和 traceback 变化依赖人工发现、复制日志、切回本地分析，反馈链路长。',
];

const coreValues = [
  '把飞书变成 Claude Code 的交互入口：发起会话、绑定目录、恢复历史 session。',
  '用飞书卡片展示处理状态和结果，让长任务过程可见、可回看。',
  '集成 lark-cli skills，让 Claude Code 能按需操作飞书生态能力。',
  'Web Monitor 把 AI 能力嵌入后台自动化任务，从被动问答变成事件触发后的主动分析和修复。',
];
</script>

<template>
  <section class="showcase-legacy value-doc-page">
    <aside class="value-sidebar" aria-label="项目亮点目录">
      <p class="eyebrow">Highlights</p>
      <h2>项目亮点介绍</h2>
      <nav>
        <a href="#pain" @click.prevent="scrollToSection('pain')">真实痛点</a>
        <a href="#value" @click.prevent="scrollToSection('value')">核心价值</a>
        <a href="#product" @click.prevent="scrollToSection('product')">产品亮点</a>
        <a href="#engineering" @click.prevent="scrollToSection('engineering')">工程亮点</a>
      </nav>
    </aside>

    <article class="value-reader">
      <header class="value-intro">
        <p class="eyebrow">Project highlights</p>
        <h1>项目亮点介绍</h1>
        <p>oh-my-feishu 的重点不是把模型接进聊天窗口，而是把飞书协作、本地 Claude Code、项目目录、skills 和后台自动化连接成一个可用的开发工作流。</p>
      </header>

      <section class="value-section" id="pain">
        <div class="value-copy">
          <p class="eyebrow">Pain points</p>
          <h2>项目解决的真实痛点</h2>
          <div class="point-list"><p v-for="item in painPoints" :key="item">{{ item }}</p></div>
        </div>
        <figure class="media-frame">
          <img :src="asset('talk-demo.gif')" alt="飞书内与 Claude Code 对话演示" loading="lazy" />
          <figcaption>飞书不只是通知出口，而是 Claude Code 的交互入口。</figcaption>
        </figure>
      </section>

      <section class="value-section" id="value">
        <div class="value-copy">
          <p class="eyebrow">Core value</p>
          <h2>项目的核心价值</h2>
          <div class="point-list"><p v-for="item in coreValues" :key="item">{{ item }}</p></div>
        </div>
        <figure class="media-frame">
          <img :src="asset('web服务监控.png')" alt="Web Monitor 服务监控截图" loading="lazy" />
          <figcaption>Web Monitor 把 AI 能力放进后台事件流。</figcaption>
        </figure>
      </section>

      <section class="value-section full" id="product">
        <div class="section-title-row">
          <div><p class="eyebrow">Product highlights</p><h2>产品亮点</h2></div>
        </div>
        <div class="product-highlight-list">
          <article v-for="[title, text, detail, image] in productHighlights" :key="title" class="product-highlight-card">
            <img :src="asset(image)" :alt="title" loading="lazy" />
            <div><h3>{{ title }}</h3><p>{{ text }}</p><p>{{ detail }}</p></div>
          </article>
        </div>
      </section>

      <section class="value-section full" id="engineering">
        <div class="section-title-row">
          <div><p class="eyebrow">Engineering highlights</p><h2>工程亮点</h2></div>
        </div>
        <div class="engineering-list">
          <article v-for="[icon, title, desc, detail] in engineeringHighlights" :key="title" class="engineering-card">
            <span class="eng-icon">{{ icon }}</span>
            <div class="eng-content"><h3>{{ title }}</h3><p class="eng-desc">{{ desc }}</p><p class="eng-detail">{{ detail }}</p></div>
          </article>
        </div>
      </section>
    </article>
  </section>
</template>
