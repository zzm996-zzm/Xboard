<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{ $title }} Ops</title>
  <script>
    window.__ADMIN_OPS__ = {
      appName: @json($title),
      securePath: @json($secure_path),
      version: @json($version)
    };
  </script>
  @php
    $manifestPath = public_path('assets/admin-ops/.vite/manifest.json');
    $manifest = file_exists($manifestPath) ? json_decode(file_get_contents($manifestPath), true) : null;
    $entry = is_array($manifest) ? ($manifest['index.html'] ?? null) : null;
  @endphp

  @if($entry)
    @foreach(($entry['css'] ?? []) as $css)
      <link rel="stylesheet" crossorigin href="/assets/admin-ops/{{ $css }}" />
    @endforeach
    <script type="module" crossorigin src="/assets/admin-ops/{{ $entry['file'] }}"></script>
  @else
    <script type="module" crossorigin src="/assets/admin-ops/assets/index.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/admin-ops/assets/index.css" />
  @endif
</head>
<body>
  <div id="root"></div>
</body>
</html>
