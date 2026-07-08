# 架构说明

## 模块

- `frontend/`：负责页面、交互和数据展示。
- `backend/`：负责 API、用户、商品、价格、评论等业务逻辑。
- `crawler/`：负责采集手机、价格、评论、参数等原始数据。
- `database/`：负责数据库初始化、迁移和结构说明。
- `deploy/`：负责部署相关配置。

## 早期原则

- 先跑通最小闭环：采集数据 -> 入库 -> API 输出 -> 前端展示。
- 先保持简单，等模块变复杂后再拆服务或拆仓库。
- AI 分析暂不接入，后续在数据质量和产品流程稳定后再设计独立模块。

## 采集来源

- 酷安机型搜索：`https://m.coolapk.com/mp/productSelector/configSearch?&callFunction=indexSearch`
- 酷安版本接口：`https://m.coolapk.com/mp/productSelector/getProductVersion`
- 酷安版本参数页：`https://m.coolapk.com/mp/product/configInfo?id={configId}&drawNav=1`

## 服务端口

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8000`
