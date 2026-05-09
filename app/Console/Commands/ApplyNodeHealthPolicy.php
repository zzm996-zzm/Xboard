<?php

namespace App\Console\Commands;

use App\Services\NodeHealthPolicyService;
use Illuminate\Console\Command;

class ApplyNodeHealthPolicy extends Command
{
    protected $signature = 'node:apply-health-policy';

    protected $description = 'Apply node auto-hide health policies';

    public function handle(NodeHealthPolicyService $service): int
    {
        $hidden = $service->apply();

        foreach ($hidden as $node) {
            $this->line(sprintf(
                'Hidden node #%d %s (%s)',
                $node['id'],
                $node['name'],
                $node['reason']
            ));
        }

        $this->info(sprintf('Applied node health policies. Hidden nodes: %d', $hidden->count()));

        return self::SUCCESS;
    }
}
