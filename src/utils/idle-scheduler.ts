/**
 * 空闲调度工具：把非首屏必需的工作挪出关键渲染路径，
 * 避免 Swup 切页时十几个组件在 contentReplaced 后同步抢主线程，
 * 导致"文章标题/目录/正文看起来一起慢"。
 *
 * 优先级：requestIdleCallback（有 deadline）→ setTimeout 兜底。
 */

type IdleCallback = (deadline?: IdleDeadline) => void;

const hasIdle =
	typeof window !== "undefined" &&
	typeof window.requestIdleCallback === "function";

/** 在浏览器空闲时执行，超时（timeout）后强制执行 */
export function onIdle(fn: IdleCallback, timeout = 2000): void {
	if (typeof window === "undefined") return;
	if (hasIdle) {
		window.requestIdleCallback((d) => fn(d), { timeout });
	} else {
		setTimeout(() => fn(), 1);
	}
}

/** 分帧执行：把一批任务拆到多帧，避免单次长任务阻塞主线程 */
export function runChunked(
	tasks: Array<() => void>,
	onDone?: () => void,
): void {
	if (typeof window === "undefined") return;
	let i = 0;
	const step = () => {
		const start = performance.now();
		while (i < tasks.length && performance.now() - start < 5) {
			try {
				tasks[i]();
			} catch {
				// 单个任务失败不影响其余任务
			}
			i++;
		}
		if (i < tasks.length) {
			requestAnimationFrame(step);
		} else if (onDone) {
			onDone();
		}
	};
	onIdle(() => requestAnimationFrame(step));
}

/**
 * 元素进入视口时执行一次（用于评论等底部内容的懒加载）
 */
export function onVisible(
	el: Element,
	fn: () => void,
	rootMargin = "600px",
): () => void {
	if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
		onIdle(fn);
		return () => {};
	}
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					io.disconnect();
					onIdle(fn);
					break;
				}
			}
		},
		{ rootMargin },
	);
	io.observe(el);
	return () => io.disconnect();
}
