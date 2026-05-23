"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  CoinRankingItem,
  fetchCoinRanking,
  fetchNewsRanking,
  fetchRiskOverview,
  NewsRankingItem,
  RiskOverview,
  RiskReport,
  sendChatMessage,
} from "@/lib/api";

type ActiveView = "home" | "chat" | "news" | "coin" | "reports" | "settings";
type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type NavItem = {
  key: ActiveView;
  label: string;
  icon: ReactNode;
};

const examplePrompts = [
  "某交易所宣布暂停所有提现，官方称钱包系统维护，但社群出现大量无法提款反馈，请评估风险。",
  "SOL 链上大额转账数量激增，多个巨鲸地址向交易所转入 SOL，社交媒体负面讨论快速上升。",
  "某 DeFi 协议疑似遭遇 flash loan attack，攻击者从资金池转出约 1200 万美元资产。",
  "USDT 在多个交易对出现短时脱锚，链上兑换量异常放大，市场担心储备透明度。",
];

const workflowSteps = [
  "input_agent",
  "risk_detect_agent",
  "classify_agent",
  "evidence_agent",
  "score_agent",
  "impact_agent",
  "advice_agent",
  "report_agent",
];

const forbiddenAdviceTerms = ["买入", "卖出", "做空", "梭哈"];

const fallbackNews: NewsRankingItem[] = [
  {
    rank: 1,
    news_id: "demo-1",
    title: "某交易所暂停所有提现，系统维护中",
    content: "交易所公告称钱包系统维护，多个用户反馈长时间无法提现。",
    risk_score: 96,
    risk_level: "高风险",
    risk_type: "交易所风险",
    published_at: "10:28",
    coins: ["--"],
    summary: "提现暂停叠加用户投诉，需关注资产流动性与运营稳定性。",
    evidence: "官方暂停提现公告、社群投诉增加、恢复时间不明确。",
  },
  {
    rank: 2,
    news_id: "demo-2",
    title: "稳定币短时脱锚，USDT 跌至 0.92",
    content: "多个交易对出现异常价差，链上兑换量升高。",
    risk_score: 92,
    risk_level: "高风险",
    risk_type: "稳定币风险",
    published_at: "10:15",
    coins: ["USDT"],
    summary: "价格偏离锚定区间，可能引发赎回压力与流动性风险。",
    evidence: "价格脱锚、兑换量异常、市场担忧储备透明度。",
  },
  {
    rank: 3,
    news_id: "demo-3",
    title: "知名项目 Rug Pull，团队疑似跑路",
    content: "项目社媒停止更新，合约资金被快速转移。",
    risk_score: 89,
    risk_level: "高风险",
    risk_type: "项目风险",
    published_at: "09:57",
    coins: ["XYZ"],
    summary: "团队失联与资金转移同时出现，投资者保护风险较高。",
    evidence: "资金外流、社群无法联系团队、公告缺失。",
  },
];

const fallbackCoins: CoinRankingItem[] = [
  {
    rank: 1,
    symbol: "SOL",
    name: "Solana",
    final_score: 92,
    risk_level: "高风险",
    news_count: 186,
    main_risk_type: "交易活跃异常 / 市场波动风险",
    top_news_title: "SOL 链上大额转账数量激增",
    summary: "链上转账与交易所流入同时升高，短期波动风险上升。",
    related_news: [],
  },
  {
    rank: 2,
    symbol: "FTT",
    name: "FTX Token",
    final_score: 88,
    risk_level: "高风险",
    news_count: 142,
    main_risk_type: "流动性风险",
    top_news_title: "FTT 相关地址出现异常转移",
    summary: "相关风险事件集中出现，需观察流动性变化。",
    related_news: [],
  },
  {
    rank: 3,
    symbol: "LUNC",
    name: "Terra Classic",
    final_score: 76,
    risk_level: "中风险",
    news_count: 128,
    main_risk_type: "社群风险",
    top_news_title: "LUNC 社群治理争议升温",
    summary: "舆情升温但直接资产风险仍需更多证据确认。",
    related_news: [],
  },
];

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>("home");
  const [overview, setOverview] = useState<RiskOverview | null>(null);
  const [newsRanking, setNewsRanking] = useState<NewsRankingItem[]>([]);
  const [coinRanking, setCoinRanking] = useState<CoinRankingItem[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState("");

  const [message, setMessage] = useState(examplePrompts[0]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "你好，我是 CryptoRisk Agent。输入新闻、公告、链上事件或交易所异常，我会输出风险评分、证据摘要、影响分析和处置建议。",
    },
  ]);
  const [latestReport, setLatestReport] = useState<RiskReport | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadRankings() {
      setRankingLoading(true);
      setRankingError("");
      try {
        const [overviewData, newsData, coinData] = await Promise.all([
          fetchRiskOverview(),
          fetchNewsRanking(10),
          fetchCoinRanking(10),
        ]);
        if (ignore) return;
        setOverview(overviewData);
        setNewsRanking(newsData.items);
        setCoinRanking(coinData.items);
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setRankingError("排行数据暂未连接，当前展示本地演示数据。请确认 FastAPI 后端已启动。");
          setNewsRanking(fallbackNews);
          setCoinRanking(fallbackCoins);
        }
      } finally {
        if (!ignore) setRankingLoading(false);
      }
    }

    loadRankings();
    return () => {
      ignore = true;
    };
  }, []);

  const displayNews = newsRanking.length ? newsRanking : fallbackNews;
  const displayCoins = coinRanking.length ? coinRanking : fallbackCoins;

  const pageMeta = getPageMeta(activeView);

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setChatMessages((items) => [
      ...items,
      { id: `user-${Date.now()}`, role: "user", content: trimmed },
    ]);
    setChatLoading(true);
    setChatError("");
    setMessage("");

    try {
      const response = await sendChatMessage(trimmed);
      setLatestReport(response.data);
      setChatMessages((items) => [
        ...items,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.data.summary,
        },
      ]);
    } catch (error) {
      console.error(error);
      setChatError("请求后端失败，请检查 FastAPI 服务或后端日志。");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar activeView={activeView} onChangeView={setActiveView} />

        <div className="min-w-0 flex-1 lg:pl-[248px]">
          <TopBar title={pageMeta.title} subtitle={pageMeta.subtitle} />
          <MobileNav activeView={activeView} onChangeView={setActiveView} />

          <div className="grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_336px] 2xl:px-8">
            <div className="min-w-0 space-y-4">
              {rankingError && <Notice tone="amber" text={rankingError} />}

              <MetricGrid
                activeView={activeView}
                loading={rankingLoading}
                overview={overview}
                topCoin={displayCoins[0]}
                topNews={displayNews[0]}
              />

              {activeView === "home" && (
                <DashboardHome
                  coinItems={displayCoins}
                  latestReport={latestReport}
                  newsItems={displayNews}
                  onChangeView={setActiveView}
                  onMessageChange={setMessage}
                  onSubmit={handleChatSubmit}
                  message={message}
                  chatLoading={chatLoading}
                />
              )}

              {activeView === "chat" && (
                <ChatView
                  chatError={chatError}
                  chatLoading={chatLoading}
                  chatMessages={chatMessages}
                  latestReport={latestReport}
                  message={message}
                  onExampleClick={setMessage}
                  onMessageChange={setMessage}
                  onSubmit={handleChatSubmit}
                />
              )}

              {activeView === "news" && <NewsView items={displayNews} />}
              {activeView === "coin" && <CoinView items={displayCoins} />}
              {activeView === "reports" && (
                <ReportsView latestReport={latestReport} newsItems={displayNews} coinItems={displayCoins} />
              )}
              {activeView === "settings" && <SettingsView />}
            </div>

            <AssistantPanel
              activeView={activeView}
              chatLoading={chatLoading}
              latestReport={latestReport}
              topCoin={displayCoins[0]}
              topNews={displayNews[0]}
              onAsk={(text) => {
                setActiveView("chat");
                setMessage(text);
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function Sidebar({
  activeView,
  onChangeView,
}: {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
}) {
  const navItems: NavItem[] = [
    { key: "home", label: "首页总览", icon: <HomeIcon /> },
    { key: "chat", label: "风险对话分析", icon: <ChatIcon /> },
    { key: "news", label: "新闻风险榜", icon: <ChartIcon /> },
    { key: "coin", label: "币种风险榜", icon: <CoinIcon /> },
    { key: "reports", label: "分析报告", icon: <FileIcon /> },
    { key: "settings", label: "系统设置", icon: <GearIcon /> },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-blue-100 bg-white lg:flex lg:flex-col">
      <div className="flex h-[92px] items-center gap-3 border-b border-blue-100 px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
          <ShieldIcon />
        </div>
        <div>
          <p className="text-xl font-bold leading-6 text-blue-600">CryptoRisk</p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agent</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChangeView(item.key)}
            className={`flex h-12 w-full items-center gap-3 rounded-lg px-4 text-sm font-semibold transition ${
              activeView === item.key
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-blue-700"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-md ${
                activeView === item.key ? "bg-blue-600 text-white" : "text-slate-500"
              }`}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mx-4 mb-6 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          系统状态
        </div>
        <p className="mt-2 text-xl font-bold text-emerald-600">运行中</p>
        <p className="mt-1 text-xs text-slate-500">所有 Agent 正常运行</p>
      </div>

      <div className="px-6 pb-6 text-xs leading-6 text-slate-400">
        <p>© 2026 CryptoRisk Agent</p>
        <p>v1.0.0</p>
      </div>
    </aside>
  );
}

function TopBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/90 backdrop-blur">
      <div className="flex min-h-[92px] items-center gap-4 px-4 sm:px-6 2xl:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tracking-tight text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <label className="hidden h-12 w-full max-w-xl items-center gap-3 rounded-lg border border-blue-100 bg-slate-50 px-4 text-sm text-slate-500 shadow-inner lg:flex">
          <SearchIcon />
          <input
            className="w-full bg-transparent outline-none placeholder:text-slate-400"
            placeholder="搜索新闻、币种、事件..."
          />
        </label>

        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-blue-100 bg-white text-slate-600 shadow-sm"
          aria-label="通知"
        >
          <BellIcon />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            3
          </span>
        </button>
      </div>
    </header>
  );
}

function MobileNav({
  activeView,
  onChangeView,
}: {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
}) {
  const items: Array<[ActiveView, string]> = [
    ["home", "总览"],
    ["chat", "对话"],
    ["news", "新闻榜"],
    ["coin", "币种榜"],
    ["reports", "报告"],
    ["settings", "设置"],
  ];

  return (
    <nav className="sticky top-[92px] z-10 flex gap-2 overflow-x-auto border-b border-blue-100 bg-white px-4 py-3 lg:hidden">
      {items.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChangeView(key)}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
            activeView === key
              ? "bg-blue-600 text-white"
              : "border border-blue-100 bg-white text-slate-600"
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function MetricGrid({
  activeView,
  loading,
  overview,
  topCoin,
  topNews,
}: {
  activeView: ActiveView;
  loading: boolean;
  overview: RiskOverview | null;
  topCoin: CoinRankingItem;
  topNews: NewsRankingItem;
}) {
  const metrics = getMetrics(activeView, overview, topNews, topCoin, loading);

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta: string;
  tone: "blue" | "red" | "orange" | "green" | "purple";
}) {
  const toneStyle = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-violet-50 text-violet-600",
  }[tone];

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full ${toneStyle}`}>{icon}</div>
        <Sparkline tone={tone} />
      </div>
      <div className="mt-3">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className={`mt-1 text-3xl font-bold ${toneStyle.split(" ")[1]}`}>{value}</p>
        <p className="mt-2 text-xs text-slate-500">较昨日 <span className="font-semibold text-emerald-600">{delta}</span></p>
      </div>
    </article>
  );
}

function DashboardHome({
  chatLoading,
  coinItems,
  latestReport,
  message,
  newsItems,
  onChangeView,
  onMessageChange,
  onSubmit,
}: {
  chatLoading: boolean;
  coinItems: CoinRankingItem[];
  latestReport: RiskReport | null;
  message: string;
  newsItems: NewsRankingItem[];
  onChangeView: (view: ActiveView) => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <AnalysisInputCard
          chatLoading={chatLoading}
          message={message}
          onMessageChange={onMessageChange}
          onSubmit={onSubmit}
        />
        <RankingCard title="新闻风险排行榜 Top 10" action="查看全部" onAction={() => onChangeView("news")}>
          <NewsTable items={newsItems.slice(0, 10)} compact />
        </RankingCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <ResultCard report={latestReport} topNews={newsItems[0]} />
        <RankingCard title="币种风险排行榜 Top 10" action="查看全部" onAction={() => onChangeView("coin")}>
          <CoinTable items={coinItems.slice(0, 10)} compact />
        </RankingCard>
      </div>
    </>
  );
}

function AnalysisInputCard({
  chatLoading,
  message,
  onMessageChange,
  onSubmit,
}: {
  chatLoading: boolean;
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-100/60">
      <div className="border-b border-blue-100 px-5 py-4">
        <PanelTitle icon={<ChatIcon />} title="用户输入分析 / 风险聊天分析" />
      </div>
      <div className="p-5">
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          className="min-h-28 w-full resize-none rounded-lg border border-blue-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
          maxLength={3000}
          placeholder="输入您想要分析的内容、公告、链上事件...（支持中英文）"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["新闻文本", "交易所公告", "链上事件", "项目方声明"].map((item) => (
              <span key={item} className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                {item}
              </span>
            ))}
          </div>
          <button
            type="submit"
            disabled={chatLoading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendIcon />
            {chatLoading ? "分析中" : "分析"}
          </button>
        </div>
        <WorkflowStrip />
      </div>
    </form>
  );
}

function ChatView({
  chatError,
  chatLoading,
  chatMessages,
  latestReport,
  message,
  onExampleClick,
  onMessageChange,
  onSubmit,
}: {
  chatError: string;
  chatLoading: boolean;
  chatMessages: ChatMessage[];
  latestReport: RiskReport | null;
  message: string;
  onExampleClick: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
      <section className="rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-100/60">
        <div className="border-b border-blue-100 px-5 py-4">
          <PanelTitle icon={<ChatIcon />} title="输入待分析内容" />
        </div>
        <form onSubmit={onSubmit} className="p-5">
          <textarea
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            className="min-h-36 w-full resize-none rounded-lg border border-blue-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700 outline-none focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            placeholder="请输入新闻、公告、项目动态、交易所事件或链上异常描述..."
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {examplePrompts.slice(0, 3).map((item, index) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onExampleClick(item)}
                  className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  示例 {index + 1}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={chatLoading}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SendIcon />
              {chatLoading ? "开始分析中" : "开始分析"}
            </button>
          </div>
          {chatError && <Notice tone="red" text={chatError} />}
        </form>
      </section>

      <section className="rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-100/60">
        <div className="border-b border-blue-100 px-5 py-4">
          <PanelTitle icon={<FileIcon />} title="最近对话记录" />
        </div>
        <div className="max-h-[390px] space-y-4 overflow-y-auto p-5">
          {chatMessages.map((item) => (
            <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[84%] rounded-lg px-4 py-3 text-sm leading-6 ${
                  item.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-blue-100 bg-slate-50 text-slate-700"
                }`}
              >
                {item.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              多 Agent 正在进行证据抽取、分类、评分和报告生成...
            </div>
          )}
        </div>
      </section>

      <ResultCard report={latestReport} topNews={fallbackNews[0]} />
      <QuestionList />
    </div>
  );
}

function NewsView({ items }: { items: NewsRankingItem[] }) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <RankingCard title="新闻风险排行榜 Top 10" action="刷新">
          <RiskFilterBar />
          <NewsTable items={items} />
          <TableFooter text={`共 ${Math.max(items.length, 10)} 条，已显示前 ${items.length} 条`} />
        </RankingCard>
        <div className="space-y-4">
          <DistributionCard total={300} high={12} midHigh={28} mid={88} low={172} />
          <TrendCard title="今日风险趋势（按平均风险分）" />
        </div>
      </div>
      <FocusNewsCard item={items[0]} />
    </>
  );
}

function CoinView({ items }: { items: CoinRankingItem[] }) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(390px,0.8fr)]">
        <RankingCard title="币种风险排行榜 Top 10" action="近24小时">
          <RiskFilterBar />
          <CoinTable items={items} />
          <TableFooter text={`共 ${Math.max(items.length, 128)} 个币种，已显示前 ${items.length} 个`} />
        </RankingCard>
        <div className="space-y-4">
          <DistributionCard total={128} high={5} midHigh={18} mid={41} low={64} />
          <TrendCard title="热门币种风险趋势" withLegend />
        </div>
      </div>
      <FocusCoinCard item={items[0]} />
    </>
  );
}

function ReportsView({
  coinItems,
  latestReport,
  newsItems,
}: {
  coinItems: CoinRankingItem[];
  latestReport: RiskReport | null;
  newsItems: NewsRankingItem[];
}) {
  const reports = [
    { title: `${newsItems[0]?.title || "交易所暂停提现"} 风险分析报告`, type: "事件分析报告", target: newsItems[0]?.coins[0] || "某交易所", level: "高风险", time: "2026-05-23 10:32" },
    { title: `${coinItems[0]?.symbol || "SOL"} 链上异常转账事件分析报告`, type: "链上分析报告", target: coinItems[0]?.symbol || "SOL", level: "中高风险", time: "2026-05-23 09:15" },
    { title: "稳定币脱锚事件分析报告", type: "事件分析报告", target: "USDT", level: "中高风险", time: "2026-05-22 23:08" },
    { title: "DeFi 协议漏洞事件分析报告", type: "安全分析报告", target: "DeFi 协议", level: "高风险", time: "2026-05-22 18:27" },
  ];

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <RankingCard title="报告列表" action="最近7天">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-y border-blue-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  {["报告标题", "报告类型", "关联对象", "风险等级", "生成时间", "状态", "操作"].map((head) => (
                    <th key={head} className="px-3 py-3 font-semibold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {reports.map((report) => (
                  <tr key={report.title} className="text-slate-700">
                    <td className="max-w-[280px] px-3 py-3 font-semibold text-slate-800">{report.title}</td>
                    <td className="px-3 py-3">{report.type}</td>
                    <td className="px-3 py-3">{report.target}</td>
                    <td className="px-3 py-3"><RiskBadge level={report.level} /></td>
                    <td className="px-3 py-3 text-slate-500">{report.time}</td>
                    <td className="px-3 py-3"><span className="text-emerald-600">● 已完成</span></td>
                    <td className="px-3 py-3"><span className="font-semibold text-blue-600">查看 | 导出</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RankingCard>
        <div className="space-y-4">
          <DistributionCard total={1286} high={12} midHigh={156} mid={423} low={695} />
          <TrendCard title="报告生成趋势" />
        </div>
      </div>
      <ResultCard report={latestReport} topNews={newsItems[0]} title="报告详情预览" />
    </>
  );
}

function SettingsView() {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60">
      <PanelTitle icon={<GearIcon />} title="系统设置" />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[
          ["模型配置", "deepseek-v4-pro", "已通过 .env 读取 DEEPSEEK_API_KEY"],
          ["Agent 工作流", "8 个节点", "风险识别、分类、证据、评分、影响、建议、报告"],
          ["数据源", "本地新闻 CSV", "当前不接入外部爬虫源"],
          ["风控边界", "非投资建议", "仅输出风险识别和处置建议"],
        ].map(([title, value, desc]) => (
          <div key={title} className="rounded-lg border border-blue-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-500">{title}</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
            <p className="mt-2 text-sm text-slate-500">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AssistantPanel({
  activeView,
  latestReport,
  topCoin,
  topNews,
  onAsk,
}: {
  activeView: ActiveView;
  chatLoading: boolean;
  latestReport: RiskReport | null;
  topCoin: CoinRankingItem;
  topNews: NewsRankingItem;
  onAsk: (text: string) => void;
}) {
  const topic = activeView === "coin" ? topCoin.symbol : topNews.coins[0] || topCoin.symbol;
  const score = latestReport?.risk_score ?? (activeView === "coin" ? topCoin.final_score : topNews.risk_score);

  return (
    <aside className="hidden space-y-4 xl:block">
      <section className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-100/60">
        <div className="flex items-center justify-between border-b border-blue-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <BotIcon />
            </div>
            <div>
              <p className="font-bold text-slate-950">可解释风控助手</p>
              <p className="text-xs text-slate-500">实时解读风险与疑问</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <button className="text-slate-400" type="button" aria-label="关闭">×</button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex justify-end">
            <div className="max-w-[84%] rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white">
              为什么 {topic} 是红色预警？
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            <p className="font-semibold text-slate-900">{topic} 被标记为高风险，主要原因如下：</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>风险评分达到 {score} 分，显著高于常规监测阈值。</li>
              <li>证据集中在公告异常、链上资金流动或社群负面反馈。</li>
              <li>短期可能影响用户资产安全、平台流动性与市场情绪。</li>
            </ul>
            <p className="mt-3">建议持续监控官方公告与链上资金流向，必要时提升人工复核优先级。</p>
          </div>

          <div className="flex gap-3 text-slate-500">
            <ThumbIcon />
            <ThumbIcon down />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60">
        <p className="font-bold text-slate-900">猜你想问</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            `查看 ${topic} 近期风险事件`,
            "解释风险分来源",
            "有哪些相似事件？",
            "如何评估项目风险？",
          ].map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onAsk(question)}
              className="rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              {question}
            </button>
          ))}
        </div>
        <div className="mt-5 flex h-12 items-center gap-3 rounded-lg border border-blue-100 bg-slate-50 px-3 text-sm text-slate-400">
          输入你的问题...
          <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
            <SendIcon />
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">内容由 AI 生成，仅供参考</p>
      </section>
    </aside>
  );
}

function RankingCard({
  action,
  children,
  onAction,
  title,
}: {
  action?: string;
  children: ReactNode;
  onAction?: () => void;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-100/60">
      <div className="flex items-center justify-between border-b border-blue-100 px-5 py-4">
        <PanelTitle icon={<ChartIcon />} title={title} />
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
          >
            {action}
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function NewsTable({ compact = false, items }: { compact?: boolean; items: NewsRankingItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-y border-blue-100 bg-slate-50 text-xs text-slate-500">
          <tr>
            {["#", "新闻标题", "风险类别", "关联币种", "风险分", "风险等级", compact ? "" : "发布时间"].map((head) => (
              <th key={head} className="px-3 py-3 font-semibold">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-50">
          {items.map((item) => (
            <tr key={item.news_id} className="text-slate-700">
              <td className="px-3 py-3 font-semibold text-slate-900">{item.rank}</td>
              <td className="max-w-[310px] px-3 py-3 font-semibold text-slate-800">
                <span className="line-clamp-1">{item.title}</span>
              </td>
              <td className="px-3 py-3">{item.risk_type || "综合风险"}</td>
              <td className="px-3 py-3">{item.coins.length ? item.coins.join(", ") : "--"}</td>
              <td className="px-3 py-3 font-bold text-red-500">{clampScore(item.risk_score)}</td>
              <td className="px-3 py-3"><RiskBadge level={item.risk_level} /></td>
              <td className="px-3 py-3 text-slate-500">{compact ? "" : item.published_at || "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CoinTable({ compact = false, items }: { compact?: boolean; items: CoinRankingItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-y border-blue-100 bg-slate-50 text-xs text-slate-500">
          <tr>
            {["#", "币种", "风险类别", "风险分", "风险等级", "相关新闻数", compact ? "" : "24H 趋势"].map((head) => (
              <th key={head} className="px-3 py-3 font-semibold">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-50">
          {items.map((item) => (
            <tr key={item.symbol} className="text-slate-700">
              <td className="px-3 py-3 font-semibold text-red-500">{item.rank}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <CoinMark symbol={item.symbol} />
                  <span className="font-bold text-slate-900">{item.symbol}</span>
                </div>
              </td>
              <td className="max-w-[260px] px-3 py-3">{item.main_risk_type}</td>
              <td className="px-3 py-3 font-bold text-red-500">{clampScore(item.final_score)}</td>
              <td className="px-3 py-3"><RiskBadge level={item.risk_level} /></td>
              <td className="px-3 py-3">{item.news_count}</td>
              <td className="px-3 py-3">{compact ? "" : <MiniTrend />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCard({
  report,
  title = "分析结果",
  topNews,
}: {
  report: RiskReport | null;
  title?: string;
  topNews: NewsRankingItem;
}) {
  const score = report?.risk_score ?? topNews.risk_score ?? 86;
  const categories = report?.risk_categories?.length ? report.risk_categories : [topNews.risk_type || "交易所与系统风险"];
  const evidence = report?.evidence?.[0]?.evidence_text || topNews.evidence || "提现受阻、系统异常、多所用户投诉增加";
  const impact = report?.impact?.join(" / ") || "持有用户 / 平台流动性";
  const advice = sanitizeAdvice(report?.advice || ["持续监控公告与链上资金流向", "提升人工复核优先级"])[0];

  return (
    <section className="rounded-lg border border-blue-100 bg-white shadow-sm shadow-blue-100/60">
      <div className="border-b border-blue-100 px-5 py-4">
        <PanelTitle icon={<ShieldIcon />} title={title} />
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <RiskGauge score={score} />
        <div className="divide-y divide-blue-50">
          <InfoLine icon={<ShieldIcon />} label="风险评分" value={`${clampScore(score)} / 100`} suffix={<RiskBadge level={report?.risk_level || topNews.risk_level || "高风险"} />} />
          <InfoLine icon={<TagIcon />} label="风险类别" value={categories.join(" / ")} />
          <InfoLine icon={<FileIcon />} label="证据摘要" value={evidence} />
          <InfoLine icon={<UsersIcon />} label="影响对象" value={impact} />
          <InfoLine icon={<BulbIcon />} label="建议" value={advice || "持续关注公告与资金流向"} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6 border-t border-blue-100 px-5 py-4 text-sm text-slate-500">
        <span>分析时间：2026-05-23 10:32:15</span>
        <span>处理时长：23.4s</span>
        <span>置信度：92%</span>
      </div>
    </section>
  );
}

function DistributionCard({
  high,
  low,
  mid,
  midHigh,
  total,
}: {
  high: number;
  low: number;
  mid: number;
  midHigh: number;
  total: number;
}) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60">
      <PanelTitle icon={<ChartIcon />} title="风险等级分布" />
      <div className="mt-5 grid gap-5 sm:grid-cols-[170px_minmax(0,1fr)]">
        <div className="relative h-40 w-40 rounded-full bg-[conic-gradient(#ef4444_0_4%,#f97316_4%_14%,#facc15_14%_43%,#10b981_43%_100%)]">
          <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-3xl font-bold text-slate-700">{total.toLocaleString()}</span>
            <span className="text-sm text-slate-500">总数</span>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <Legend color="bg-red-500" label="高风险" value={high} />
          <Legend color="bg-orange-500" label="中高风险" value={midHigh} />
          <Legend color="bg-yellow-400" label="中风险" value={mid} />
          <Legend color="bg-emerald-500" label="低风险" value={low} />
        </div>
      </div>
    </section>
  );
}

function TrendCard({ title, withLegend = false }: { title: string; withLegend?: boolean }) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60">
      <div className="flex items-center justify-between">
        <PanelTitle icon={<ChartIcon />} title={title} />
        <span className="rounded-lg border border-blue-100 px-2 py-1 text-xs font-semibold text-slate-500">24小时</span>
      </div>
      <div className="mt-5 h-40 rounded-lg bg-slate-50 p-3">
        <svg className="h-full w-full" viewBox="0 0 340 130" role="img" aria-label="风险趋势">
          {[20, 50, 80, 110].map((y) => (
            <line key={y} x1="0" x2="340" y1={y} y2={y} stroke="#dbeafe" strokeDasharray="4 4" />
          ))}
          <polyline
            points="0,86 26,91 52,78 78,88 104,67 130,72 156,62 182,47 208,70 234,49 260,43 286,55 312,50 340,42"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="130" cy="72" r="5" fill="#2563eb" />
        </svg>
      </div>
      {withLegend && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          {["SOL", "FTT", "LUNC", "XRP", "BNB"].map((item) => (
            <span key={item} className="rounded-full border border-blue-100 px-3 py-1">{item}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function FocusNewsCard({ item }: { item: NewsRankingItem }) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60">
      <PanelTitle icon={<FileIcon />} title="重点高风险新闻解读" />
      <div className="mt-4 grid gap-4 border-b border-blue-50 pb-4 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(120px,0.7fr))]">
        <div>
          <RiskBadge level={item.risk_level} />
          <p className="mt-3 font-bold text-slate-900">{item.title}</p>
          <p className="mt-2 text-sm text-slate-500">发布时间：{item.published_at || "--"}　风险分：<span className="font-bold text-red-500">{item.risk_score}</span></p>
        </div>
        <MiniInfo label="风险类别" value={item.risk_type} />
        <MiniInfo label="关联币种" value={item.coins.join(", ") || "--"} />
        <MiniInfo label="影响对象" value="用户资产、交易流动性" />
        <MiniInfo label="建议动作" value="密切关注官方公告，评估风险敞口" />
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">证据摘要：{item.evidence || item.summary}</p>
    </section>
  );
}

function FocusCoinCard({ item }: { item: CoinRankingItem }) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60">
      <PanelTitle icon={<CoinIcon />} title="重点币种风险解读" />
      <div className="mt-4 grid gap-5 lg:grid-cols-[180px_repeat(4,minmax(120px,1fr))]">
        <div>
          <div className="flex items-center gap-3">
            <CoinMark symbol={item.symbol} large />
            <div>
              <p className="text-2xl font-bold text-slate-900">{item.symbol}</p>
              <p className="text-sm text-slate-500">{item.name}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">风险分</p>
          <p className="text-3xl font-bold text-red-500">{item.final_score}<span className="text-base text-slate-500"> / 100</span></p>
        </div>
        <MiniInfo label="风险标签" value={item.main_risk_type} />
        <MiniInfo label="相关事件" value={item.top_news_title} />
        <MiniInfo label="影响对象" value="持币用户、交易者、平台流动性" />
        <MiniInfo label="建议动作" value="持续跟踪公告与链上资金流向" />
      </div>
      <p className="mt-4 border-t border-blue-50 pt-4 text-sm leading-7 text-slate-600">证据摘要：{item.summary}</p>
    </section>
  );
}

function WorkflowStrip() {
  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        多 Agent 分析流程
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 text-[10px] text-blue-600">i</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {workflowSteps.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <span className="rounded-lg border border-blue-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              {step}
            </span>
            {index < workflowSteps.length - 1 && <span className="text-slate-300">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionList() {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm shadow-blue-100/60">
      <PanelTitle icon={<ChatIcon />} title="典型风险问答" />
      <div className="mt-4 space-y-3">
        {["为什么这个事件被判为高风险？", "风险分数是如何计算的？", "证据来自哪里？", "这个建议具体是什么意思？", "是否影响某个币种的短期风险？"].map((item) => (
          <div key={item} className="flex items-center justify-between rounded-lg border border-blue-100 px-4 py-3 text-sm font-semibold text-slate-700">
            {item}
            <span className="text-slate-400">⌄</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiskFilterBar() {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {["全部", "高风险", "中高风险", "中风险", "低风险"].map((item, index) => (
        <button
          key={item}
          type="button"
          className={`rounded-lg px-4 py-2 text-xs font-semibold ${
            index === 0 ? "bg-blue-600 text-white" : "border border-blue-100 bg-white text-slate-600 hover:bg-blue-50"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function RiskGauge({ score }: { score: number }) {
  const value = clampScore(score);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-44 w-44 rounded-full bg-[conic-gradient(from_220deg,#22c55e_0_22%,#facc15_22%_48%,#fb923c_48%_70%,#ef4444_70%_78%,transparent_78%_100%)]">
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-5xl font-bold text-red-500">{value}</span>
          <span className="text-sm font-semibold text-slate-500">/100</span>
        </div>
      </div>
      <RiskBadge level={value >= 80 ? "高风险" : value >= 50 ? "中风险" : "低风险"} />
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const style = riskLevelStyle(level);
  return <span className={`inline-flex rounded-lg px-3 py-1 text-xs font-bold ${style}`}>{level || "低风险"}</span>;
}

function InfoLine({
  icon,
  label,
  suffix,
  value,
}: {
  icon: ReactNode;
  label: string;
  suffix?: ReactNode;
  value: string;
}) {
  return (
    <div className="grid gap-3 py-3 text-sm sm:grid-cols-[110px_minmax(0,1fr)_auto]">
      <div className="flex items-center gap-2 font-semibold text-slate-500">
        <span className="text-blue-600">{icon}</span>
        {label}
      </div>
      <p className="min-w-0 text-slate-700">{value}</p>
      {suffix}
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-blue-600">{icon}</span>
      <h2 className="font-bold text-slate-950">{title}</h2>
    </div>
  );
}

function Notice({ text, tone }: { text: string; tone: "red" | "amber" }) {
  const style = tone === "red" ? "border-red-100 bg-red-50 text-red-700" : "border-amber-100 bg-amber-50 text-amber-700";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${style}`}>{text}</div>;
}

function TableFooter({ text }: { text: string }) {
  return <p className="mt-4 text-sm text-slate-500">{text}</p>;
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-blue-100 lg:border-l lg:pl-5">
      <p className="text-xs font-semibold text-blue-600">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function Sparkline({ tone }: { tone: "blue" | "red" | "orange" | "green" | "purple" }) {
  const color = {
    blue: "#2563eb",
    red: "#ef4444",
    orange: "#f97316",
    green: "#10b981",
    purple: "#7c3aed",
  }[tone];

  return (
    <svg className="mt-8 h-8 w-20" viewBox="0 0 88 32" aria-hidden="true">
      <polyline
        points="0,24 10,20 18,23 28,12 38,18 48,8 58,25 68,16 78,20 88,12"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MiniTrend() {
  return (
    <svg className="h-8 w-20" viewBox="0 0 80 28" aria-hidden="true">
      <polyline
        points="0,22 8,21 16,9 24,18 32,5 40,22 48,16 56,20 64,8 72,17 80,14"
        fill="none"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CoinMark({ large = false, symbol }: { large?: boolean; symbol: string }) {
  const colors = ["bg-slate-950", "bg-blue-600", "bg-orange-500", "bg-emerald-500", "bg-violet-600"];
  const color = colors[symbol.charCodeAt(0) % colors.length];
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${color} font-bold text-white ${large ? "h-14 w-14 text-lg" : "h-7 w-7 text-xs"}`}>
      {symbol.slice(0, 1)}
    </span>
  );
}

function getPageMeta(view: ActiveView) {
  const map = {
    home: ["CryptoRisk Agent 风控看板", "多智能体加密风险监测平台"],
    chat: ["风险对话分析", "面向新闻 / 公告 / 链上事件的智能体风险解读"],
    news: ["新闻风险榜", "基于新闻文本与风险规则的实时风险排行"],
    coin: ["币种风险榜", "基于新闻、公告与链上事件聚合的币种风险排行"],
    reports: ["分析报告", "查看、管理与导出风险分析结果报告"],
    settings: ["系统设置", "模型、Agent 工作流与数据源配置"],
  } satisfies Record<ActiveView, [string, string]>;

  return { title: map[view][0], subtitle: map[view][1] };
}

function getMetrics(
  view: ActiveView,
  overview: RiskOverview | null,
  topNews: NewsRankingItem,
  topCoin: CoinRankingItem,
  loading: boolean
) {
  if (view === "chat") {
    return [
      { label: "今日分析请求", value: "126", delta: "↑ 18.7%", tone: "purple" as const, icon: <ChatIcon /> },
      { label: "高风险会话", value: "28", delta: "↑ 21.2%", tone: "orange" as const, icon: <AlertIcon /> },
      { label: "平均响应时长", value: "2.4s", delta: "↓ 8.6%", tone: "blue" as const, icon: <ClockIcon /> },
      { label: "对话满意度", value: "96%", delta: "↑ 3.2%", tone: "green" as const, icon: <SmileIcon /> },
    ];
  }

  if (view === "reports") {
    return [
      { label: "累计报告数", value: "1,286", delta: "↑ 8.6%", tone: "blue" as const, icon: <FileIcon /> },
      { label: "今日新增报告", value: "36", delta: "↑ 16.2%", tone: "green" as const, icon: <PlusIcon /> },
      { label: "高风险报告", value: "12", delta: "↑ 9.1%", tone: "red" as const, icon: <AlertIcon /> },
      { label: "自动生成成功率", value: "98%", delta: "↑ 2.3%", tone: "purple" as const, icon: <CheckIcon /> },
    ];
  }

  if (view === "coin") {
    return [
      { label: "监测币种总数", value: "128", delta: "↑ 8.5%", tone: "blue" as const, icon: <FileIcon /> },
      { label: "红色预警币种", value: String(topCoin.final_score >= 80 ? 5 : 3), delta: "↑ 25.0%", tone: "red" as const, icon: <AlertIcon /> },
      { label: "平均币种风险分", value: "72", delta: "↓ 1.4%", tone: "blue" as const, icon: <TrendIcon /> },
      { label: "异常波动事件", value: "14", delta: "↑ 16.7%", tone: "orange" as const, icon: <ShieldIcon /> },
    ];
  }

  if (view === "news") {
    return [
      { label: "监测新闻总数", value: loading ? "--" : String(overview?.total_news ?? 300), delta: "↑ 18.7%", tone: "blue" as const, icon: <FileIcon /> },
      { label: "高风险新闻", value: loading ? "--" : String(overview?.high_risk_news ?? 12), delta: "↑ 33.3%", tone: "red" as const, icon: <AlertIcon /> },
      { label: "平均风险分", value: "68", delta: "↑ 2.4%", tone: "blue" as const, icon: <TrendIcon /> },
      { label: "红色预警事件", value: "5", delta: "↑ 25.0%", tone: "orange" as const, icon: <ShieldIcon /> },
    ];
  }

  return [
    { label: "今日高风险新闻", value: loading ? "--" : String(overview?.high_risk_news ?? (topNews.risk_score > 80 ? 12 : 5)), delta: "↑ 33.3%", tone: "red" as const, icon: <FileIcon /> },
    { label: "红色预警币种", value: "5", delta: "↑ 25.0%", tone: "orange" as const, icon: <ShieldIcon /> },
    { label: "平均风险分", value: "74", delta: "↓ 2.1%", tone: "blue" as const, icon: <TrendIcon /> },
    { label: "实时监测状态", value: "运行中", delta: "所有 Agent 正常", tone: "green" as const, icon: <SmileIcon /> },
  ];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value || 0)));
}

function sanitizeAdvice(items: string[]) {
  return items.filter((item) => !forbiddenAdviceTerms.some((term) => item.includes(term)));
}

function riskLevelStyle(level: string) {
  if (level.includes("高") || level.includes("红")) return "bg-red-50 text-red-600";
  if (level.includes("中")) return "bg-orange-50 text-orange-600";
  return "bg-emerald-50 text-emerald-600";
}

function IconSvg({ children }: { children: ReactNode }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function HomeIcon() { return <IconSvg><path d="M3 10.5 12 3l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></IconSvg>; }
function ChatIcon() { return <IconSvg><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 1 1 18-5Z" /></IconSvg>; }
function ChartIcon() { return <IconSvg><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 3 5-7" /></IconSvg>; }
function CoinIcon() { return <IconSvg><circle cx="12" cy="12" r="8" /><path d="M9 10h6" /><path d="M9 14h6" /></IconSvg>; }
function FileIcon() { return <IconSvg><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h6" /></IconSvg>; }
function GearIcon() { return <IconSvg><circle cx="12" cy="12" r="3" /><path d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L15 5.5h-4l-.4 2.6a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 .1 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 2.6h4l.4-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.4z" /></IconSvg>; }
function ShieldIcon() { return <IconSvg><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path d="m9 12 2 2 4-5" /></IconSvg>; }
function SearchIcon() { return <IconSvg><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></IconSvg>; }
function BellIcon() { return <IconSvg><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></IconSvg>; }
function AlertIcon() { return <IconSvg><path d="m12 3 10 18H2z" /><path d="M12 9v5" /><path d="M12 18h.01" /></IconSvg>; }
function ClockIcon() { return <IconSvg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></IconSvg>; }
function SmileIcon() { return <IconSvg><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" /></IconSvg>; }
function TrendIcon() { return <IconSvg><path d="m4 16 5-5 4 4 7-8" /><path d="M14 7h6v6" /></IconSvg>; }
function SendIcon() { return <IconSvg><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4z" /></IconSvg>; }
function BotIcon() { return <IconSvg><rect x="5" y="8" width="14" height="11" rx="4" /><path d="M12 4v4" /><path d="M9 13h.01" /><path d="M15 13h.01" /><path d="M10 17h4" /></IconSvg>; }
function ThumbIcon({ down = false }: { down?: boolean }) { return <IconSvg><path d={down ? "M7 10v10H4V10z" : "M7 14V4H4v10z"} /><path d={down ? "M7 18h9l-1 4 5-6V7a2 2 0 0 0-2-2H9z" : "M7 6h9l-1-4 5 6v9a2 2 0 0 1-2 2H9z"} /></IconSvg>; }
function TagIcon() { return <IconSvg><path d="M20 12 12 20 4 12V4h8z" /><path d="M8 8h.01" /></IconSvg>; }
function UsersIcon() { return <IconSvg><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.8" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></IconSvg>; }
function BulbIcon() { return <IconSvg><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z" /></IconSvg>; }
function PlusIcon() { return <IconSvg><path d="M12 5v14" /><path d="M5 12h14" /></IconSvg>; }
function CheckIcon() { return <IconSvg><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></IconSvg>; }
