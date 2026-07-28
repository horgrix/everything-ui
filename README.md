# 数据可视化平台 (Everything-UI)

基于 **React + ApexCharts + Bootstrap 5** 的多页面数据可视化前端，对接 Python 后端 REST API，覆盖业务报表、财务信息、量化分析三大领域。

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React 19 | latest |
| 构建工具 | Vite 8 | latest |
| 路由 | React Router 7 | latest |
| 状态管理 | TanStack React Query 5 | latest |
| HTTP | Axios | latest |
| 图表 | ApexCharts 6 + react-apexcharts | latest |
| UI 框架 | Bootstrap 5 (SCSS) | latest |
| 图标 | Bootstrap Icons (CDN) | 1.11 |
| 样式预处理 | Sass (sass-embedded) | latest |
| 语言 | JavaScript (JSX) | ES2024+ |

---

## 系统架构

```
┌────────────────────────────────────────────────────────────┐
│                      用户浏览器                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 业务报表  │  │ 财务信息  │  │ 量化信息  │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       └──────────────┼─────────────┘                       │
│               ┌──────┴──────┐                              │
│               │   React Query │  (缓存/去重/loading/error) │
│               └──────┬──────┘                              │
│          ┌───────────┼───────────┐                         │
│          │           │           │                         │
│     ┌────┴────┐ ┌───┴───┐ ┌────┴────┐                    │
│     │ 通用查询 │ │财务API│ │ 量化API │                    │
│     │ /api/    │ │ /api/ │ │ /api/v1 │                    │
│     │  data    │ │  v2   │ │         │                    │
│     └────┬────┘ └───┬───┘ └────┬────┘                    │
└──────────┼──────────┼───────────┼─────────────────────────┘
           │          │           │
           ▼          ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │horgrix.  │ │api.      │ │api.horgrix.  │
   │com       │ │horgrix.  │ │com/api/v1    │
   │通用数据表 │ │com/api/v2│ │量化回测/指标 │
   └──────────┘ └──────────┘ └──────────────┘
```

### 数据流

```
用户交互 → URL/参数 → react-query (useChartData)
  → API 客户端 (axios + interceptors)
  → REST API 响应 ({code:0, data:[...]})
  → transform 数据转换 (ApexCharts 兼容格式)
  → 图表组件渲染 + KPI 卡片展示
```

---

## 项目结构

```
everything-ui/
├── index.html                       # HTML 入口
├── package.json                     # 依赖配置
├── vite.config.js                   # Vite 构建 + 开发代理
├── .env                             # 开发环境变量
├── .env.production                  # 生产环境变量
└── src/
    ├── main.jsx                     # 应用入口 (React Query Provider)
    ├── App.jsx                      # 路由 + 布局
    │
    ├── api/                         # API 层
    │   ├── client.js                # 通用查询 axios 客户端
    │   ├── query.js                 # 通用查询函数
    │   ├── financial.js             # 财务 API (api.horgrix.com)
    │   └── quant.js                 # 量化 API (api.horgrix.com/v1)
    │
    ├── components/                  # 通用组件
    │   ├── charts/                  # ApexCharts 封装
    │   │   ├── ChartWrapper.jsx     # 通用包装器
    │   │   ├── LineChart.jsx        # 折线/面积/阶梯图
    │   │   ├── BarChart.jsx         # 柱状图
    │   │   ├── PieChart.jsx         # 饼图/环形图
    │   │   ├── CandlestickChart.jsx # K线/蜡烛图
    │   │   ├── HeatmapChart.jsx     # 热力图
    │   │   └── MixedChart.jsx       # 双Y轴混合图
    │   ├── layout/                  # 布局组件
    │   │   ├── Navbar.jsx           # 顶部导航栏
    │   │   └── DashboardCard.jsx    # KPI 指标卡片
    │   └── common/                  # 通用组件
    │       ├── Loading.jsx          # 加载状态
    │       └── ErrorBoundary.jsx    # 错误边界
    │
    ├── hooks/
    │   └── useChartData.js          # 图表数据 Hook (react-query)
    │
    ├── utils/
    │   ├── formatters.js            # 格式化工具 (金额/百分比/日期)
    │   └── chart-theme.js           # ApexCharts 主题配置
    │
    ├── styles/
    │   └── index.scss               # Bootstrap + 自定义样式
    │
    └── pages/
        ├── BusinessReport/          # 业务报表页
        ├── FinanceInfo/             # 财务信息页
        └── QuantInfo/              # 量化信息页
```

---

## 页面详情

### 1. 业务报表 (`/business`)

对接 `horgrix.com/api/data` 通用查询接口，包含 4 个 section：

| Section | 图表 | 数据 |
|---------|------|------|
| 游戏选择 | 按钮组 (单选) | 火炬之光国际服 / 国服 / 心动小镇 |
| 排名趋势 | 折线图 (3天) | X=crawled_at, Y=rank, 图例=region |
| 排名热力图 | 热力图 (9个月) | X=日期, Y=region, 值=rank (10段颜色阶梯) |
| 峰值在线人数 | 面积图 (3天) | X=stat_ts, Y=peak_players |
| 评论分析 | 双MixedChart (左右并排) | 左轴: 推荐/不推荐(柱状), 右轴: 推荐率(折线) |

### 2. 财务信息 (`/finance`)

对接 `api.horgrix.com/api/v2/financial` 专用接口，包含 7 个 section：

| Section | 图表 | 数据源 |
|---------|------|--------|
| KPI 卡片 | 营收/毛利/毛利率/调整后净利润 | `core-financial-report` |
| 财务指标 | 柱状图 (4系列) | `core-financial-report` |
| 利润率趋势 | 折线图 (3系列) | `core-financial-report` |
| 资产负债表 | 合同负债折线 + 现金等价物混合图 | `balance-report` |
| 费用报告 | 4列 MixedChart (总费用/销售/研发/行政) | `expense-report` |
| 运营数据 | MAU/MPU 柱状图 | `core-operational-report` |
| 业务收入 | 占比柱状图 + 毛利率折线图 | `revenue-report` |
| 游戏收入分类 | 按类别 + 按确认方式 (堆叠柱状图) | `revenue-game-report` |

**筛选：** 年份范围下拉框 (`start_year` ~ `end_year`) + 期间 H1/H2/FY

### 3. 量化信息 (`/quant`)

对接 `api.horgrix.com/api/v1` 量化回测接口：

| Section | 图表 | 数据源 |
|---------|------|--------|
| KPI 卡片 x6 | 最新价/涨跌幅/最高/最低/成交量/条数 | `indicator/compute` |
| K线图 | 蜡烛图 + 策略信号 B/S 标注 | `indicator/compute` + `strategy/run` |
| 指标图 | ADX / CHOP / PSAR (3列并排) | `indicator/compute` |
| 策略参数 | 动态参数配置 (下拉+输入框) | `strategy/list` |
| 策略摘要 x6 | 初始资金/最终权益/总收益率/夏普/最大回撤 | `strategy/run` |
| 净值曲线+回撤 | 策略净值 vs 基准 折线面图 | `strategy/run` (equity_curve) |
| 交易明细 | 分页表格 (每页10条) | `strategy/run` (trades) |

**筛选：** 股票代码输入 + 市场下拉 + 起止日期

---

## API 集成

### API 端点映射

| 页面 | 客户端 | Base URL | 认证格式 |
|------|--------|----------|---------|
| 业务报表 | `apiClient` (通用查询) | `/api/data` → `horgrix.com` | `{code:0, data:[], total:N}` |
| 财务信息 | `finClient` (专用) | `/api/v2/financial` → `api.horgrix.com` | 纯数组 |
| 量化信息 | `quantClient` (专用) | `/api/v1` → `api.horgrix.com` | `{code:0, data:[], count:N}` |

### 通用查询参数格式

```
/api/data/{table_name}/query?
  fields=col1,col2
  &where=[{"col":"date","op":">=","value":"2026-01-01"}]
  &group_by=date
  &order_by=col ASC
  &limit=9999
  &aggregate=SUM(col) as total
```

### 图表组件数据格式约定

```js
// 时序折线图
{ series: [{ name: '系列名', data: [{ x: '2026-01-01', y: 100 }] }] }

// K线图 (OHLC)
{ series: [{ data: [{ x: '2026-01-01', y: [O, H, L, C] }] }] }

// 饼图
{ series: [35, 28, 20], labels: ['A', 'B', 'C'] }

// 热力图
{ series: [{ name: '行', data: [{ x: '列', y: 值 }] }] }

// 混合图 (双Y轴)
{ series: [{ name: '费用', type: 'column', yAxisIndex: 0, data: [...] },
           { name: '占比', type: 'line', yAxisIndex: 1, data: [...] }] }
```

---

## 环境配置

### 开发环境 (`.env`)

```bash
# 业务报表通用查询 → Vite 代理到 horgrix.com
VITE_API_BASE_URL=/api/data

# 量化 API → 直连远程
VITE_QUANT_API_BASE_URL=https://api.horgrix.com/api/v1
```

### 生产环境 (`.env.production`)

```bash
VITE_API_BASE_URL=https://horgrix.com/api/data
VITE_QUANT_API_BASE_URL=https://api.horgrix.com/api/v1
```

### Vite 代理配置 (`vite.config.js`)

开发环境下 `/api/data` 和 `/api/v2` 通过代理转发，避免 CORS 问题。量化 API 直连远程服务器。

---

## 部署指南

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器 (默认端口 5173)
npm run dev

# 3. 访问
http://localhost:5173
```

### 生产构建

```bash
# 构建生产版本
npm run build

# 产出目录: dist/
# - index.html
# - assets/index-xxx.css (~225KB)
# - assets/index-xxx.js (~1.14MB)

# 部署 dist/ 到任意静态服务器即可
```

### Nginx 部署示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/everything-ui/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 可选：代理 API 避免跨域
    # location /api/ {
    #     proxy_pass https://horgrix.com;
    # }
}
```

### Docker 部署 (可选)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 图表组件 API

### LineChart

| Prop | 类型 | 说明 |
|------|------|------|
| `series` | Array | ApexCharts series 数据 |
| `area` | boolean | 是否面积图 |
| `stepline` | boolean | 是否阶梯线 |
| `chartGroup` | string | 缩放同步组名 |
| `colors` | Array | 自定义颜色 |
| `yaxisAnnotations` | Array | Y轴水平标注线 `[{y, label, color}]` |
| `xaxisOverrides` | Object | X轴配置覆盖 (type/categories/min/max) |
| `yaxisOverrides` | Object | Y轴配置覆盖 |
| `strokeWidth` | number | 线条粗细 (默认2) |
| `markers` | number | 数据点大小 (默认0) |

### BarChart

| Prop | 类型 | 说明 |
|------|------|------|
| `stacked` | boolean | 是否堆叠 |
| `horizontal` | boolean | 是否横向柱状 |
| `xaxisOverrides` | Object | X轴覆盖 (含 categories) |
| `yaxisOverrides` | Object | Y轴覆盖 (含 max/labels.formatter) |

### CandlestickChart

| Prop | 类型 | 说明 |
|------|------|------|
| `annotations` | Object | ApexCharts 标注对象 (如 xaxis B/S 标记) |
| `chartGroup` | string | 缩放同步组名 |
| `chartEvents` | Object | 事件回调 (mounted/mouseMove等) |

### MixedChart

| Prop | 类型 | 说明 |
|------|------|------|
| `yaxisLeft` | Object | 左Y轴配置 (title/labels.formatter) |
| `yaxisRight` | Object | 右Y轴配置 |
| `colors` | Array | 自定义颜色 (按series顺序) |
| `strokeWidths` | Array | 线条宽度数组 |
| `tooltipY` | Function | `(value, yAxisIndex) => string` 自定义格式化 |

### HeatmapChart

| Prop | 类型 | 说明 |
|------|------|------|
| `colorScale` | Array | 自定义色阶 `[{from, to, name, color}]` |
| `valueFormatter` | Function | 单元格数值格式化 |
| `xaxisOverrides` | Object | X轴覆盖 (含 categories) |

---

## 数据格式化工具

```js
// formatters.js
formatCurrency(1234567)   // "¥1,234,567"
formatPercent(0.1234)      // "12.34%"
formatNumber(1234567)      // "1,234,567"
formatLarge(1234567)       // "123.46万"
formatDate('2026-07-01')   // "2026-07-01"

// chart-theme.js
baseChartOptions            // 全局 ApexCharts 默认配置
datetimeAxis               // 时间轴配置 {type:'datetime', format:'MM/dd'}
currencyFormatter          // 货币 tooltip
percentFormatter           // 百分比 tooltip
```

---

## 许可

MIT License