/**
 * ApexCharts 全局主题和默认配置
 */

// 主色调定义
export const COLORS = {
  primary: '#4361ee',
  secondary: '#3f37c9',
  success: '#2ec4b6',
  danger: '#e71d36',
  warning: '#ff9f1c',
  info: '#4cc9f0',
  purple: '#7209b7',
  gray: '#6c757d',
  chartColors: [
    '#4361ee', '#3a86ff', '#8338ec', '#ff006e',
    '#fb5607', '#ffbe0b', '#06d6a0', '#118ab2',
  ],
};

/** 统一色库（25 种柔和色，全局图表/标签共用） */
export const AD_MATERIAL_COLORS = [
  '#7A8B99', '#9CAF9F', '#C4A4A4', '#D6C9B0', '#9B93A8',
  '#8FA3B0', '#7D8F7B', '#D0B4B4', '#BFAE8E', '#B4AEC0',
  '#5C6B7A', '#8A8F6B', '#B08B8B', '#C9B79C', '#A0A0A0',
  '#A9BAC4', '#A8BFAE', '#C9B6C0', '#A6947E', '#B0AAA4',
  '#6B7C8C', '#5F6F5E', '#B9A2AE', '#D8CFC0', '#6E6E6E',
];

// 通用 ApexCharts 配置
export const baseChartOptions = {
  chart: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    toolbar: {
      show: true,
      tools: {
        download: true,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true,
      },
    },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800,
    },
  },
  colors: COLORS.chartColors,
  dataLabels: {
    enabled: false,
  },
  tooltip: {
    theme: 'light',
    x: {
      show: true,
    },
  },
  legend: {
    position: 'top',
    horizontalAlign: 'left',
    fontSize: '13px',
  },
  grid: {
    borderColor: '#e9ecef',
    strokeDashArray: 3,
  },
  xaxis: {
    labels: {
      style: {
        colors: '#6c757d',
        fontSize: '12px',
      },
    },
    axisBorder: {
      color: '#dee2e6',
    },
    axisTicks: {
      color: '#dee2e6',
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: '#6c757d',
        fontSize: '12px',
      },
      formatter: (val) => {
        if (Math.abs(val) >= 1e8) return (val / 1e8).toFixed(1) + '亿';
        if (Math.abs(val) >= 1e4) return (val / 1e4).toFixed(1) + '万';
        return val;
      },
    },
  },
  responsive: [
    {
      breakpoint: 768,
      options: {
        legend: {
          position: 'bottom',
          horizontalAlign: 'center',
        },
      },
    },
  ],
};

/** 时间轴通用配置 */
export const datetimeAxis = {
  type: 'datetime',
  labels: {
    datetimeUTC: false,
    format: 'MM/dd',
  },
};

/** 深色工具提示中的货币格式器 */
export const currencyFormatter = (val) => '¥' + val.toLocaleString('zh-CN');

/** 百分比格式器 */
export const percentFormatter = (val) => val.toFixed(2) + '%';