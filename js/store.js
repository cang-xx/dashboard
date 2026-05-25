const STORAGE_KEY = "content-dashboard-data";

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

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateData(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  const preset = getPresetData();
  saveRaw(preset);
  return preset;
}

function saveRaw(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let cache = null;

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
