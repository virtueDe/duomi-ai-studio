# Duomi AI Studio 发布与部署

Duomi 使用独立 Docker 镜像发布，不依赖 Sub2API 的源码构建。正式发布通过 Git tag 触发：

```bash
git add -A
git commit -m "feat: ..."
git push origin master
git tag v0.1.0
git push origin v0.1.0
```

推送 `v0.1.0` 后，GitHub Actions 会构建并推送 GHCR 镜像、上传 Compose 文件、更新服务器镜像并重启 Duomi 容器。

## GitHub 配置

必填 Secrets：`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_KNOWN_HOSTS`。

Sub2API 已经配置过的 SSH 参数可以直接沿用。若这些是 GitHub Organization Secrets，并且已授权给 `duomi-ai-studio`，Duomi 无需重复配置；若它们是 Sub2API 仓库级 Secrets，需要在 Duomi 仓库再次添加同名值，或者将它们提升为对两个仓库可见的 Organization Secrets。Secret 的值无法从一个仓库读取或自动复制到另一个仓库。

在 Duomi 仓库的 `Settings -> Secrets and variables -> Actions -> New repository secret` 中确认以下参数：

| Secret | 填写内容 |
| --- | --- |
| `DEPLOY_HOST` | 与 Sub2API 相同的服务器公网域名或 IP。 |
| `DEPLOY_USER` | 与 Sub2API 相同的 Linux SSH 用户；该用户需要能执行 Docker 命令。 |
| `DEPLOY_SSH_KEY` | 与 Sub2API 相同的 SSH 私钥全文。 |
| `DEPLOY_KNOWN_HOSTS` | 与 Sub2API 相同的服务器 SSH 主机指纹全文。 |

如果 Sub2API 使用的是仓库级 Secret，复制已有值即可，不需要重新生成密钥。只有还没有配置时，才需要生成专用密钥：

```powershell
ssh-keygen -t ed25519 -C "github-actions-duomi" -f "$HOME\.ssh\duomi_actions_ed25519"
Get-Content "$HOME\.ssh\duomi_actions_ed25519" -Raw
ssh-keyscan -H -p 22 studio.example.com
```

把 `.pub` 公钥内容加入服务器部署用户的 `~/.ssh/authorized_keys`，把私钥文件内容粘贴到 `DEPLOY_SSH_KEY`，把 `ssh-keyscan` 的输出粘贴到 `DEPLOY_KNOWN_HOSTS`。`ssh-keyscan` 的主机名必须和 `DEPLOY_HOST` 使用的主机名一致；如果使用非 22 端口，需要同时配置可选 Secret `DEPLOY_PORT`，并使用相同端口执行 `ssh-keyscan -p <端口>`。

服务器初始化示例：

```bash
sudo useradd --create-home --shell /bin/bash deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/proxy/duomi-studio
sudo chown -R deploy:deploy /opt/proxy/duomi-studio
```

配置完成后，先在本地验证 SSH 和 Docker 权限：

```powershell
ssh -i "$HOME\.ssh\duomi_actions_ed25519" deploy@studio.example.com "docker version && docker compose version"
```

如果 GHCR 中的 `duomi-ai-studio` 镜像是私有的，还要增加 `GHCR_DEPLOY_USERNAME` 和 `GHCR_DEPLOY_TOKEN` 两个 Secrets。Token 至少需要 `read:packages` 权限；镜像公开时不需要这两个值。

可选 Secrets：`DEPLOY_PORT`（默认 22）、`DUOMI_DEPLOY_DIR`（默认 `/opt/proxy/duomi-studio`）、`DUOMI_DEPLOY_COMPOSE_FILE`（默认 `docker-compose.duomi.yml`）、`GHCR_DEPLOY_USERNAME`、`GHCR_DEPLOY_TOKEN`、`VITE_API_BASE_URL`。

不要把 Sub2API 的 `DEPLOY_DIR` 或 `DEPLOY_COMPOSE_FILE` 原值复制给 Duomi；Sub2API 默认目录是 `/opt/proxy/sub2api`。如果需要覆盖 Duomi 默认值，只配置上面两个 `DUOMI_` 参数。

Actions Variables：`VITE_BASE_PATH=/duomi-studio/`、`VITE_SUB2API_BASE_URL=`（同源代理时留空）、`VITE_PROVIDER_DEFAULT_BASE_URL=https://api.chatfire.site/v1`。

镜像通过 GitHub Actions 内置 `GITHUB_TOKEN` 推送到 GHCR，不需要 Docker Hub 凭据。

## 服务器首次初始化

服务器需要安装 Docker Compose，并创建部署目录。首次部署前，把 `.env.production.example` 复制到服务器并填写真实配置：

```bash
sudo mkdir -p /opt/proxy/duomi-studio
sudo cp .env.production.example /opt/proxy/duomi-studio/.env.production
sudo nano /opt/proxy/duomi-studio/.env.production
```

当前 Duomi Compose 会随应用启动一个独立的 MariaDB 容器，因此 `.env.production` 还需要填写 `MARIADB_DATABASE`、`MARIADB_USER`、`MARIADB_PASSWORD`、`MARIADB_ROOT_PASSWORD`，并让 `DATABASE_URL` 指向 `mariadb` 服务。生产环境必须长期保持数据库密码和 `PROVIDER_CONFIG_SECRET`、`STORAGE_CONFIG_SECRET` 不变，否则已有数据或加密配置无法读取。

`SUB2API_BASE_URL` 填 Sub2API 的公开 API 地址；当前使用 `https://subapi.duomi.cloud`。同源部署时 `VITE_API_BASE_URL` 和 `VITE_SUB2API_BASE_URL` 可以留空，`CORS_ALLOWED_ORIGINS` 配置为 `https://subapi.duomi.cloud,https://duomi.cloud`，以允许两个入口域名访问 Duomi。

R2/S3 不放进 GitHub Secrets。服务启动后，在 Duomi 管理后台的对象存储配置中填写 Endpoint、Bucket、Access Key 和 Secret Key，测试通过后再设为默认配置；密钥会加密写入 Duomi 数据库。

首次手动启动时，在部署目录准备 `.env`：

```text
APP_ENV_FILE=.env.production
DUOMI_IMAGE=ghcr.io/<github-owner>/duomi-ai-studio:0.1.0
```

再把 `deploy/docker-compose.duomi.yml` 上传为 `docker-compose.duomi.yml`，然后执行：

```bash
docker compose -f docker-compose.duomi.yml config --quiet
docker compose -f docker-compose.duomi.yml pull app
docker compose -f docker-compose.duomi.yml up -d --no-deps app
```

如果 GHCR 镜像是私有的，先在服务器执行 `docker login ghcr.io`。

## 手动部署或回滚

在 Actions 中运行 `Duomi AI Studio 手动部署`，填写要部署的镜像 tag，例如 `0.1.0`。该流程只更新镜像，不覆盖服务器 `.env.production`。

发布后检查：

```bash
docker compose -f docker-compose.duomi.yml ps app
docker compose -f docker-compose.duomi.yml logs --tail=100 app
curl -fsS http://127.0.0.1:5409/api/health
```

外部入口还要确认 Sub 的反向代理已经配置 `/duomi-studio/` 和根 `/api/*` 到 Duomi 服务。
