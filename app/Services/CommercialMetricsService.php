<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Server;
use App\Models\ServerMachine;
use App\Models\StatServer;

class CommercialMetricsService
{
    public function overview(): array
    {
        $nodes = $this->nodes();
        $machines = $this->machines();
        $monthRevenue = $this->monthRevenue();
        $nodeCost = array_sum(array_column($nodes, 'monthly_cost'));
        $machineCost = array_sum(array_column($machines, 'monthly_cost'));
        $monthTraffic = array_sum(array_column($nodes, 'month_traffic_bytes'));

        return [
            'currency' => $this->primaryCurrency($nodes, $machines),
            'month_revenue' => $monthRevenue,
            'configured_monthly_node_cost' => $nodeCost,
            'configured_monthly_machine_cost' => $machineCost,
            'configured_monthly_cost' => $nodeCost + $machineCost,
            'estimated_gross_margin' => $monthRevenue - $nodeCost - $machineCost,
            'online_nodes' => collect($nodes)->where('is_online', 1)->count(),
            'offline_nodes' => collect($nodes)->where('is_online', 0)->count(),
            'hidden_nodes' => collect($nodes)->where('show', false)->count(),
            'month_traffic_bytes' => $monthTraffic,
        ];
    }

    public function nodes(): array
    {
        $monthStart = strtotime(date('Y-m-1'));
        $trafficByNode = StatServer::query()
            ->where('record_at', '>=', $monthStart)
            ->selectRaw('server_id, SUM(u + d) as total')
            ->groupBy('server_id')
            ->pluck('total', 'server_id');

        return Server::query()
            ->with('machine')
            ->orderBy('sort')
            ->get()
            ->append(['is_online', 'last_check_at'])
            ->map(function (Server $server) use ($trafficByNode) {
                $monthTraffic = (int) ($trafficByNode[$server->id] ?? 0);
                $limit = (int) ($server->transfer_enable ?? 0);
                $usage = $limit > 0 ? round($monthTraffic / $limit * 100, 2) : null;
                $cost = $server->monthly_cost ?? 0;

                return [
                    'id' => $server->id,
                    'name' => $server->name,
                    'type' => $server->type,
                    'host' => $server->host,
                    'rate' => (float) $server->getCurrentRate(),
                    'show' => (bool) $server->show,
                    'enabled' => (bool) $server->enabled,
                    'is_online' => (int) $server->is_online,
                    'last_check_at' => $server->last_check_at,
                    'provider_name' => $server->provider_name ?: $server->machine?->provider_name,
                    'provider_plan' => $server->provider_plan ?: $server->machine?->provider_plan,
                    'monthly_cost' => $cost,
                    'cost_currency' => $server->cost_currency ?: $server->machine?->cost_currency,
                    'machine_id' => $server->machine_id,
                    'machine_name' => $server->machine?->name,
                    'month_traffic_bytes' => $monthTraffic,
                    'traffic_limit_bytes' => $limit,
                    'traffic_usage_percent' => $usage,
                    'risk' => $this->nodeRisk($server, $usage),
                    'auto_hide_enabled' => (bool) $server->auto_hide_enabled,
                    'auto_hide_reason' => $server->auto_hide_reason,
                    'auto_hide_at' => $server->auto_hide_at,
                ];
            })
            ->values()
            ->all();
    }

    public function machines(): array
    {
        $monthStart = strtotime(date('Y-m-1'));

        return ServerMachine::query()
            ->withCount('servers')
            ->with('servers:id,machine_id')
            ->orderBy('id')
            ->get()
            ->map(function (ServerMachine $machine) use ($monthStart) {
                $nodeIds = $machine->servers->pluck('id');
                $traffic = $nodeIds->isEmpty()
                    ? 0
                    : (int) StatServer::query()
                        ->whereIn('server_id', $nodeIds)
                        ->where('record_at', '>=', $monthStart)
                        ->selectRaw('SUM(u + d) as total')
                        ->value('total');

                $limitBytes = $machine->traffic_limit_gb
                    ? $machine->traffic_limit_gb * 1024 * 1024 * 1024
                    : null;

                return [
                    'id' => $machine->id,
                    'name' => $machine->name,
                    'is_active' => (bool) $machine->is_active,
                    'setup_status' => $machine->setup_status,
                    'last_seen_at' => $machine->last_seen_at,
                    'load_status' => $machine->load_status,
                    'servers_count' => $machine->servers_count,
                    'provider_name' => $machine->provider_name,
                    'provider_region' => $machine->provider_region,
                    'provider_plan' => $machine->provider_plan,
                    'monthly_cost' => $machine->monthly_cost ?? 0,
                    'cost_currency' => $machine->cost_currency,
                    'traffic_limit_gb' => $machine->traffic_limit_gb,
                    'billing_cycle' => $machine->billing_cycle,
                    'month_traffic_bytes' => $traffic,
                    'traffic_limit_bytes' => $limitBytes,
                    'traffic_usage_percent' => $limitBytes ? round($traffic / $limitBytes * 100, 2) : null,
                ];
            })
            ->values()
            ->all();
    }

    private function monthRevenue(): int
    {
        return (int) Order::query()
            ->where('created_at', '>=', strtotime(date('Y-m-1')))
            ->where('created_at', '<', time())
            ->whereNotIn('status', [0, 2])
            ->sum('total_amount');
    }

    private function nodeRisk(Server $server, ?float $trafficUsage): string
    {
        if (!$server->show) {
            return 'hidden';
        }

        if (!$server->is_online) {
            return 'offline';
        }

        if ($trafficUsage !== null && $trafficUsage >= 90) {
            return 'traffic_high';
        }

        return 'ok';
    }

    private function primaryCurrency(array $nodes, array $machines): string
    {
        foreach ([...$nodes, ...$machines] as $item) {
            if (!empty($item['cost_currency'])) {
                return $item['cost_currency'];
            }
        }

        return 'USD';
    }
}
