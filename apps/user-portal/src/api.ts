export type AuthData = {
  token: string;
  auth_data: string;
  is_admin?: boolean;
};

export type PeriodKey =
  | 'month_price'
  | 'quarter_price'
  | 'half_year_price'
  | 'year_price'
  | 'two_year_price'
  | 'three_year_price'
  | 'onetime_price'
  | 'reset_price';

export type Plan = {
  id: number;
  name: string;
  tags?: string[] | null;
  content?: string | null;
  transfer_enable: number;
  speed_limit?: number | null;
  device_limit?: number | null;
  sell?: boolean;
  renew?: boolean;
  capacity_limit?: number | string | null;
  month_price?: number | null;
  quarter_price?: number | null;
  half_year_price?: number | null;
  year_price?: number | null;
  two_year_price?: number | null;
  three_year_price?: number | null;
  onetime_price?: number | null;
  reset_price?: number | null;
};

export type UserInfo = {
  email: string;
  transfer_enable: number;
  last_login_at?: number | null;
  created_at?: number | null;
  banned?: boolean;
  expired_at?: number | null;
  balance: number;
  commission_balance: number;
  plan_id?: number | null;
  avatar_url?: string;
  uuid?: string;
};

export type SubscribeInfo = {
  plan_id?: number | null;
  token: string;
  expired_at?: number | null;
  u: number;
  d: number;
  transfer_enable: number;
  email: string;
  uuid: string;
  device_limit?: number | null;
  speed_limit?: number | null;
  next_reset_at?: number | null;
  plan?: Plan;
  subscribe_url: string;
  reset_day?: number | null;
};

export type ServerNode = {
  id: number;
  type: string;
  name: string;
  rate?: number;
  tags?: string[] | null;
  is_online?: boolean;
  last_check_at?: number | null;
};

export type PaymentMethod = {
  id: number;
  name: string;
  payment: string;
  icon?: string | null;
  handling_fee_fixed?: number | null;
  handling_fee_percent?: number | null;
};

export type CheckoutResponse = {
  type: number;
  data: unknown;
};

export type TrafficLog = {
  record_at: number;
  u: number;
  d: number;
  rate?: number;
  total?: number;
};

export type OrderRecord = {
  id: number;
  trade_no: string;
  status: number;
  period: PeriodKey;
  total_amount: number;
  created_at?: number | null;
  plan?: Plan | null;
};

export type InviteInfo = {
  codes?: Array<{ code: string; pv?: number; status?: number; created_at?: number | null }>;
  stat?: [number, number, number, number, number];
};

export type TicketRecord = {
  id: number;
  level: number;
  reply_status: number;
  status: number;
  subject: string;
  created_at?: number | null;
  updated_at?: number | null;
};

const API_BASE = (import.meta.env.VITE_XBOARD_API_BASE || '/api/v1').replace(/\/$/, '');

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    token?: string | null;
    body?: Record<string, unknown>;
    params?: Record<string, string | number | undefined | null>;
  } = {}
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
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

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'type')) {
    return payload as T;
  }

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data as T;
  }

  return payload as T;
}

function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as T[];
    }
    if (Array.isArray(record.list)) {
      return record.list as T[];
    }

    const values = Object.values(record);
    if (values.length && values.every(Array.isArray)) {
      return values.flat() as T[];
    }
  }

  return [];
}

export const api = {
  login(email: string, password: string) {
    return request<AuthData>('/passport/auth/login', {
      method: 'POST',
      body: { email, password }
    });
  },

  register(email: string, password: string) {
    return request<AuthData>('/passport/auth/register', {
      method: 'POST',
      body: { email, password }
    });
  },

  guestPlans() {
    return request<unknown>('/guest/plan/fetch').then(asList<Plan>);
  },

  userInfo(token: string) {
    return request<UserInfo>('/user/info', { token });
  },

  subscribe(token: string) {
    return request<SubscribeInfo>('/user/getSubscribe', { token });
  },

  userPlans(token: string) {
    return request<unknown>('/user/plan/fetch', { token }).then(asList<Plan>);
  },

  servers(token: string) {
    return request<unknown>('/user/server/fetch', { token }).then(asList<ServerNode>);
  },

  stats(token: string) {
    return request<[number, number, number]>('/user/getStat', { token });
  },

  trafficLogs(token: string) {
    return request<unknown>('/user/stat/getTrafficLog', { token }).then(asList<TrafficLog>);
  },

  paymentMethods(token: string) {
    return request<unknown>('/user/order/getPaymentMethod', { token }).then(asList<PaymentMethod>);
  },

  orders(token: string) {
    return request<unknown>('/user/order/fetch', { token }).then(asList<OrderRecord>);
  },

  createOrder(token: string, planId: number, period: PeriodKey, couponCode?: string) {
    return request<string>('/user/order/save', {
      method: 'POST',
      token,
      body: { plan_id: planId, period, coupon_code: couponCode || undefined }
    });
  },

  checkoutOrder(token: string, tradeNo: string, method?: number) {
    return request<CheckoutResponse>('/user/order/checkout', {
      method: 'POST',
      token,
      body: { trade_no: tradeNo, method }
    });
  },

  checkOrder(token: string, tradeNo: string) {
    return request<number>('/user/order/check', {
      token,
      params: { trade_no: tradeNo }
    });
  },

  invite(token: string) {
    return request<InviteInfo>('/user/invite/fetch', { token });
  },

  createInviteCode(token: string) {
    return request<boolean>('/user/invite/save', { token });
  },

  tickets(token: string) {
    return request<unknown>('/user/ticket/fetch', { token }).then(asList<TicketRecord>);
  },

  resetSecurity(token: string) {
    return request<string>('/user/resetSecurity', { token });
  }
};
