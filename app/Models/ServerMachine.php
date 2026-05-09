<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * App\Models\ServerMachine
 *
 * @property int $id
 * @property string $name 机器名称
 * @property string $token 认证 Token
 * @property string|null $notes 备注
 * @property bool $is_active 是否启用
 * @property int|null $last_seen_at 最后心跳时间
 * @property array|null $load_status 负载状态
 * @property string|null $provider_name 服务商
 * @property string|null $provider_region 服务商区域
 * @property string|null $provider_plan 套餐名称
 * @property int|null $monthly_cost 月成本（分）
 * @property string|null $cost_currency 成本币种
 * @property int|null $traffic_limit_gb 月流量上限 GB
 * @property string|null $billing_cycle 账单周期
 * @property string|null $purchase_url 购买链接
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 *
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Server> $servers 关联的节点
 */
class ServerMachine extends Model
{
    protected $table = 'v2_server_machine';

    protected $guarded = ['id'];

    protected $casts = [
        'is_active' => 'boolean',
        'last_seen_at' => 'integer',
        'load_status' => 'array',
        'monthly_cost' => 'integer',
        'traffic_limit_gb' => 'integer',
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
    ];

    protected $hidden = ['token'];

    public function servers(): HasMany
    {
        return $this->hasMany(Server::class, 'machine_id');
    }

    public function loadHistory(): HasMany
    {
        return $this->hasMany(ServerMachineLoadHistory::class, 'machine_id');
    }

    /**
     * 生成新的随机 Token
     */
    public static function generateToken(): string
    {
        return Str::random(32);
    }

    /**
     * 更新最后心跳时间
     */
    public function updateHeartbeat(): bool
    {
        return $this->forceFill(['last_seen_at' => now()->timestamp])->save();
    }

    public function getSetupStatusAttribute(): string
    {
        if (!$this->last_seen_at) {
            return 'not_connected';
        }

        return $this->last_seen_at >= now()->subSeconds(180)->timestamp
            ? 'online'
            : 'stale';
    }
}
