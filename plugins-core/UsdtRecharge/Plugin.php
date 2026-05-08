<?php

namespace Plugin\UsdtRecharge;

use App\Contracts\PaymentInterface;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\User;
use App\Services\Plugin\AbstractPlugin;
use Illuminate\Support\Facades\Http;

class Plugin extends AbstractPlugin implements PaymentInterface
{
    public function boot(): void
    {
        $this->filter('available_payment_methods', function ($methods) {
            if ($this->getConfig('enabled', true)) {
                $methods['UsdtRecharge'] = [
                    'name' => $this->getConfig('display_name', 'USDT TRC20'),
                    'icon' => $this->getConfig('icon', '₮'),
                    'plugin_code' => $this->getPluginCode(),
                    'type' => 'plugin'
                ];
            }
            return $methods;
        });
    }

    public function form(): array
    {
        return [
            'recharge_url' => [
                'label' => '充值接口地址',
                'type' => 'string',
                'required' => true,
                'default' => 'http://153.92.5.18:9999/payment/recharge',
                'description' => '支付方提供的 POST JSON 接口地址'
            ],
            'merchant_no' => [
                'label' => '商户号',
                'type' => 'string',
                'required' => true,
                'description' => '支付方分配的 merchant_no'
            ],
            'merchant_secret' => [
                'label' => '商户密钥',
                'type' => 'string',
                'required' => true,
                'description' => '用于 MD5 签名的密钥'
            ],
            'amount_type' => [
                'label' => '币种',
                'type' => 'string',
                'default' => 'USDT',
                'description' => '默认 USDT'
            ],
            'network' => [
                'label' => '网络',
                'type' => 'string',
                'default' => 'trc20',
                'description' => '默认 trc20'
            ],
            'consumer_id' => [
                'label' => '固定 Consumer ID',
                'type' => 'string',
                'default' => 'xboard',
                'description' => '当 Consumer ID 模式为 fixed 时使用'
            ],
            'consumer_id_mode' => [
                'label' => 'Consumer ID 模式',
                'type' => 'select',
                'default' => 'email',
                'description' => 'email 使用注册邮箱；order 每笔订单独立；fixed 使用固定值',
                'options' => [
                    'email' => '用户注册邮箱',
                    'order' => '每笔订单独立',
                    'fixed' => '固定值'
                ]
            ],
            'amount_mode' => [
                'label' => '请求金额模式',
                'type' => 'select',
                'default' => 'order',
                'description' => 'order 按订单金额请求；fixed 使用下方固定金额',
                'options' => [
                    'order' => '订单金额',
                    'fixed' => '固定金额'
                ]
            ],
            'fixed_amount' => [
                'label' => '固定请求金额',
                'type' => 'string',
                'default' => '0',
                'description' => '当请求金额模式为 fixed 时使用，通常可填 0'
            ],
        ];
    }

    public function pay($order): array
    {
        $callbackUrl = $this->appendQuery($order['notify_url'], [
            'trade_no' => $order['trade_no'],
        ]);

        $params = [
            'merchant_no' => $this->getConfig('merchant_no'),
            'amount' => $this->getRequestAmount($order),
            'amount_type' => $this->getConfig('amount_type', 'USDT'),
            'network' => $this->getConfig('network', 'trc20'),
            'consumer_id' => $this->getConsumerId($order),
            'callback_url' => $callbackUrl,
        ];
        $params['sign'] = $this->sign($params);

        $response = Http::asJson()
            ->timeout(15)
            ->post($this->getConfig('recharge_url'), $params);

        if (!$response->successful()) {
            throw new ApiException(__('Payment gateway request failed'));
        }

        $result = $response->json();
        if (($result['code'] ?? null) !== 200 || empty($result['data'])) {
            throw new ApiException($result['msg'] ?? __('Payment gateway request failed'));
        }

        $data = $result['data'];
        $paymentData = $data['qrcode'] ?? $data['address'] ?? null;
        if (!$paymentData) {
            throw new ApiException(__('Payment gateway request failed'));
        }

        return [
            'type' => 0,
            'data' => $paymentData,
        ];
    }

    public function notify($params): array|bool
    {
        if (empty($params['sign']) || !$this->verifySign($params)) {
            return false;
        }

        if (($params['merchant_no'] ?? '') !== $this->getConfig('merchant_no')) {
            return false;
        }

        if ((string) ($params['is_pay'] ?? '') !== '1') {
            return false;
        }

        $tradeNo = request()->query('trade_no');
        if (!$tradeNo) {
            return false;
        }

        $order = Order::where('trade_no', $tradeNo)->first();
        if (!$order) {
            return false;
        }

        if (!$this->isActualAmountEnough($params, $order)) {
            return false;
        }

        $callbackNo = trim(($params['order_no'] ?? '') . ':' . ($params['hash'] ?? ''), ':');
        if (!$callbackNo) {
            return false;
        }

        return [
            'trade_no' => $tradeNo,
            'callback_no' => $callbackNo,
            'custom_result' => [
                'code' => 0,
                'msg' => 'success'
            ]
        ];
    }

    private function getRequestAmount(array $order): string
    {
        if ($this->getConfig('amount_mode', 'order') === 'fixed') {
            return (string) $this->getConfig('fixed_amount', '0');
        }

        return $this->formatAmount($order['total_amount'] / 100);
    }

    private function getConsumerId(array $order): string
    {
        $mode = $this->getConfig('consumer_id_mode', 'email');

        if ($mode === 'fixed') {
            return (string) $this->getConfig('consumer_id', 'xboard');
        }

        if ($mode === 'email') {
            $email = User::where('id', $order['user_id'] ?? null)->value('email');
            if ($email) {
                return $email;
            }
        }

        return 'xboard_' . $order['trade_no'];
    }

    private function formatAmount(float $amount): string
    {
        $formatted = number_format($amount, 2, '.', '');
        return rtrim(rtrim($formatted, '0'), '.') ?: '0';
    }

    private function isActualAmountEnough(array $params, Order $order): bool
    {
        if (!isset($params['actual_amount'])) {
            return false;
        }

        $expectedAmount = (float) $this->formatAmount($order->total_amount / 100);
        $actualAmount = (float) $params['actual_amount'];

        return $actualAmount + 0.00000001 >= $expectedAmount;
    }

    private function verifySign(array $params): bool
    {
        $sign = (string) $params['sign'];
        unset($params['sign']);

        return hash_equals(strtolower($sign), $this->sign($params));
    }

    private function sign(array $params): string
    {
        unset($params['sign']);
        ksort($params, SORT_STRING);

        return strtolower(md5($this->buildSignString($params) . '&secret=' . $this->getConfig('merchant_secret')));
    }

    private function buildSignString(array $params): string
    {
        $pairs = [];
        foreach ($params as $key => $value) {
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
            $pairs[] = $key . '=' . (string) $value;
        }

        return implode('&', $pairs);
    }

    private function appendQuery(string $url, array $query): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';
        return $url . $separator . http_build_query($query);
    }
}
