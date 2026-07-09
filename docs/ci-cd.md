# CI/CD

This project uses GitHub Actions with a self-hosted runner on the staging
server.

## Workflows

- `CI`: runs on pushes and pull requests to `main` and `dev`.
  - Builds the frontend.
  - Runs backend unit tests.
  - Validates and builds Docker Compose services.
- `Deploy staging`: runs automatically after `CI` succeeds on `main`.
  - Manual `Run workflow` remains available as a fallback.
  - Choose a branch, tag, or commit when running it manually.

## Server setup

The server needs Docker, Docker Compose, Node.js, Python, and the GitHub
self-hosted runner service:

```bash
docker --version
docker compose version
node --version
python3 --version
systemctl status actions.runner.m79464449p-FkPhone.fkphone-server.service
```

The runner service is installed as `github-runner` and uses the `fkphone` label.
Workflows that should run on this server use:

```yaml
runs-on:
  - self-hosted
  - fkphone
```

## Recommended usage while testing

- Push to `dev` to verify builds without deployment.
- Push to `main` to run CI on the self-hosted runner, then deploy automatically
  on the same server after CI succeeds.
- Use the manual `Deploy staging` workflow when you need to redeploy a specific
  branch, tag, or commit.
- Keep `main` protected once the flow is stable.
- Add a required reviewer to the `staging` environment if you want a second
  confirmation before deployment.
