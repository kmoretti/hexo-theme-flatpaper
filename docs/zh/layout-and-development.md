# 布局与开发

## 布局文件

| 布局 | 文件 | 用途 |
| --- | --- | --- |
| Home | `layout/index.ejs` | 精选轮播与分页文章网格 |
| Post | `layout/post.ejs` | 文章、reaction、上一篇 / 下一篇、相关文章 |
| Page | `layout/page.ejs` | 默认页面与 `type:` 路由 |
| Friends | `layout/link.ejs` | 友链网格 |
| Archive | `layout/archive.ejs` | 按日期分组的文章列表 |
| Category index | `layout/categories.ejs` | 分类云 / 网格 |
| Category | `layout/category.ejs` | 单个分类下的文章 |
| Tag index | `layout/tags.ejs` | 标签云 |
| Tag | `layout/tag.ejs` | 单个标签下的文章 |

## 共享 partial

- `head.ejs`：meta 与 stylesheet
- `header.ejs`：品牌、桌面导航、搜索、调色盘、明暗切换、移动端抽屉按钮
- `footer.ejs`：页脚模板 token
- `sidebar-right.ejs`：视觉左侧栏与移动端抽屉
- `sidebar-left.ejs`：首页 / 列表页视觉右侧栏
- `random-posts.ejs`：随机文章卡片
- `post-card.ejs`：首页 / 网格卡片
- `archive-list.ejs`：分页归档 / 分类 / 标签列表
- `thumbnail.ejs`：封面图与 CSS 回退
- `search.ejs`：搜索弹窗与 JSON 索引
- `icons.ejs`：图标查找

## 侧栏布局说明

DOM 中视觉左列由 `sidebar-right.ejs` 渲染，包含 profile、文章页 TOC、分类、标签、brand links 与移动端抽屉工具。

视觉右列由 `sidebar-left.ejs` 渲染，在首页 / 列表页包含欢迎卡片和随机文章。

这个顺序让更常用的侧栏在窄屏下成为汉堡按钮控制的抽屉。

文章页跳过 `sidebar-left`，只保留一个侧栏。

## 目录结构

```text
themes/flatpaper/
|-- _config.yml
|-- docs/
|-- layout/
|   |-- _partial/
|   `-- *.ejs
|-- scripts/
|   |-- tags.js
|   |-- note-container.js
|   `-- _note-types.js
`-- source/
    |-- css/
    |   |-- style.styl
    |   `-- _partials/
    |       |-- var.styl
    |       |-- base.styl
    |       |-- _layout/
    |       |-- _global/
    |       |-- _components/
    |       |-- _page/
    |       `-- _mode/
    `-- js/
        `-- main.js
```

## JavaScript 职责

`source/js/main.js` 负责：

- 深色模式切换
- 主题色菜单与移动端色点
- 搜索弹窗
- 标题锚点
- TOC scrollspy 与 bottom lock
- 精选轮播
- 移动端侧栏抽屉
- 桌面与抽屉二级菜单
- 代码块复制 / 折叠 / 行号交互
- tabs 交互
- reaction 弹层
- 评论跳转 / 分享按钮
- Fancybox 内容包裹

## 构建检查

在使用该主题的 Hexo 站点中：

```bash
hexo generate --config _config.yml,_config.flatpaper.yml
```

在当前 demo workspace 中：

```bash
pnpm build -- --config _config.yml,_config.flatpaper.yml
```
