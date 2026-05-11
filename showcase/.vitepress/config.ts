import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'zh-CN',
  title: 'oh-my-feishu',
  description: '在飞书中使用 Claude Code 的轻量文档与项目展示',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
  ],
  themeConfig: {
    logo: '/icon-192.png',
    nav: [
      { text: '首页', link: '/' },
      { text: '文档', link: '/docs/' },
      {
        text: '项目展示',
        items: [
          { text: '产品亮点', link: '/value/' },
          { text: '自动化服务', link: '/gateway/' },
          { text: '核心代码', link: '/code/' },
          { text: 'AI 亮点', link: '/ai/' },
        ],
      },
    ],
    sidebar: [
      {
        text: '开始使用',
        items: [
          { text: '文档概览', link: '/docs/' },
          { text: '安装与启动', link: '/docs/install/' },
          { text: '飞书配置', link: '/docs/feishu/' },
          { text: '目录会话', link: '/docs/sessions/' },
          { text: 'Web Monitor 自动化', link: '/docs/web-monitor/' },
        ],
      },
      {
        text: '维护',
        items: [
          { text: '插件能力概览', link: '/docs/plugin-capabilities/' },
          { text: '部署与网站', link: '/docs/deployment/' },
        ],
      },
      {
        text: '开发与排障',
        items: [
          { text: '卡片开发规范', link: '/docs/card-development/' },
          { text: '日志与排障', link: '/docs/logging/' },
        ],
      },
    ],
    outline: {
      level: [2, 3],
      label: '本页目录',
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档',
          },
          modal: {
            displayDetails: '显示详情',
            resetButtonTitle: '清除搜索',
            backButtonTitle: '关闭搜索',
            noResultsText: '没有找到结果',
            footer: {
              selectText: '选择',
              selectKeyAriaLabel: '回车',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '上方向键',
              navigateDownKeyAriaLabel: '下方向键',
              closeText: '关闭',
              closeKeyAriaLabel: 'ESC',
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/yjzhang2003/oh-my-feishu' },
    ],
    footer: {
      message: 'Claude Code x Feishu x lark-cli',
      copyright: 'Released under the MIT License.',
    },
  },
});
