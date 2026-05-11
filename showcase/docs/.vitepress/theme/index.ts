import DefaultTheme from 'vitepress/theme';
import './custom.css';
import ShowcaseAI from './components/ShowcaseAI.vue';
import ShowcaseCode from './components/ShowcaseCode.vue';
import ShowcaseGateway from './components/ShowcaseGateway.vue';
import ShowcaseSkill from './components/ShowcaseSkill.vue';
import ShowcaseValue from './components/ShowcaseValue.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ShowcaseAI', ShowcaseAI);
    app.component('ShowcaseCode', ShowcaseCode);
    app.component('ShowcaseGateway', ShowcaseGateway);
    app.component('ShowcaseSkill', ShowcaseSkill);
    app.component('ShowcaseValue', ShowcaseValue);
  },
};
