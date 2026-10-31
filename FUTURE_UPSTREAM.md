# FUTURE_UPSTREAM

本文件记录 multiple-chat-panels 在纯插件实现中使用的“内部 API 桥接”以及希望上游 DeepSeek Harness 公开化的能力。当前官方仓库不接受 PR，但可以在讨论区提出；本文件作为 TODO 和讨论素材。

## 1. per-session staging / `Session.open()` —— 0.2 已解决

**0.1.x 的现状（已结束）**：客户端 `SessionRuntime` 是 single-occupant，完整
`session/event` 流只喂给 `list.current`。插件通过 `ctx.sessions.binding(id)` 拿到
`SessionFace` 后，调用了运行时实例上的内部 `open()` 方法来加载历史窗口并接收 live 事件。

**0.2 的变化**：`ctx.sessions.retain(target, { source })` 成为公开契约，返回
`SessionReference` 并自动开始该会话的历史打开；`binding()` 只借用已持有的会话。
多窗口 UI 现在是受支持的一等用法，插件侧不再需要任何 cast 或内部方法。本项诉求已关闭。

## 2. 侧边栏会话行菜单扩展点

**现状**：`ui-workspace` 的会话行三点菜单是内部硬编码的 `sessionMenuItems`，没有插件扩展点。本插件 v1 采用“拖拽 + 页面内选择器”作为入口，没有改三点菜单。

**希望上游提供**：在会话行菜单暴露一个 list/chain slot，允许插件追加菜单项（如“加入 Mission Control”）。

## 3. `SessionProvider` 支持 per-session provide

**现状**：内置 Conversation 组件未导出，且依赖当前会话的 provide 机制。插件因此自研了 mini chat 渲染器。

**0.1.5 / 0.2 的改善**：转录内容可以从公开的 Conversation assembly 读取
（`ctx.uiConversation.binding(binding).target('chat')`，其 `legacy.nodes` / `legacy.partial`
即扁平的节点列表），插件不依赖 `SessionFace` 的内部快照字段；
会话生命周期、队列、权限、模型选择也都有公开读面
（`SessionSnapshot`、`inbox` / `permissions` projection、`ModelDirectory`）。
诉求因此收窄为：**内置 Conversation 组件本身**仍无法按 `sessionId` 复用。

**希望上游提供**：一个可指定 `sessionId` 的 `SessionPaneProvider` / per-session `SessionProvideInfo`，让插件未来可以直接复用内置 Conversation 组件，减少自研渲染器的维护成本。

## 4. 其他可讨论项

- 网格布局 / tiling 是否需要核心布局服务支持，还是保持插件自绘。
- git branch/worktree 信息是否值得进入 Workspace/Session 数据模型（目前只是插件 host RPC 展示层增强）。
- 中央列锚点（`[data-dsh-center-col]` → `[data-slot="main.conversation"]`）缺少稳定的
  “drop 区域”语义；插件目前靠 `main` 槽位的渲染父元素兜底，希望上游给中央列一个稳定属性。
