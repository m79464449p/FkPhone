# 开发约定

## 分支

- `main`：稳定代码。
- `feature/xxx`：功能开发。
- `bugfix/xxx`：问题修复。

## 提交

提交信息尽量说明做了什么，例如：

```bash
git commit -m "新增手机详情接口"
git commit -m "初始化前端项目"
git commit -m "补充价格采集脚本"
```

## 环境变量

- 本地使用 `.env`。
- 仓库提交 `.env.example`。
- 不提交真实密钥、数据库密码和第三方平台 Token。

## PostgreSQL

本地开发默认数据库名：

```text
fkphone
```

连接配置写入项目根目录 `.env`：

```env
DATABASE_URL=postgresql://用户名:密码@localhost:5432/fkphone
```

## 闲鱼本地采集

后端通过 Playwright 启动一个持久化 Chromium profile。第一次搜索时需要人工扫码登录，登录态保存在 `GOOFISH_PROFILE_DIR`。

安装依赖：

```bash
cd backend
pip install -r requirements.txt
python -m playwright install chromium
```

推荐本地环境变量：

```env
GOOFISH_PROFILE_DIR=../.goofish-profile
GOOFISH_HEADLESS=false
GOOFISH_LOGIN_TIMEOUT_SECONDS=180
```

触发搜索：

```bash
curl -X POST http://localhost:8000/api/goofish/search \
  -H 'Content-Type: application/json' \
  -d '{"keywords":["turbo5max","tubro5max"],"max_results_per_keyword":30}'
```

查看入库结果：

```bash
curl 'http://localhost:8000/api/goofish/listings?keyword=turbo5max'
```

服务器部署时继续复用同一思路：挂载持久化 profile 目录。首次登录需要服务器提供可视化浏览器入口，例如 noVNC；登录完成后定时任务只需要调用同一个搜索接口。
