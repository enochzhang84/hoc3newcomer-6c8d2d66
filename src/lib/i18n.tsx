import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

const STORAGE_KEY = "hoc3.lang";

// 统一的翻译字典 — 新增文案在此添加 key 即可
export const translations = {
  // 后台标题
  appTitle: { zh: "基督三家 事工中心", en: "HOC3 Ministry Center" },
  appSubtitle: { zh: "HOC3 Ministry Center", en: "基督三家 事工中心" },

  // 顶部按钮
  contacts: { zh: "通讯录", en: "Contacts" },
  hoc3Home: { zh: "基督三家主页", en: "HOC3 Home" },
  manualEntry: { zh: "手动录入", en: "Manual Entry" },
  logout: { zh: "退出", en: "Sign out" },
  readOnly: { zh: "只读模式", en: "Read-only" },
  workerLabel: { zh: "同工", en: "Worker" },
  viewerLabel: { zh: "访客", en: "Viewer" },

  // 模块 / Tab
  modReports: { zh: "数据统计", en: "Reports" },
  modWelcome: { zh: "迎宾接待", en: "Welcome Ministry" },
  modMedia: { zh: "影音投影", en: "Media Ministry" },
  modKitchen: { zh: "厨房事工", en: "Kitchen Ministry" },
  modSundaySchool: { zh: "主日学", en: "Sunday School" },
  modEvents: { zh: "活动", en: "Events" },
  modNewcomer: { zh: "新人登记", en: "Newcomer Registration" },
  modRetreat: { zh: "退修会", en: "Retreat" },
  modTvDisplay: { zh: "TV 数字标牌", en: "TV Display" },
  modChat: { zh: "同工聊天", en: "Team Chat" },
  modUsers: { zh: "用户管理", en: "User Management" },

  // 语言切换
  langZh: { zh: "中文", en: "中文" },
  langEn: { zh: "English", en: "English" },
} as const satisfies Record<string, Record<Lang, string>>;

export type TKey = keyof typeof translations;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "zh" || saved === "en") setLangState(saved);
    } catch {/* ignore */}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {/* ignore */}
  };

  const t = (k: TKey) => translations[k][lang] ?? translations[k].zh;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // 兜底：未挂载 Provider 时仍然可用（默认中文）
    return {
      lang: "zh",
      setLang: () => {},
      t: (k: TKey) => translations[k].zh,
    };
  }
  return ctx;
}