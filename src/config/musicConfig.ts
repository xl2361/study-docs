import type { MusicPlayerConfig } from "../types/musicConfig";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: "local",

	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式
	playMode: "random",

	// 是否显启用歌词
	showLyrics: true,

	// Meting API 配置（保留备用）
	meting: {
		api: "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
		server: "netease",
		type: "playlist",
		id: "13747735815",
		auth: "",
		fallbackApis: [],
	},

	// 本地音乐 — MP3 文件存在 public/music/ 目录，随 Cloudflare Pages 部署
	local: {
		playlist: [
			{ name: "素颜", artist: "许嵩/何曼婷", url: "/music/许嵩_素颜.mp3", cover: "", lrc: "" },
			{ name: "有何不可", artist: "许嵩", url: "/music/许嵩_有何不可.mp3", cover: "", lrc: "" },
			{ name: "幻听", artist: "许嵩", url: "/music/许嵩_幻听.mp3", cover: "", lrc: "" },
			{ name: "断桥残雪", artist: "许嵩", url: "/music/许嵩_断桥残雪.mp3", cover: "", lrc: "" },
			{ name: "庐州月", artist: "许嵩", url: "/music/许嵩_庐州月.mp3", cover: "", lrc: "" },
			{ name: "如果当时", artist: "许嵩", url: "/music/许嵩_如果当时.mp3", cover: "", lrc: "" },
			{ name: "江南", artist: "林俊杰", url: "/music/林俊杰_江南.mp3", cover: "", lrc: "" },
			{ name: "Always Online", artist: "林俊杰", url: "/music/林俊杰_Always_Online.mp3", cover: "", lrc: "" },
			{ name: "可惜没如果", artist: "林俊杰", url: "/music/林俊杰_可惜没如果.mp3", cover: "", lrc: "" },
			{ name: "曹操", artist: "林俊杰", url: "/music/林俊杰_曹操.mp3", cover: "", lrc: "" },
			{ name: "泡沫", artist: "G.E.M.邓紫棋", url: "/music/邓紫棋_泡沫.mp3", cover: "", lrc: "" },
			{ name: "句号", artist: "G.E.M.邓紫棋", url: "/music/邓紫棋_句号.mp3", cover: "", lrc: "" },
			{ name: "喜欢你", artist: "G.E.M.邓紫棋", url: "/music/邓紫棋_喜欢你.mp3", cover: "", lrc: "" },
		],
	},
};
