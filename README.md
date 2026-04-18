# World Heritage Cyber Atlas

基于 **Google Maps** 的世界遗产探索网页。项目从 `data/whc-sites-2025.csv` 读取遗产数据，并在地图上展示全部遗产点位、筛选和统计结果。

## 主要功能

- 地图标注三类遗产：`Cultural`、`Natural`、`Mixed`
- 使用 `assets/` 里的自定义图标显示不同类别
- 点击 marker 展示信息窗，包含：
  - 中文名 `name_zh`
  - 英文名 `name_en`
  - 描述（优先 `short_description_zh`，为空则用 `short_description_en`）
  - 入选年份 `date_inscribed`
  - 是否濒危 `danger`
  - 面积 `area_hectares`
  - 类别 `category`
  - 国家或地区 `states_name_en`
  - 区域 `region_en`
- 支持 `been` 列（`Y`=去过）并在地图上做高亮区分
- 多维过滤：
  - 名称搜索
  - 濒危
  - 类别
  - 国家或地区
  - 区域
  - 是否去过
- 每个过滤选项显示当前匹配数量
- 统计矩阵：
  - `全部遗产` / `我去过` 两种视角
  - 按国家/地区统计文化、自然、混合、总数
  - 单柱堆叠图（绝对长度）

## 项目结构

- `index.html`：页面结构与 Google Maps 脚本引入
- `styles.css`：赛博风 UI 样式和响应式布局
- `app.js`：数据解析、地图渲染、过滤与统计逻辑
- `data/whc-sites-2025.csv`：遗产数据源
- `assets/`：marker 图标资源

## 本地运行

1. 进入项目目录：

```bash
cd /Users/bingxu/Desktop/Bing/projects/260322_whc_explorer
```

2. 启动静态服务（避免浏览器直接打开 `file://` 时阻止 CSV 请求）：

```bash
python3 -m http.server 8000
```

3. 打开页面：

- `http://localhost:8000/index.html`


## 数据约定

- `been` 列：
  - `Y` 表示已去过
  - 空值表示未去过
- `danger` 列：
  - `1` 表示濒危
  - `0` 表示非濒危
- `states_name_en` 可能包含多个国家/地区，使用逗号分隔

## 设计说明

- 整体风格为未来感 / geek / fancy
- 地图与统计模块采用面板化布局
- 当前布局为：
  - 第一行：过滤面板 + 地图
  - 第二行：统计矩阵（横跨全宽）

## 后续可扩展

- marker 聚合（减少缩放级别较小时的视觉拥挤）
- 统计导出（CSV / PNG）
- 更多地图底图主题切换
