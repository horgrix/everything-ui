# 数据大盘 · 静态 JSON 契约

页面：`/dashboard`（导航「数据大盘」）。前端只按这份契约渲染，**不写死任何业务区块** ——
新增/删除区块只改数仓导出的 `manifest.json`，前端不用重新发版。

## 1. 落点

生产中 JSON 放在 dist 下的同源静态目录：

```
/var/www/everything-ui/dist/_api/dashboard/manifest.json
/var/www/everything-ui/dist/_api/dashboard/*.json
```

页面按相对路径 `/_api/dashboard/<file>` 取，同源带 SSO Cookie、可被 nginx 缓存。
要换路径只需改环境变量 `VITE_DASHBOARD_BASE_URL`（dev 走 `vite.config.js` 的 `/_api` 代理）。

## 2. manifest.json

```json
{
  "title": "数据大盘",
  "subtitle": "全站核心指标总览",
  "updatedAt": "2026-11-05T08:10:00+08:00",
  "period": "2026-11",
  "blocks": [
    { "id": "core-kpi", "type": "kpi", "title": "核心指标", "source": "core-kpi.json", "span": 12 },
    { "id": "traffic-trend", "type": "trend", "title": "站内访问趋势", "source": "traffic-trend.json", "span": 7, "height": 320 },
    { "id": "type-share", "type": "distribution", "title": "题材分布", "source": "type-share.json", "span": 5, "height": 320 },
    { "id": "game-rank", "type": "rank", "title": "热门游戏 Top 10", "source": "game-rank.json", "span": 12, "maxRows": 10 }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `updatedAt` | 数据时间，页头直接展示；数据生成脚本写入 |
| `period` | 统计口径（如 `2026-11`），可选 |
| `blocks[].id` | 唯一，仅前端 key 用 |
| `blocks[].type` | `kpi` / `trend` / `rank` / `distribution` / `table` |
| `blocks[].source` | 相对 `/_api/dashboard/` 的文件名，一个区块一个文件，互不影响 |
| `blocks[].span` | 12 栅格里占几列；`<12` 时在 xl 屏并排，小屏自动整行 |
| `blocks[].height` | 图表高度（px），`trend` / `distribution` 用 |
| `blocks[].maxRows` | `rank` / `table` 最多显示多少行 |

**区块隔离**：任一 `source` 404 或报错，只有那一个卡片显示「数据未就绪」，其余照常渲染；
`manifest.json` 拿不到才整页降级。

## 3. 各类型的数据格式

### kpi

```json
{ "items": [ { "label": "在库游戏数", "value": 12874, "format": "number",
               "unit": "", "delta": 0.0213, "deltaLabel": "较上月", "hint": "口径说明" } ] }
```

`format`：`number` | `compact` | `money` | `money-cny` | `percent` | `large`；
`delta` 为小数（`0.0213` = +2.13%），正数绿、负数红，缺省不显示。

### trend

```json
{ "categories": ["10/7", "10/8"], "series": [ { "name": "PV", "type": "line", "data": [3200, 3420] } ] }
```

`series[].type` 可逐条给 `line` / `bar` / `area`，同一张图混排。

### distribution

```json
{ "labels": ["角色扮演", "策略"], "values": [3120, 2480] }
```

### rank / table

```json
{
  "columns": [ { "key": "name", "label": "游戏" },
               { "key": "ad", "label": "广告消耗（万）", "align": "end", "format": "money" },
               { "key": "delta", "label": "环比", "align": "end", "format": "percent" } ],
  "rows": [ { "name": "星海远征", "ad": 486.2, "delta": 0.213 } ]
}
```

`align`: `end`（数字列右对齐）；`format` 同 kpi；`percent` 列出现负数自动标红。

## 4. 开发自测

`src/pages/DataDashboard/mock.js` 提供了一份同结构的假数据。接口 404 时（仅 dev）页面会回落
到它并在页头打「示例」角标 —— 生产构建不会回落，缺数据就是「数据未就绪」。

```bash
npm run dev   # /dashboard
npm run build # vite build 产物 + dist/_api/dashboard/ 由运维/数仓同步
```
