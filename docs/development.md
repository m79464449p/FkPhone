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
