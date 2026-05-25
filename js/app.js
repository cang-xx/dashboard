import {
  getPlatforms,
  getPlatform,
  getArticles,
  getAllArticles,
  addPlatform,
  addArticle,
  updateArticle,
  deleteArticle,
  computeStats,
  formatNumber,
  ARTICLE_TYPES,
  getArticleTypeAverages,
  initStore,
  downloadPortfolioExport,
} from "./store.js";

const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");

let lineChart = null;
let barChart = null;

function navigate(path) {
  if (path === "/" || path === "") {
    history.pushState({ page: "home" }, "", "#/");
  } else {
    const id = path.replace(/^\/platform\//, "");
    history.pushState({ page: "platform", id }, "", `#/platform/${encodeURIComponent(id)}`);
  }
  render();
}

function getRoute() {
  const hash = location.hash.slice(1) || "/";
  const match = hash.match(/^\/platform\/(.+)$/);
  if (match) return { page: "platform", id: decodeURIComponent(match[1]) };
  return { page: "home" };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function normalizeUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function renderArticleTitle(article) {
  const url = normalizeUrl(article.url);
  const title = escapeHtml(article.title);
  if (!url) return `<div class="title">${title}</div>`;
  return `<div class="title"><a class="title-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${title}<span class="link-mark"> ↗</span></a></div>`;
}

function openModal(html, onMount) {
  modalRoot.innerHTML = `<div class="modal-overlay" role="dialog">${html}</div>`;
  const overlay = modalRoot.querySelector(".modal-overlay");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  onMount?.(overlay);
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function showAddPlatformModal() {
  openModal(
    `
    <div class="modal" onclick="event.stopPropagation()">
      <h2>添加新平台</h2>
      <form id="form-platform">
        <div class="form-group">
          <label for="pf-name">平台名称</label>
          <input id="pf-name" name="name" required placeholder="如：简单心理" />
        </div>
        <div class="form-group">
          <label for="pf-period">时间段</label>
          <input id="pf-period" name="period" required placeholder="如：2025.01–2025.06" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" data-action="cancel">取消</button>
          <button type="submit" class="btn-submit">确认添加</button>
        </div>
      </form>
    </div>
  `,
    (overlay) => {
      overlay.querySelector('[data-action="cancel"]').onclick = closeModal;
      overlay.querySelector("#form-platform").onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = fd.get("name").trim();
        const period = fd.get("period").trim();
        if (!name || !period) return;
        const platform = addPlatform({ name, period });
        closeModal();
        navigate(platform.id);
      };
    }
  );
}

function showArticleModal(platformId, article = null) {
  const isEdit = !!article;
  openModal(
    `
    <div class="modal" onclick="event.stopPropagation()">
      <h2>${isEdit ? "编辑稿件" : "添加稿件"}</h2>
      <form id="form-article">
        <div class="form-group">
          <label for="ar-title">稿件标题</label>
          <input id="ar-title" name="title" required value="${article ? escapeHtml(article.title) : ""}" />
        </div>
        <div class="form-group">
          <label for="ar-date">发布日期</label>
          <input id="ar-date" name="publishDate" type="date" required value="${article?.publishDate ?? ""}" />
        </div>
        <div class="form-group">
          <label for="ar-reads">阅读量</label>
          <input id="ar-reads" name="reads" type="number" min="0" required value="${article?.reads ?? ""}" />
        </div>
        <div class="form-group">
          <label for="ar-engagement">转评赞</label>
          <input id="ar-engagement" name="engagement" type="number" min="0" required value="${article?.engagement ?? 0}" />
        </div>
        <div class="form-group">
          <label for="ar-type">类型</label>
          <select id="ar-type" name="type" required>
            ${ARTICLE_TYPES.map(
              (t) =>
                `<option value="${escapeHtml(t)}" ${article?.type === t ? "selected" : ""}>${escapeHtml(t)}</option>`
            ).join("")}
          </select>
        </div>
        <div class="form-group">
          <label for="ar-url">原文链接 <span class="label-hint">选填</span></label>
          <input id="ar-url" name="url" type="url" placeholder="https://…" value="${article?.url ? escapeHtml(article.url) : ""}" />
        </div>
        <div class="form-group">
          <label for="ar-summary">内容简介 <span class="label-hint">选填</span></label>
          <textarea id="ar-summary" name="summary" rows="3" placeholder="一两句话介绍这篇写了什么、选题角度…">${article?.summary ? escapeHtml(article.summary) : ""}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" data-action="cancel">取消</button>
          <button type="submit" class="btn-submit">${isEdit ? "保存" : "确认添加"}</button>
        </div>
      </form>
    </div>
  `,
    (overlay) => {
      overlay.querySelector('[data-action="cancel"]').onclick = closeModal;
      overlay.querySelector("#form-article").onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          title: fd.get("title").trim(),
          publishDate: fd.get("publishDate"),
          reads: fd.get("reads"),
          engagement: fd.get("engagement"),
          type: fd.get("type"),
          url: normalizeUrl(fd.get("url")),
          summary: fd.get("summary").trim(),
        };
        if (isEdit) {
          updateArticle(article.id, payload);
        } else {
          addArticle(platformId, payload);
        }
        closeModal();
        render();
      };
    }
  );
}

function renderStatsCards(stats, labels) {
  return `
    <div class="stats-row">
      <div class="stat-card">
        <div class="label">${labels.count}</div>
        <div class="value">${formatNumber(stats.count)}</div>
      </div>
      <div class="stat-card">
        <div class="label">${labels.maxReads}</div>
        <div class="value accent">${formatNumber(stats.maxReads)}</div>
      </div>
      <div class="stat-card">
        <div class="label">${labels.avgReads}</div>
        <div class="value">${formatNumber(stats.avgReads)}</div>
      </div>
    </div>
  `;
}

function renderHome() {
  const platforms = getPlatforms();
  const allArticles = getAllArticles();
  const globalStats = computeStats(allArticles);

  const platformCards =
    platforms.length === 0
      ? `<p class="empty-state">暂无平台，点击右上角添加新平台</p>`
      : platforms
          .map((p) => {
            const articles = getArticles(p.id);
            const stats = computeStats(articles);
            return `
            <div class="platform-card" role="link" tabindex="0" data-platform-id="${escapeHtml(p.id)}">
              <div class="name">${escapeHtml(p.name)}</div>
              <div class="period">${escapeHtml(p.period)}</div>
              <div class="meta">
                <span class="meta-item">
                  <span class="meta-label">稿件数</span>
                  <span class="meta-value">${stats.count} 篇</span>
                </span>
                <span class="meta-item">
                  <span class="meta-label">平均阅读量</span>
                  <span class="meta-value">${formatNumber(stats.avgReads)}</span>
                </span>
              </div>
            </div>
          `;
          })
          .join("");

  app.innerHTML = `
    <div class="top-bar">
      <div class="top-actions">
        <button type="button" class="btn-export" id="btn-export">↓ 导出 portfolio.json</button>
        <button type="button" class="btn-primary" id="btn-add-platform">添加新平台</button>
      </div>
    </div>
    <header class="page-header">
      <h1>仓晓璇</h1>
      <p class="subtitle">内容作品全览</p>
    </header>
    ${renderStatsCards(globalStats, {
      count: "全平台总篇数",
      maxReads: "最高单篇阅读量",
      avgReads: "全平台平均阅读量",
    })}
    <h2 class="section-title">创作平台</h2>
    <div class="platform-grid">${platformCards}</div>
  `;

  const runExport = () => {
    const ver = downloadPortfolioExport();
    alert(
      `已下载 portfolio.json（版本号 ${ver}）\n\n` +
        `下一步：\n` +
        `1. 打开 GitHub 仓库\n` +
        `2. 编辑 data/portfolio.json\n` +
        `3. 全选删除旧内容，粘贴刚下载的文件\n` +
        `4. Commit 保存，等几分钟刷新线上链接`
    );
  };

  document.getElementById("btn-add-platform").onclick = showAddPlatformModal;
  document.getElementById("btn-export").onclick = runExport;
  app.querySelectorAll("[data-platform-id]").forEach((el) => {
    const go = () => navigate(el.dataset.platformId);
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
  });
}

function destroyCharts() {
  if (lineChart) {
    lineChart.destroy();
    lineChart = null;
  }
  if (barChart) {
    barChart.destroy();
    barChart = null;
  }
}

function renderCharts(articles) {
  const sorted = [...articles].sort(
    (a, b) => new Date(a.publishDate) - new Date(b.publishDate)
  );

  const lineCtx = document.getElementById("chart-line");
  const barCtx = document.getElementById("chart-bar");

  if (!lineCtx) return;

  destroyCharts();

  const accent = "#3d5c4a";
  const accentMuted = "rgba(61, 92, 74, 0.15)";
  const gridColor = "#e8e8e8";
  const fontFamily = '"SimSun", "Songti SC", serif';

  lineChart = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: sorted.map((a) => a.publishDate),
      datasets: [
        {
          label: "阅读量",
          data: sorted.map((a) => a.reads),
          borderColor: accent,
          backgroundColor: accentMuted,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: accent,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          title: { display: true, text: "发布日期", font: { family: fontFamily, size: 12 } },
          grid: { color: gridColor },
          ticks: { font: { family: fontFamily, size: 11 }, maxRotation: 45 },
        },
        y: {
          title: { display: true, text: "阅读量", font: { family: fontFamily, size: 12 } },
          grid: { color: gridColor },
          ticks: { font: { family: fontFamily, size: 11 } },
        },
      },
    },
  });

  const typeStats = getArticleTypeAverages(articles);
  if (!barCtx || !typeStats.length) return;

  const barLabels = typeStats.map((s) => s.type);
  const barValues = typeStats.map((s) => s.avgReads);
  const barColors = barLabels.map((_, i) => {
    const opacity = 0.85 - (i / Math.max(barLabels.length - 1, 1)) * 0.5;
    return `rgba(61, 92, 74, ${opacity})`;
  });

  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: [
        {
          label: "平均阅读量",
          data: barValues,
          backgroundColor: barColors,
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => barLabels[items[0].dataIndex],
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: fontFamily, size: 10 }, maxRotation: 45, autoSkip: false },
        },
        y: {
          title: { display: true, text: "平均阅读量", font: { family: fontFamily, size: 12 } },
          grid: { color: gridColor },
          ticks: { font: { family: fontFamily, size: 11 } },
        },
      },
    },
  });
}

function renderPlatform(id) {
  const platform = getPlatform(id);
  if (!platform) {
    app.innerHTML = `
      <div class="top-bar with-back">
        <div class="top-bar-left">
          <button type="button" class="btn-back" id="btn-back">← 返回首页</button>
        </div>
      </div>
      <p class="empty-state">未找到该平台</p>
    `;
    document.getElementById("btn-back").onclick = () => navigate("/");
    return;
  }

  const articles = getArticles(id);
  const stats = computeStats(articles);
  const typeStats = getArticleTypeAverages(articles);

  const listHtml =
    articles.length === 0
      ? `<p class="empty-state">暂无稿件，点击右上角添加稿件</p>`
      : `<ul class="article-list">${articles
          .sort((a, b) => b.reads - a.reads)
          .map(
            (a) => `
          <li class="article-item" data-id="${a.id}">
            <div class="article-info">
              ${renderArticleTitle(a)}
              <div class="details">
                <span>${a.publishDate}</span>
                <span>阅读量 ${formatNumber(a.reads)}</span>
                <span>转评赞 ${formatNumber(a.engagement ?? 0)}</span>
                <span class="type-tag">${escapeHtml(a.type)}</span>
              </div>
              ${a.summary ? `<p class="article-summary">${escapeHtml(a.summary)}</p>` : ""}
            </div>
            <div class="article-actions">
              <button type="button" class="btn-ghost" data-edit="${a.id}">编辑</button>
              <button type="button" class="btn-ghost danger" data-delete="${a.id}">删除</button>
            </div>
          </li>
        `
          )
          .join("")}</ul>`;

  app.innerHTML = `
    <div class="top-bar with-back">
      <div class="top-bar-left">
        <button type="button" class="btn-back" id="btn-back">← 返回首页</button>
      </div>
      <div class="top-bar-right">
        <button type="button" class="btn-primary" id="btn-add-article">添加稿件</button>
      </div>
    </div>
    <header class="page-header platform-header">
      <h1>${escapeHtml(platform.name)}</h1>
      <p class="period">${escapeHtml(platform.period)}</p>
    </header>
    ${renderStatsCards(stats, {
      count: "该平台总篇数",
      maxReads: "最高阅读量",
      avgReads: "平均阅读量",
    })}
    <section class="charts-section">
      <div class="chart-block">
        <h3>阅读量趋势</h3>
        <div class="chart-wrap"><canvas id="chart-line"></canvas></div>
      </div>
      <div class="chart-block">
        <h3>稿件类型平均阅读量对比</h3>
        ${
          typeStats.length
            ? `<div class="chart-wrap chart-wrap--bar"><canvas id="chart-bar"></canvas></div>`
            : `<p class="chart-empty">暂无稿件类型数据</p>`
        }
      </div>
    </section>
    <h2 class="section-title">稿件列表</h2>
    ${listHtml}
  `;

  document.getElementById("btn-back").onclick = () => navigate("/");
  document.getElementById("btn-add-article").onclick = () => showArticleModal(id);

  app.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => {
      const article = articles.find((a) => a.id === btn.dataset.edit);
      if (article) showArticleModal(id, article);
    };
  });

  app.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.onclick = () => {
      if (confirm("确定删除这条稿件吗？")) {
        deleteArticle(btn.dataset.delete);
        render();
      }
    };
  });

  requestAnimationFrame(() => renderCharts(articles));
}

function render() {
  destroyCharts();
  const route = getRoute();
  if (route.page === "platform") {
    renderPlatform(route.id);
  } else {
    renderHome();
  }
}

window.addEventListener("hashchange", render);
window.addEventListener("popstate", render);

async function start() {
  if (!app) return;
  try {
    app.innerHTML = `<p class="empty-state">加载中…</p>`;
    await initStore();
    if (!location.hash) location.hash = "#/";
    render();
  } catch (err) {
    console.error(err);
    app.innerHTML = `
      <div class="empty-state" style="padding:48px 24px">
        <p>页面加载失败</p>
        <p style="margin-top:12px;font-size:0.9rem">${escapeHtml(String(err.message || err))}</p>
        <p style="margin-top:16px;font-size:0.85rem">请确认已用本地服务打开（见项目里的「启动本地网站.command」），不要双击 index.html。</p>
        <button type="button" class="btn-primary" style="margin-top:20px" onclick="location.reload()">重新加载</button>
      </div>
    `;
  }
}

start();
