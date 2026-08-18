# multiple-chat-panels 开源发布操作指南

本文档从零开始：建 GitHub 仓库 → 生成 token → 填空 → 发布 npm → 打 Release → 社区曝光。

> 约定：`WilliamShi666` 指你的 GitHub/npm 用户名，`<版本>` 指版本号（例如 `0.0.1`）。

## 0. 前置条件

- 本机已装 Node.js（建议 `>=22`）、npm、git；可选装 [GitHub CLI `gh`](https://cli.github.com/)。
- 有 GitHub 账号、npm 账号。
- 插件已经构建好：`npm run build && npm run build:client`。

## 1. 创建 GitHub 仓库

### 方式 A：网页
1. 打开 <https://github.com/new>。
2. 填空：
   - **Repository name**：`multiple-chat-panels`
   - **Description**：`Multiple chat panels for DeepSeek Harness: view and interact with several agent sessions side by side.`
   - **Visibility**：选 `Public`
   - 不要勾选 *Add a README file*、*.gitignore*、*license*（我们已经有这些文件，避免冲突）。
3. 点 **Create repository**。
4. 记下仓库地址，例如 `https://github.com/WilliamShi666/dsh-multiple-chat-panels.git`。

### 方式 B：gh CLI（推荐，如果你有 gh 且已登录）
在本地准备好插件目录后直接执行：

```bash
cd multiple-chat-panels
gh repo create dsh-multiple-chat-panels --public --source . --remote origin --push
```

## 2. 创建 GitHub Token（PAT）

用途：本地用 gh 推送/发 Release，或给 GitHub Actions 发 Release 用。

1. 打开 <https://github.com/settings/tokens>。
2. 点 **Generate new token (classic)**。
3. 填：
   - **Note**：例如 `multiple-chat-panels release`
   - **Expiration**：按需（建议 90 天）
   - **Select scopes**：勾选 `repo`（完整控制你的仓库）；如果之后要在 Actions 里写 workflow 文件，再勾 `workflow`。
4. 点 **Generate token**，复制保存（只显示一次，别提交到仓库）。

如果使用 gh CLI，也可以直接：

```bash
gh auth login
# 选 GitHub.com → HTTPS → 用浏览器或粘贴 token
```

## 3. 创建 npm Token

用途：`npm publish`（本地或 CI）。

1. 打开 <https://www.npmjs.com/settings/WilliamShi666/tokens>。
2. 点 **Generate New Token**。
3. 类型：
   - 只用本地发布：选 `Publish`；
   - 给 GitHub Actions 用：选 `Automation`（CI 专用）。
4. 填名字（如 `multiple-chat-panels-publish`），生成后复制保存。

## 4. 需要填空的地方（package.json）

打开 `package.json`，在合适位置补这些字段（把 `WilliamShi666` 换成真实的）：

```jsonc
{
  "name": "multiple-chat-panels",
  "version": "0.0.1",
  "license": "MIT",
  "author": {
    "name": "你的名字或昵称",
    "url": "https://github.com/WilliamShi666"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/WilliamShi666/dsh-multiple-chat-panels.git"
  },
  "homepage": "https://github.com/WilliamShi666/dsh-multiple-chat-panels#readme",
  "bugs": {
    "url": "https://github.com/WilliamShi666/dsh-multiple-chat-panels/issues"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": [
    "lib",
    "cordis.patch.yml",
    "README.md",
    "LICENSE",
    "FUTURE_UPSTREAM.md"
  ],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

要点：
- `name` 不要带 scope，社区安装命令就是 `dsh plugin --profile web add multiple-chat-panels`。
- `version` 首次发布用 `0.0.1` 可以；想正式一点可改成 `0.1.0`。
- `files` 已包含发布必需内容；不要加 `node_modules`、`.scratch`。
- `private: true` 必须**没有**，否则 `npm publish` 会拒绝。
- `LICENSE` 文件里如果写了具体作者，请改成你的名字；保持 MIT 协议文本即可。

## 5. 本地初始化 git 并推送

如果是从 DSH monorepo 里复制出来的，先做一次“独立仓库清理”：

```bash
# 假设你在 monorepo 根目录
mkdir -p /tmp/mcp-release && cd /tmp/mcp-release
# 复制发布所需内容（不要复制 node_modules、.scratch）
cp -R /Users/williamshi666/Developers/deepseek-harness-studio/multiple-chat-panels .
cd multiple-chat-panels
rm -rf node_modules .scratch
```

然后：

```bash
git init
git add .
git commit -m "feat: initial public release of multiple-chat-panels"
git branch -M main
git remote add origin git@github.com:WilliamShi666/dsh-multiple-chat-panels.git
git push -u origin main
```

> 如果你已经用 `gh repo create --source . --remote origin --push`，这步会自动完成。

**重要**：为了让别人从 GitHub 直接安装、也让 CI 不用构建就能发布，建议把 `lib/` 提交进仓库。做法：删除 `.gitignore` 里的 `lib/` 这一行（保留 `node_modules/`、`*.tsbuildinfo`、`*.tgz`），再 `git add .`。

## 6. 发布前自检

```bash
cd multiple-chat-panels
npm run build
npm run build:client
npm pack --dry-run
```

确认输出包含：
- `lib/client.js`、`lib/client.js.map`、`lib/index.js`、`lib/types/index.d.ts`
- `cordis.patch.yml`
- `README.md`、`LICENSE`
- `package.json`

如果没有 `lib/`，说明你没构建，或 `files` 写错了。

## 7. 发布到 npm

```bash
npm login
npm publish --access public
```

验证：

```bash
npm view multiple-chat-panels version
# 应输出 0.0.1（或你填的版本）
```

再真实安装一次：

```bash
dsh plugin --profile web add multiple-chat-panels
# 重启 DSH 后，把侧边栏会话拖到中间区域即可看到 Mission Control
```

> 如果本机 `~/.npm` 有权限问题（`EPERM`），先执行：
> `sudo chown -R 501:20 ~/.npm`
> 或临时换缓存：`npm publish --cache /tmp/npm-cache --access public`

## 8. 创建 GitHub Release（可选但推荐）

先生成 tgz：

```bash
npm pack
# 生成 multiple-chat-panels-0.0.1.tgz
```

用 gh：

```bash
gh release create v0.0.1 multiple-chat-panels-0.0.1.tgz \
  --title "v0.0.1" \
  --notes "Initial public release of multiple-chat-panels"
```

或浏览器：仓库页面 → **Releases** → **Draft a new release** → 填 Tag `v0.0.1`、标题、说明，上传 tgz。

## 9. 配置 GitHub Actions 自动发布（可选）

仓库里已经放了 `.github/workflows/publish.yml` 模板。它监听 `v*` tag：
1. 用 `NPM_TOKEN` 发布 npm；
2. 用自动生成的 `GITHUB_TOKEN` 创建 GitHub Release 并附 tgz。

使用步骤：
1. 确认 `lib/` 已提交（该模板不重新构建，直接发布已提交的产物）。
2. 到仓库 **Settings → Secrets and variables → Actions** 添加：
   - `NPM_TOKEN`：第 3 步生成的 npm Automation token。
   - `GITHUB_TOKEN` 不需要你填，GitHub 会自动提供。
3. 打 tag 发布：

```bash
git tag v0.0.1
git push origin v0.0.1
```

Actions 会自动跑 `npm publish` + GitHub Release。

## 10. 社区曝光

1. 给仓库加 topics（GitHub 网页 **About → Topics**，或 gh）：
   ```bash
   gh repo edit dsh-multiple-chat-panels --add-topic dsh-plugin --add-topic deepseek-harness --add-topic multi-pane
   ```
2. 向 [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness/blob/main/CONTRIBUTING.md) 提 PR：
   - fork 仓库；
   - 同时改 `README.md` 和 `README.zh-CN.md`，各加一行：
     ```markdown
     - [dsh-multiple-chat-panels](https://github.com/WilliamShi666/dsh-multiple-chat-panels) — Multiple chat panels for DeepSeek Harness.
     ```
   - 只新增、不改别人的行；PR 只动这两个 README。
3. 可再提交到：
   - [fendouai/awesome-deepseek-harness](https://github.com/fendouai/awesome-deepseek-harness)
   - [walkinglabs/awesome-deepseek-harness-plugins](https://github.com/walkinglabs/awesome-deepseek-harness-plugins)
   - [web-casa/Awesome-DeepSeek-Harness-Plugins](https://github.com/web-casa/Awesome-DeepSeek-Harness-Plugins)
   - [dsh-community-plugins](https://github.com/HubaKing/dsh-community-plugins)（社区发现 skill）
   - [dsh-tui-ecosystem](https://github.com/dsh-tui-ecosystem)
   - [linxiecoder/deepseek-harness-plugins](https://github.com/linxiecoder/deepseek-harness-plugins)（可参考它的发布 CI）
4. 在 DeepSeek Harness 官方讨论区、开发者群、X/Twitter 发一条带截图和安装命令的帖子。

## 11. 发布检查清单

- [ ] `package.json` 已填 `repository` / `homepage` / `bugs` / `author`
- [ ] `package.json` 没有 `private: true`
- [ ] `LICENSE` 作者/年份正确
- [ ] `.gitignore` 已允许提交 `lib/`
- [ ] `npm run build && npm run build:client` 通过
- [ ] `npm pack --dry-run` 内容正确
- [ ] `npm publish --access public` 成功
- [ ] `dsh plugin --profile web add multiple-chat-panels` 安装成功
- [ ] GitHub 仓库 topics 已加 `dsh-plugin` / `deepseek-harness`
- [ ] GitHub Release `v0.0.1` 已创建（或 Actions 自动创建）
- [ ] awesome-deepseek-harness PR 已提交
