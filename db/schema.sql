-- ============================================
-- Samakal News — D1 Database Schema
-- ============================================

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,           -- বাংলাদেশ, রাজনীতি, খেলা…
  slug       TEXT UNIQUE NOT NULL,    -- bangladesh, politics, sports…
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Authors / Users
CREATE TABLE IF NOT EXISTS authors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE,
  bio           TEXT,
  avatar        TEXT,                 -- R2 key
  role          TEXT DEFAULT 'reporter', -- reporter | editor | admin
  password_hash TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Articles
CREATE TABLE IF NOT EXISTS articles (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  excerpt        TEXT,
  content        TEXT NOT NULL,
  featured_image TEXT,               -- R2 key
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  author_id      INTEGER REFERENCES authors(id) ON DELETE SET NULL,
  status         TEXT DEFAULT 'draft', -- draft | review | published | archived
  is_featured    INTEGER DEFAULT 0,   -- 1 = show in hero
  is_breaking    INTEGER DEFAULT 0,   -- 1 = show in ticker
  view_count     INTEGER DEFAULT 0,
  published_at   DATETIME,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

-- Article ↔ Tags pivot
CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_articles_status      ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category    ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_published   ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_featured    ON articles(is_featured);
CREATE INDEX IF NOT EXISTS idx_articles_breaking    ON articles(is_breaking);
CREATE INDEX IF NOT EXISTS idx_articles_slug        ON articles(slug);

-- ── Seed: Categories ──
INSERT OR IGNORE INTO categories (name, slug, sort_order) VALUES
  ('সর্বশেষ',    'latest',        1),
  ('বাংলাদেশ',   'bangladesh',    2),
  ('রাজনীতি',    'politics',      3),
  ('অর্থনীতি',   'economy',       4),
  ('বিশ্ব',      'world',         5),
  ('খেলা',       'sports',        6),
  ('বিনোদন',    'entertainment',  7),
  ('সারাদেশ',    'nationwide',    8),
  ('অপরাধ',     'crime',         9),
  ('মতামত',     'opinion',       10),
  ('রাজধানী',    'capital',       11),
  ('লাইফস্টাইল', 'lifestyle',     12),
  ('শৈলী',      'style',         13),
  ('ভিডিও',     'video',         14);

-- ── Seed: Admin author ──
INSERT OR IGNORE INTO authors (name, slug, email, role, password_hash) VALUES
  ('সম্পাদনা পর্ষদ', 'editorial-board', 'editor@samakal.com', 'admin', 'CHANGE_ME_HASH');

-- ── Seed: Sample articles ──
INSERT OR IGNORE INTO articles (title, slug, excerpt, content, category_id, author_id, status, is_featured, is_breaking, published_at) VALUES
  ('ইসরায়েলে জয়-পরাজয় দেখছে ইউক্রেনিয়ারা, যুদ্ধের ভবিষ্যৎ নিয়ে নতুন আশঙ্কা',
   'israel-ukraine-war-2026',
   'ইসরায়েলের বর্তমান ও সাবেক গোয়েন্দা সূত্রগুলো বলছে, অভিযানের সাফল্য এখন নির্ভর করছে ব্যাপক সমুদ্র সীমান্তের ভবিষ্যতের ওপর।',
   '<p>ইসরায়েলের বর্তমান ও সাবেক গোয়েন্দা সূত্রগুলো বলছে, অভিযানের সাফল্য এখন নির্ভর করছে ব্যাপক সমুদ্র সীমান্তের ভবিষ্যতের ওপর।</p><p>আন্তর্জাতিক বিশ্লেষকরা মনে করছেন, এই সংঘাতের দীর্ঘমেয়াদী প্রভাব পড়বে পুরো মধ্যপ্রাচ্যে।</p>',
   5, 1, 'published', 1, 0, CURRENT_TIMESTAMP),
  ('নতুন রাজনৈতিক মোর্চা গঠন নিয়ে আলোচনা তুঙ্গে, বৈঠকে নেতারা',
   'new-political-alliance-2026',
   'সংসদ নির্বাচনকে সামনে রেখে বিভিন্ন দলের নেতারা একটি বৃহত্তর জোট গঠনের বিষয়ে আলোচনা করেছেন।',
   '<p>সংসদ নির্বাচনকে সামনে রেখে বিভিন্ন দলের নেতারা একটি বৃহত্তর জোট গঠনের বিষয়ে আলোচনা করেছেন। আগামী সপ্তাহের মধ্যে আনুষ্ঠানিক ঘোষণা আসতে পারে বলে সূত্র জানিয়েছে।</p>',
   3, 1, 'published', 0, 0, CURRENT_TIMESTAMP);
