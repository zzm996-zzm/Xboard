<!doctype html>
<html lang="zh-CN">

<head>
  @php
    $themeName = $theme ?? 'Northline';
    $publicAssetPath = public_path("theme/{$themeName}/assets/index.js");
    $storageAssetPath = base_path("storage/theme/{$themeName}/assets/index.js");
    $assetVersion = file_exists($publicAssetPath)
      ? filemtime($publicAssetPath)
      : (file_exists($storageAssetPath) ? filemtime($storageAssetPath) : ($version ?? '1'));
  @endphp
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230071e3'/%3E%3Cpath d='M17 39c7-18 23-18 30-2M22 27c6-7 15-7 21 0' stroke='white' stroke-width='6' stroke-linecap='round' fill='none'/%3E%3Ccircle cx='32' cy='43' r='4' fill='white'/%3E%3C/svg%3E" />
  <title>{{ $title ?? 'Northline' }}</title>
  <script>
    window.settings = {
      title: @json($title ?? 'Northline'),
      description: @json($description ?? ''),
      version: @json($version ?? ''),
      logo: @json($logo ?? null)
    };
  </script>
  <script type="module" crossorigin src="/theme/{{ $themeName }}/assets/index.js?v={{ $assetVersion }}"></script>
  <link rel="stylesheet" crossorigin href="/theme/{{ $themeName }}/assets/index.css?v={{ $assetVersion }}" />
</head>

<body>
  <div id="root"></div>
</body>

</html>
