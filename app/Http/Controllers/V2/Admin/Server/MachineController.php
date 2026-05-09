<?php

namespace App\Http\Controllers\V2\Admin\Server;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Server;
use App\Models\ServerMachine;
use App\Models\ServerMachineLoadHistory;
use App\Services\NodeSyncService;
use Illuminate\Http\Request;

class MachineController extends Controller
{
    /**
     * 获取机器列表（附带关联节点数）
     */
    public function fetch(Request $request)
    {
        $machines = ServerMachine::withCount('servers')
            ->orderBy('id')
            ->get()
            ->map(function (ServerMachine $machine) {
                return $this->serializeMachine($machine, includeInstallCommand: true);
            });

        return $this->success($machines);
    }

    /**
     * 创建 / 更新机器
     */
    public function save(Request $request)
    {
        $params = $request->validate([
            'id' => 'nullable|integer|exists:v2_server_machine,id',
            'name' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'provider_name' => 'nullable|string|max:255',
            'provider_region' => 'nullable|string|max:255',
            'provider_plan' => 'nullable|string|max:255',
            'monthly_cost' => 'nullable|integer|min:0',
            'cost_currency' => 'nullable|string|max:8',
            'traffic_limit_gb' => 'nullable|integer|min:0',
            'billing_cycle' => 'nullable|string|max:255',
            'purchase_url' => 'nullable|string',
        ]);

        if (!empty($params['id'])) {
            $machine = ServerMachine::find($params['id']);
            $update = [];
            foreach ([
                'name',
                'notes',
                'is_active',
                'provider_name',
                'provider_region',
                'provider_plan',
                'monthly_cost',
                'cost_currency',
                'traffic_limit_gb',
                'billing_cycle',
                'purchase_url',
            ] as $field) {
                if (array_key_exists($field, $params)) {
                    $update[$field] = $params[$field];
                }
            }
            $machine->update($update);
            return $this->success(true);
        }

        $machine = ServerMachine::create([
            'name' => $params['name'],
            'notes' => $params['notes'] ?? null,
            'is_active' => $params['is_active'] ?? true,
            'provider_name' => $params['provider_name'] ?? null,
            'provider_region' => $params['provider_region'] ?? null,
            'provider_plan' => $params['provider_plan'] ?? null,
            'monthly_cost' => $params['monthly_cost'] ?? null,
            'cost_currency' => $params['cost_currency'] ?? 'USD',
            'traffic_limit_gb' => $params['traffic_limit_gb'] ?? null,
            'billing_cycle' => $params['billing_cycle'] ?? null,
            'purchase_url' => $params['purchase_url'] ?? null,
            'token' => ServerMachine::generateToken(),
        ]);

        return $this->success($this->serializeMachine($machine, includeInstallCommand: true, includeToken: true));
    }

    /**
     * 重置机器 Token
     */
    public function resetToken(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer|exists:v2_server_machine,id',
        ]);

        $machine = ServerMachine::find($params['id']);
        $token = ServerMachine::generateToken();
        $machine->update(['token' => $token]);

        return $this->success(['token' => $token]);
    }

    /**
     * 获取机器 Token（仅展示一次，用于首次配置）
     */
    public function getToken(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer|exists:v2_server_machine,id',
        ]);

        $machine = ServerMachine::find($params['id']);

        return $this->success(['token' => $machine->token]);
    }

    /**
     * 获取机器模式一键安装命令
     */
    public function installCommand(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer|exists:v2_server_machine,id',
        ]);

        $machine = ServerMachine::find($params['id']);

        return $this->success([
            'command' => $this->buildInstallCommand($request, $machine),
        ]);
    }

    /**
     * 删除机器（自动解除关联节点）
     */
    public function drop(Request $request)
    {
        $params = $request->validate([
            'id' => 'required|integer|exists:v2_server_machine,id',
        ]);

        $machine = ServerMachine::find($params['id']);
        $machineId = $machine->id;

        // Detach nodes first (sets machine_id = null), then delete and notify
        Server::where('machine_id', $machineId)->update(['machine_id' => null]);
        $machine->delete();

        // Notify with empty node list so WS process cleans up registry
        NodeSyncService::notifyMachineNodesChanged($machineId);

        return $this->success(true);
    }

    /**
     * 获取机器下的节点列表
     */
    public function nodes(Request $request)
    {
        $params = $request->validate([
            'machine_id' => 'required|integer|exists:v2_server_machine,id',
        ]);

        $nodes = Server::where('machine_id', $params['machine_id'])
            ->orderBy('sort')
            ->get(['id', 'name', 'type', 'host', 'port', 'show', 'enabled', 'sort']);

        return $this->success($nodes);
    }

    /**
     * 获取机器负载历史
     */
    public function history(Request $request)
    {
        $params = $request->validate([
            'machine_id' => 'required|integer|exists:v2_server_machine,id',
            'limit' => 'nullable|integer|min:10|max:1440',
            'range_hours' => 'nullable|integer|min:1|max:24',
        ]);

        $query = ServerMachineLoadHistory::query()
            ->where('machine_id', $params['machine_id']);

        if (!empty($params['range_hours'])) {
            $query->where('recorded_at', '>=', now()->subHours((int) $params['range_hours'])->timestamp);
        }

        $limit = (int) ($params['limit'] ?? 60);

        $history = $query
            ->orderByDesc('recorded_at')
            ->limit($limit)
            ->get([
                'cpu',
                'mem_total',
                'mem_used',
                'disk_total',
                'disk_used',
                'net_in_speed',
                'net_out_speed',
                'recorded_at',
            ])
            ->reverse()
            ->values();

        return $this->success($history);
    }

    private function buildInstallCommand(Request $request, ServerMachine $machine): string
    {
        $panelUrl = rtrim((string) (admin_setting('app_url') ?: $request->getSchemeAndHttpHost()), '/');
        $installerUrl = 'https://raw.githubusercontent.com/cedar2025/xboard-node/dev/install.sh';

        return sprintf(
            'curl -fsSL %s | sudo bash -s -- --mode machine --panel %s --token %s --machine-id %d',
            $installerUrl,
            escapeshellarg($panelUrl),
            escapeshellarg($machine->token),
            $machine->id
        );
    }

    private function serializeMachine(
        ServerMachine $machine,
        bool $includeInstallCommand = false,
        bool $includeToken = false
    ): array {
        $data = [
            'id' => $machine->id,
            'name' => $machine->name,
            'notes' => $machine->notes,
            'is_active' => $machine->is_active,
            'last_seen_at' => $machine->last_seen_at,
            'setup_status' => $machine->setup_status,
            'load_status' => $machine->load_status,
            'servers_count' => $machine->servers_count ?? $machine->servers()->count(),
            'provider_name' => $machine->provider_name,
            'provider_region' => $machine->provider_region,
            'provider_plan' => $machine->provider_plan,
            'monthly_cost' => $machine->monthly_cost,
            'cost_currency' => $machine->cost_currency,
            'traffic_limit_gb' => $machine->traffic_limit_gb,
            'billing_cycle' => $machine->billing_cycle,
            'purchase_url' => $machine->purchase_url,
            'created_at' => $machine->created_at,
            'updated_at' => $machine->updated_at,
        ];

        if ($includeInstallCommand) {
            $data['install_command'] = $this->buildInstallCommand(request(), $machine);
        }

        if ($includeToken) {
            $data['token'] = $machine->token;
        }

        return $data;
    }
}
