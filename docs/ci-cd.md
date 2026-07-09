# CI/CD

This project uses GitHub Actions for CI and an SSH-based manual deployment to
the staging server.

## Workflows

- `CI`: runs on pushes and pull requests to `main` and `dev`.
  - Builds the frontend.
  - Runs backend unit tests.
  - Validates and builds Docker Compose services.
- `Deploy staging`: manual only.
  - Open GitHub Actions.
  - Select `Deploy staging`.
  - Click `Run workflow`.
  - Choose a branch, tag, or commit, then deploy.

## GitHub secrets

Create these repository secrets before running `Deploy staging`:

```text
SERVER_HOST=47.116.116.42
SERVER_USER=fkphone-deploy
SERVER_SSH_KEY=<private deploy key>
```

The private deploy key is stored on the server at:

```text
/root/fkphone_actions_deploy_key
```

To show it while logged in as `root`:

```bash
cat /root/fkphone_actions_deploy_key
```

Add the whole key, including the `BEGIN OPENSSH PRIVATE KEY` and
`END OPENSSH PRIVATE KEY` lines, as `SERVER_SSH_KEY`.

## Server setup

The server needs Docker, Docker Compose, and rsync:

```bash
docker --version
docker compose version
rsync --version
```

The deployment user is `fkphone-deploy`, and the application is synced to
`/opt/fkphone`.

## Recommended usage while testing

- Push to `dev` or `main` to verify builds.
- Deploy only with the manual `Deploy staging` workflow.
- Keep `main` protected once the flow is stable.
- Add a required reviewer to the `staging` environment if you want a second
  confirmation before deployment.
