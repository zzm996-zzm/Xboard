<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Services\CommercialMetricsService;

class CommercialController extends Controller
{
    public function overview(CommercialMetricsService $service)
    {
        return $this->success($service->overview());
    }

    public function nodes(CommercialMetricsService $service)
    {
        return $this->success($service->nodes());
    }

    public function machines(CommercialMetricsService $service)
    {
        return $this->success($service->machines());
    }
}
