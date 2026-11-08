---
name: plugin-release
description: Use when asked to release or publish a new version of a DSH plugin, bundle or preset repository — bumping the version, updating CHANGELOG/README, committing, tagging, publishing to npm, and making the change take effect in local profiles.
---

# 发版流程

`/publish` 指令会把发版任务交给本技能。按下面的顺序执行,**每一步都用真实命令验证**,不要凭印象跳过。

## 0. 先确认版本

- 用户给了版本号 → 直接用;给了 `patch` / `minor` / `major` → 按语义化版本升对应位;
- 用户什么都没给 → 读 `package.json` 当前版本、`CHANGELOG.md` 未发布段落、以及自上一个 tag 以来的提交,自行判断该升哪一位,并在动手前用一句话说明依据;
- **升 major 必须先得到用户确认**。

## 1. 前置检查

- `git status --short`:有不属于本次发版的改动就先问用户,不要顺手打包;
- 跑仓库既有校验:`npm test`、`npm run verify`、`node --check`(按 `package.json` 的 scripts 决定)。测试不通过就停下报告,不发版。

## 2. 版本与文档同步

- `package.json` 的 `version`;
- 有 `package-lock.json` 时同步 **两处**:`version` 与 `packages[""].version`(最容易漏);
- 代码里硬编码的构建标记/版本号(如 `BUILD_MARK`、设置页展示的「构建 x.y.z」);
- `CHANGELOG.md`:新增 `## [x.y.z] - YYYY-MM-DD` 段落,按 Added / Changed / Fixed 分类;
- README 里的事实性数字(测试数量、版本号),只改事实、不夸大;
- 校验:package.json / lock / 代码三处版本一致;文件为**无 BOM** 的 UTF-8。

## 3. 提交与推送

- `git add -A` + `git commit -m "chore(release): x.y.z"`(沿用仓库既有提交风格);
- 推送 main。网络抖动用重试循环(例如最多 40 次、每次间隔数秒),**不要 force push**。

## 4. 打 tag 并发布

- `git tag vx.y.z`,推送该 tag(同样带重试);
- 若仓库有发布工作流(`.github/workflows/publish.yml` 或 npm publish 脚本):轮询该次 Actions run 直到 `completed`,再用 `npm view <包名> version` 确认 npm 上出现了新版本;
- 发布失败**不要**用同一版本号重复打 tag:先确认线上有没有发出去,再决定补发还是升版本。

## 5. 让本机生效并验证

- **bundle**(`package.json` 里有 `dsh.bundle`):用 `plugin_manager` 对该 bundle 执行 `set_bundle` 关 → 开,确认 `application: applied` 且无 warnings,预设行仍 active;
- **npm 插件**:把 `web` 与 `desktop` 两个 profile 的依赖与安装更新到新版本(`dsh plugin --profile <名字> add <包名>@<版本>`),确认两份安装目录里的版本一致;
- **只改预设文本/技能**的仓库:重新应用 bundle 即可,新会话生效。

## 6. 收尾

报告四件事:版本号、tag 是否推送成功、npm 上的版本(如适用)、本地 profile 生效情况;并说明还差什么人工确认。

## 纪律

- 不改与发版无关的文件;不做未经请求的重构;
- 任何一步失败都如实报告(退出码、报错原文),不静默跳过、不换成更弱的检查;
- 发版过程中不要关闭或重启用户的浏览器 / GUI,除非该步骤确实需要。
