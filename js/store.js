const STORAGE_KEY = "content-dashboard-data";
const SEED_VERSION_KEY = "content-dashboard-seed-version";
const SEED_URL = "data/portfolio.json";

export const ARTICLE_TYPES = [
  "科普文",
  "采访稿",
  "编辑稿",
  "同人文/小说",
  "影评/书评",
  "随笔/杂文",
];

const LEGACY_TYPE_MAP = {
  "独立撰写-科普文": "科普文",
  "独立撰写-采访稿": "采访稿",
  "负责编辑选题的栏目": "编辑稿",
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getPresetData() {
  const platformId = "preset-jiandanxinli";
  return {
    platforms: [
      {
        id: platformId,
        name: "简单心理",
        period: "2025.01–2025.06",
      },
    ],
    articles: [
      {
        id: "a1",
        platformId,
        title: "作品一",
        publishDate: "2025-01-12",
        reads: 20000,
        engagement: 1280,
        type: "科普文",
        url: "",
        summary: "从日常焦虑切入，梳理认知行为疗法中「灾难化思维」的识别与自助练习。",
      },
      {
        id: "a2",
        platformId,
        title: "作品二",
        publishDate: "2025-02-18",
        reads: 45000,
        engagement: 3560,
        type: "采访稿",
        url: "",
        summary: "专访青年心理咨询师，讨论「高功能抑郁」在职场人群中的隐蔽表现。",
      },
      {
        id: "a3",
        platformId,
        title: "作品三",
        publishDate: "2025-03-25",
        reads: 62000,
        engagement: 4820,
        type: "编辑稿",
        url: "",
        summary: "策划「情绪劳动」专题栏目，统筹三位作者稿件并撰写栏目导语。",
      },
      {
        id: "a4",
        platformId,
        title: "作品四",
        publishDate: "2025-04-08",
        reads: 31000,
        engagement: 1890,
        type: "影评/书评",
        url: "",
        summary: "",
      },
      {
        id: "a5",
        platformId,
        title: "作品五",
        publishDate: "2025-05-20",
        reads: 28000,
        engagement: 2150,
        type: "随笔/杂文",
        url: "",
        summary: "",
      },
    ],
  };
}

function migrateData(data) {
  let changed = false;
  for (const article of data.articles) {
    const mapped = LEGACY_TYPE_MAP[article.type];
    if (mapped) {
      article.type = mapped;
      changed = true;
    }
    if (article.url === undefined) {
      article.url = "";
      changed = true;
    }
    if (article.summary === undefined) {
      article.summary = "";
      changed = true;
    }
    if (article.engagement === undefined) {
      article.engagement = 0;
      changed = true;
    }
  }
  if (changed) saveRaw(data);
  return data;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateData(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return null;
}

function loadRaw() {
  const stored = loadFromStorage();
  if (stored) return stored;
  const preset = getPresetData();
  saveRaw(preset);
  return preset;
}

function saveRaw(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let cache = null;

/** 启动时从 data/portfolio.json 同步数据（GitHub 上改这个文件即可更新线上内容） */
export async function initStore() {
  let seed = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(SEED_URL, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) seed = await res.json();
  } catch {
    /* 本地未启动服务、file:// 打开、或 portfolio.json 不存在时走下方兜底 */
  }

  const remoteVersion = seed?.version != null ? String(seed.version) : null;
  const storedVersion = localStorage.getItem(SEED_VERSION_KEY);
  const hasLocal = !!localStorage.getItem(STORAGE_KEY);

  if (seed?.data && remoteVersion && remoteVersion !== storedVersion) {
    cache = migrateData(seed.data);
    saveRaw(cache);
    localStorage.setItem(SEED_VERSION_KEY, remoteVersion);
    return cache;
  }

  if (!hasLocal) {
    if (seed?.data) {
      cache = migrateData(seed.data);
      saveRaw(cache);
      if (remoteVersion) localStorage.setItem(SEED_VERSION_KEY, remoteVersion);
      return cache;
    }
    cache = loadRaw();
    return cache;
  }

  cache = loadFromStorage() ?? loadRaw();
  return cache;
}

export function getData() {
  if (!cache) cache = loadRaw();
  return cache;
}

export function persist() {
  saveRaw(cache);
}

export function getPlatforms() {
  return getData().platforms;
}

export function getPlatform(id) {
  return getPlatforms().find((p) => p.id === id) ?? null;
}

export function getArticles(platformId) {
  return getData().articles.filter((a) => a.platformId === platformId);
}

export function getAllArticles() {
  return getData().articles;
}

export function addPlatform({ name, period }) {
  const platform = { id: generateId(), name, period };
  getData().platforms.push(platform);
  persist();
  return platform;
}

export function addArticle(
  platformId,
  { title, publishDate, reads, engagement = 0, type, url = "", summary = "" }
) {
  const article = {
    id: generateId(),
    platformId,
    title,
    publishDate,
    reads: Number(reads),
    engagement: Number(engagement) || 0,
    type,
    url: (url || "").trim(),
    summary: (summary || "").trim(),
  };
  getData().articles.push(article);
  persist();
  return article;
}

export function updateArticle(articleId, fields) {
  const article = getData().articles.find((a) => a.id === articleId);
  if (!article) return null;
  const next = { ...fields };
  if (next.reads !== undefined) next.reads = Number(next.reads);
  if (next.engagement !== undefined) next.engagement = Number(next.engagement) || 0;
  if (next.url !== undefined) next.url = (next.url || "").trim();
  if (next.summary !== undefined) next.summary = (next.summary || "").trim();
  Object.assign(article, next);
  persist();
  return article;
}

export function getArticleTypeAverages(articles) {
  return ARTICLE_TYPES.filter((type) => articles.some((a) => a.type === type)).map((type) => {
    const ofType = articles.filter((a) => a.type === type);
    const sum = ofType.reduce((s, a) => s + a.reads, 0);
    return {
      type,
      avgReads: Math.round(sum / ofType.length),
    };
  });
}

export function deleteArticle(articleId) {
  const data = getData();
  const idx = data.articles.findIndex((a) => a.id === articleId);
  if (idx === -1) return false;
  data.articles.splice(idx, 1);
  persist();
  return true;
}

export function computeStats(articles) {
  if (!articles.length) {
    return { count: 0, maxReads: 0, avgReads: 0 };
  }
  const reads = articles.map((a) => a.reads);
  const sum = reads.reduce((s, r) => s + r, 0);
  return {
    count: articles.length,
    maxReads: Math.max(...reads),
    avgReads: Math.round(sum / articles.length),
  };
}

export function formatNumber(n) {
  return n.toLocaleString("zh-CN");
}

/** 把当前浏览器里录入的作品，导出成可上传 GitHub 的 portfolio.json */
export function buildPortfolioExport() {
  const data = getData();
  const stored = localStorage.getItem(SEED_VERSION_KEY);
  const num = parseInt(stored || "1", 10);
  const version = String(Number.isFinite(num) ? num + 1 : 2);
  return {
    version,
    data: {
      platforms: data.platforms.map(({ id, name, period }) => ({ id, name, period })),
      articles: data.articles.map(
        ({ id, platformId, title, publishDate, reads, engagement, type, url, summary }) => ({
          id,
          platformId,
          title,
          publishDate,
          reads,
          engagement: engagement ?? 0,
          type,
          url: url ?? "",
          summary: summary ?? "",
        })
      ),
    },
  };
}

export function downloadPortfolioExport() {
  const payload = buildPortfolioExport();
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "portfolio.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  return payload.version;
}
