import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  DownloadCloud,
  ExternalLink,
  Gift,
  Globe2,
  Home,
  KeyRound,
  Laptop,
  LockKeyhole,
  LogOut,
  MessageCircle,
  PackageCheck,
  QrCode,
  RadioTower,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  TicketCheck,
  UserRound,
  WalletCards,
  Wifi,
  X
} from 'lucide-react';
import { api, type AuthData, type CheckoutResponse, type GiftCardRedeemResult, type InviteInfo, type OrderRecord, type PaymentMethod, type PeriodKey, type Plan, type PortalConfig, type ServerNode, type SubscribeInfo, type TicketRecord, type TrafficLog, type UserInfo } from './api';
import './styles.css';

type Page = 'home' | 'plans' | 'redeem' | 'checkout' | 'setup' | 'account';

type CheckoutState = {
  tradeNo?: string;
  planName?: string;
  amount?: string;
  periodLabel?: string;
  period?: PeriodKey;
  payment?: PaymentMethod;
  result?: CheckoutResponse;
  status?: number;
  error?: string;
};

type AccountView = 'overview' | 'security' | 'orders' | 'tickets' | 'invite' | 'wallet' | 'redeem';

type AccountNotice = {
  title: string;
  body: string;
  primary: string;
};

const AUTH_KEY = 'northline.auth';

const periods: Array<{ key: PeriodKey; label: string; months?: number }> = [
  { key: 'month_price', label: '月付', months: 1 },
  { key: 'quarter_price', label: '季付', months: 3 },
  { key: 'half_year_price', label: '半年付', months: 6 },
  { key: 'year_price', label: '年付', months: 12 },
  { key: 'two_year_price', label: '2年套餐', months: 24 },
  { key: 'three_year_price', label: '三年付', months: 36 },
  { key: 'onetime_price', label: '一次性' },
  { key: 'reset_price', label: '流量重置' }
];

const customerPeriodKeys: PeriodKey[] = ['month_price', 'year_price', 'two_year_price'];

const setupClients = [
  {
    name: 'Clash Verge',
    platform: 'macOS / Windows',
    flag: 'clash',
    icon: Laptop,
    downloadUrl: 'https://github.com/clash-verge-rev/clash-verge-rev/releases/latest',
    steps: ['下载并安装 Clash Verge Rev', '复制配置链接', '打开订阅或配置页面，粘贴链接并导入', '更新配置后选择节点并连接']
  },
  {
    name: 'Shadowrocket',
    platform: 'iPhone / iPad',
    flag: 'shadowrocket',
    icon: Smartphone,
    downloadUrl: 'https://apps.apple.com/us/app/shadowrocket/id932747118',
    steps: ['在 App Store 安装 Shadowrocket', '复制配置链接', '点击右上角加号，类型选择 Subscribe', '粘贴链接保存，然后刷新订阅']
  },
  {
    name: 'Stash',
    platform: 'iOS / macOS',
    flag: 'stash',
    icon: ShieldCheck,
    downloadUrl: 'https://apps.apple.com/us/app/stash-rule-based-proxy/id1596063349',
    steps: ['安装 Stash', '复制配置链接', '进入配置管理，选择从 URL 下载', '粘贴链接保存，返回首页启用配置']
  },
  {
    name: 'Sing-box',
    platform: 'Android / Linux',
    flag: 'sing-box',
    icon: RadioTower,
    downloadUrl: 'https://github.com/SagerNet/sing-box/releases/latest',
    steps: ['安装支持 sing-box 的客户端', '复制配置链接', '在客户端中选择 URL 导入', '刷新配置后连接可用节点']
  }
];

function App() {
  const [page, setPage] = React.useState<Page>(() => pageFromHash());
  const [auth, setAuth] = React.useState<AuthData | null>(() => loadAuth());
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [subscribe, setSubscribe] = React.useState<SubscribeInfo | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [servers, setServers] = React.useState<ServerNode[]>([]);
  const [trafficLogs, setTrafficLogs] = React.useState<TrafficLog[]>([]);
  const [portalConfig, setPortalConfig] = React.useState<PortalConfig | null>(null);
  const [stats, setStats] = React.useState<[number, number, number]>([0, 0, 0]);
  const [message, setMessage] = React.useState<string>('');
  const [accountNotice, setAccountNotice] = React.useState<AccountNotice | null>(null);
  const [orderNoticeDismissed, setOrderNoticeDismissed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busyPlanId, setBusyPlanId] = React.useState<number | null>(null);
  const [checkout, setCheckout] = React.useState<CheckoutState | null>(null);
  const [accountEntryView, setAccountEntryView] = React.useState<AccountView>('overview');

  const isLoggedIn = Boolean(auth?.auth_data);
  const subscriptionUrl = subscribe?.subscribe_url || '';
  const usedBytes = (subscribe?.u || 0) + (subscribe?.d || 0);
  const totalBytes = subscribe?.transfer_enable || user?.transfer_enable || 0;
  const progress = totalBytes > 0 ? Math.min(1, usedBytes / totalBytes) : 0;
  const hasSubscription = hasActiveSubscription(subscribe, user);
  const telegramLink = stringValue(portalConfig?.telegram_discuss_link);

  const go = React.useCallback((nextPage: Page) => {
    setPage(nextPage);
    const nextHash = hashForPage(nextPage);
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash);
    }
  }, []);

  const goAccount = React.useCallback((view: AccountView = 'overview') => {
    setAccountEntryView(view);
    go('account');
  }, [go]);

  const refresh = React.useCallback(async (currentAuth = auth) => {
    setLoading(true);
    setMessage('');
    try {
      if (!currentAuth?.auth_data) {
        const [guestPlans, config] = await Promise.all([
          api.guestPlans(),
          api.guestConfig().catch(() => null)
        ]);
        setPlans(guestPlans);
        setPortalConfig(config);
        setUser(null);
        setSubscribe(null);
        setServers([]);
        setTrafficLogs([]);
        setStats([0, 0, 0]);
        return;
      }

      const [info, sub, userPlans, nodeList, stat, logs, config] = await Promise.all([
        api.userInfo(currentAuth.auth_data),
        api.subscribe(currentAuth.auth_data),
        api.userPlans(currentAuth.auth_data),
        api.servers(currentAuth.auth_data),
        api.stats(currentAuth.auth_data),
        api.trafficLogs(currentAuth.auth_data),
        api.userConfig(currentAuth.auth_data).catch(() => null)
      ]);

      setUser(info);
      setSubscribe(sub);
      setPlans(userPlans);
      setServers(nodeList);
      setStats(stat);
      setTrafficLogs(logs);
      setPortalConfig(config);
    } catch (error) {
      const text = error instanceof Error ? error.message : '加载失败';
      setMessage(text);
      if (text.includes('未登录') || text.includes('403')) {
        saveAuth(null);
        setAuth(null);
      }
    } finally {
      setLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  React.useEffect(() => {
    const syncFromHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [page]);

  React.useEffect(() => {
    if (auth?.auth_data && stats[0] > 0 && !orderNoticeDismissed) {
      setAccountNotice({
        title: '你有未完成的订单',
        body: `当前还有 ${stats[0]} 个待支付订单。为了避免重复购买，请先完成支付或取消旧订单。`,
        primary: '去处理订单'
      });
    }
  }, [auth?.auth_data, orderNoticeDismissed, stats]);

  async function handleLogin(email: string, password: string) {
    const nextAuth = await api.login(email, password);
    saveAuth(nextAuth);
    setAuth(nextAuth);
    go(page === 'redeem' ? 'redeem' : 'home');
    await refresh(nextAuth);
  }

  async function handleRegister(email: string, password: string) {
    const nextAuth = await api.register(email, password);
    saveAuth(nextAuth);
    setAuth(nextAuth);
    go(page === 'redeem' ? 'redeem' : 'home');
    await refresh(nextAuth);
  }

  async function handleConnectionTest() {
    const guestPlans = await api.guestPlans();
    setPlans(guestPlans);
    setMessage(`连接正常，已读取 ${guestPlans.length} 个套餐。`);
  }

  function handleLogout() {
    saveAuth(null);
    setAuth(null);
    setAccountNotice(null);
    setOrderNoticeDismissed(false);
    goAccount();
    refresh(null);
  }

  function handleNotifications() {
    if (!auth?.auth_data) {
      setMessage('登录后可以查看待支付订单、工单和账户提醒。');
      goAccount();
      return;
    }

    if (stats[0] > 0) {
      showOrderNotice(`你有 ${stats[0]} 个待支付订单，可以继续完成支付或取消旧订单。`);
      return;
    }

    if (stats[1] > 0) {
      setMessage(`你有 ${stats[1]} 个未结工单。`);
      goAccount('tickets');
      return;
    }

    setMessage('暂无新的账户提醒。');
  }

  function openHelp() {
    if (!auth?.auth_data) {
      setMessage('请先登录，登录后可以查看工单与账户帮助。');
      goAccount();
      return;
    }

    goAccount('tickets');
  }

  function openSetup() {
    if (!auth?.auth_data) {
      setMessage('请先登录，登录后才能复制你的专属导入配置。');
      goAccount();
      return;
    }

    go('setup');
  }

  async function copySubscribe(flag = 'clash') {
    if (!auth?.auth_data) {
      setMessage('请先登录，登录后才能复制你的专属订阅链接。');
      goAccount();
      return;
    }

    if (!hasSubscription || !subscriptionUrl) {
      setMessage('当前账号还没有有效套餐，请先选择套餐完成开通。');
      go('plans');
      return;
    }

    const url = withQuery(subscriptionUrl, 'flag', flag);
    await copyText(url);
    setMessage(`已复制 ${flag} 订阅链接`);
  }

  async function resetSecurity() {
    if (!auth?.auth_data) return;
    await api.resetSecurity(auth.auth_data);
    await refresh(auth);
    setMessage('订阅链接已重置。旧链接已失效，请重新复制 Clash 订阅链接并导入客户端。');
  }

  async function startCheckout(plan: Plan, selectedPeriod?: PeriodKey) {
    if (!auth?.auth_data) {
      setMessage('请先登录后继续。');
      go('account');
      return;
    }

    const period = purchasePeriod(plan, selectedPeriod);
    if (!period) {
      setMessage('这个套餐没有可购买周期。');
      return;
    }

    setBusyPlanId(plan.id);
    setMessage('');
    try {
      const tradeNo = await api.createOrder(auth.auth_data, plan.id, period.key);
      const amount = formatMoney(plan[period.key]);
      let payment: PaymentMethod | undefined;
      let result: CheckoutResponse | undefined;

      if ((plan[period.key] || 0) > 0) {
        const methods = await api.paymentMethods(auth.auth_data);
        payment = pickPaymentMethod(methods);
        if (!payment) {
          setCheckout({
            tradeNo,
            planName: plan.name,
            amount,
            periodLabel: period.label,
            period: period.key,
            error: '暂未启用可用支付方式，请稍后再试。'
          });
          go('checkout');
          return;
        }
      }

      result = await api.checkoutOrder(auth.auth_data, tradeNo, payment?.id);
      setCheckout({ tradeNo, planName: plan.name, amount, periodLabel: period.label, period: period.key, payment, result, status: result.type === -1 ? 3 : 0 });
      go('checkout');
      await refresh(auth);
    } catch (error) {
      handleOrderCreationError(error, '创建订单失败');
    } finally {
      setBusyPlanId(null);
    }
  }

  async function startTrafficReset() {
    if (!auth?.auth_data) {
      setMessage('请先登录后购买流量重置包。');
      go('account');
      return;
    }

    const activePlanId = subscribe?.plan_id || user?.plan_id;
    let activePlan = plans.find((plan) => plan.id === activePlanId) || null;

    if (!activePlan && activePlanId) {
      const [fetchedPlan] = await api.userPlans(auth.auth_data, activePlanId);
      activePlan = fetchedPlan || null;
    }

    if (!activePlan) {
      setMessage('当前账号还没有有效套餐，请先选择套餐。');
      go('plans');
      return;
    }

    if (activePlan.reset_price === null || activePlan.reset_price === undefined) {
      setMessage('当前套餐暂未配置流量重置包，请续费套餐或联系工单处理。');
      go('plans');
      return;
    }

    setBusyPlanId(activePlan.id);
    setMessage('');
    try {
      const tradeNo = await api.createOrder(auth.auth_data, activePlan.id, 'reset_price');
      const amount = formatMoney(activePlan.reset_price);
      let payment: PaymentMethod | undefined;
      let result: CheckoutResponse | undefined;

      if ((activePlan.reset_price || 0) > 0) {
        const methods = await api.paymentMethods(auth.auth_data);
        payment = pickPaymentMethod(methods);
        if (!payment) {
          setCheckout({
            tradeNo,
            planName: activePlan.name,
            amount,
            periodLabel: '流量重置',
            period: 'reset_price',
            error: '暂未启用可用支付方式，请稍后再试。'
          });
          go('checkout');
          return;
        }
      }

      result = await api.checkoutOrder(auth.auth_data, tradeNo, payment?.id);
      setCheckout({
        tradeNo,
        planName: activePlan.name,
        amount,
        periodLabel: '流量重置',
        period: 'reset_price',
        payment,
        result,
        status: result.type === -1 ? 3 : 0
      });
      go('checkout');
      await refresh(auth);
    } catch (error) {
      handleOrderCreationError(error, '创建流量重置订单失败');
    } finally {
      setBusyPlanId(null);
    }
  }

  function showOrderNotice(body: string) {
    setAccountNotice({
      title: '需要先处理订单',
      body,
      primary: '去处理订单'
    });
  }

  function handleOrderCreationError(error: unknown, fallback: string) {
    const text = error instanceof Error ? error.message : fallback;
    if (isOrderBlockingMessage(text)) {
      showOrderNotice('你有未付款或开通中的订单。请先完成支付或取消旧订单，然后再重新操作。');
      return;
    }
    setMessage(text);
  }

  function openOrdersFromNotice() {
    setAccountNotice(null);
    setOrderNoticeDismissed(true);
    goAccount('orders');
  }

  async function continueCheckout(order: OrderRecord) {
    if (!auth?.auth_data) {
      setMessage('请先登录后继续。');
      go('account');
      return;
    }

    if (!isPendingOrder(order.status)) {
      setMessage(`订单状态：${orderStatusLabel(order.status)}`);
      return;
    }

    setMessage('');
    try {
      let payment: PaymentMethod | undefined;

      if ((order.total_amount || 0) > 0) {
        const methods = await api.paymentMethods(auth.auth_data);
        payment = pickPaymentMethod(methods);
        if (!payment) {
          setCheckout({
            tradeNo: order.trade_no,
            planName: order.plan?.name || `订单 ${order.trade_no}`,
            amount: formatMoney(order.total_amount),
            periodLabel: periodName(order.period),
            period: order.period,
            error: '暂未启用可用支付方式，请稍后再试。'
          });
          go('checkout');
          return;
        }
      }

      const result = await api.checkoutOrder(auth.auth_data, order.trade_no, payment?.id);
      setCheckout({
        tradeNo: order.trade_no,
        planName: order.plan?.name || `订单 ${order.trade_no}`,
        amount: formatMoney(order.total_amount),
        periodLabel: periodName(order.period),
        period: order.period,
        payment,
        result,
        status: result.type === -1 ? 3 : order.status
      });
      go('checkout');
      await refresh(auth);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '继续支付失败');
    }
  }

  async function refreshCheckoutStatus() {
    if (!auth?.auth_data || !checkout?.tradeNo) {
      return;
    }

    setMessage('');
    try {
      const status = await api.checkOrder(auth.auth_data, checkout.tradeNo);
      setCheckout((current) => current ? { ...current, status } : current);
      await refresh(auth);
      setMessage(status === 3 ? '订单已完成，订阅已更新。' : `订单状态：${orderStatusLabel(status)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '检查订单失败');
    }
  }

  async function redeemGiftCard(code: string): Promise<GiftCardRedeemResult> {
    if (!auth?.auth_data) {
      throw new Error('请先登录后再兑换礼品卡。');
    }

    const result = await api.redeemGiftCard(auth.auth_data, code);
    await refresh(auth);
    setMessage(result.message || '兑换成功，套餐状态已更新。');
    return result;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => go('home')}>
          <span className="brand-mark"><Wifi size={22} /></span>
          <span>Northline</span>
        </button>
        <nav className="nav">
          <NavButton active={page === 'home'} icon={Home} label="首页" onClick={() => go('home')} />
          <NavButton active={page === 'plans'} icon={PackageCheck} label="套餐" onClick={() => go('plans')} />
          <NavButton active={page === 'redeem'} icon={Gift} label="兑换" onClick={() => go('redeem')} />
          <NavButton active={page === 'setup'} icon={DownloadCloud} label="导入" onClick={openSetup} />
          <NavButton active={page === 'account'} icon={UserRound} label="我的" onClick={() => goAccount()} />
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="查看提醒" title="查看提醒" onClick={handleNotifications}><Bell size={19} /></button>
          <button className="profile-button" onClick={() => goAccount()} title={user ? '我的账户' : '登录'}>
            <span>{user ? initials(user.email) : '登录'}</span>
          </button>
        </div>
      </header>

      {message && <div className="toast">{message}</div>}
      {accountNotice && (
        <NoticeDialog
          notice={accountNotice}
          onPrimary={openOrdersFromNotice}
          onClose={() => {
            setAccountNotice(null);
            setOrderNoticeDismissed(true);
          }}
        />
      )}

      <main className="content">
        {page === 'home' && (
          <HomePage
            loading={loading}
            isLoggedIn={isLoggedIn}
            hasSubscription={hasSubscription}
            user={user}
            subscribe={subscribe}
            plans={plans}
            servers={servers}
            progress={progress}
            usedBytes={usedBytes}
            totalBytes={totalBytes}
            onPlan={() => go('plans')}
            onSetup={openSetup}
            onResetTraffic={startTrafficReset}
            onRedeem={() => go('redeem')}
            onCopySubscribe={() => copySubscribe()}
            onHelp={openHelp}
          />
        )}
        {page === 'plans' && <PlansPage plans={plans} loading={loading} busyPlanId={busyPlanId} onCheckout={startCheckout} />}
        {page === 'redeem' && (
          isLoggedIn ? (
            <GiftCardRedeemPage telegramLink={telegramLink} onRedeem={redeemGiftCard} onSetup={() => go('setup')} />
          ) : (
            <section className="page-stack">
              <PageTitle eyebrow="Gift Card" title="兑换礼品卡" subtitle="登录后输入兑换码，套餐会自动开通到当前账号。" />
              <ContactAdminPanel telegramLink={telegramLink} compact />
              <LoginPanel onLogin={handleLogin} onRegister={handleRegister} onConnectionTest={handleConnectionTest} />
            </section>
          )
        )}
        {page === 'checkout' && (
          <CheckoutPage
            checkout={checkout}
            onRefresh={refreshCheckoutStatus}
            onSetup={() => go('setup')}
            onCopySubscribe={() => copySubscribe()}
          />
        )}
        {page === 'setup' && <SetupPage subscribe={subscribe} hasSubscription={hasSubscription} onCopyProfile={copySubscribe} />}
        {page === 'account' && (
          <AccountPage
            auth={auth}
            user={user}
            subscribe={subscribe}
            stats={stats}
            trafficLogs={trafficLogs}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onConnectionTest={handleConnectionTest}
            onLogout={handleLogout}
            onResetSecurity={resetSecurity}
            onPayOrder={continueCheckout}
            onRedeemGiftCard={redeemGiftCard}
            telegramLink={telegramLink}
            entryView={accountEntryView}
          />
        )}
      </main>
    </div>
  );
}

function NoticeDialog({ notice, onPrimary, onClose }: {
  notice: AccountNotice;
  onPrimary: () => void;
  onClose: () => void;
}) {
  return (
    <div className="notice-backdrop" role="dialog" aria-modal="true" aria-labelledby="account-notice-title">
      <div className="notice-dialog">
        <div className="notice-icon"><ReceiptText size={24} /></div>
        <div>
          <h2 id="account-notice-title">{notice.title}</h2>
          <p>{notice.body}</p>
        </div>
        <div className="notice-actions">
          <button className="secondary-button" onClick={onClose}>稍后处理</button>
          <button className="primary-button" onClick={onPrimary}>{notice.primary}</button>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function HomePage(props: {
  loading: boolean;
  isLoggedIn: boolean;
  hasSubscription: boolean;
  user: UserInfo | null;
  subscribe: SubscribeInfo | null;
  plans: Plan[];
  servers: ServerNode[];
  progress: number;
  usedBytes: number;
  totalBytes: number;
  onPlan: () => void;
  onSetup: () => void;
  onResetTraffic: () => void;
  onRedeem: () => void;
  onCopySubscribe: () => void;
  onHelp: () => void;
}) {
  const planName = props.subscribe?.plan?.name || (props.user?.plan_id ? `套餐 ${props.user.plan_id}` : '未开通套餐');
  const remaining = Math.max(0, props.totalBytes - props.usedBytes);
  const onlineNodes = props.servers.filter((server) => server.is_online).length;
  const resetDate = props.hasSubscription ? formatDate(props.subscribe?.next_reset_at) : '购买后显示';
  const expireDate = props.hasSubscription ? formatDate(props.subscribe?.expired_at || props.user?.expired_at) : '未开通';
  const title = !props.isLoggedIn ? '网络会员中心' : props.loading ? '正在读取订阅' : props.hasSubscription ? '已购买订阅' : '还未开通套餐';
  const subtitle = !props.isLoggedIn
    ? '登录后复制订阅、查看流量、管理套餐。'
    : props.loading
      ? `${props.user?.email || '当前账号'} · 正在同步套餐状态`
      : props.hasSubscription
      ? `${planName} · ${props.user?.email || '当前账号'}`
      : `${props.user?.email || '当前账号'} · 请选择套餐完成开通`;

  return (
    <section className="page-stack">
      <div className="subscription-hero">
        <div className="subscription-main">
          <div className="subscription-heading">
            <PackageCheck size={26} />
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>
          <div className="subscription-copy">
            {props.loading ? '正在读取账号套餐状态，请稍候。' : props.hasSubscription ? '专属线路已经准备好，可以复制订阅链接导入客户端。' : '购买套餐后会生成你的专属订阅链接，并在这里显示流量与到期时间。'}
          </div>
          <div className="subscription-stats">
            <Metric label="套餐总流量" value={props.loading ? '读取中' : props.hasSubscription ? formatBytes(props.totalBytes) : props.isLoggedIn ? '未开通' : '登录后显示'} />
            <Metric label="本月已用" value={props.hasSubscription ? formatBytes(props.usedBytes) : '-'} />
            <Metric label="剩余流量" value={props.hasSubscription ? formatBytes(remaining) : '-'} />
          </div>
          <div className="usage-meter">
            <span style={{ width: `${props.progress * 100}%` }} />
          </div>
          <div className="subscription-lines">
            <button onClick={props.onPlan}>
              <ReceiptText size={18} />
              <span>到期时间</span>
              <strong>{expireDate}</strong>
              <ArrowRight size={17} />
            </button>
            <button onClick={props.onResetTraffic}>
              <RefreshCcw size={18} />
              <span>重置日期</span>
              <strong>{resetDate}</strong>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <div className="subscription-import">
          <div className="client-mark-row">
            {setupClients.slice(0, 4).map(({ name, icon: Icon }) => (
              <span key={name} title={name}><Icon size={28} /></span>
            ))}
          </div>
          <div>
            <strong>支持客户端一键导入</strong>
            <p>Clash Verge、Shadowrocket、Stash 等客户端均可使用订阅链接。</p>
          </div>
          <button className="primary-button wide" onClick={props.hasSubscription ? props.onCopySubscribe : props.onPlan} disabled={!props.isLoggedIn || props.loading}>
            {props.hasSubscription ? <Copy size={18} /> : <ReceiptText size={18} />}
            {props.hasSubscription ? '复制订阅链接' : '选择套餐'}
          </button>
          <div className="import-links">
            <button onClick={props.onSetup}><MessageCircle size={17} />不会用？查看教程<ArrowRight size={16} /></button>
            <button onClick={props.onSetup}><DownloadCloud size={17} />一键导入通用客户端<ArrowRight size={16} /></button>
          </div>
          <span className="live-pill">{props.isLoggedIn ? `${onlineNodes}/${props.servers.length} 节点在线` : props.loading ? '加载中' : '待登录'}</span>
        </div>
      </div>

      <div className="quick-grid support-grid">
        <ActionCard icon={Gift} title="兑换礼品卡" body="输入管理员发放的兑换码，套餐会自动开通到当前账号。" onClick={props.onRedeem} />
        <ActionCard icon={RefreshCcw} title="重置流量" body="流量不足时购买重置包，恢复当前套餐流量。" onClick={props.onResetTraffic} />
        <ActionCard icon={TicketCheck} title="工单帮助" body="连接异常、订单问题、套餐咨询都可以提交工单。" onClick={props.onHelp} />
      </div>

      <div className="section-grid">
        <div className="panel">
          <PanelHeader icon={Globe2} title="线路概览" action="导入配置" onAction={props.onSetup} />
          <div className="route-list">
            {(props.servers.length ? props.servers : []).slice(0, 4).map((server, index) => (
              <div className="route-row" key={server.id}>
                <span className={`dot ${server.is_online ? `dot-${index % 3}` : 'dot-offline'}`} />
                <div>
                  <strong>{server.name}</strong>
                  <p>{server.is_online ? '可用线路' : '暂不可用'}</p>
                </div>
                <span className={`route-status ${server.is_online ? 'online' : 'offline'}`}>
                  {server.is_online ? '在线' : '离线'}
                </span>
              </div>
            ))}
            {!props.servers.length && <EmptyState text={props.isLoggedIn ? '当前套餐暂无可用节点。' : '登录后显示你的可用节点。'} />}
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={MessageCircle} title="帮助与公告" action="工单帮助" onAction={props.onHelp} />
          <div className="notice-card">
            <strong>订阅提醒</strong>
            <p>如果客户端连接异常，请重新复制订阅链接并刷新配置。</p>
          </div>
          <div className="notice-card subtle">
            <strong>使用建议</strong>
            <p>按设备选择客户端，导入后即可开始使用。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlansPage({ plans, loading, busyPlanId, onCheckout }: { plans: Plan[]; loading: boolean; busyPlanId: number | null; onCheckout: (plan: Plan, period?: PeriodKey) => void }) {
  const [selectedPeriods, setSelectedPeriods] = React.useState<Record<number, PeriodKey>>({});

  return (
    <section className="page-stack">
      <PageTitle eyebrow="选择套餐" title="选择适合你的套餐" subtitle="清晰展示权益，按需购买或续费。" />
      <div className="plans-grid">
        {plans.map((plan, index) => {
          const availablePeriods = purchasePeriods(plan);
          const period = purchasePeriod(plan, selectedPeriods[plan.id]);
          const disabled = !period || plan.sell === false || busyPlanId === plan.id;
          return (
            <article className={`plan-card ${index === 1 ? 'primary' : index === 2 ? 'gold' : 'calm'}`} key={plan.id}>
              <span className="plan-badge">{plan.tags?.[0] || (plan.sell === false ? '暂不可售' : '可购买')}</span>
              <h2>{plan.name}</h2>
              <p className="plan-data">每月 {plan.transfer_enable} GB 流量</p>
              <div className="price-row"><strong>{period ? formatMonthlyMoney(plan[period.key], period.months) : '-'}</strong><span>/月</span></div>
              {availablePeriods.length > 1 && (
                <div className="period-picker" role="group" aria-label={`${plan.name} 购买周期`}>
                  {availablePeriods.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={period?.key === item.key ? 'active' : ''}
                      onClick={() => setSelectedPeriods((current) => ({ ...current, [plan.id]: item.key }))}
                    >
                      <span>{item.label}</span>
                      <strong>{formatMonthlyMoney(plan[item.key], item.months)}/月</strong>
                    </button>
                  ))}
                </div>
              )}
              <button className={index === 1 ? 'primary-button wide' : 'secondary-button wide'} disabled={disabled} onClick={() => onCheckout(plan, period?.key)}>
                {busyPlanId === plan.id ? '创建订单中...' : `${formatMoney(plan[period?.key || 'month_price']) === '免费' ? '开通' : '购买'} ${plan.name}`}
              </button>
              <ul className="feature-list">
                {planFeatures(plan).map((feature) => (
                  <li key={feature}><Check size={17} />{feature}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      {!plans.length && <EmptyState text={loading ? '正在读取套餐...' : '暂无可售套餐。'} />}
    </section>
  );
}

function CheckoutPage({
  checkout,
  onRefresh,
  onSetup,
  onCopySubscribe
}: {
  checkout: CheckoutState | null;
  onRefresh: () => void;
  onSetup: () => void;
  onCopySubscribe: () => void;
}) {
  const paymentInfo = paymentData(checkout?.result?.data);
  const paymentUrl = paymentInfo.qrcode || paymentInfo.url;
  const paymentExternalUrl = isWebUrl(paymentInfo.qrcodeUrl)
    ? paymentInfo.qrcodeUrl
    : isWebUrl(paymentUrl)
      ? paymentUrl
      : isWebUrl(paymentInfo.url)
        ? paymentInfo.url
        : '';
  const paymentCopyValue = paymentInfo.qrcodeUrl || paymentUrl;
  const isQr = checkout?.result?.type === 0 && paymentUrl;
  const isRedirect = checkout?.result?.type === 1 && paymentUrl;
  const isFree = checkout?.result?.type === -1;
  const isComplete = isFree || checkout?.status === 3;
  const isProcessing = checkout?.status === 1;
  const isTrafficReset = checkout?.period === 'reset_price';
  const [qrFailed, setQrFailed] = React.useState(false);
  const paymentAddress = paymentInfo.address;
  const paymentAmount = paymentInfo.amount && paymentInfo.amountType
    ? `${paymentInfo.amount} ${paymentInfo.amountType.toUpperCase()}`
    : checkout?.amount || '-';

  React.useEffect(() => {
    setQrFailed(false);
  }, [paymentUrl]);

  return (
    <section className="page-stack checkout-layout">
      <PageTitle
        eyebrow="Checkout"
        title={isComplete ? (isTrafficReset ? '流量已重置' : '订阅已生效') : '完成订单支付'}
        subtitle={isComplete ? (isTrafficReset ? '当前套餐流量已经恢复，可以继续使用。' : '套餐已经开通，可以复制订阅链接或导入客户端。') : '确认金额后完成支付，套餐会在到账后自动生效。'}
      />
      <div className="checkout-grid">
        <div className="panel payment-panel">
          <div className="qr-box">
            {isComplete ? (
              <Check size={108} />
            ) : isQr && !qrFailed ? (
              <img src={paymentUrl} alt="支付二维码" onError={() => setQrFailed(true)} />
            ) : (
              <div className="qr-fallback">
                <QrCode size={74} />
                <span>{isQr ? '二维码图片暂时无法显示' : '等待支付二维码'}</span>
              </div>
            )}
          </div>
          <div>
            <span className="muted">{paymentInfo.amountType ? '应转金额' : '应付金额'}</span>
            <h2>{paymentAmount}</h2>
            <p>订单：{checkout?.tradeNo || '尚未创建'}</p>
            <p>套餐：{checkout?.planName || '-'}</p>
            <p>支付方式：{checkout?.payment?.name || (isFree ? '免费订单' : '待配置')}</p>
            {checkout?.status !== undefined && <p>订单状态：{orderStatusLabel(checkout.status)}</p>}
          </div>
          {paymentAddress && !isComplete && (
            <div className="payment-address">
              <span>{paymentInfo.network ? `${paymentInfo.network.toUpperCase()} 收款地址` : '收款地址'}</span>
              <code>{paymentAddress}</code>
              <CopyButton className="secondary-button wide" text={paymentAddress} successText="已复制转账地址">
                <Copy size={18} />复制转账地址
              </CopyButton>
            </div>
          )}
          {isComplete && (
            <div className="checkout-actions">
              <button className="primary-button wide" onClick={onCopySubscribe}><Copy size={18} />复制订阅链接</button>
              <button className="secondary-button wide" onClick={onSetup}>导入客户端<ArrowRight size={18} /></button>
            </div>
          )}
          {isRedirect && <a className="primary-button wide" href={paymentUrl} target="_blank" rel="noreferrer">打开支付页面<ArrowRight size={18} /></a>}
          {isQr && qrFailed && paymentExternalUrl && (
            <a className="secondary-button wide" href={paymentExternalUrl} target="_blank" rel="noreferrer">
              打开二维码<ExternalLink size={18} />
            </a>
          )}
          {isQr && (
            <CopyButton className="primary-button wide" text={paymentCopyValue} successText="已复制二维码链接">
              <Copy size={18} />复制二维码链接
            </CopyButton>
          )}
          {checkout?.error && <div className="inline-error">{checkout.error}</div>}
        </div>
        <div className="panel">
          <PanelHeader icon={ReceiptText} title="订单状态" action="检查状态" onAction={onRefresh} />
          <div className="timeline">
            <Step done={Boolean(checkout?.tradeNo)} title="订单已创建" body={checkout?.periodLabel || '选择套餐周期'} />
            <Step done={Boolean(checkout?.result)} title={isComplete ? '支付已确认' : '支付请求已提交'} body={checkout?.payment?.name || checkout?.error || (isFree ? '免费订单' : '等待支付方式')} />
            <Step done={isComplete} title={isProcessing ? (isTrafficReset ? '流量重置中' : '套餐开通中') : (isTrafficReset ? '流量重置生效' : '套餐生效')} body={isComplete ? (isTrafficReset ? '已用流量已经清零。' : '订阅已经更新，可以开始使用。') : '到账确认后订阅会自动更新。'} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SetupPage({ subscribe, hasSubscription, onCopyProfile }: { subscribe: SubscribeInfo | null; hasSubscription: boolean; onCopyProfile: (flag?: string) => void }) {
  const [selectedClient, setSelectedClient] = React.useState(setupClients[0].flag);
  const guideRef = React.useRef<HTMLDivElement | null>(null);
  const activeClient = setupClients.find((client) => client.flag === selectedClient) || setupClients[0];

  function openGuide(flag: string) {
    setSelectedClient(flag);
    window.setTimeout(() => {
      guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  return (
    <section className="page-stack">
      <PageTitle eyebrow="One click setup" title="导入配置与使用教程" subtitle="选择设备对应客户端，复制配置链接后按步骤导入。" />
      <div className="client-grid">
        {setupClients.map(({ name, platform, flag, icon: Icon }) => (
          <article className={`client-card ${activeClient.flag === flag ? 'active' : ''}`} key={name}>
            <div className="client-icon"><Icon size={28} /></div>
            <h2>{name}</h2>
            <p>{platform}</p>
            <button className="secondary-button wide" onClick={() => openGuide(flag)}>
              查看教程<ChevronRight size={18} />
            </button>
            <button className="secondary-button wide" disabled={!hasSubscription || !subscribe?.subscribe_url} onClick={() => onCopyProfile(flag)}>
              复制配置链接<DownloadCloud size={18} />
            </button>
          </article>
        ))}
      </div>
      {(!hasSubscription || !subscribe?.subscribe_url) && <EmptyState text="当前账号还没有有效套餐，请先在套餐页完成开通。" />}
      <div className="panel guide-panel" ref={guideRef}>
        <PanelHeader icon={activeClient.icon} title={`${activeClient.name} 教程`} action={activeClient.platform} />
        <div className="guide-layout">
          <div className="guide-download">
            <strong>客户端下载</strong>
            <p>先安装客户端，再复制你的订阅配置链接。</p>
            <a className="primary-button wide" href={activeClient.downloadUrl} target="_blank" rel="noreferrer">
              打开下载页面<ExternalLink size={18} />
            </a>
            <button className="secondary-button wide" disabled={!hasSubscription || !subscribe?.subscribe_url} onClick={() => onCopyProfile(activeClient.flag)}>
              复制配置链接<Copy size={18} />
            </button>
          </div>
          <ol className="guide-steps">
            {activeClient.steps.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="guide-note">
          <strong>连接异常时</strong>
          <p>重新复制订阅链接并刷新配置；如果仍然不可用，切换其它在线节点后再试。</p>
        </div>
      </div>
    </section>
  );
}

function GiftCardRedeemPage({ telegramLink, onRedeem, onSetup }: { telegramLink: string; onRedeem: (code: string) => Promise<GiftCardRedeemResult>; onSetup: () => void }) {
  return (
    <section className="page-stack redeem-layout">
      <PageTitle eyebrow="Gift Card" title="兑换礼品卡" subtitle="没有兑换码时，先通过 Telegram 联系管理员获取。" />
      <div className="redeem-grid">
        <GiftCardRedeemPanel onRedeem={onRedeem} />
        <div className="panel redeem-side-panel">
          <ContactAdminPanel telegramLink={telegramLink} compact />
          <PanelHeader icon={PackageCheck} title="兑换后怎么用" action="自动生效" />
          <div className="timeline">
            <Step done={Boolean(telegramLink)} title="联系管理员" body="通过 Telegram 获取礼品卡兑换码，再回到当前页面输入。" />
            <Step done title="输入兑换码" body="兑换码只需要使用一次，请确认登录的是要开通套餐的账号。" />
            <Step done title="套餐开通" body="兑换成功后订阅状态会自动刷新，不需要再创建支付订单。" />
            <Step title="导入客户端" body="套餐生效后复制订阅链接，导入到你的常用客户端。" />
          </div>
          <button className="secondary-button wide" onClick={onSetup}>查看导入教程<ArrowRight size={18} /></button>
        </div>
      </div>
    </section>
  );
}

function ContactAdminPanel({ telegramLink, compact = false }: { telegramLink: string; compact?: boolean }) {
  const hasLink = isWebUrl(telegramLink);

  return (
    <div className={compact ? 'contact-admin compact' : 'panel contact-admin'}>
      <div className="contact-admin-icon"><MessageCircle size={22} /></div>
      <div>
        <strong>没有兑换码？</strong>
        <p>{hasLink ? '联系 Telegram 管理员购买或获取礼品卡兑换码。' : '请联系管理员购买或获取礼品卡兑换码。'}</p>
      </div>
      {hasLink ? (
        <a className="primary-button wide" href={telegramLink} target="_blank" rel="noreferrer">
          联系 Telegram<ExternalLink size={18} />
        </a>
      ) : (
        <button className="secondary-button wide" disabled>等待管理员配置联系方式</button>
      )}
    </div>
  );
}

function GiftCardRedeemPanel({ onRedeem, framed = true }: { onRedeem: (code: string) => Promise<GiftCardRedeemResult>; framed?: boolean }) {
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState<GiftCardRedeemResult | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.trim().replace(/\s+/g, '').toUpperCase();
    if (!normalizedCode) {
      setError('请输入礼品卡兑换码。');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess(null);
    try {
      const result = await onRedeem(normalizedCode);
      setCode('');
      setSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '兑换失败，请稍后再试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`${framed ? 'panel ' : ''}redeem-panel`} onSubmit={submit}>
      <div className="redeem-card-mark"><Gift size={34} /></div>
      <div>
        <h2>礼品卡兑换</h2>
        <p>把收到的兑换码输入到这里，成功后会直接开通或更新当前账号的套餐。</p>
      </div>
      <label className="redeem-code-field">
        兑换码
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="例如 NORTHLINE2026"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          minLength={8}
          maxLength={32}
          required
        />
      </label>
      {error && <div className="inline-error">{error}</div>}
      {success && (
        <div className="redeem-success">
          <Check size={18} />
          <div>
            <strong>{success.message || '兑换成功'}</strong>
            <p>{success.template_name ? `${success.template_name} 已应用到当前账号。` : '套餐状态已更新，可以复制订阅链接开始使用。'}</p>
          </div>
        </div>
      )}
      <button className="primary-button wide" disabled={busy}>
        {busy ? '兑换中...' : '立即兑换'}<ArrowRight size={18} />
      </button>
    </form>
  );
}

function AccountPage(props: {
  auth: AuthData | null;
  user: UserInfo | null;
  subscribe: SubscribeInfo | null;
  stats: [number, number, number];
  trafficLogs: TrafficLog[];
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onConnectionTest: () => Promise<void>;
  onLogout: () => void;
  onResetSecurity: () => void;
  onPayOrder: (order: OrderRecord) => Promise<void>;
  onRedeemGiftCard: (code: string) => Promise<GiftCardRedeemResult>;
  telegramLink: string;
  entryView: AccountView;
}) {
  const [view, setView] = React.useState<AccountView>(props.entryView);
  const [orders, setOrders] = React.useState<OrderRecord[] | null>(null);
  const [invite, setInvite] = React.useState<InviteInfo | null>(null);
  const [tickets, setTickets] = React.useState<TicketRecord[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const token = props.auth?.auth_data || '';

  React.useEffect(() => {
    setView(props.entryView);
    setError('');

    if (!token) {
      return;
    }

    if (props.entryView === 'orders') {
      withBusy(async () => setOrders(await api.orders(token)));
    }

    if (props.entryView === 'tickets') {
      withBusy(async () => setTickets(await api.tickets(token)));
    }

    if (props.entryView === 'invite') {
      withBusy(async () => setInvite(await api.invite(token)));
    }
  }, [props.entryView, token]);

  if (!props.auth) {
    return (
      <section className="page-stack">
        <LoginPanel onLogin={props.onLogin} onRegister={props.onRegister} onConnectionTest={props.onConnectionTest} />
      </section>
    );
  }

  async function withBusy(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setBusy(false);
    }
  }

  function showOverview() {
    setView('overview');
    setError('');
  }

  function showSecurity() {
    setView('security');
    setError('');
  }

  function showResetSecurity() {
    setView('security');
    setError('');
  }

  function showWallet() {
    setView('wallet');
    setError('');
  }

  function showRedeem() {
    setView('redeem');
    setError('');
  }

  function showOrders() {
    setView('orders');
    withBusy(async () => setOrders(await api.orders(token)));
  }

  function showTickets() {
    setView('tickets');
    withBusy(async () => setTickets(await api.tickets(token)));
  }

  function showInvite() {
    setView('invite');
    withBusy(async () => setInvite(await api.invite(token)));
  }

  function createInviteCode() {
    withBusy(async () => {
      await api.createInviteCode(token);
      setInvite(await api.invite(token));
    });
  }

  async function createTicket(subject: string, message: string, level: number) {
    await withBusy(async () => {
      await api.createTicket(token, subject, message, level);
      setTickets(await api.tickets(token));
    });
  }

  return (
    <section className="page-stack">
      <div className="account-shell">
        <div className="account-profile">
          <div className="avatar-large">{initials(props.user?.email || 'zz')}</div>
          <div>
            <h1>{props.user?.email || '已登录用户'}</h1>
            <p>账号创建于 {formatDate(props.user?.created_at)}</p>
          </div>
          <button className="danger-button" onClick={props.onLogout}><LogOut size={18} />退出登录</button>
        </div>
        <div className="account-layout">
          <aside className="account-sidebar">
            <div className="account-shortcuts">
              <button className={view === 'orders' ? 'active' : ''} onClick={showOrders}>
                <span><ReceiptText size={22} /></span>
                订单
              </button>
              <button className={view === 'tickets' ? 'active' : ''} onClick={showTickets}>
                <span><TicketCheck size={22} /></span>
                工单
              </button>
              <button className={view === 'wallet' ? 'active' : ''} onClick={showWallet}>
                <span><WalletCards size={22} /></span>
                钱包
              </button>
              <button className={view === 'redeem' ? 'active' : ''} onClick={showRedeem}>
                <span><Gift size={22} /></span>
                兑换
              </button>
            </div>
            <div className="account-menu">
              <button className={view === 'overview' ? 'active' : ''} onClick={showOverview}>
                <PackageCheck size={19} />订阅概览
              </button>
              <button className={view === 'security' ? 'active' : ''} onClick={showResetSecurity}>
                <ShieldCheck size={19} />重置订阅信息
              </button>
              <button className={view === 'security' ? 'active' : ''} onClick={showSecurity}>
                <KeyRound size={19} />修改账号安全
              </button>
              <button className={view === 'redeem' ? 'active' : ''} onClick={showRedeem}>
                <Gift size={19} />礼品卡兑换
              </button>
              <div className="account-menu-title">增长与协议</div>
              <button className={view === 'invite' ? 'active' : ''} onClick={showInvite}>
                <CircleDollarSign size={19} />邀请与返佣
              </button>
              <button className={view === 'tickets' ? 'active' : ''} onClick={showTickets}>
                <MessageCircle size={19} />工单支持
              </button>
            </div>
          </aside>
          <AccountDetailPanel
            view={view}
            user={props.user}
            subscribe={props.subscribe}
            orders={orders}
            invite={invite}
            tickets={tickets}
            trafficLogs={props.trafficLogs}
            busy={busy}
            error={error}
            onOrders={showOrders}
            onOverview={showOverview}
            onSecurity={showSecurity}
            onInvite={showInvite}
            onTickets={showTickets}
            onCreateInvite={createInviteCode}
            onCreateTicket={createTicket}
            onResetSecurity={props.onResetSecurity}
            onPayOrder={props.onPayOrder}
            onRedeemGiftCard={props.onRedeemGiftCard}
            telegramLink={props.telegramLink}
          />
        </div>
      </div>
    </section>
  );
}

function AccountDetailPanel({
  view,
  user,
  subscribe,
  orders,
  invite,
  tickets,
  trafficLogs,
  busy,
  error,
  onOrders,
  onOverview,
  onSecurity,
  onInvite,
  onTickets,
  onCreateInvite,
  onCreateTicket,
  onResetSecurity,
  onPayOrder,
  onRedeemGiftCard,
  telegramLink
}: {
  view: AccountView;
  user: UserInfo | null;
  subscribe: SubscribeInfo | null;
  orders: OrderRecord[] | null;
  invite: InviteInfo | null;
  tickets: TicketRecord[] | null;
  trafficLogs: TrafficLog[];
  busy: boolean;
  error: string;
  onOrders: () => void;
  onOverview: () => void;
  onSecurity: () => void;
  onInvite: () => void;
  onTickets: () => void;
  onCreateInvite: () => void;
  onCreateTicket: (subject: string, message: string, level: number) => Promise<void>;
  onResetSecurity: () => void;
  onPayOrder: (order: OrderRecord) => Promise<void>;
  onRedeemGiftCard: (code: string) => Promise<GiftCardRedeemResult>;
  telegramLink: string;
}) {
  const [payingTradeNo, setPayingTradeNo] = React.useState<string | null>(null);
  const [ticketSubject, setTicketSubject] = React.useState('');
  const [ticketMessage, setTicketMessage] = React.useState('');
  const [ticketLevel, setTicketLevel] = React.useState(0);
  const [ticketFormError, setTicketFormError] = React.useState('');
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  async function continuePayment(order: OrderRecord) {
    setPayingTradeNo(order.trade_no);
    try {
      await onPayOrder(order);
    } finally {
      setPayingTradeNo(null);
    }
  }

  function confirmResetSecurity() {
    setShowResetConfirm(true);
  }

  async function submitTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = ticketSubject.trim();
    const message = ticketMessage.trim();
    if (!subject || !message) {
      setTicketFormError('请填写工单主题和问题描述。');
      return;
    }
    setTicketFormError('');
    await onCreateTicket(subject, message, ticketLevel);
    setTicketSubject('');
    setTicketMessage('');
    setTicketLevel(0);
  }

  const panelCopy: Record<AccountView, { icon: React.ElementType; title: string; subtitle: string }> = {
    overview: { icon: PackageCheck, title: '订阅概览', subtitle: '查看套餐、流量、到期和本月使用情况' },
    security: { icon: KeyRound, title: '账号安全', subtitle: '管理订阅链接和账号安全设置' },
    orders: { icon: ReceiptText, title: '我的订单', subtitle: '查看订单状态，继续处理未支付订单' },
    tickets: { icon: TicketCheck, title: '工单中心', subtitle: '创建工单并管理你的支持请求' },
    invite: { icon: CircleDollarSign, title: '邀请与返佣', subtitle: '查看邀请数据，生成邀请码' },
    wallet: { icon: WalletCards, title: '我的钱包', subtitle: '一览账户余额与邀请佣金' },
    redeem: { icon: Gift, title: '礼品卡兑换', subtitle: '输入管理员发放的兑换码，自动开通套餐' }
  };
  const ActiveIcon = panelCopy[view].icon;
  const hasSubscription = hasActiveSubscription(subscribe, user);
  const subscriptionName = hasSubscription
    ? subscribe?.plan?.name || (user?.plan_id ? `套餐 ${user.plan_id}` : '已开通套餐')
    : '暂无套餐';
  const subscriptionExpireText = hasSubscription ? formatDate(subscribe?.expired_at || user?.expired_at) : '未开通';

  return (
    <div className="panel account-detail">
      {showResetConfirm && (
        <div className="notice-backdrop" role="dialog" aria-modal="true" aria-labelledby="reset-security-title">
          <div className="notice-dialog">
            <div className="notice-icon"><ShieldCheck size={24} /></div>
            <div>
              <h2 id="reset-security-title">确认重置订阅链接</h2>
              <p>重置后旧链接会立即失效，所有客户端都需要重新复制 Clash 订阅链接并导入。</p>
            </div>
            <div className="notice-actions">
              <button className="secondary-button" onClick={() => setShowResetConfirm(false)}>取消</button>
              <button
                className="primary-button"
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetSecurity();
                }}
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="account-detail-head">
        <div>
          <ActiveIcon size={24} />
          <div>
            <h2>{panelCopy[view].title}</h2>
            <p>{panelCopy[view].subtitle}</p>
          </div>
        </div>
        {view !== 'overview' && (
          <button className="icon-button" onClick={onOverview} aria-label="返回概览"><X size={20} /></button>
        )}
      </div>

      {error && <div className="inline-error">{error}</div>}
      {busy && <EmptyState text="正在读取账户数据..." />}

      {!busy && view === 'overview' && (
        <div className="account-overview-grid">
          <div className="subscription-mini">
            <strong>{subscriptionName}</strong>
            <p>到期时间 {subscriptionExpireText}</p>
            <div className="usage-meter">
              <span style={{ width: `${Math.min(1, ((subscribe?.u || 0) + (subscribe?.d || 0)) / Math.max(1, subscribe?.transfer_enable || user?.transfer_enable || 1)) * 100}%` }} />
            </div>
          </div>
          <Metric label="已用流量" value={formatBytes((subscribe?.u || 0) + (subscribe?.d || 0))} />
          <Metric label="总流量" value={formatBytes(subscribe?.transfer_enable || user?.transfer_enable)} />
          <Metric label="设备限制" value={subscribe?.device_limit ? `${subscribe.device_limit} 台` : '未限制'} />
          <Metric label="速度限制" value={subscribe?.speed_limit ? `${subscribe.speed_limit} Mbps` : '未限制'} />
          <Metric label="流量记录" value={`${trafficLogs.length} 条`} />
        </div>
      )}

      {!busy && view === 'wallet' && (
        <div className="wallet-panel">
          <div>
            <span>余额</span>
            <strong>{formatAccountMoney(user?.balance)}</strong>
          </div>
          <div>
            <span>邀请佣金</span>
            <strong>{formatAccountMoney(user?.commission_balance)}</strong>
          </div>
          <p>余额可用于后续套餐购买；邀请佣金会根据后台配置发放。</p>
        </div>
      )}

      {!busy && view === 'redeem' && (
        <div className="account-redeem-stack">
          <ContactAdminPanel telegramLink={telegramLink} compact />
          <GiftCardRedeemPanel onRedeem={onRedeemGiftCard} framed={false} />
        </div>
      )}

      {!busy && view === 'security' && (
        <div className="record-list">
          <div className="record-row">
            <div>
              <strong>订阅链接</strong>
              <p>重置后旧链接会立即失效，客户端需要重新导入。</p>
            </div>
            <button className="secondary-button" onClick={confirmResetSecurity}>重置链接</button>
          </div>
          <div className="record-row muted-row">
            <div>
              <strong>密码与邮箱验证</strong>
              <p>Xboard 已有 changePassword 和邮箱验证相关接口，后面可以单独做成完整表单。</p>
            </div>
          </div>
        </div>
      )}

      {!busy && view === 'orders' && (
        <div className="record-list">
          {(orders || []).slice(0, 8).map((order) => (
            <div
              className={`record-row ${isPendingOrder(order.status) ? 'payable-row' : ''}`}
              key={order.id || order.trade_no}
              role={isPendingOrder(order.status) ? 'button' : undefined}
              tabIndex={isPendingOrder(order.status) ? 0 : undefined}
              onClick={isPendingOrder(order.status) ? () => continuePayment(order) : undefined}
              onKeyDown={(event) => {
                if (isPendingOrder(order.status) && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  continuePayment(order);
                }
              }}
            >
              <div>
                <strong>{order.plan?.name || `订单 ${order.trade_no}`}</strong>
                <p>{formatDate(order.created_at)} · {periodName(order.period)} · {orderStatusLabel(order.status)}</p>
              </div>
              <div className="record-actions">
                <span>{formatMoney(order.total_amount)}</span>
                {isPendingOrder(order.status) && (
                  <button
                    className="secondary-button compact"
                    disabled={payingTradeNo === order.trade_no}
                    onClick={(event) => {
                      event.stopPropagation();
                      continuePayment(order);
                    }}
                  >
                    {payingTradeNo === order.trade_no ? '加载中' : '继续支付'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {orders && !orders.length && <EmptyState text="暂无订单记录。" />}
          {!orders && <button className="secondary-button wide" onClick={onOrders}>读取订单记录</button>}
        </div>
      )}

      {!busy && view === 'tickets' && (
        <div className="record-list">
          <form className="ticket-form" onSubmit={submitTicket}>
            <div className="ticket-form-head">
              <strong>新建工单</strong>
              <select value={ticketLevel} onChange={(event) => setTicketLevel(Number(event.target.value))}>
                <option value={0}>普通问题</option>
                <option value={1}>较急问题</option>
                <option value={2}>紧急问题</option>
              </select>
            </div>
            <input
              value={ticketSubject}
              onChange={(event) => setTicketSubject(event.target.value)}
              placeholder="工单主题，例如：节点无法连接"
              maxLength={80}
            />
            <textarea
              value={ticketMessage}
              onChange={(event) => setTicketMessage(event.target.value)}
              placeholder="请描述你的问题、客户端、节点名称和报错现象。"
              rows={4}
            />
            {ticketFormError && <div className="inline-error">{ticketFormError}</div>}
            <button className="primary-button wide" disabled={busy}>提交工单</button>
          </form>
          {(tickets || []).slice(0, 8).map((ticket) => (
            <div className="record-row" key={ticket.id}>
              <div>
                <strong>{ticket.subject}</strong>
                <p>{formatDate(ticket.created_at)} · {ticket.status ? '已关闭' : '处理中'}</p>
              </div>
              <span>#{ticket.id}</span>
            </div>
          ))}
          {tickets && !tickets.length && <EmptyState text="暂无工单记录。" />}
          {!tickets && <button className="secondary-button wide" onClick={onTickets}>读取工单记录</button>}
        </div>
      )}

      {!busy && view === 'invite' && (
        <div className="record-list">
          <div className="detail-grid compact">
            <Metric label="注册用户" value={String(invite?.stat?.[0] ?? 0)} />
            <Metric label="确认佣金" value={formatMoney(invite?.stat?.[1] ?? 0)} />
            <Metric label="待确认" value={formatMoney(invite?.stat?.[2] ?? 0)} />
            <Metric label="佣金比例" value={`${invite?.stat?.[3] ?? 0}%`} />
          </div>
          {(invite?.codes || []).map((item) => (
            <div className="record-row" key={item.code}>
              <div>
                <strong>{item.code}</strong>
                <p>{formatDate(item.created_at)} · 访问 {item.pv || 0} 次</p>
              </div>
              <button className="secondary-button" onClick={() => copyText(item.code)}>复制</button>
            </div>
          ))}
          {invite && !(invite.codes || []).length && <EmptyState text="暂无邀请码，可以立即生成一个。" />}
          <button className="secondary-button wide" onClick={invite ? onCreateInvite : onInvite}>{invite ? '生成邀请码' : '读取邀请数据'}</button>
        </div>
      )}
    </div>
  );
}

function LoginPanel({
  onLogin,
  onRegister,
  onConnectionTest
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onConnectionTest: () => Promise<void>;
}) {
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [error, setError] = React.useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('两次输入的密码不一致');
        }
        await onRegister(email, password);
        return;
      }
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'register' ? '注册失败' : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError('');
    try {
      await onConnectionTest();
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接测试失败');
    } finally {
      setTesting(false);
    }
  }

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode);
    setError('');
    setConfirmPassword('');
  }

  return (
    <div className="login-shell">
      <div className="login-copy">
        <span className="eyebrow light"><BadgeCheck size={17} /> 安全访问</span>
        <h1>{mode === 'register' ? '创建账号' : '欢迎回来'}</h1>
        <p>{mode === 'register' ? '创建账号后可购买套餐、导入配置并管理订阅。' : '登录后即可查看订阅、复制配置、续费套餐和管理账号安全。'}</p>
      </div>
      <form className="login-card" onSubmit={submit}>
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>登录</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>注册</button>
        </div>
        <label>
          邮箱
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" required />
        </label>
        <label>
          密码
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} placeholder="至少 8 位" required />
        </label>
        {mode === 'register' && (
          <label>
            确认密码
            <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" minLength={8} placeholder="再次输入密码" required />
          </label>
        )}
        {error && <div className="inline-error">{error}</div>}
        <button className="primary-button wide" disabled={busy}>{busy ? (mode === 'register' ? '注册中...' : '登录中...') : (mode === 'register' ? '创建账号' : '登录')}</button>
        {import.meta.env.DEV && (
          <button type="button" className="secondary-button wide" disabled={testing} onClick={testConnection}>
            {testing ? '测试中...' : '测试连接'}
          </button>
        )}
      </form>
    </div>
  );
}

function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="page-title">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, action, onAction }: { icon: React.ElementType; title: string; action: string; onAction?: () => void }) {
  return (
    <div className="panel-header">
      <div><Icon size={20} /><strong>{title}</strong></div>
      {onAction ? <button onClick={onAction}>{action}<ChevronRight size={17} /></button> : <span className="panel-meta">{action}</span>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionCard({ icon: Icon, title, body, onClick }: { icon: React.ElementType; title: string; body: string; onClick: () => void }) {
  return (
    <button className="action-card" onClick={onClick}>
      <span className="action-icon"><Icon size={23} /></span>
      <strong>{title}<ChevronRight size={17} /></strong>
      <p>{body}</p>
    </button>
  );
}

function Step({ done, title, body }: { done?: boolean; title: string; body: string }) {
  return (
    <div className={`step ${done ? 'done' : ''}`}>
      <span>{done ? <Check size={16} /> : null}</span>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}

function ActionLine({ icon: Icon, title, onClick }: { icon: React.ElementType; title: string; onClick?: () => void }) {
  return (
    <button className="action-line" onClick={onClick}>
      <Icon size={19} />
      <span>{title}</span>
      <ChevronRight size={17} />
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function CopyButton({
  text,
  successText,
  className,
  children
}: {
  text: string;
  successText: string;
  className: string;
  children: React.ReactNode;
}) {
  const [feedback, setFeedback] = React.useState('');

  async function handleCopy() {
    try {
      await copyText(text);
      setFeedback(successText);
      window.setTimeout(() => setFeedback(''), 1800);
    } catch {
      setFeedback('复制失败，请手动复制');
      window.setTimeout(() => setFeedback(''), 2200);
    }
  }

  return (
    <div className="copy-action">
      <button className={className} onClick={handleCopy}>{children}</button>
      {feedback && <span>{feedback}</span>}
    </div>
  );
}

function orderStatusLabel(status?: number) {
  switch (Number(status)) {
    case 0:
      return '待支付';
    case 1:
      return '开通中';
    case 2:
      return '已取消';
    case 3:
      return '已完成';
    case 4:
      return '已折抵';
    default:
      return '待确认';
  }
}

function isPendingOrder(status?: number) {
  return Number(status) === 0;
}

function isOrderBlockingMessage(text: string) {
  return /unpaid|pending|待支付|未付款|开通中|订单/.test(text);
}

function periodName(period?: PeriodKey | string) {
  return periods.find((item) => item.key === period)?.label || '周期';
}

function pageFromHash(): Page {
  const value = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  switch (value) {
    case 'plans':
    case 'shop':
      return 'plans';
    case 'redeem':
    case 'gift-card':
    case 'giftcard':
      return 'redeem';
    case 'checkout':
    case 'order':
      return 'checkout';
    case 'setup':
    case 'import':
      return 'setup';
    case 'account':
    case 'login':
    case 'register':
    case 'user-center':
      return 'account';
    case 'home':
    case 'dashboard':
    default:
      return 'home';
  }
}

function hashForPage(page: Page) {
  const map: Record<Page, string> = {
    home: '#/home',
    plans: '#/plans',
    redeem: '#/redeem',
    checkout: '#/checkout',
    setup: '#/setup',
    account: '#/account'
  };
  return map[page];
}

function loadAuth(): AuthData | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) as AuthData : null;
  } catch {
    return null;
  }
}

function saveAuth(auth: AuthData | null) {
  if (auth) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

function bestPeriod(plan: Plan) {
  return purchasePeriods(plan)[0];
}

function purchasePeriods(plan: Plan) {
  return periods.filter((period) => customerPeriodKeys.includes(period.key) && plan[period.key] !== null && plan[period.key] !== undefined);
}

function purchasePeriod(plan: Plan, selectedPeriod?: PeriodKey) {
  return purchasePeriods(plan).find((period) => period.key === selectedPeriod) || bestPeriod(plan);
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return '-';
  if (value <= 0) return '免费';
  const amount = value / 100;
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function formatAccountMoney(value?: number | null) {
  if (value === null || value === undefined) return '-';
  const amount = Math.max(0, value) / 100;
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function formatMonthlyMoney(value?: number | null, months = 1) {
  if (value === null || value === undefined) return '-';
  if (value <= 0) return '免费';
  const amount = value / 100 / Math.max(1, months);
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function formatBytes(bytes?: number | null) {
  const value = Math.max(0, bytes || 0);
  if (value >= 1024 ** 4) return `${(value / 1024 ** 4).toFixed(2)} TB`;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${value} B`;
}

function formatDate(timestamp?: number | null) {
  if (!timestamp) return '长期有效';
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function hasActiveSubscription(subscribe?: SubscribeInfo | null, user?: UserInfo | null) {
  const planId = subscribe?.plan_id || user?.plan_id;
  const transferEnable = subscribe?.transfer_enable || user?.transfer_enable || 0;
  const expiredAt = subscribe?.expired_at ?? user?.expired_at;
  const isNotExpired = expiredAt === null || expiredAt === undefined || expiredAt > Math.floor(Date.now() / 1000);

  return Boolean(planId && transferEnable > 0 && isNotExpired);
}

function initials(email: string) {
  return email.slice(0, 2).toLowerCase();
}

function planFeatures(plan: Plan) {
  const fromContent = (plan.content || '')
    .split('\n')
    .map((line) => line.replace(/^[-#*\s]+/, '').trim())
    .filter((line) => line && !line.includes('套餐详情') && !line.includes('服务说明'))
    .slice(0, 4);

  if (fromContent.length) return fromContent;

  return [
    `${plan.transfer_enable} GB 可用流量`,
    plan.speed_limit ? `${plan.speed_limit} Mbps 速率` : '不限速率',
    plan.device_limit ? `${plan.device_limit} 台设备` : '不限设备',
    '自动重置与续费'
  ];
}

function pickPaymentMethod(methods: PaymentMethod[]) {
  return methods.find((method) => /usdt|coin|btc|crypto|trc/i.test(`${method.name} ${method.payment}`)) || methods[0];
}

function paymentData(data: unknown) {
  if (typeof data === 'string') {
    return { url: data, qrcode: data, qrcodeUrl: data, address: '', network: '', amount: '', amountType: '' };
  }

  if (!data || typeof data !== 'object') {
    return { url: '', qrcode: '', qrcodeUrl: '', address: '', network: '', amount: '', amountType: '' };
  }

  const record = data as Record<string, unknown>;
  return {
    url: stringValue(record.url || record.pay_url || record.payment_url || record.qrcode),
    qrcode: stringValue(record.qrcode || record.qr_code || record.url),
    qrcodeUrl: stringValue(record.qrcode_url || record.qr_code_url || record.url || record.qrcode),
    address: stringValue(record.address || record.to_address),
    network: stringValue(record.network),
    amount: stringValue(record.amount || record.actual_amount),
    amountType: stringValue(record.amount_type || record.currency || record.coin)
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isWebUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function withQuery(url: string, key: string, value: string) {
  const target = new URL(url, window.location.origin);
  target.searchParams.set(key, value);
  return target.toString();
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

createRoot(document.getElementById('root')!).render(<App />);
