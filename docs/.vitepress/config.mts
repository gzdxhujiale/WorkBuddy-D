import { defineConfig } from "vitepress";

export default defineConfig({
  title: "WorkBuddy-D",
  description: "项目知识库",
  lang: "zh-CN",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "架构", link: "/architecture" },
      { text: "产品", link: "/product-specs/" },
      { text: "设计", link: "/design-docs/" },
      { text: "质量", link: "/QUALITY_SCORE" },
    ],
    sidebar: [
      {
        text: "项目",
        items: [
          { text: "首页", link: "/" },
          { text: "架构", link: "/architecture" },
          { text: "设计", link: "/DESIGN" },
          { text: "前端", link: "/FRONTEND" },
          { text: "产品判断", link: "/PRODUCT_SENSE" },
        ],
      },
      {
        text: "产品与设计",
        items: [
          { text: "产品规范", link: "/product-specs/" },
          { text: "设计文档", link: "/design-docs/" },
          { text: "色彩与视觉层级规范", link: "/design-docs/color-scheme" },
          { text: "核心信念", link: "/design-docs/core-beliefs" },
        ],
      },
      {
        text: "工程运营",
        items: [
          { text: "数据库快照", link: "/generated/db-schema" },
          { text: "执行计划", link: "/PLANS" },
          { text: "技术债", link: "/exec-plans/tech-debt-tracker" },
          { text: "可靠性", link: "/RELIABILITY" },
          { text: "安全", link: "/SECURITY" },
          { text: "质量评分", link: "/QUALITY_SCORE" },
        ],
      },
    ],
    search: { provider: "local" },
  },
});
