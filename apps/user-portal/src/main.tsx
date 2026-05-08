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
  CreditCard,
  DownloadCloud,
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
  Zap
} from 'lucide-react';
import { api, type AuthData, type CheckoutResponse, type InviteInfo, type OrderRecord, type PaymentMethod, type PeriodKey, type Plan, type ServerNode, type SubscribeInfo, type TicketRecord, type TrafficLog, type UserInfo } from './api';
import './styles.css';

type Page = 'home' | 'plans' | 'checkout' | 'setup' | 'account';

type CheckoutState = {
  tradeNo?: string;
  planName?: string;
  amount?: string;
  periodLabel?: string;
  payment?: PaymentMethod;
  result?: CheckoutResponse;
  status?: number;
  error?: string;
};

type AccountView = 'overview' | 'security' | 'orders' | 'tickets' | 'invite';

const AUTH_KEY = 'northline.auth';

const periods: Array<{ key: PeriodKey; label: string; months?: number }> = [
  { key: 'month_price', label: '月付', months: 1 },
  { key: 'quarter_price', label: '季付', months: 3 },
  { key: 'half_year_price', label: '半年付', months: 6 },
  { key: 'year_price', label: '年付', months: 12 },
  { key: 'two_year_price', label: '两年付', months: 24 },
  { key: 'three_year_price', label: '三年付', months: 36 },
  { key: 'onetime_price', label: '一次性' },
  { key: 'reset_price', label: '流量重置' }
];

const setupClients = [
  { name: 'Clash Verge', platform: 'macOS / Windows', flag: 'clash', icon: Laptop },
  { name: 'Shadowrocket', platform: 'iOS', flag: 'shadowrocket', icon: Smartphone },
  { name: 'Stash', platform: 'iOS / macOS', flag: 'stash', icon: ShieldCheck },
  { name: 'Sing-box', platform: 'Universal core', flag: 'sing-box', icon: RadioTower }
];

function App() {
  const [page, setPage] = React.useState<Page>(() => pageFromHash());
  const [auth, setAuth] = React.useState<AuthData | null>(() => loadAuth());
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [subscribe, setSubscribe] = React.useState<SubscribeInfo | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [servers, setServers] = React.useState<ServerNode[]>([]);
  const [trafficLogs, setTrafficLogs] = React.useState<TrafficLog[]>([]);
  const [stats, setStats] = React.useState<[number, number, number]>([0, 0, 0]);
  const [message, setMessage] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [busyPlanId, setBusyPlanId] = React.useState<number | null>(null);
  const [checkout, setCheckout] = React.useState<CheckoutState | null>(null);

  const isLoggedIn = Boolean(auth?.auth_data);
  const subscriptionUrl = subscribe?.subscribe_url || '';
  const usedBytes = (subscribe?.u || 0) + (subscribe?.d || 0);
  const totalBytes = subscribe?.transfer_enable || user?.transfer_enable || 0;
  const progress = totalBytes > 0 ? Math.min(1, usedBytes / totalBytes) : 0;

  const go = React.useCallback((nextPage: Page) => {
    setPage(nextPage);
    const nextHash = hashForPage(nextPage);
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash);
    }
  }, []);

  const refresh = React.useCallback(async (currentAuth = auth) => {
    setLoading(true);
    setMessage('');
    try {
      if (!currentAuth?.auth_data) {
        const guestPlans = await api.guestPlans();
        setPlans(guestPlans);
        setUser(null);
        setSubscribe(null);
        setServers([]);
        setTrafficLogs([]);
        setStats([0, 0, 0]);
        return;
      }

      const [info, sub, userPlans, nodeList, stat, logs] = await Promise.all([
        api.userInfo(currentAuth.auth_data),
        api.subscribe(currentAuth.auth_data),
        api.userPlans(currentAuth.auth_data),
        api.servers(currentAuth.auth_data),
        api.stats(currentAuth.auth_data),
        api.trafficLogs(currentAuth.auth_data)
      ]);

      setUser(info);
      setSubscribe(sub);
      setPlans(userPlans);
      setServers(nodeList);
      setStats(stat);
      setTrafficLogs(logs);
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

  async function handleLogin(email: string, password: string) {
    const nextAuth = await api.login(email, password);
    saveAuth(nextAuth);
    setAuth(nextAuth);
    go('home');
    await refresh(nextAuth);
  }

  async function handleRegister(email: string, password: string) {
    const nextAuth = await api.register(email, password);
    saveAuth(nextAuth);
    setAuth(nextAuth);
    go('home');
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
    go('account');
    refresh(null);
  }

  async function copySubscribe(flag?: string) {
    if (!subscriptionUrl) {
      setMessage('请先登录，登录后才能复制你的专属订阅链接。');
      go('account');
      return;
    }
    const url = flag ? withQuery(subscriptionUrl, 'flag', flag) : subscriptionUrl;
    await copyText(url);
    setMessage(flag ? `已复制 ${flag} 订阅链接` : '已复制订阅链接');
  }

  async function resetSecurity() {
    if (!auth?.auth_data) return;
    const url = await api.resetSecurity(auth.auth_data);
    await refresh(auth);
    await copyText(url);
    setMessage('订阅链接已重置，并复制到剪贴板。旧链接会失效。');
  }

  async function startCheckout(plan: Plan) {
    if (!auth?.auth_data) {
      setMessage('请先登录后继续。');
      go('account');
      return;
    }

    const period = bestPeriod(plan);
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
            error: '暂未启用可用支付方式，请稍后再试。'
          });
          go('checkout');
          return;
        }
      }

      result = await api.checkoutOrder(auth.auth_data, tradeNo, payment?.id);
      setCheckout({ tradeNo, planName: plan.name, amount, periodLabel: period.label, payment, result, status: result.type === -1 ? 3 : 0 });
      go('checkout');
      await refresh(auth);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建订单失败');
    } finally {
      setBusyPlanId(null);
    }
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
          <NavButton active={page === 'setup'} icon={DownloadCloud} label="导入" onClick={() => go('setup')} />
          <NavButton active={page === 'account'} icon={UserRound} label="我的" onClick={() => go('account')} />
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="notifications"><Bell size={19} /></button>
          <button className="profile-button" onClick={() => go('account')}>
            <span>{user ? initials(user.email) : '登录'}</span>
          </button>
        </div>
      </header>

      {message && <div className="toast">{message}</div>}

      <main className="content">
        {page === 'home' && (
          <HomePage
            loading={loading}
            isLoggedIn={isLoggedIn}
            user={user}
            subscribe={subscribe}
            plans={plans}
            servers={servers}
            progress={progress}
            usedBytes={usedBytes}
            totalBytes={totalBytes}
            onPlan={() => go('plans')}
            onCheckout={() => plans[0] ? startCheckout(plans[0]) : go('plans')}
            onSetup={() => go(isLoggedIn ? 'setup' : 'account')}
            onCopySubscribe={() => copySubscribe()}
          />
        )}
        {page === 'plans' && <PlansPage plans={plans} loading={loading} busyPlanId={busyPlanId} onCheckout={startCheckout} />}
        {page === 'checkout' && (
          <CheckoutPage
            checkout={checkout}
            onRefresh={refreshCheckoutStatus}
            onSetup={() => go('setup')}
            onCopySubscribe={() => copySubscribe()}
          />
        )}
        {page === 'setup' && <SetupPage subscribe={subscribe} onCopyProfile={copySubscribe} />}
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
          />
        )}
      </main>
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
  user: UserInfo | null;
  subscribe: SubscribeInfo | null;
  plans: Plan[];
  servers: ServerNode[];
  progress: number;
  usedBytes: number;
  totalBytes: number;
  onPlan: () => void;
  onCheckout: () => void;
  onSetup: () => void;
  onCopySubscribe: () => void;
}) {
  const planName = props.subscribe?.plan?.name || props.plans[0]?.name || '未选择套餐';
  const remaining = Math.max(0, props.totalBytes - props.usedBytes);
  const onlineNodes = props.servers.filter((server) => server.is_online).length;

  return (
    <section className="page-stack">
      <div className="hero-grid">
        <div className="hero-panel">
          <div className="eyebrow"><BadgeCheck size={17} /> {props.isLoggedIn ? `${planName} active` : 'Member access'}</div>
          <h1>{props.isLoggedIn ? '你的网络会员中心' : '欢迎回来'}</h1>
          <p>{props.isLoggedIn ? '一键导入客户端，查看剩余流量，管理套餐续费。所有复杂配置都已经替你收好。' : '登录后管理订阅、复制配置、查看流量，并继续完成未支付订单。'}</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={props.onCopySubscribe}><Copy size={18} />复制订阅链接</button>
            <button className="secondary-button" onClick={props.onPlan}>查看套餐<ArrowRight size={18} /></button>
          </div>
        </div>
        <div className="status-card">
          <div className="status-top">
            <div>
              <span className="muted">{props.isLoggedIn ? '剩余流量' : '当前状态'}</span>
              <strong>{props.isLoggedIn ? formatBytes(remaining) : props.loading ? '加载中' : '待登录'}</strong>
            </div>
            <span className="live-pill">{props.isLoggedIn ? `${onlineNodes}/${props.servers.length} 节点在线` : '安全连接'}</span>
          </div>
          <div className="usage-meter">
            <span style={{ width: `${props.progress * 100}%` }} />
          </div>
          <div className="usage-stats">
            <Metric label="本月已用" value={props.isLoggedIn ? formatBytes(props.usedBytes) : '登录后显示'} />
            <Metric label="套餐总量" value={props.isLoggedIn ? formatBytes(props.totalBytes) : `${props.plans.length} 个套餐`} />
            <Metric label="到期时间" value={formatDate(props.subscribe?.expired_at)} />
          </div>
        </div>
      </div>

      <div className="quick-grid">
        <ActionCard icon={Zap} title="快速导入" body="Clash Verge、Shadowrocket、Stash 一键复制配置。" onClick={props.onSetup} />
        <ActionCard icon={CreditCard} title="USDT 支付" body="选择套餐后进入安全收银台。" onClick={props.onCheckout} />
        <ActionCard icon={RefreshCcw} title="套餐续费" body="按需续费或购买流量重置包。" onClick={props.onPlan} />
      </div>

      <div className="section-grid">
        <div className="panel">
          <PanelHeader icon={Globe2} title="线路概览" action="实时节点" />
          <div className="route-list">
            {(props.servers.length ? props.servers : []).slice(0, 4).map((server, index) => (
              <div className="route-row" key={server.id}>
                <span className={`dot ${server.is_online ? `dot-${index % 3}` : 'dot-offline'}`} />
                <div>
                  <strong>{server.name}</strong>
                  <p>{server.type} / {server.is_online ? 'online' : 'offline'}</p>
                </div>
                <ChevronRight size={18} />
              </div>
            ))}
            {!props.servers.length && <EmptyState text={props.isLoggedIn ? '当前套餐暂无可用节点。' : '登录后显示你的可用节点。'} />}
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={MessageCircle} title="帮助与公告" action="进入帮助" />
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

function PlansPage({ plans, loading, busyPlanId, onCheckout }: { plans: Plan[]; loading: boolean; busyPlanId: number | null; onCheckout: (plan: Plan) => void }) {
  return (
    <section className="page-stack">
      <PageTitle eyebrow="Choose plan" title="选择适合你的套餐" subtitle="清晰展示权益，按需购买或续费。" />
      <div className="plans-grid">
        {plans.map((plan, index) => {
          const period = bestPeriod(plan);
          const disabled = !period || plan.sell === false || busyPlanId === plan.id;
          return (
            <article className={`plan-card ${index === 1 ? 'primary' : index === 2 ? 'gold' : 'calm'}`} key={plan.id}>
              <span className="plan-badge">{plan.tags?.[0] || (plan.sell === false ? '暂不可售' : 'Available')}</span>
              <h2>{plan.name}</h2>
              <p className="plan-data">{plan.transfer_enable} GB monthly data</p>
              <div className="price-row"><strong>{period ? formatMoney(plan[period.key]) : '-'}</strong><span>{period ? `/${period.label}` : ''}</span></div>
              <button className={index === 1 ? 'primary-button wide' : 'secondary-button wide'} disabled={disabled} onClick={() => onCheckout(plan)}>
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
  const isQr = checkout?.result?.type === 0 && paymentUrl;
  const isRedirect = checkout?.result?.type === 1 && paymentUrl;
  const isFree = checkout?.result?.type === -1;
  const isComplete = isFree || checkout?.status === 3;
  const isProcessing = checkout?.status === 1;
  const paymentAddress = paymentInfo.address;

  return (
    <section className="page-stack checkout-layout">
      <PageTitle
        eyebrow="Checkout"
        title={isComplete ? '订阅已生效' : '完成订单支付'}
        subtitle={isComplete ? '套餐已经开通，可以复制订阅链接或导入客户端。' : '确认金额后完成支付，套餐会在到账后自动生效。'}
      />
      <div className="checkout-grid">
        <div className="panel payment-panel">
          <div className="qr-box">
            {isComplete ? <Check size={108} /> : isQr ? <img src={paymentUrl} alt="payment qr code" /> : <QrCode size={108} />}
          </div>
          <div>
            <span className="muted">应付金额</span>
            <h2>{checkout?.amount || '-'}</h2>
            <p>订单：{checkout?.tradeNo || '尚未创建'}</p>
            <p>套餐：{checkout?.planName || '-'}</p>
            <p>支付方式：{checkout?.payment?.name || (isFree ? '免费订单' : '待配置')}</p>
            {checkout?.status !== undefined && <p>订单状态：{orderStatusLabel(checkout.status)}</p>}
          </div>
          {paymentAddress && !isComplete && (
            <div className="payment-address">
              <span>{paymentInfo.network ? `${paymentInfo.network.toUpperCase()} 收款地址` : '收款地址'}</span>
              <code>{paymentAddress}</code>
              <button className="secondary-button wide" onClick={() => copyText(paymentAddress)}><Copy size={18} />复制转账地址</button>
            </div>
          )}
          {isComplete && (
            <div className="checkout-actions">
              <button className="primary-button wide" onClick={onCopySubscribe}><Copy size={18} />复制订阅链接</button>
              <button className="secondary-button wide" onClick={onSetup}>导入客户端<ArrowRight size={18} /></button>
            </div>
          )}
          {isRedirect && <a className="primary-button wide" href={paymentUrl} target="_blank" rel="noreferrer">打开支付页面<ArrowRight size={18} /></a>}
          {isQr && <button className="primary-button wide" onClick={() => copyText(paymentUrl)}><Copy size={18} />复制二维码链接</button>}
          {checkout?.error && <div className="inline-error">{checkout.error}</div>}
        </div>
        <div className="panel">
          <PanelHeader icon={ReceiptText} title="订单状态" action="检查状态" onAction={onRefresh} />
          <div className="timeline">
            <Step done={Boolean(checkout?.tradeNo)} title="订单已创建" body={checkout?.periodLabel || '选择套餐周期'} />
            <Step done={Boolean(checkout?.result)} title={isComplete ? '支付已确认' : '支付请求已提交'} body={checkout?.payment?.name || checkout?.error || (isFree ? '免费订单' : '等待支付方式')} />
            <Step done={isComplete} title={isProcessing ? '套餐开通中' : '套餐生效'} body={isComplete ? '订阅已经更新，可以开始使用。' : '到账确认后订阅会自动更新。'} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SetupPage({ subscribe, onCopyProfile }: { subscribe: SubscribeInfo | null; onCopyProfile: (flag?: string) => void }) {
  return (
    <section className="page-stack">
      <PageTitle eyebrow="One click setup" title="选择你的客户端" subtitle="选择设备对应客户端，复制配置链接后导入使用。" />
      <div className="client-grid">
        {setupClients.map(({ name, platform, flag, icon: Icon }) => (
          <article className="client-card" key={name}>
            <div className="client-icon"><Icon size={28} /></div>
            <h2>{name}</h2>
            <p>{platform}</p>
            <button className="secondary-button wide" disabled={!subscribe?.subscribe_url} onClick={() => onCopyProfile(flag)}>
              复制配置链接<DownloadCloud size={18} />
            </button>
          </article>
        ))}
      </div>
      {!subscribe?.subscribe_url && <EmptyState text="请先登录并拥有有效套餐，才会生成专属订阅链接。" />}
    </section>
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
}) {
  const [view, setView] = React.useState<AccountView>('overview');
  const [orders, setOrders] = React.useState<OrderRecord[] | null>(null);
  const [invite, setInvite] = React.useState<InviteInfo | null>(null);
  const [tickets, setTickets] = React.useState<TicketRecord[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const token = props.auth?.auth_data || '';

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

  return (
    <section className="page-stack">
      <div className="account-hero">
        <div className="avatar-large">{initials(props.user?.email || 'zz')}</div>
        <div>
          <h1>{props.user?.email || '已登录用户'}</h1>
          <p>账号创建于 {formatDate(props.user?.created_at)}，你可以在这里管理订阅和安全设置。</p>
        </div>
        <button className="danger-button" onClick={props.onLogout}><LogOut size={18} />退出登录</button>
      </div>
      <div className="section-grid">
        <div className="panel">
          <PanelHeader icon={WalletCards} title="账户资产" action="账户概览" onAction={showOverview} />
          <div className="account-list">
            <Metric label="余额" value={formatMoney(props.user?.balance)} />
            <Metric label="邀请佣金" value={formatMoney(props.user?.commission_balance)} />
            <Metric label="待支付订单" value={String(props.stats[0] || 0)} />
          </div>
        </div>
        <div className="panel">
          <PanelHeader icon={LockKeyhole} title="安全与偏好" action="管理" onAction={showSecurity} />
          <div className="settings-list">
            <ActionLine icon={KeyRound} title="重置订阅链接" onClick={props.onResetSecurity} />
            <ActionLine icon={TicketCheck} title={`未结工单 ${props.stats[1] || 0}`} onClick={showTickets} />
            <ActionLine icon={CircleDollarSign} title={`邀请用户 ${props.stats[2] || 0}`} onClick={showInvite} />
          </div>
        </div>
      </div>
      <AccountDetailPanel
        view={view}
        user={props.user}
        subscribe={props.subscribe}
        orders={orders}
        invite={invite}
        tickets={tickets}
        busy={busy}
        error={error}
        onOrders={showOrders}
        onOverview={showOverview}
        onSecurity={showSecurity}
        onInvite={showInvite}
        onTickets={showTickets}
        onCreateInvite={createInviteCode}
        onResetSecurity={props.onResetSecurity}
        onPayOrder={props.onPayOrder}
      />
      <div className="panel">
        <PanelHeader icon={ReceiptText} title="本月流量记录" action={`${props.trafficLogs.length} 条`} />
        <div className="traffic-table">
          {props.trafficLogs.slice(0, 8).map((log) => (
            <div className="traffic-row" key={`${log.record_at}-${log.u}-${log.d}`}>
              <span>{formatDate(log.record_at)}</span>
              <strong>{formatBytes((log.u || 0) + (log.d || 0))}</strong>
            </div>
          ))}
          {!props.trafficLogs.length && <EmptyState text="本月暂无流量明细。" />}
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
  busy,
  error,
  onOrders,
  onOverview,
  onSecurity,
  onInvite,
  onTickets,
  onCreateInvite,
  onResetSecurity,
  onPayOrder
}: {
  view: AccountView;
  user: UserInfo | null;
  subscribe: SubscribeInfo | null;
  orders: OrderRecord[] | null;
  invite: InviteInfo | null;
  tickets: TicketRecord[] | null;
  busy: boolean;
  error: string;
  onOrders: () => void;
  onOverview: () => void;
  onSecurity: () => void;
  onInvite: () => void;
  onTickets: () => void;
  onCreateInvite: () => void;
  onResetSecurity: () => void;
  onPayOrder: (order: OrderRecord) => Promise<void>;
}) {
  const [payingTradeNo, setPayingTradeNo] = React.useState<string | null>(null);

  async function continuePayment(order: OrderRecord) {
    setPayingTradeNo(order.trade_no);
    try {
      await onPayOrder(order);
    } finally {
      setPayingTradeNo(null);
    }
  }

  return (
    <div className="panel account-detail">
      <div className="account-tabs">
        <button className={view === 'overview' ? 'active' : ''} onClick={onOverview}>概览</button>
        <button className={view === 'security' ? 'active' : ''} onClick={onSecurity}>安全</button>
        <button className={view === 'orders' ? 'active' : ''} onClick={onOrders}>订单</button>
        <button className={view === 'tickets' ? 'active' : ''} onClick={onTickets}>工单</button>
        <button className={view === 'invite' ? 'active' : ''} onClick={onInvite}>邀请</button>
      </div>

      {error && <div className="inline-error">{error}</div>}
      {busy && <EmptyState text="正在读取账户数据..." />}

      {!busy && view === 'overview' && (
        <div className="detail-grid">
          <Metric label="当前套餐" value={subscribe?.plan?.name || (user?.plan_id ? `套餐 ${user.plan_id}` : '暂无套餐')} />
          <Metric label="到期时间" value={formatDate(subscribe?.expired_at || user?.expired_at)} />
          <Metric label="已用流量" value={formatBytes((subscribe?.u || 0) + (subscribe?.d || 0))} />
          <Metric label="总流量" value={formatBytes(subscribe?.transfer_enable || user?.transfer_enable)} />
          <Metric label="设备限制" value={subscribe?.device_limit ? `${subscribe.device_limit} 台` : '未限制'} />
          <Metric label="速度限制" value={subscribe?.speed_limit ? `${subscribe.speed_limit} Mbps` : '未限制'} />
        </div>
      )}

      {!busy && view === 'security' && (
        <div className="record-list">
          <div className="record-row">
            <div>
              <strong>订阅链接</strong>
              <p>重置后旧链接会立即失效，客户端需要重新导入。</p>
            </div>
            <button className="secondary-button" onClick={onResetSecurity}>重置链接</button>
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
                {isPendingOrder(order.status) && <span className="record-cta">点击继续支付</span>}
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
        <span className="eyebrow light"><BadgeCheck size={17} /> Secure access</span>
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
      <Icon size={24} />
      <strong>{title}</strong>
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

function periodName(period?: PeriodKey | string) {
  return periods.find((item) => item.key === period)?.label || '周期';
}

function pageFromHash(): Page {
  const value = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  switch (value) {
    case 'plans':
    case 'shop':
      return 'plans';
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
  return periods.find((period) => plan[period.key] !== null && plan[period.key] !== undefined);
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined) return '-';
  if (value <= 0) return '免费';
  const amount = value / 100;
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
    return { url: data, qrcode: data, address: '', network: '' };
  }

  if (!data || typeof data !== 'object') {
    return { url: '', qrcode: '', address: '', network: '' };
  }

  const record = data as Record<string, unknown>;
  return {
    url: stringValue(record.url || record.pay_url || record.payment_url || record.qrcode),
    qrcode: stringValue(record.qrcode || record.qr_code || record.url),
    address: stringValue(record.address || record.to_address),
    network: stringValue(record.network)
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
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
