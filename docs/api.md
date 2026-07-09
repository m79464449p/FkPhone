# API 文档

后端接口变更时同步维护这里。后续如果使用 FastAPI，可以从 OpenAPI 自动生成更完整的接口文档。

## 约定

- 请求路径统一使用 `/api` 前缀。
- 返回数据保持稳定字段名，删除或改名字段前需要和前端同步。
- 新增接口时补充请求参数、响应示例和错误码。

## 当前接口

### 健康检查

```http
GET /api/health
```

响应：

```json
{
  "status": "ok"
}
```

### 手机列表

```http
GET /api/phones
```

响应：

```json
[
  {
    "id": "demo-iphone",
    "name": "iPhone Demo",
    "brand": "Apple",
    "score": 88,
    "source": null,
    "source_product_id": null,
    "price": null,
    "specs": null,
    "image_url": null,
    "source_url": null,
    "version_count": 0
  }
]
```

### 手机版本参数

```http
GET /api/phones/{phone_id}/versions
```

`specs` 保存自酷安参数页的完整分组参数，包含页面里的所有 `config-item`。

响应：

```json
[
  {
    "config_id": "8959",
    "phone_id": "coolapk-5554",
    "title": "12GB+256GB",
    "price": 2799,
    "specs": [
      {
        "group": "重要参数",
        "subgroup": "性能",
        "name": "芯片",
        "value": "骁龙8 至尊版"
      }
    ],
    "source_url": "https://m.coolapk.com/mp/product/configInfo?id=8959&drawNav=1"
  }
]
```

### 手机版本对比

```http
GET /api/phones/compare?config_ids=8959&config_ids=8960
```

也支持逗号分隔：

```http
GET /api/phones/compare?config_ids=8959,8960
```

一次至少对比 2 个版本，最多 6 个版本。响应里的 `columns` 是参与对比的版本，`rows` 是按完整参数集合合并后的对比行。

响应：

```json
{
  "columns": [
    {
      "config_id": "8959",
      "phone_id": "coolapk-5554",
      "phone_name": "REDMI K90至尊版",
      "title": "12GB+256GB",
      "price": 2799,
      "source_url": "https://m.coolapk.com/mp/product/configInfo?id=8959&drawNav=1"
    }
  ],
  "rows": [
    {
      "group": "重要参数",
      "subgroup": "性能",
      "name": "芯片",
      "values": {
        "8959": "骁龙8 至尊版",
        "8960": "骁龙8 至尊版"
      }
    }
  ]
}
```

### 同步酷安数据

```http
POST /api/crawl/coolapk
```

请求：

```json
{
  "max_pages": 1,
  "fetch_versions": true
}
```

`fetch_versions` 默认值为 `true`，开启后会进入每个机型版本的参数页并保存全部参数到后端。

### 触发闲鱼搜索

```http
POST /api/goofish/search
```

请求：

```json
{
  "keywords": ["turbo5max", "tubro5max"],
  "max_results_per_keyword": 30,
  "login_timeout_seconds": 600
}
```

本地模式会启动持久化 Chromium。第一次使用时如果未登录，需要在弹出的浏览器里扫码登录；登录成功后，后续请求会复用 `GOOFISH_PROFILE_DIR` 里的浏览器会话。

响应：

```json
{
  "status": "ok",
  "keywords": ["turbo5max", "tubro5max"],
  "inserted": 12,
  "updated": 3,
  "matched": 60,
  "login_required": false,
  "message": null
}
```

### 闲鱼商品列表

```http
GET /api/goofish/listings?keyword=turbo5max&limit=50
```

`keyword` 可选；不传时返回最近看到的闲鱼商品。
