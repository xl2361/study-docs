import type { MusicPlayerConfig } from "../types/musicConfig";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar: true,

	// 使用 Meting 获取歌单和歌词，播放失败时回退到 GD Studio 动态取链
	mode: "meting",

	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式
	playMode: "random",

	// 是否显启用歌词
	showLyrics: true,

	// Meting API 配置
	meting: {
		api: "https://meting.mikus.ink/api?server=:server&type=:type&id=:id",
		server: "netease",
		type: "playlist",
		id: "13747735815",
		auth: "",
		fallbackApis: [],
		urlFallbackApis: [
			{
				api: "https://music-api.gdstudio.xyz/api.php?types=url&source=:server&id=:id&br=128",
				response: "json",
			},
		],
	},
};
