# FkPhone

一个面向手机数据采集、分析和展示的长期项目。当前采用单仓库结构，先把前端、后端、爬虫、AI 分析和文档放在同一个 Git 仓库里，方便两个人早期协作和同步接口变化。

## 项目结构

```text
FkPhone/
├── frontend/       # 前端应用，React + Vite + TypeScript
├── backend/        # 后端 API 服务，FastAPI
├── crawler/        # 数据采集与爬虫，Scrapy
├── database/       # 数据库初始化、迁移和模型说明
├── deploy/         # Docker、部署脚本、环境配置模板
├── docs/           # 产品、接口、架构和开发约定
└── README.md
```

## 本地启动

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

后端默认读取 `DATABASE_URL` 连接 PostgreSQL：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fkphone
```

### 爬虫

```bash
cd crawler
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
scrapy list
```

## 协作约定

- 目录负责区分模块，例如 `frontend/` 和 `backend/`。
- 分支负责区分开发过程，例如 `feature/phone-detail`、`bugfix/crawler-timeout`。
- 不使用 `frontend-branch`、`backend-branch` 这类长期模块分支。
- 接口变更需要同步更新 `docs/api.md` 或 OpenAPI 文档。
- 本地密钥写入 `.env`，仓库只提交 `.env.example`。
- AI 能力暂不接入，等数据、接口和展示流程成熟后再新增独立模块。

## 推荐分支

```text
main
├── feature/xxx
└── bugfix/xxx
```

早期两个人协作可以直接从 `main` 拉功能分支，功能完成后合并回 `main`。等部署流程稳定后，再考虑增加 `develop` 分支。
