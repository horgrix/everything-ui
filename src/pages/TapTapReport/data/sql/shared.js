/**
 * TapTap 报表 SQL —— 共享常量（小时表与公共列）
 */

/** 小时窗口数据表（v2：每行一个游戏，自带 app/pc/总下载数与游戏类型） */
export const HOURLY_TABLE = 'dws_taptap_download_v2_hourly';

/** v2 小时表自带的名称 / 图标 / 标签列（明细表直接用，不用再查 taptap_game_info_hourly） */
export const HOURLY_META_COLS = 'app_name, icon, tag_1, tag_2, tag_3';
