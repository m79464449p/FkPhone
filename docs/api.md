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
