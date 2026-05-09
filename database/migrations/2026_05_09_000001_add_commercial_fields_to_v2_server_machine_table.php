<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('v2_server_machine', function (Blueprint $table) {
            if (!Schema::hasColumn('v2_server_machine', 'provider_name')) {
                $table->string('provider_name')->nullable()->after('load_status');
            }
            if (!Schema::hasColumn('v2_server_machine', 'provider_region')) {
                $table->string('provider_region')->nullable()->after('provider_name');
            }
            if (!Schema::hasColumn('v2_server_machine', 'provider_plan')) {
                $table->string('provider_plan')->nullable()->after('provider_region');
            }
            if (!Schema::hasColumn('v2_server_machine', 'monthly_cost')) {
                $table->integer('monthly_cost')->nullable()->after('provider_plan');
            }
            if (!Schema::hasColumn('v2_server_machine', 'cost_currency')) {
                $table->string('cost_currency', 8)->nullable()->default('USD')->after('monthly_cost');
            }
            if (!Schema::hasColumn('v2_server_machine', 'traffic_limit_gb')) {
                $table->integer('traffic_limit_gb')->nullable()->after('cost_currency');
            }
            if (!Schema::hasColumn('v2_server_machine', 'billing_cycle')) {
                $table->string('billing_cycle')->nullable()->after('traffic_limit_gb');
            }
            if (!Schema::hasColumn('v2_server_machine', 'purchase_url')) {
                $table->text('purchase_url')->nullable()->after('billing_cycle');
            }
        });
    }

    public function down(): void
    {
        Schema::table('v2_server_machine', function (Blueprint $table) {
            $columns = [
                'provider_name',
                'provider_region',
                'provider_plan',
                'monthly_cost',
                'cost_currency',
                'traffic_limit_gb',
                'billing_cycle',
                'purchase_url',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('v2_server_machine', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
