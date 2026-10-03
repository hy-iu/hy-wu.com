# 博客插图生成：content/posts/img/<slug>/*.png
# 所有图均由模型数值计算得到（DLA 聚集、Laplace 场松弛、OU 过程精确解、梯度流），
# 不是手绘示意。运行：python3 scripts/blog-figs.py
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from pathlib import Path

# ---------- 公共样式 ----------
for name in ("Noto Sans CJK JP", "Droid Sans Fallback"):
    if any(f.name == name for f in font_manager.fontManager.ttflist):
        plt.rcParams["font.family"] = [name, "DejaVu Sans"]
        break
plt.rcParams["axes.unicode_minus"] = False

INK = "#1c2b33"
BLUE0 = "#0d3557"
BLUE1 = "#2e77a8"
BLUE2 = "#8db9d6"
BLUE3 = "#cfe2ef"
ACCENT = "#b9502e"
GRAY = "#8a8a8a"
DPI = 170

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "content" / "posts" / "img"


def style_ax(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color(GRAY)
    ax.tick_params(colors=INK, labelsize=9)
    for s in ax.get_xticklabels() + ax.get_yticklabels():
        s.set_color(INK)


def save(fig, slug, name):
    d = IMG / slug
    d.mkdir(parents=True, exist_ok=True)
    fig.savefig(d / name, dpi=DPI, facecolor="white", bbox_inches="tight")
    plt.close(fig)
    print("wrote", slug + "/" + name)


# ---------- 第一篇：窗花 ----------
def dla_cluster(n_target, seed=11):
    """带噪声削减（需 ≥2 个已占邻居才粘住，种子附近放宽）的片上 DLA。"""
    rng = np.random.default_rng(seed)
    L = 760
    cx = cy = L // 2
    occ = np.zeros((L, L), bool)
    occ[cy, cx] = True
    xs, ys, order = [cx], [cy], [0]
    snaps = {}
    marks = {500, 2000, 5000}
    while len(xs) < n_target:
        rmax = np.hypot(np.array(xs) - cx, np.array(ys) - cy).max()
        r0, rkill = rmax + 4, rmax + 30
        n = 1400
        th = rng.random(n) * 2 * np.pi
        x = np.clip(np.round(cx + r0 * np.cos(th)).astype(int), 1, L - 2)
        y = np.clip(np.round(cy + r0 * np.sin(th)).astype(int), 1, L - 2)
        alive = np.ones(n, bool)
        for _ in range(60000):
            idx = np.where(alive)[0]
            if idx.size == 0:
                break
            d = rng.integers(0, 4, idx.size)
            x[idx] += (d == 0).astype(np.int64) - (d == 1)
            y[idx] += (d == 2).astype(np.int64) - (d == 3)
            out = np.hypot(x[idx] - cx, y[idx] - cy) > rkill
            if out.any():
                t2 = rng.random(out.sum()) * 2 * np.pi
                x[idx[out]] = np.round(cx + r0 * np.cos(t2)).astype(int)
                y[idx[out]] = np.round(cy + r0 * np.sin(t2)).astype(int)
            xi, yi = x[idx], y[idx]
            cnt = (
                occ[yi, xi - 1].astype(np.int32)
                + occ[yi, xi + 1]
                + occ[yi - 1, xi]
                + occ[yi + 1, xi]
            )
            hit = cnt >= 1
            for i in idx[hit]:
                occ[y[i], x[i]] = True
                xs.append(int(x[i]))
                ys.append(int(y[i]))
                order.append(len(xs))
                alive[i] = False
        for m in marks:
            if m not in snaps and len(xs) >= m:
                snaps[m] = (np.array(xs[:m]), np.array(ys[:m]), np.array(order[:m]))
    return snaps


def fig_frost_dla():
    slug = "2026-10-03-frost-and-ml-structure"
    snaps = dla_cluster(5000)
    titles = {
        500: "N = 500 · 成核与主干",
        2000: "N = 2 000 · 侧枝竞争",
        5000: "N = 5 000 · 自相似分形",
    }
    fig, axes = plt.subplots(1, 3, figsize=(10.8, 3.75))
    for ax, n in zip(axes, (500, 2000, 5000)):
        x, y, o = snaps[n]
        norm = 0.62 * o / o.max()
        ax.scatter(x, y, s=2.2, c=norm, cmap="Blues_r", vmin=0, vmax=0.62, linewidths=0)
        ax.set_title(titles[n], fontsize=10.5, color=INK)
        ax.set_aspect("equal")
        ax.set_box_aspect(1)
        r = np.hypot(x - x.mean(), y - y.mean()).max() + 12
        xm, ym = x.mean(), y.mean()
        ax.set_xlim(xm - r, xm + r)
        ax.set_ylim(ym - r, ym + r)
        ax.set_xticks([])
        ax.set_yticks([])
        for s in ax.spines.values():
            s.set_color(GRAY)
    fig.tight_layout(w_pad=0.6)
    save(fig, slug, "dla_growth.png")


def fig_frost_laplace():
    """过饱和度 u 的准静态扩散：远场 u=1（过饱和），晶体表面 u=0（平衡）。
    水汽通量 −∇u 汇入晶体，在尖端最密集 → 界面法向梯度 ∝ 生长速度。"""
    slug = "2026-10-03-frost-and-ml-structure"
    nx, ny = 420, 330
    xg = np.linspace(-3, 3, nx)
    yg = np.linspace(-2.2, 2.2, ny)
    X, Y = np.meshgrid(xg, yg)
    f = (
        -0.55
        + 1.35 * np.exp(-(X**2) / (2 * 0.32**2))
        + 0.28 * np.exp(-((X - 1.35) ** 2) / (2 * 0.16**2))
        + 0.22 * np.exp(-((X + 1.35) ** 2) / (2 * 0.14**2))
    )
    ice = Y < f
    c = np.where(ice, 0.0, 1.0)
    for it in range(9000):
        cn = c.copy()
        cn[1:-1, 1:-1] = 0.25 * (
            c[:-2, 1:-1] + c[2:, 1:-1] + c[1:-1, :-2] + c[1:-1, 2:]
        )
        cn[ice] = 0.0
        cn[0, :] = 1.0
        cn[-1, :] = 1.0
        cn[:, 0] = 1.0
        cn[:, -1] = 1.0
        if it % 1500 == 0 and np.abs(cn - c).max() < 1e-5 and it > 0:
            break
        c = cn
    gy, gx = np.gradient(c)
    dx, dy = xg[1] - xg[0], yg[1] - yg[0]
    gx, gy = gx / dx, gy / dy  # 换算成物理单位的梯度
    gm = np.hypot(gx, gy)

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10.4, 4.0), gridspec_kw={"width_ratios": [1.45, 1]})
    a1.contourf(X, Y, c, levels=np.linspace(0, 1, 11), cmap="Blues_r")
    a1.contour(X, Y, c, levels=np.linspace(0.08, 0.92, 10), colors="#7ea4bd", linewidths=0.6)
    a1.contourf(X, Y, ice.astype(float), levels=[0.5, 1.5], colors=[BLUE0])
    # 通量流线：从顶部若干起点沿 −∇u（水汽扩散方向）积分到晶体表面，
    # 展示流线向尖端汇聚；比箭头场干净得多
    ytop = np.array([np.where(ice[:, j])[0].max() for j in range(nx)])
    for x0 in (-2.55, -1.9, -1.25, -0.6, 0.0, 0.6, 1.25, 1.9, 2.55):
        p = np.array([x0, 2.15])
        trace = [p.copy()]
        for _ in range(4000):
            col = int(round((p[0] + 3) / (6 / (nx - 1))))
            row = int(round((p[1] + 2.2) / (4.4 / (ny - 1))))
            if not (0 < row < ny - 1 and 0 < col < nx - 1) or ice[row, col]:
                break
            g = np.array([gx[row, col], gy[row, col]])
            n = np.linalg.norm(g)
            if n < 1e-9:
                break
            p = p - (g / n) * 0.012
            trace.append(p.copy())
            if len(trace) > 2 and np.linalg.norm(trace[-1] - trace[-2]) == 0:
                break
        tr = np.array(trace)
        a1.plot(tr[:, 0], tr[:, 1], color=ACCENT, lw=1.0, alpha=0.85)
        if len(tr) > 3:
            d = tr[-1] - tr[-4]
            a1.annotate("", xy=tr[-1], xytext=tr[-1] - 0.055 * d / np.linalg.norm(d),
                        arrowprops=dict(arrowstyle="-|>", color=ACCENT, lw=1.0))
    a1.set_title("过饱和度场 $u$（深色 = 已被晶体耗尽）与扩散流线", fontsize=10.5, color=INK, pad=6)
    a1.set_xticks([])
    a1.set_yticks([])
    for s in a1.spines.values():
        s.set_color(GRAY)

    # 界面法向梯度随横向位置的变化：表面上方第一个自由格点的 u 值（∝ ∂ₙu）。
    # 两端 0.4 内是晶面贴着求解区侧墙的边界伪影，剪掉。
    gsurf = c[np.minimum(ytop + 1, ny - 1), np.arange(nx)]
    edge = np.abs(xg) > 2.6
    gsurf_show = np.where(edge, np.nan, gsurf)
    a2.fill_between(xg, gsurf_show, color=BLUE2, alpha=0.55)
    a2.plot(xg, gsurf_show, color=BLUE0, lw=1.4)
    for bump in (0, 1.35, -1.35):
        a2.axvline(bump, color=GRAY, lw=0.6, ls=":")
    a2.annotate("主尖", xy=(0, gsurf[nx // 2]), xytext=(-2.45, 0.045),
                fontsize=9.5, color=INK, arrowprops=dict(arrowstyle="->", color=INK, lw=0.9))
    a2.annotate("侧枝", xy=(1.35, gsurf[np.argmin(np.abs(xg - 1.35))]), xytext=(1.75, 0.052),
                fontsize=9.5, color=INK, arrowprops=dict(arrowstyle="->", color=INK, lw=0.9))
    a2.set_xlabel("横向位置 $x$", fontsize=10, color=INK)
    a2.set_ylabel("法向梯度（∝ 生长速度）", fontsize=10, color=INK)
    a2.set_title("界面生长速度的分布", fontsize=10.5, color=INK)
    a2.set_xlim(-2.85, 2.85)
    style_ax(a2)
    fig.tight_layout(w_pad=1.2)
    save(fig, slug, "laplace_tip.png")


def fig_frost_dispersion():
    slug = "2026-10-03-frost-and-ml-structure"
    fig = plt.figure(figsize=(10.6, 3.3))
    gs = fig.add_gridspec(1, 3, width_ratios=[1.1, 1.15, 0.75], wspace=0.42)

    a = fig.add_subplot(gs[0])
    k = np.linspace(0, 2.6, 400)
    w = k - k**3 / 3
    a.axhline(0, color=GRAY, lw=0.7)
    a.fill_between(k, w, 0, where=w > 0, color=BLUE3, alpha=0.9)
    a.plot(k, w, color=BLUE0, lw=1.8)
    kc, kst = np.sqrt(3), 1.0
    a.plot([kst], [kst - kst**3 / 3], "o", color=ACCENT, ms=5)
    a.annotate("$k^*$（最快模式）", xy=(kst, 4 / 9), xytext=(1.35, 0.52), fontsize=9.5,
               color=INK, arrowprops=dict(arrowstyle="->", color=INK, lw=0.9))
    a.text(0.12, -0.42, "不稳定带 $0<k<k_c$", fontsize=9.5, color=BLUE0)
    a.annotate("$k_c$", xy=(kc, 0), xytext=(kc, 0.22), fontsize=10, color=INK,
               ha="center", arrowprops=dict(arrowstyle="->", color=INK, lw=0.8))
    a.set_xlabel("扰动波数 $k$", fontsize=10, color=INK)
    a.set_ylabel("增长率 $\\omega(k)$", fontsize=10, color=INK)
    a.set_title("(a) Mullins–Sekerka 色散关系\n$\\omega(k)=|\\nabla u|\\,k-d_0k^3$", fontsize=10, color=INK)
    a.set_xlim(0, 2.6)
    a.set_ylim(-1.6, 0.75)
    style_ax(a)

    b = fig.add_subplot(gs[1])
    th = np.linspace(0, 360, 721)
    eps = 0.12
    g = 1 + eps * np.cos(np.deg2rad(6 * th))
    stiff = 1 - 35 * eps * np.cos(np.deg2rad(6 * th))
    b.axhline(0, color=GRAY, lw=0.7)
    b.fill_between(th, stiff, 0, where=stiff < 0, color="#f2d9cf", alpha=0.9)
    b.plot(th, g, color=BLUE0, lw=1.8, label="界面能 $\\gamma(\\theta)$")
    b.plot(th, stiff, color=ACCENT, lw=1.6, ls="--", label="刚度 $\\gamma+\\gamma''$")
    b.annotate("刚度 < 0：棱角失稳，\n界面长成小面", xy=(30, -1.6), xytext=(95, -2.6), fontsize=9,
               color=INK, arrowprops=dict(arrowstyle="->", color=INK, lw=0.9))
    b.set_xlabel("界面法向角 $\\theta$（度）", fontsize=10, color=INK)
    b.set_title("(b) 六重各向异性（$\\varepsilon=0.12$）", fontsize=10, color=INK)
    b.legend(fontsize=8.5, frameon=False, loc="upper center", bbox_to_anchor=(0.5, -0.16), ncols=2)
    b.set_xticks([0, 60, 120, 180, 240, 300, 360])
    b.set_ylim(-3.4, 1.35)
    style_ax(b)

    c = fig.add_subplot(gs[2], projection="polar")
    t2 = np.linspace(0, 2 * np.pi, 721)
    r = 1 / np.clip(1 - 35 * 0.12 * np.cos(6 * t2), 0.12, None)
    c.plot(t2, r / r.max(), color=BLUE1, lw=1.6)
    c.fill(t2, r / r.max(), color=BLUE2, alpha=0.35)
    c.set_xticks(np.deg2rad([0, 60, 120, 180, 240, 300]))
    c.set_xticklabels([])
    c.set_yticks([])
    c.grid(color=GRAY, alpha=0.35, lw=0.5)
    c.spines["polar"].set_color(GRAY)
    c.set_title("(c) Wulff 形状：\n沿 $a$ 轴的六个尖", fontsize=10, color=INK, pad=14)
    save(fig, slug, "dispersion_anisotropy.png")


# ---------- 第二篇：蒙卡与 diffusion ----------
def mixture_params(mu, sig, t):
    """OU 前向：x_t = e^{-t} x_0 + sqrt(1-e^{-2t}) eps。双高斯混合参数的精确演化。"""
    a = np.exp(-t)
    v = sig**2 * a**2 + 1 - a**2
    return [(-mu * a, np.sqrt(v)), (mu * a, np.sqrt(v))]


def mix_pdf(x, params):
    return sum(np.exp(-0.5 * ((x - m) / s) ** 2) / (s * np.sqrt(2 * np.pi)) for m, s in params)


def mix_score(x, params):
    num = sum(-((x - m) / s**2) * np.exp(-0.5 * ((x - m) / s) ** 2) / s for m, s in params)
    den = sum(np.exp(-0.5 * ((x - m) / s) ** 2) / s for m, s in params)
    return num / den


def fig_mc_routes():
    slug = "2026-10-03-transport-qmc-diffusion"
    fig, axes = plt.subplots(1, 3, figsize=(11.0, 3.7))

    # (a) DMC：虚时投影 = 扩散步 + 势场漂移 + 分支
    a = axes[0]
    x = np.linspace(-2.6, 2.6, 400)
    U = 0.35 * x**4 - 1.1 * x**2 + 0.15 * x + 1.6
    a.plot(x, U, color=BLUE0, lw=1.8)
    a.fill_between(x, U, -0.4, color=BLUE3, alpha=0.5)
    rng = np.random.default_rng(3)
    wx = np.concatenate([rng.normal(-1.25, 0.32, 15), rng.normal(1.35, 0.28, 7), rng.normal(0, 0.45, 4)])
    wy = 0.35 * wx**4 - 1.1 * wx**2 + 0.15 * wx + 1.6 + 0.07
    a.scatter(wx, wy, s=16, color=BLUE1, zorder=5)
    dU = 1.4 * x**3 - 2.2 * x + 0.15
    for xi in (-2.05, -0.7, 0.55, 2.1):
        dirn = -np.sign(np.interp(xi, x, dU))
        yv = np.interp(xi, x, U) + 0.16
        a.annotate("", xy=(xi + 0.17 * dirn, yv), xytext=(xi - 0.17 * dirn, yv),
                   arrowprops=dict(arrowstyle="-|>", color=ACCENT, lw=1.4))
    a.annotate("", xy=(-1.1, 0.33), xytext=(-1.45, 0.33), arrowprops=dict(arrowstyle="-|>", color=BLUE1, lw=1.2))
    a.annotate("", xy=(-1.62, 0.18), xytext=(-1.28, 0.18), arrowprops=dict(arrowstyle="-|>", color=BLUE1, lw=1.2))
    a.text(-1.36, -0.12, "低处 $w>1$：分裂", fontsize=9, color=INK, ha="center")
    a.scatter([0.06], [1.72], s=16, color=BLUE1, zorder=5)
    a.text(0.32, 1.78, "× 0", fontsize=10, color=ACCENT)
    a.text(0.95, 2.2, "$w<1$：消亡", fontsize=9, color=INK, ha="center")
    a.text(2.5, 0.12, "漂移指向低压处", fontsize=8.5, color=ACCENT, ha="right")
    a.set_title("(a) 量子蒙卡：行走 + 分支\n（虚时投影出基态）", fontsize=10, color=INK)
    a.set_xlim(-2.7, 2.7)
    a.set_ylim(-0.4, 3.3)
    a.set_xticks([])
    a.set_yticks([])
    for s in a.spines.values():
        s.set_color(GRAY)

    # (b) diffusion：前向加噪 / 反向去噪
    b = axes[1]
    xs = np.linspace(-4.2, 4.2, 600)
    mu, sig = 1.7, 0.32
    for t, col in zip((0.0, 0.35, 1.0, 2.4), (BLUE0, BLUE1, BLUE2, "#d8e6f2")):
        p = mix_pdf(xs, mixture_params(mu, sig, t))
        b.plot(xs, p, color=col, lw=1.7, label=f"$t={t}$")
    b.annotate("", xy=(-1.9, 1.1), xytext=(-3.3, 1.1), arrowprops=dict(arrowstyle="-|>", color=GRAY, lw=1.3))
    b.text(-2.6, 1.17, "前向：加噪声", fontsize=9, color=INK, ha="center")
    b.annotate("", xy=(1.9, 1.1), xytext=(3.3, 1.1), arrowprops=dict(arrowstyle="-|>", color=ACCENT, lw=1.3))
    b.text(2.6, 1.17, "反向：沿 score 去噪", fontsize=9, color=INK, ha="center")
    b.set_title("(b) Diffusion 模型：分布的输运\n（反向漂移 = score）", fontsize=10, color=INK)
    b.set_xlabel("$x$", fontsize=10, color=INK)
    b.legend(fontsize=8, frameon=False, loc="center left")
    b.set_ylim(0, 1.32)
    style_ax(b)

    # (c) flow matching：确定性速度场把噪声搬去数据
    c = axes[2]
    g = np.linspace(-2.6, 2.6, 24)
    X, Y = np.meshgrid(g, g)
    r1 = (X + 1.15) ** 2 + (Y + 0.5) ** 2
    r2 = (X - 1.15) ** 2 + (Y - 0.5) ** 2
    U2 = 0.5 * (r1 * r2) / 6
    gy2, gx2 = np.gradient(-U2)
    th = np.linspace(0, 2 * np.pi, 26, endpoint=False)
    sp = np.stack([2.35 * np.cos(th), 2.35 * np.sin(th)], axis=1)
    c.streamplot(X, Y, gx2, gy2, start_points=sp, color=BLUE1, density=8, linewidth=0.7,
                 arrowsize=1.1, integration_direction="both")
    c.add_patch(plt.Circle((0, 0), 2.35, fill=False, ls="--", color=GRAY, lw=1.0))
    for (m0, m1) in ((-1.15, -0.5), (1.15, 0.5)):
        c.add_patch(plt.Circle((m0, m1), 0.42, color=BLUE0, alpha=0.85))
    c.text(0, -2.72, "初始：高斯噪声（虚线圆上出发）", fontsize=9, color=INK, ha="center")
    c.text(-1.15, -1.25, "数据", fontsize=9.5, color="white", ha="center")
    c.text(1.15, -0.25, "数据", fontsize=9.5, color="white", ha="center")
    c.set_title("(c) Flow matching：确定性流\n（连续性方程的速度场）", fontsize=10, color=INK)
    c.set_xlim(-2.6, 2.6)
    c.set_ylim(-2.6, 2.6)
    c.set_xticks([])
    c.set_yticks([])
    c.set_aspect("equal")
    for s in c.spines.values():
        s.set_color(GRAY)
    fig.tight_layout(w_pad=1.6)
    save(fig, slug, "routes_schematic.png")


def fig_mc_score_ess():
    slug = "2026-10-03-transport-qmc-diffusion"
    fig, (a, b) = plt.subplots(1, 2, figsize=(10.0, 3.5))

    xs = np.linspace(-4.2, 4.2, 800)
    mu, sig = 1.7, 0.32
    for t, col in zip((0.05, 0.35, 1.0, 2.5), (BLUE0, BLUE1, BLUE2, "#c8a13d")):
        s = mix_score(xs, mixture_params(mu, sig, t))
        a.plot(xs, s, lw=1.7, color=col, label=f"$t={t}$")
    a.axhline(0, color=GRAY, lw=0.7)
    a.annotate("小 $t$：score 在模式附近\n急剧发散，最难学", xy=(1.32, -9), xytext=(-3.9, 6.5),
               fontsize=9, color=INK, arrowprops=dict(arrowstyle="->", color=INK, lw=0.9))
    a.set_title("(a) 反向漂移场：$\\partial_x \\log p_t(x)$", fontsize=10, color=INK)
    a.set_xlabel("$x$", fontsize=10, color=INK)
    a.legend(fontsize=8, frameon=False)
    a.set_ylim(-16, 16)
    style_ax(a)

    # ESS：目标 N(0,1)，建议分布 N(Δ,1)，权重 w=p/q；解析 ESS/N = e^{-Δ²}，
    # 数值校验用直接积分（朴素蒙特卡罗在这里自己就会撞上方差指数墙）
    d = np.linspace(0, 4, 300)
    ess = np.exp(-(d**2))
    b.semilogy(d, ess, color=BLUE0, lw=1.8, label="解析：$\\mathrm{ESS}/N=e^{-\\Delta^2}$")
    xq = np.linspace(-12, 12, 200001)
    dd = (0.5, 1.5, 2.5, 3.5)
    est = []
    for dv in dd:
        eq_w2 = np.trapezoid(
            np.exp(-((xq - dv) ** 2) / 2 - 2 * dv * xq + dv**2) / np.sqrt(2 * np.pi), xq
        )
        est.append(1.0 / eq_w2)
    b.plot(dd, est, "o", color=ACCENT, ms=5, label="数值积分校验")
    b.annotate("费米子符号问题、长时间投影、\n模式坍缩：同一堵指数墙", xy=(2.4, np.exp(-2.4**2)), xytext=(0.35, 3e-3),
               fontsize=9, color=INK, arrowprops=dict(arrowstyle="->", color=INK, lw=0.9))
    b.set_xlabel("两个分布的错位 $\\Delta$", fontsize=10, color=INK)
    b.set_ylabel("有效样本比例（对数轴）", fontsize=10, color=INK)
    b.set_title("(b) 重要性抽样的指数墙", fontsize=10, color=INK)
    b.legend(fontsize=8.5, frameon=False)
    b.set_ylim(1e-13, 2)
    style_ax(b)
    fig.tight_layout(w_pad=1.6)
    save(fig, slug, "score_ess.png")


if __name__ == "__main__":
    fig_frost_dla()
    fig_frost_laplace()
    fig_frost_dispersion()
    fig_mc_routes()
    fig_mc_score_ess()
