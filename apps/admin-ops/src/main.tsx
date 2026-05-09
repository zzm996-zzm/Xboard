import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Command,
  Database,
  DollarSign,
  EyeOff,
  HardDrive,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCcw,
  Router,
  Server,
  ShieldAlert,
  Wifi,
  X
} from 'lucide-react';
import { api, type AuthData, type Machine, type NodeMetric, type Overview } from './api';
import './styles.css';

const AUTH_KEY = 'xboard.admin.ops.auth';

type View = 'overview' | 'machines' | 'nodes';

type MachineDraft = {
  id?: number;
  name: string;
  notes?: string;
  provider_name?: string;
  provider_region?: string;
  provider_plan?: string;
  monthly_cost?: string;
  cost_currency?: string;
  traffic_limit_gb?: string;
  billing_cycle?: string;
  purchase_url?: string;
  is_active: boolean;
};

function App() {
  const [auth, setAuth] = React.useState<AuthData | null>(() => loadAuth());
  const [view, setView] = React.useState<View>('overview');
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [machines, setMachines] = React.useState<Machine[]>([]);
  const [nodes, setNodes] = React.useState<NodeMetric[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [machineDraft, setMachineDraft] = React.useState<MachineDraft | null>(null);

  const isAdmin = Boolean(auth?.auth_data && auth.is_admin);

  const refresh = React.useCallback(async () => {
    if (!auth?.auth_data) return;
    setLoading(true);
    setMessage('');
    try {
      const [nextOverview, nextMachines, nextNodes] = await Promise.all([
        api.overview(auth.auth_data),
        api.machineFetch(auth.auth_data),
        api.nodes(auth.auth_data)
      ]);
      setOverview(nextOverview);
      setMachines(nextMachines);
      setNodes(nextNodes);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  React.useEffect(() => {
    if (isAdmin) {
      refresh();
    }
  }, [isAdmin, refresh]);

  async function handleLogin(email: string, password: string) {
    setLoading(true);
    setMessage('');
    try {
      const nextAuth = await api.login(email, password);
      if (!nextAuth.is_admin) {
        setMessage('当前账号不是管理员。');
        return;
      }
      saveAuth(nextAuth);
      setAuth(nextAuth);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    saveAuth(null);
    setAuth(null);
    setOverview(null);
    setMachines([]);
    setNodes([]);
  }

  async function saveMachine(draft: MachineDraft) {
    if (!auth?.auth_data) return;
    const body = {
      id: draft.id,
      name: draft.name.trim(),
      notes: draft.notes || null,
      provider_name: draft.provider_name || null,
      provider_region: draft.provider_region || null,
      provider_plan: draft.provider_plan || null,
      monthly_cost: moneyToCents(draft.monthly_cost),
      cost_currency: draft.cost_currency || 'USD',
      traffic_limit_gb: draft.traffic_limit_gb ? Number(draft.traffic_limit_gb) : null,
      billing_cycle: draft.billing_cycle || null,
      purchase_url: draft.purchase_url || null,
      is_active: draft.is_active
    };

    setLoading(true);
    try {
      await api.saveMachine(auth.auth_data, body);
      setMachineDraft(null);
      await refresh();
      setMessage('机器已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin) {
    return <LoginScreen loading={loading} message={message} onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><Command size={22} /></div>
          <div>
            <strong>Ops Console</strong>
            <span>{window.__ADMIN_OPS__?.appName || 'Xboard'}</span>
          </div>
        </div>
        <nav>
          <NavButton active={view === 'overview'} icon={Activity} label="总览" onClick={() => setView('overview')} />
          <NavButton active={view === 'machines'} icon={Server} label="机器" onClick={() => setView('machines')} />
          <NavButton active={view === 'nodes'} icon={Router} label="节点" onClick={() => setView('nodes')} />
        </nav>
        <button className="sidebar-action" onClick={logout}><LogOut size={16} />退出</button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p>Commercial Operations</p>
            <h1>{viewTitle(view)}</h1>
          </div>
          <div className="topbar-actions">
            {message && <span className="notice">{message}</span>}
            <button className="icon-button" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 className="spin" size={17} /> : <RefreshCcw size={17} />}
            </button>
          </div>
        </header>

        {view === 'overview' && <OverviewView overview={overview} nodes={nodes} machines={machines} />}
        {view === 'machines' && (
          <MachinesView
            machines={machines}
            onCreate={() => setMachineDraft(emptyMachineDraft())}
            onEdit={(machine) => setMachineDraft(machineToDraft(machine))}
          />
        )}
        {view === 'nodes' && <NodesView nodes={nodes} />}
      </main>

      {machineDraft && (
        <MachineModal
          draft={machineDraft}
          onChange={setMachineDraft}
          onClose={() => setMachineDraft(null)}
          onSave={saveMachine}
        />
      )}
    </div>
  );
}

function LoginScreen({ loading, message, onLogin }: { loading: boolean; message: string; onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={(event) => {
        event.preventDefault();
        onLogin(email, password);
      }}>
        <div className="login-icon"><LockKeyhole size={24} /></div>
        <h1>运营控制台</h1>
        <p>使用管理员账号登录，管理机器部署、成本和节点风险。</p>
        <label>
          邮箱
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <label>
          密码
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {message && <div className="form-error">{message}</div>}
        <button className="primary-button" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
      </form>
    </div>
  );
}

function OverviewView({ overview, nodes, machines }: { overview: Overview | null; nodes: NodeMetric[]; machines: Machine[] }) {
  const riskyNodes = nodes.filter((node) => node.risk !== 'ok');

  return (
    <div className="content-stack">
      <section className="metric-grid">
        <MetricCard icon={DollarSign} label="本月收入" value={money(overview?.month_revenue)} />
        <MetricCard icon={Database} label="配置成本" value={money(overview?.configured_monthly_cost)} />
        <MetricCard icon={CheckCircle2} label="预估毛利" value={money(overview?.estimated_gross_margin)} tone="good" />
        <MetricCard icon={Wifi} label="本月流量" value={bytes(overview?.month_traffic_bytes || 0)} />
      </section>

      <section className="split-grid">
        <div className="panel">
          <PanelTitle icon={ShieldAlert} title="风险节点" subtitle={`${riskyNodes.length} 个节点需要关注`} />
          <div className="table-list">
            {riskyNodes.length === 0 && <Empty text="暂无风险节点" />}
            {riskyNodes.map((node) => (
              <div className="list-row" key={node.id}>
                <div>
                  <strong>{node.name}</strong>
                  <span>{node.host}</span>
                </div>
                <RiskBadge risk={node.risk} />
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <PanelTitle icon={Server} title="机器状态" subtitle={`${machines.length} 台机器`} />
          <div className="table-list">
            {machines.map((machine) => (
              <div className="list-row" key={machine.id}>
                <div>
                  <strong>{machine.name}</strong>
                  <span>{machine.provider_region || machine.provider_name || '未填写供应商'}</span>
                </div>
                <StatusBadge status={machine.setup_status} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MachinesView({ machines, onCreate, onEdit }: { machines: Machine[]; onCreate: () => void; onEdit: (machine: Machine) => void }) {
  return (
    <section className="panel">
      <div className="section-head">
        <PanelTitle icon={Server} title="机器管理" subtitle="创建机器、复制部署命令、记录服务商成本" />
        <button className="primary-inline" onClick={onCreate}><Plus size={16} />新建机器</button>
      </div>
      <div className="data-table machine-table">
        <div className="table-head">
          <span>机器</span><span>状态</span><span>供应商</span><span>成本</span><span>流量</span><span>命令</span>
        </div>
        {machines.map((machine) => (
          <div className="table-row" key={machine.id}>
            <button className="link-cell" onClick={() => onEdit(machine)}>
              <strong>{machine.name}</strong>
              <small>{machine.servers_count} 个节点</small>
            </button>
            <StatusBadge status={machine.setup_status} />
            <span>{machine.provider_name || '-'}</span>
            <span>{money(machine.monthly_cost)} {machine.cost_currency || 'USD'}</span>
            <span>{machine.traffic_limit_gb ? `${machine.traffic_limit_gb} GB` : '-'}</span>
            <CopyButton text={machine.install_command || ''} />
          </div>
        ))}
      </div>
    </section>
  );
}

function NodesView({ nodes }: { nodes: NodeMetric[] }) {
  return (
    <section className="panel">
      <PanelTitle icon={Router} title="节点运营" subtitle="查看成本、流量使用率和自动隐藏状态" />
      <div className="data-table node-table">
        <div className="table-head">
          <span>节点</span><span>状态</span><span>机器</span><span>成本</span><span>流量</span><span>风险</span><span>自动隐藏</span>
        </div>
        {nodes.map((node) => (
          <div className="table-row" key={node.id}>
            <div>
              <strong>{node.name}</strong>
              <small>{node.host}</small>
            </div>
            <span>{node.is_online ? '在线' : '离线'} / {node.show ? '显示' : '隐藏'}</span>
            <span>{node.machine_name || '-'}</span>
            <span>{money(node.monthly_cost)} {node.cost_currency || 'USD'}</span>
            <span>{bytes(node.month_traffic_bytes)}{node.traffic_usage_percent !== null && node.traffic_usage_percent !== undefined ? ` · ${node.traffic_usage_percent}%` : ''}</span>
            <RiskBadge risk={node.risk} />
            <span>{node.auto_hide_enabled ? (node.auto_hide_reason || '已启用') : '关闭'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MachineModal({ draft, onChange, onClose, onSave }: {
  draft: MachineDraft;
  onChange: (draft: MachineDraft) => void;
  onClose: () => void;
  onSave: (draft: MachineDraft) => void;
}) {
  const set = (key: keyof MachineDraft, value: string | boolean) => onChange({ ...draft, [key]: value });

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <h2>{draft.id ? '编辑机器' : '新建机器'}</h2>
            <p>保存后可以在机器列表复制部署命令。</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <Field label="机器名称" value={draft.name} onChange={(value) => set('name', value)} />
          <Field label="供应商" value={draft.provider_name || ''} onChange={(value) => set('provider_name', value)} />
          <Field label="地区" value={draft.provider_region || ''} onChange={(value) => set('provider_region', value)} />
          <Field label="套餐" value={draft.provider_plan || ''} onChange={(value) => set('provider_plan', value)} />
          <Field label="月成本" value={draft.monthly_cost || ''} onChange={(value) => set('monthly_cost', value)} placeholder="89.99" />
          <Field label="币种" value={draft.cost_currency || 'USD'} onChange={(value) => set('cost_currency', value)} />
          <Field label="月流量 GB" value={draft.traffic_limit_gb || ''} onChange={(value) => set('traffic_limit_gb', value)} placeholder="500" />
          <Field label="账单周期" value={draft.billing_cycle || ''} onChange={(value) => set('billing_cycle', value)} placeholder="monthly" />
          <label className="field field-wide">
            购买链接
            <input value={draft.purchase_url || ''} onChange={(event) => set('purchase_url', event.target.value)} />
          </label>
          <label className="field field-wide">
            备注
            <textarea value={draft.notes || ''} onChange={(event) => set('notes', event.target.value)} />
          </label>
        </div>
        <div className="modal-foot">
          <label className="switch-line">
            <input type="checkbox" checked={draft.is_active} onChange={(event) => set('is_active', event.target.checked)} />
            启用机器
          </label>
          <button className="primary-button compact" onClick={() => onSave(draft)}>保存</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      {label}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return <button className={active ? 'nav-item active' : 'nav-item'} onClick={onClick}><Icon size={17} />{label}</button>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone?: 'good' }) {
  return (
    <div className={tone ? `metric-card ${tone}` : 'metric-card'}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return <div className="panel-title"><Icon size={18} /><div><h2>{title}</h2><p>{subtitle}</p></div></div>;
}

function StatusBadge({ status }: { status: Machine['setup_status'] }) {
  const label = status === 'online' ? '在线' : status === 'stale' ? '过期' : '未连接';
  return <span className={`status-badge ${status}`}>{label}</span>;
}

function RiskBadge({ risk }: { risk: NodeMetric['risk'] }) {
  const map = {
    ok: ['正常', CheckCircle2],
    offline: ['离线', AlertTriangle],
    traffic_high: ['流量高', HardDrive],
    hidden: ['已隐藏', EyeOff]
  } as const;
  const [label, Icon] = map[risk];
  return <span className={`risk-badge ${risk}`}><Icon size={13} />{label}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button className="copy-button" disabled={!text} onClick={async () => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }}>
      <Clipboard size={14} />{copied ? '已复制' : '复制'}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function viewTitle(view: View) {
  return view === 'overview' ? '运营总览' : view === 'machines' ? '机器部署' : '节点风险';
}

function bytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let next = value;
  let index = 0;
  while (next >= 1024 && index < units.length - 1) {
    next /= 1024;
    index += 1;
  }
  return `${next.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function money(value?: number | null) {
  return `$${((value || 0) / 100).toFixed(2)}`;
}

function moneyToCents(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function loadAuth(): AuthData | null {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(auth: AuthData | null) {
  if (auth) {
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } else {
    window.localStorage.removeItem(AUTH_KEY);
  }
}

function emptyMachineDraft(): MachineDraft {
  return {
    name: '',
    is_active: true,
    cost_currency: 'USD',
    billing_cycle: 'monthly'
  };
}

function machineToDraft(machine: Machine): MachineDraft {
  return {
    id: machine.id,
    name: machine.name,
    notes: machine.notes || '',
    provider_name: machine.provider_name || '',
    provider_region: machine.provider_region || '',
    provider_plan: machine.provider_plan || '',
    monthly_cost: machine.monthly_cost ? String(machine.monthly_cost / 100) : '',
    cost_currency: machine.cost_currency || 'USD',
    traffic_limit_gb: machine.traffic_limit_gb ? String(machine.traffic_limit_gb) : '',
    billing_cycle: machine.billing_cycle || 'monthly',
    purchase_url: machine.purchase_url || '',
    is_active: machine.is_active
  };
}

createRoot(document.getElementById('root')!).render(<App />);
