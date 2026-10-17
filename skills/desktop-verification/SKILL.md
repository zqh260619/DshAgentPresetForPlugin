---
name: desktop-verification
description: Use when a change must be verified at the OPERATING-SYSTEM level — native toasts, OS dialogs, tray popups, or other application windows — which the Playwright browser tools cannot see; ships a screen-capture script (one-shot and diff-filtered watch) with an explicit opt-in gate.
---

# 桌面 / OS 层验证

`browser_take_screenshot`(Playwright MCP)只能截网页,**截不到操作系统层**:原生 toast、系统对话框、托盘弹窗、其它应用窗口。这类验证用本预设附带的截图脚本。

## 分工

| 要看什么 | 用什么 |
|---|---|
| 网页 / Harness GUI 内的界面 | `mcp__playwright__browser_take_screenshot` |
| 原生 toast / OS 对话框 / 托盘 / 其它应用窗口 | 本脚本 `tools/screen-capture.ps1` |

## 脚本位置与门禁

脚本随本预设 bundle 分发:技能基目录(`skill` 输出里的 "Base directory")向上两级即 bundle 根,脚本位于 `<bundle>/tools/screen-capture.ps1`。

**门禁(默认关闭)**:脚本要求标记文件 `$DSH_HOME/screen-capture.enabled` 存在,否则直接返回 `{"error":"screen capture is disabled; …"}` 并以退出码 2 结束。需要启用时,请用户执行一次:

```powershell
New-Item -ItemType File -Force "$env:DSH_HOME\screen-capture.enabled"
```

## 用法(用会话自带的 `pwsh` 调用)

坐标一律是**物理像素**;脚本启动时先声明 per-monitor-V2 DPI 感知,所以在有缩放的屏幕上也不会切边。

```powershell
$cap = '<bundle>\tools\screen-capture.ps1'

# 一次性:截一个区域(推荐;隐私上区域优先)
powershell -NoProfile -ExecutionPolicy Bypass -File $cap -Mode capture -Clip "1520,960,400,120"

# 一次性:整屏(必须显式声明)
powershell -NoProfile -ExecutionPolicy Bypass -File $cap -Mode capture -Fullscreen

# watch:先开监听 → 再触发 → 只收"状态变化帧"(抓 toast 的正确姿势)
powershell -NoProfile -ExecutionPolicy Bypass -File $cap -Mode watch -Clip "1520,960,400,120" -DurationMs 15000 -IntervalMs 700 -Threshold 30
```

参数要点:

- `-Clip "x,y,w,h"` 区域;`-Fullscreen` 整屏。二者必选其一,否则报错——刻意的隐私约束。
- `-Out <png>` 指定输出文件;不指定则写到 `$DSH_HOME/cache/screen-captures/`。
- watch:`-DurationMs ≤ 120000`、`-IntervalMs 100–5000`、`-Threshold`(20×20 缩略图最大色差,0–765,默认 30)、`-MaxFrames ≤ 300`、`-DedupeThreshold`(与上一张入选帧的差异门槛,默认等于 `Threshold`)。
- 单帧超过 8 MB 会报错并删除该帧。

返回 JSON:capture → `{path,width,height,scale,screen,region,mimeType,bytes}`;watch → `{frames:[{path,at,diff,bytes}],changed,restored,captured,threshold,…,dir}`。

## 操作纪律(隐私)

1. **只有"新状态"帧会被写盘**(与基线差异够大、且与上一张入选帧不同);未入选的帧根本不保存,事后无需删除——这是刻意设计。
2. 任务结束把需要保留的帧复制到目标位置后,**删掉整个 `dir`**;不要把帧留在仓库里(要留就用 `artifacts/`、`tmp/` 这类已 gitignore 的目录,或默认缓存目录)。
3. 整屏截图会带上用户其它窗口:能裁就裁,必要时才 `-Fullscreen`。
4. 截图只是 PNG 落盘;要让"模型看见"必须再用 `read_image` 读回。
5. 只在用户要求桌面级验证时使用;不要用它截取用户的私人内容。

## 验收套路

1. 先开 watch(例如 15 s / 700 ms),再让被测操作触发 toast;
2. 结束后 `frames` 应有 1–3 张、`diff.max` 明显高于阈值、`changed: true`(toast 已消失时还会带 `restored: true`);
3. `read_image` 读回第一帧确认 toast 内容;
4. 清理:删掉整个 `dir`。
