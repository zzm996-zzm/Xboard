<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('v2_server', function (Blueprint $table) {
            if (!Schema::hasColumn('v2_server', 'provider_name')) {
                $table->string('provider_name')->nullable()->after('machine_id');
            }
            if (!Schema::hasColumn('v2_server', 'provider_plan')) {
                $table->string('provider_plan')->nullable()->after('provider_name');
            }
            if (!Schema::hasColumn('v2_server', 'monthly_cost')) {
                $table->integer('monthly_cost')->nullable()->after('provider_plan');
            }
            if (!Schema::hasColumn('v2_server', 'cost_currency')) {
                $table->string('cost_currency', 8)->nullable()->default('USD')->after('monthly_cost');
            }
            if (!Schema::hasColumn('v2_server', 'traffic_cost_per_gb')) {
                $table->integer('traffic_cost_per_gb')->nullable()->after('cost_currency');
            }
            if (!Schema::hasColumn('v2_server', 'commercial_notes')) {
                $table->text('commercial_notes')->nullable()->after('traffic_cost_per_gb');
            }
            if (!Schema::hasColumn('v2_server', 'auto_hide_enabled')) {
                $table->boolean('auto_hide_enabled')->default(false)->after('commercial_notes');
            }
            if (!Schema::hasColumn('v2_server', 'auto_hide_reason')) {
                $table->string('auto_hide_reason')->nullable()->after('auto_hide_enabled');
            }
            if (!Schema::hasColumn('v2_server', 'auto_hide_at')) {
                $table->integer('auto_hide_at')->nullable()->after('auto_hide_reason');
            }
            if (!Schema::hasColumn('v2_server', 'health_offline_minutes')) {
                $table->integer('health_offline_minutes')->nullable()->default(30)->after('auto_hide_at');
            }
            if (!Schema::hasColumn('v2_server', 'health_traffic_threshold')) {
                $table->integer('health_traffic_threshold')->nullable()->default(95)->after('health_offline_minutes');
            }
            if (!Schema::hasColumn('v2_server', 'health_cpu_threshold')) {
                $table->integer('health_cpu_threshold')->nullable()->default(95)->after('health_traffic_threshold');
            }
        });
    }

    public function down(): void
    {
        Schema::table('v2_server', function (Blueprint $table) {
            $columns = [
                'provider_name',
                'provider_plan',
                'monthly_cost',
                'cost_currency',
                'traffic_cost_per_gb',
                'commercial_notes',
                'auto_hide_enabled',
                'auto_hide_reason',
                'auto_hide_at',
                'health_offline_minutes',
                'health_traffic_threshold',
                'health_cpu_threshold',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('v2_server', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
