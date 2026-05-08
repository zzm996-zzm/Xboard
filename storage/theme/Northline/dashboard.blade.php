<!doctype html>
<html lang="zh-CN">

<head>
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
  <script type="module" crossorigin src="/theme/{{ $theme }}/assets/index.js"></script>
  <link rel="stylesheet" crossorigin href="/theme/{{ $theme }}/assets/index.css" />
</head>

<body>
  <div id="root"></div>
</body>

</html>
