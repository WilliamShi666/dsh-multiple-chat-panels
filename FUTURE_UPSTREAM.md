# FUTURE_UPSTREAM

本文件记录 multiple-chat-panels 在纯插件实现中使用的“内部 API 桥接”以及希望上游 DeepSeek Harness 公开化的能力。当前官方仓库不接受 PR，但可以在讨论区提出；本文件作为 TODO 和讨论素材。

## 1. 公开 per-session staging / `Session.open()`

**现状**：客户端 `SessionRuntime` 是 single-occupant，完整 `session/event` 流只喂给 `list.current`。插件通过 `ctx.sessions.binding(id)` 拿到 `SessionFace` 后，调用了运行时实例上的内部 `open()` 方法（类型上需要一次受控 cast）来加载历史窗口并接收 live 事件。

**风险**：`open()` 不在公开 `ISession` 契约上，未来 DSH 升级可能变化。

**希望上游提供**：

- 在 `ISession` / `SessionFace` 上公开 `open()` 或等价的 `stage()` / `resume()` 方法；
- 或提供 per-session provide 机制，让插件可以为任意已列出会话拿到完整的 standard props / 事件窗口；
- 或将 `SessionRuntime` 的 staged 状态从单一 `current` 扩展为多 pane 集合。

**讨论区提案要点**：多会话 UI（如本插件）需要同时打开多个会话窗口；Host 和 mux 流已经支持 all-session，只是 client runtime 的 staging 限制。

## 2. 侧边栏会话行菜单扩展点

**现状**：`ui-workspace` 的会话行三点菜单是内部硬编码的 `sessionMenuItems`，没有插件扩展点。本插件 v1 采用“拖拽 + 页面内选择器”作为入口，没有改三点菜单。

**希望上游提供**：在会话行菜单暴露一个 list/chain slot，允许插件追加菜单项（如“加入 Mission Control”）。

## 3. `SessionProvider` 支持 per-session provide

**现状**：`@deepseek-ai/dsh-client-web-react` 的 `SessionProvider` 只跟随当前会话，内置 Conversation 组件未导出且依赖当前会话 provide 机制。插件因此自研了 mini chat 渲染器。

**希望上游提供**：一个可指定 `sessionId` 的 `SessionPaneProvider` / per-session `SessionProvideInfo`，让插件未来可以直接复用内置 Conversation 组件，减少自研渲染器的维护成本。

## 4. 其他可讨论项

- 网格布局 / tiling 是否需要核心布局服务支持，还是保持插件自绘。
- git branch/worktree 信息是否值得进入 Workspace/Session 数据模型（目前只是插件 host RPC 展示层增强）。
