<?php

namespace App\Services;

use App\Models\Server;
use Illuminate\Support\Collection;

class NodeHealthPolicyService
{
    public function apply(): Collection
    {
        return Server::query()
            ->with('machine')
            ->where('auto_hide_enabled', true)
            ->get()
            ->map(fn(Server $server) => $this->applyToServer($server))
            ->filter()
            ->values();
    }

    public function applyToServer(Server $server): ?array
    {
        $reason = $this->getHideReason($server);
        if (!$reason) {
            return null;
        }

        if (!$server->show && $server->auto_hide_reason === $reason) {
            return null;
        }

        $server->forceFill([
            'show' => false,
            'auto_hide_reason' => $reason,
            'auto_hide_at' => time(),
        ])->save();

        return [
            'id' => $server->id,
            'name' => $server->name,
            'reason' => $reason,
        ];
    }

    private function getHideReason(Server $server): ?string
    {
        if ($this->isOffline($server)) {
            return 'offline';
        }

        if ($this->isOverTrafficThreshold($server)) {
            return 'traffic_threshold';
        }

        if ($this->isOverCpuThreshold($server)) {
            return 'cpu_threshold';
        }

        return null;
    }

    private function isOffline(Server $server): bool
    {
        $minutes = $server->health_offline_minutes ?: 30;
        $lastCheckAt = $server->last_check_at;

        return !$lastCheckAt || (time() - (int) $lastCheckAt) > ($minutes * 60);
    }

    private function isOverTrafficThreshold(Server $server): bool
    {
        $limit = (int) ($server->transfer_enable ?? 0);
        if ($limit <= 0) {
            return false;
        }

        $threshold = $server->health_traffic_threshold ?: 95;
        $used = (int) $server->u + (int) $server->d;

        return ($used / $limit * 100) >= $threshold;
    }

    private function isOverCpuThreshold(Server $server): bool
    {
        $threshold = $server->health_cpu_threshold ?: 95;
        $cpu = data_get($server->load_status, 'cpu');

        if ($cpu === null && $server->machine) {
            $cpu = data_get($server->machine->load_status, 'cpu');
        }

        return $cpu !== null && (float) $cpu >= $threshold;
    }
}
