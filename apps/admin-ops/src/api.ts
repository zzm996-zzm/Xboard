export type AuthData = {
  token: string;
  auth_data: string;
  is_admin?: boolean;
};

export type Overview = {
  currency: string;
  month_revenue: number;
  configured_monthly_node_cost: number;
  configured_monthly_machine_cost: number;
  configured_monthly_cost: number;
  estimated_gross_margin: number;
  online_nodes: number;
  offline_nodes: number;
  hidden_nodes: number;
  month_traffic_bytes: number;
};

export type Machine = {
  id: number;
  name: string;
  notes?: string | null;
  is_active: boolean;
  setup_status: 'not_connected' | 'online' | 'stale';
  last_seen_at?: number | null;
  load_status?: {
    cpu?: number;
    mem?: { total?: number; used?: number };
    disk?: { total?: number; used?: number };
    net?: { in_speed?: number; out_speed?: number };
  } | null;
  servers_count: number;
  provider_name?: string | null;
  provider_region?: string | null;
  provider_plan?: string | null;
  monthly_cost?: number | null;
  cost_currency?: string | null;
  traffic_limit_gb?: number | null;
  billing_cycle?: string | null;
  purchase_url?: string | null;
  install_command?: string;
  month_traffic_bytes?: number;
  traffic_usage_percent?: number | null;
};

export type NodeMetric = {
  id: number;
  name: string;
  type: string;
  host: string;
  rate: number;
  show: boolean;
  enabled: boolean;
  is_online: number;
  provider_name?: string | null;
  provider_plan?: string | null;
  monthly_cost?: number | null;
  cost_currency?: string | null;
  machine_name?: string | null;
  month_traffic_bytes: number;
  traffic_limit_bytes: number;
  traffic_usage_percent?: number | null;
  risk: 'ok' | 'offline' | 'traffic_high' | 'hidden';
  auto_hide_enabled: boolean;
  auto_hide_reason?: string | null;
  auto_hide_at?: number | null;
};

const API_V1 = '/api/v1';
const API_V2 = `/api/v2/${window.__ADMIN_OPS__?.securePath || ''}`;

declare global {
  interface Window {
    __ADMIN_OPS__?: {
      appName: string;
      securePath: string;
      version: string;
    };
  }
}

async function request<T>(
  base: string,
  path: string,
  options: {
    method?: 'GET' | 'POST';
    token?: string | null;
    body?: Record<string, unknown>;
    params?: Record<string, string | number | undefined | null>;
  } = {}
): Promise<T> {
  const url = new URL(`${base}${path}`, window.location.origin);
  Object.entries(options.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: options.token } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }

  if (payload && payload.status === 'fail') {
    throw new Error(payload.message || 'Request failed');
  }

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'status')) {
    return payload.data as T;
  }

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data as T;
  }

  return payload as T;
}

export const api = {
  login(email: string, password: string) {
    return request<AuthData>(API_V1, '/passport/auth/login', {
      method: 'POST',
      body: { email, password }
    });
  },

  overview(token: string) {
    return request<Overview>(API_V2, '/commercial/overview', { token });
  },

  nodes(token: string) {
    return request<NodeMetric[]>(API_V2, '/commercial/nodes', { token });
  },

  machines(token: string) {
    return request<Machine[]>(API_V2, '/commercial/machines', { token });
  },

  machineFetch(token: string) {
    return request<Machine[]>(API_V2, '/server/machine/fetch', { token });
  },

  saveMachine(token: string, body: Partial<Machine> & { name: string }) {
    return request<Machine | true>(API_V2, '/server/machine/save', {
      method: 'POST',
      token,
      body: body as Record<string, unknown>
    });
  }
};
