# Changelog

All notable changes to this project are documented in this file.

## 2026-04-18

### Added

- 初始地图应用框架（`index.html` + `styles.css` + `app.js`）
- 从 `data/whc-sites-2025.csv` 解析遗产数据并绘制 Google Maps markers
- 遗产三类图标支持：`Cultural` / `Natural` / `Mixed`
- marker 点击信息窗（中英文名称、描述、年份、濒危、面积、类别、国家/地区、区域）
- `been` 字段已访问状态可视化（marker 额外高亮/标记）
- 全量过滤器：名称、濒危、类别、国家/地区、区域、是否去过
- 过滤项实时计数展示
- 统计视图双范围切换：`全部遗产` / `我去过`
- 统计排序支持：`total` / `cultural` / `natural` / `mixed`

### Changed

- 统计展示从表格切换为图形主视图
- 统计图改为单柱堆叠（文化/自然/混合），并显示分段数量
- 柱长度逻辑改为绝对长度（像素单位）
- 柱长度倍率提升（`BAR_UNIT_PX` 从 `8` 提升到 `16`）
- 移除柱右侧胶囊显示与每行横向滚动条
- 修正图表标签列宽，使所有柱左侧对齐
- 主布局改版：
  - 第一行：过滤面板 + 地图（地图更宽）
  - 第二行：统计矩阵横跨全宽

### Fixed

- InfoWindow 中文标题回退逻辑中的渲染异常字符问题
- 过滤器在无可选项时的下拉回退与可用性逻辑
