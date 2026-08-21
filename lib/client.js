window.__ModuleLoader__.load({
	id: "multiple-chat-panels",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client/MissionControlNav.tsx
		/**
		* Sidebar first-level action that opens the Mission Control main page.
		*/
		/** First-level sidebar entry that opens the Mission Control page. */
		function MissionControlNav({ wide, primaryPage, pageId, open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				"aria-current": primaryPage === pageId ? "page" : void 0,
				"aria-label": "Mission Control",
				title: "Mission Control",
				onClick: open,
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					width: "100%",
					padding: "8px 12px",
					border: 0,
					background: "transparent",
					color: "inherit",
					cursor: "pointer",
					fontSize: 14
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": "true",
					children: "▦"
				}), wide ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Mission Control" }) : null]
			});
		}
		//#endregion
		//#region src/client/drag.ts
		/** MIME marker for panes dragged inside Mission Control (never sidebar rows). */
		const PANE_DRAG_MIME = "application/x-mcp-pane";
		//#endregion
		//#region src/client/git-info.ts
		const API_BASE = "/multiple-chat-panels/api/git-info";
		const cache = /* @__PURE__ */ new Map();
		/** Fetch git branch/worktree info for a directory, cached per path. */
		async function fetchGitInfo(path) {
			const cached = cache.get(path);
			if (cached !== void 0) return cached;
			try {
				const response = await fetch(`${API_BASE}?path=${encodeURIComponent(path)}`, { credentials: "same-origin" });
				if (!response.ok) throw new Error(`git-info request failed: ${String(response.status)}`);
				const value = await response.json();
				const normalized = {
					isRepo: value.isRepo === true,
					branch: typeof value.branch === "string" ? value.branch : null,
					worktree: typeof value.worktree === "string" ? value.worktree : null
				};
				cache.set(path, normalized);
				return normalized;
			} catch {
				const fallback = {
					isRepo: false,
					branch: null,
					worktree: null
				};
				cache.set(path, fallback);
				return fallback;
			}
		}
		//#endregion
		//#region src/client/pane-store.ts
		/**
		* Tiny module-level pane store for Mission Control.
		*
		* This is intentionally framework-free: the client plugin owns the pane set
		* and the page component subscribes through `useSyncExternalStore`. Pane ids,
		* per-pane sizes, row assignments, and composer heights are persisted to
		* localStorage so a reload restores the same view. Rows are dynamic: a new
		* row is created whenever the current row would overflow the available width.
		*/
		const STORAGE_KEY = "dsh.multiple-tui-simulator.v5";
		const LEGACY_KEYS = [
			"dsh.multiple-tui-simulator.v4",
			"dsh.multiple-tui-simulator.v3",
			"dsh.multiple-tui-simulator.v2",
			"dsh.multiple-tui-simulator.v1"
		];
		const FALLBACK_PANE_SIZE = {
			width: 720,
			height: 520
		};
		const listeners = /* @__PURE__ */ new Set();
		let state = loadInitial();
		let revision = 0;
		function readRaw(key) {
			try {
				const raw = localStorage.getItem(key);
				return raw === null ? null : JSON.parse(raw);
			} catch {
				return null;
			}
		}
		function normalizeSizes(value) {
			const sizes = {};
			if (typeof value !== "object" || value === null) return sizes;
			for (const [id, entry] of Object.entries(value)) {
				if (typeof entry !== "object" || entry === null) continue;
				const candidate = entry;
				if (typeof candidate.width !== "number" || typeof candidate.height !== "number") continue;
				if (!Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)) continue;
				const top = typeof candidate.top === "number" && Number.isFinite(candidate.top) ? Math.max(0, Math.round(candidate.top)) : 0;
				sizes[id] = {
					width: Math.max(360, Math.round(candidate.width)),
					height: Math.max(280, Math.round(candidate.height)),
					...top === 0 ? {} : { top }
				};
			}
			return sizes;
		}
		function normalizeRows(value) {
			const rows = {};
			if (typeof value !== "object" || value === null) return rows;
			for (const [id, row] of Object.entries(value)) if (typeof row === "number" && Number.isFinite(row) && row >= 0) rows[id] = Math.floor(row);
			return rows;
		}
		function normalizeComposerHeights(value) {
			const heights = {};
			if (typeof value !== "object" || value === null) return heights;
			for (const [id, height] of Object.entries(value)) {
				if (typeof height !== "number" || !Number.isFinite(height)) continue;
				heights[id] = Math.min(280, Math.max(48, Math.round(height)));
			}
			return heights;
		}
		function normalizePanes(value) {
			if (!Array.isArray(value)) return [];
			return value.filter((item) => typeof item === "string");
		}
		function parseState(raw) {
			if (typeof raw !== "object" || raw === null) return null;
			const record = raw;
			if (!Array.isArray(record.panes)) return null;
			return {
				panes: normalizePanes(record.panes),
				sizes: normalizeSizes(record.sizes),
				rows: normalizeRows(record.rows),
				composerHeights: normalizeComposerHeights(record.composerHeights)
			};
		}
		function loadInitial() {
			const current = parseState(readRaw(STORAGE_KEY));
			if (current !== null) return current;
			for (const key of LEGACY_KEYS) {
				const raw = readRaw(key);
				if (Array.isArray(raw)) {
					const panes = normalizePanes(raw);
					if (panes.length > 0) return {
						panes,
						sizes: {},
						rows: {},
						composerHeights: {}
					};
				}
				const parsed = parseState(raw);
				if (parsed !== null && parsed.panes.length > 0) return {
					panes: parsed.panes,
					sizes: {},
					rows: {},
					composerHeights: {}
				};
			}
			return {
				panes: [],
				sizes: {},
				rows: {},
				composerHeights: {}
			};
		}
		function persist() {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
			} catch {}
		}
		function emit() {
			for (const listener of [...listeners]) listener();
		}
		/** Read the current pane session id list (stable reference until mutation). */
		function getPanes() {
			return state.panes;
		}
		/** Monotonic mutation counter; row/height changes bump it even when the pane list is unchanged. */
		function getPaneRevision() {
			return revision;
		}
		/** Read the persisted size of one pane. */
		function getPaneSize(sessionId) {
			return state.sizes[sessionId];
		}
		/** Read the persisted row assignment of one pane; absent means the primary row. */
		function getPaneRow(sessionId) {
			return state.rows[sessionId] ?? 0;
		}
		/** Read the persisted composer height of one pane. */
		function getComposerHeight(sessionId) {
			return state.composerHeights[sessionId] ?? 48;
		}
		/** Subscribe to pane list, size, row, or composer-height changes. @returns disposer. */
		function subscribePanes(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		/** Replace the whole pane list, pruning sizes, rows, and heights of removed panes. */
		function setPanes(next) {
			const sizes = {};
			const rows = {};
			const composerHeights = {};
			for (const id of next) {
				const size = state.sizes[id];
				if (size !== void 0) sizes[id] = size;
				rows[id] = state.rows[id] ?? 0;
				composerHeights[id] = state.composerHeights[id] ?? 48;
			}
			state = {
				panes: next,
				sizes,
				rows,
				composerHeights
			};
			revision += 1;
			persist();
			emit();
		}
		/** Record a pane's user-resized dimensions, clamped to the pane minimums. */
		function setPaneSize(sessionId, size) {
			if (!state.panes.includes(sessionId)) return;
			const top = Math.max(0, Math.round(size.top ?? 0));
			const clamped = {
				width: Math.max(360, Math.round(size.width)),
				height: Math.max(280, Math.round(size.height)),
				...top === 0 ? {} : { top }
			};
			state = {
				...state,
				sizes: {
					...state.sizes,
					[sessionId]: clamped
				}
			};
			revision += 1;
			persist();
			emit();
		}
		/** Record one pane's user-adjusted composer height. */
		function setComposerHeight(sessionId, height) {
			if (!state.panes.includes(sessionId)) return;
			const clamped = Math.min(280, Math.max(48, Math.round(height)));
			if (state.composerHeights[sessionId] === clamped) return;
			state = {
				...state,
				composerHeights: {
					...state.composerHeights,
					[sessionId]: clamped
				}
			};
			revision += 1;
			persist();
			emit();
		}
		/** Append one session id when absent; new panes join the primary row. */
		function addPane(sessionId) {
			if (state.panes.includes(sessionId)) return;
			setPanes([...state.panes, sessionId]);
		}
		/** Remove one session id. */
		function removePane(sessionId) {
			if (!state.panes.includes(sessionId)) return;
			setPanes(state.panes.filter((id) => id !== sessionId));
		}
		/** Width used by the fit computation: persisted width, or the row's even share. */
		function paneFitWidth(sessionId, count, viewportWidth) {
			const persisted = state.sizes[sessionId];
			if (persisted !== void 0) return Math.min(persisted.width, Math.max(360, viewportWidth));
			return Math.max(360, Math.floor((viewportWidth - 14 * (count - 1)) / count));
		}
		/**
		* Recursively move the rightmost pane of any overflowing row to the next row
		* until every row fits the available width. Rows are renumbered contiguously.
		* @param viewportWidth - available grid width in px.
		*/
		function reflowRows(viewportWidth) {
			if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || state.panes.length === 0) return;
			const rows = /* @__PURE__ */ new Map();
			for (const id of state.panes) {
				const row = state.rows[id] ?? 0;
				const list = rows.get(row) ?? [];
				list.push(id);
				rows.set(row, list);
			}
			let changed = false;
			for (let guard = 0; guard < state.panes.length; guard += 1) {
				const rowNumbers = [...rows.keys()].sort((left, right) => left - right);
				let moved = false;
				for (const row of rowNumbers) {
					const ids = rows.get(row);
					if (ids === void 0 || ids.length <= 1) continue;
					if (ids.reduce((sum, id) => sum + paneFitWidth(id, ids.length, viewportWidth), 0) + 14 * (ids.length - 1) <= viewportWidth) continue;
					const lastId = ids[ids.length - 1];
					if (lastId === void 0) continue;
					ids.splice(ids.length - 1, 1);
					const nextRow = rows.get(row + 1) ?? [];
					nextRow.unshift(lastId);
					rows.set(row + 1, nextRow);
					changed = true;
					moved = true;
					break;
				}
				if (!moved) break;
			}
			if (!changed) return;
			const nextRows = {};
			[...rows.keys()].sort((left, right) => left - right).forEach((row, index) => {
				for (const id of rows.get(row) ?? []) nextRows[id] = index;
			});
			state = {
				...state,
				rows: nextRows
			};
			revision += 1;
			persist();
			emit();
		}
		/**
		* Insert or move one pane into a row at a specific horizontal position.
		* `beforeId` names the pane that should end up after the moved pane; omitted
		* means append to the row.
		* @param sessionId - pane to place (created if absent).
		* @param row - target row.
		* @param beforeId - existing pane that should follow the placed pane.
		*/
		function placePane(sessionId, row, beforeId) {
			const next = state.panes.filter((id) => id !== sessionId);
			const beforeIndex = beforeId === void 0 || beforeId === sessionId ? -1 : next.indexOf(beforeId);
			if (beforeIndex === -1) next.push(sessionId);
			else next.splice(beforeIndex, 0, sessionId);
			const composerHeights = state.composerHeights[sessionId] === void 0 ? state.composerHeights : { ...state.composerHeights };
			state = {
				panes: next,
				sizes: state.sizes,
				rows: {
					...state.rows,
					[sessionId]: row
				},
				composerHeights
			};
			revision += 1;
			persist();
			emit();
		}
		//#endregion
		//#region src/client/PaneToolbar.tsx
		/**
		* Compact per-pane controls: permission preset, model route, and reasoning
		* effort. All three write through the same public surfaces as the main
		* conversation (session.command('/permission ...') and the shared
		* ModelDirectory), so the pane and the main view stay on one source of truth.
		*/
		const EMPTY_MODELS = {
			current: null,
			routable: null,
			groups: [],
			failures: [],
			status: "idle",
			error: null
		};
		/** Bind a bare observable to React without pulling in web-react. */
		function useObservable(source, fallback) {
			return (0, react.useSyncExternalStore)((0, react.useMemo)(() => source === void 0 ? () => () => {} : (fn) => source.subscribe(fn), [source]), (0, react.useMemo)(() => source === void 0 ? () => fallback : () => source.getSnapshot(), [source, fallback]), () => fallback);
		}
		/** Stable key for one provider/model row. */
		function modelKey(providerId, modelId) {
			return `${providerId}\u0000${modelId}`;
		}
		function groupModels(groups) {
			const rows = [];
			for (const group of groups) {
				const models = group.models ?? [];
				for (const model of models) rows.push({
					provider: group.id,
					modelId: model.id,
					name: model.name,
					reasoningEfforts: model.reasoning?.efforts.map((effort) => effort.id) ?? [],
					defaultEffort: model.reasoning?.defaultEffort
				});
			}
			return rows;
		}
		/** Display label for one permission preset option. */
		function permissionLabel(value, name) {
			if (value === "read-only") return "Read-only";
			if (value === "workspace-write") return "Workspace write";
			if (value === "danger-full-access") return "Full access";
			return name;
		}
		/** Compact toolbar for the per-pane permission/model/thinking choices. */
		function PaneToolbar({ session, directory }) {
			const permission = useObservable(session.projections.faceOf("permissions"), void 0);
			const models = useObservable(directory?.store, EMPTY_MODELS);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (directory === void 0) return;
				let cancelled = false;
				directory.load().catch(() => {
					if (!cancelled) setError("Model catalog failed to load");
				});
				return () => {
					cancelled = true;
				};
			}, [directory]);
			const rows = (0, react.useMemo)(() => groupModels(models.groups), [models.groups]);
			const currentModel = rows.find((row) => models.current !== null && row.provider === models.current.provider && row.modelId === models.current.model);
			const currentEffort = models.current?.reasoningEffort ?? currentModel?.defaultEffort ?? "";
			const selectPermission = (value) => {
				if (permission?.currentValue === value) return;
				if (value === "danger-full-access" && !window.confirm("Enable Full Access for this session?")) return;
				session.command(`/permission ${value}`).then(() => {
					setError(null);
				}, () => {
					setError("Permission switch failed");
				});
			};
			const selectModel = async (value) => {
				if (directory === void 0) return;
				const separator = value.indexOf("\0");
				if (separator === -1) return;
				const provider = value.slice(0, separator);
				const modelId = value.slice(separator + 1);
				const row = rows.find((candidate) => candidate.provider === provider && candidate.modelId === modelId);
				if (row === void 0) return;
				const reasoningEffort = models.current?.provider === provider && models.current.model === modelId ? models.current?.reasoningEffort ?? row.defaultEffort : row.defaultEffort;
				const selection = {
					provider,
					model: modelId,
					...reasoningEffort === void 0 ? {} : { reasoningEffort }
				};
				try {
					setError(null);
					await directory.select(selection);
				} catch {
					setError("Model switch failed");
				}
			};
			const selectEffort = async (value) => {
				if (directory === void 0 || models.current === null) return;
				try {
					setError(null);
					await directory.select({
						...models.current,
						reasoningEffort: value
					});
				} catch {
					setError("Thinking mode switch failed");
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-mcp-controls": true,
				style: {
					display: "flex",
					flexWrap: "wrap",
					gap: 5,
					alignItems: "center",
					padding: "5px 8px",
					borderBottom: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
					background: "var(--dsw-alias-bg-layer-2, #f6f8fa)",
					fontSize: 11,
					flexShrink: 0
				},
				children: [
					permission !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 4,
							minWidth: 0,
							flex: 1
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
								whiteSpace: "nowrap"
							},
							children: "Perm"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							"data-mcp-permission": true,
							"aria-label": "Permission preset",
							value: permission.currentValue,
							onChange: (event) => selectPermission(event.target.value),
							style: selectStyle,
							children: permission.options.filter((option) => option.value !== "custom").map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: option.value,
								children: permissionLabel(option.value, option.name)
							}, option.value))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 4,
							minWidth: 0,
							flex: 1.4
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
								whiteSpace: "nowrap"
							},
							children: "Model"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							"data-mcp-model": true,
							"aria-label": "Model",
							value: models.current === null ? "" : modelKey(models.current.provider, models.current.model),
							onChange: (event) => {
								selectModel(event.target.value);
							},
							disabled: directory === void 0 || models.status === "loading" || models.status === "selecting",
							style: selectStyle,
							children: [models.current === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: "Loading…"
							}), models.groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
								label: group.name,
								children: group.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: modelKey(group.id, model.id),
									children: model.name
								}, modelKey(group.id, model.id)))
							}, group.id))]
						})]
					}),
					currentModel !== void 0 && currentModel.reasoningEfforts.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 4,
							minWidth: 0,
							flex: 1
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
								whiteSpace: "nowrap"
							},
							children: "Think"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							"data-mcp-thinking": true,
							"aria-label": "Thinking mode",
							value: currentEffort,
							onChange: (event) => {
								selectEffort(event.target.value);
							},
							disabled: directory === void 0 || models.status === "loading" || models.status === "selecting",
							style: selectStyle,
							children: currentModel.reasoningEfforts.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: effort,
								children: effort
							}, effort))
						})]
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							color: "var(--dsw-alias-state-error-primary, #d1242f)",
							flexBasis: "100%"
						},
						children: error
					})
				]
			});
		}
		const selectStyle = {
			flex: 1,
			minWidth: 0,
			maxWidth: 132,
			padding: "1px 3px",
			fontSize: 11,
			border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
			borderRadius: 5,
			background: "var(--dsw-alias-bg-layer-1, #fff)",
			color: "var(--dsw-alias-label-primary, #1f2328)"
		};
		//#endregion
		//#region src/client/MiniChatPane.tsx
		/**
		* Mini chat pane: a lightweight, live conversation renderer for one session.
		*
		* Uses the public `SessionFace` observable plus the runtime-internal `open()`
		* bridge to load the history window and receive live session events. This is
		* the documented v1 internal-API bridge; see FUTURE_UPSTREAM.md for the
		* upstream-public API proposal.
		*
		* The pane ships its own compact slash menu, permission/model/thinking
		* toolbar, and a bottom-anchored composer so it stays usable at pane scale.
		*/
		const COMPOSER_LINE_HEIGHT = 18;
		const IMAGE_MEDIA_TYPES = [
			"image/png",
			"image/jpeg",
			"image/webp",
			"image/gif"
		];
		const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
		const MAX_IMAGES_PER_MESSAGE = 4;
		let attachmentSeq = 0;
		function imageMediaType(value) {
			if (IMAGE_MEDIA_TYPES.includes(value)) return value;
			throw new Error(`unsupported image media type: ${value || "(empty)"}`);
		}
		function bytesToBase64(data) {
			let binary = "";
			const chunk = 32768;
			for (let offset = 0; offset < data.length; offset += chunk) binary += String.fromCharCode(...data.subarray(offset, offset + chunk));
			return btoa(binary);
		}
		const PANE_CSS = `
[data-mcp-chat] pre {
  margin: 4px 0;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
  overflow: auto;
  font-size: 12px;
}
[data-mcp-chat] code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
[data-mcp-chat] p { margin: 4px 0; }
[data-mcp-chat] p:first-child { margin-top: 0; }
[data-mcp-chat] p:last-child { margin-bottom: 0; }
`;
		function textBlocksText(content) {
			return content.map((block) => block.type === "text" && block.text !== void 0 ? block.text : "").join("");
		}
		/** First non-empty line of a collapsed tool/call/result/command row. */
		function firstLine(text, max) {
			const line = text.split("\n").find((candidate) => candidate.trim() !== "") ?? "";
			return line.length > max ? `${line.slice(0, max - 1)}…` : line;
		}
		function visibleNodes(nodes) {
			return nodes.filter((node) => node.kind === "user" || node.kind === "assistant" || node.kind === "steering" || node.kind === "context" || node.kind === "tool-result" || node.kind === "command" || node.kind === "turn-error" || node.kind === "turn-max-tokens");
		}
		/** In-progress or final assistant blocks, rendered with the Harness markdown pipeline. */
		function AssistantBlocksView({ blocks, streaming = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: blocks.map((block, index) => {
				const key = `${block.kind}-${index}`;
				switch (block.kind) {
					case "text": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
						text: block.text,
						streaming
					}, key);
					case "reasoning": return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						style: {
							margin: "6px 0",
							padding: "6px 8px",
							borderLeft: "2px solid var(--dsw-alias-border-l3, #a8b0b8)",
							background: "var(--dsw-alias-bg-layer-2, #f6f8fa)",
							borderRadius: 6
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
							style: {
								cursor: "pointer",
								color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
								fontSize: 12
							},
							children: "Reasoning"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: { marginTop: 6 },
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: block.text })
						})]
					}, key);
					case "tool-call": return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						"data-mcp-tool-call": true,
						style: {
							margin: "4px 0",
							padding: "6px 8px",
							border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
							borderRadius: 6,
							background: "var(--dsw-alias-bg-layer-2, #f6f8fa)",
							fontSize: 12
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
							style: {
								cursor: "pointer",
								fontWeight: 600
							},
							children: [
								"🔧 ",
								block.name,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										fontWeight: 400,
										color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
										marginLeft: 6
									},
									children: firstLine(block.argsRaw, 90)
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
							style: {
								margin: "6px 0 0",
								whiteSpace: "pre-wrap",
								wordBreak: "break-all"
							},
							children: block.argsRaw
						})]
					}, key);
					case "image": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 12,
							color: "var(--dsw-alias-label-primary-dimmed, #656d76)"
						},
						children: "🖼 Image attachment"
					}, key);
					default: return null;
				}
			}) });
		}
		function ToolResultCard({ node }) {
			const name = node.call?.name ?? node.callId;
			const text = node.content.map((block) => block.type === "text" && "text" in block ? block.text : "").join("");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				"data-mcp-tool-result": true,
				style: {
					margin: "4px 0",
					padding: "6px 8px",
					border: `1px solid ${node.isError ? "var(--dsw-alias-state-error-primary, #d1242f)" : "var(--dsw-alias-border-l2, #d0d7de)"}`,
					borderRadius: 6,
					background: "var(--dsw-alias-bg-layer-2, #f6f8fa)",
					fontSize: 12
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
						style: {
							cursor: "pointer",
							fontWeight: 600
						},
						children: [
							"⚙ ",
							name,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontWeight: 400,
									color: node.isError ? "var(--dsw-alias-state-error-primary, #d1242f)" : "var(--dsw-alias-label-primary-dimmed, #656d76)",
									marginLeft: 6
								},
								children: firstLine(text, 90) || (node.isError ? "Error" : "Completed")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						style: {
							margin: "6px 0 0",
							whiteSpace: "pre-wrap",
							wordBreak: "break-all"
						},
						children: text
					}),
					node.isError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							color: "var(--dsw-alias-state-error-primary, #d1242f)",
							marginTop: 4
						},
						children: "Error"
					})
				]
			});
		}
		/** One paired slash-command lifecycle from the session log. */
		function CommandCard({ node }) {
			const failed = node.outcome?.kind === "error";
			const summary = node.outcome?.text ?? node.args ?? (node.outcome === null ? "Running…" : "Completed");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				"data-mcp-command": true,
				style: {
					margin: "4px 0",
					padding: "6px 8px",
					border: `1px solid ${failed ? "var(--dsw-alias-state-error-primary, #d1242f)" : "var(--dsw-alias-border-l2, #d0d7de)"}`,
					borderRadius: 6,
					background: "var(--dsw-alias-bg-layer-2, #f6f8fa)",
					fontSize: 12
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
						style: {
							cursor: "pointer",
							fontWeight: 600
						},
						children: [
							"⌘ /",
							node.name ?? node.commandId,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontWeight: 400,
									color: failed ? "var(--dsw-alias-state-error-primary, #d1242f)" : "var(--dsw-alias-label-primary-dimmed, #656d76)",
									marginLeft: 6
								},
								children: firstLine(summary, 90)
							})
						]
					}),
					node.args !== null && node.args !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						style: {
							margin: "6px 0 0",
							whiteSpace: "pre-wrap",
							wordBreak: "break-all"
						},
						children: node.args
					}),
					node.outcome?.text !== void 0 && node.outcome.text !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							marginTop: 6,
							whiteSpace: "pre-wrap",
							wordBreak: "break-word"
						},
						children: node.outcome.text
					}),
					node.outcome === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							marginTop: 6,
							color: "var(--dsw-alias-label-primary-dimmed, #656d76)"
						},
						children: "Running…"
					})
				]
			});
		}
		/** Render one session's conversation with an input box and live controls. */
		function MiniChatPane({ sessionId, session, directory, listCommands, openInMain }) {
			const [draft, setDraft] = (0, react.useState)("");
			const [commands, setCommands] = (0, react.useState)([]);
			const [slashIndex, setSlashIndex] = (0, react.useState)(0);
			const [slashDismissed, setSlashDismissed] = (0, react.useState)(false);
			const inputRef = (0, react.useRef)(null);
			const chatRef = (0, react.useRef)(null);
			const composerRef = (0, react.useRef)(null);
			const [atBottom, setAtBottom] = (0, react.useState)(true);
			const atBottomRef = (0, react.useRef)(true);
			const composerDragRef = (0, react.useRef)(null);
			const [composerLive, setComposerLive] = (0, react.useState)(null);
			const manualComposerHeight = (0, react.useSyncExternalStore)(subscribePanes, () => getComposerHeight(sessionId), () => 48);
			const composerHeight = composerLive ?? manualComposerHeight;
			const [attachments, setAttachments] = (0, react.useState)([]);
			const [attachmentError, setAttachmentError] = (0, react.useState)(null);
			const fileInputRef = (0, react.useRef)(null);
			const snapshot = (0, react.useSyncExternalStore)(session?.subscribe ?? (() => () => {}), () => session?.getSnapshot() ?? null, () => session?.getSnapshot() ?? null);
			(0, react.useEffect)(() => {
				if (session === void 0) return;
				session.open();
			}, [session]);
			(0, react.useEffect)(() => {
				let cancelled = false;
				listCommands(sessionId).then((list) => {
					if (!cancelled) setCommands(list);
				});
				return () => {
					cancelled = true;
				};
			}, [listCommands, sessionId]);
			(0, react.useEffect)(() => {
				setSlashIndex(0);
				setSlashDismissed(false);
			}, [draft]);
			(0, react.useLayoutEffect)(() => {
				const input = inputRef.current;
				if (input === null) return;
				input.style.height = "auto";
				const naturalHeight = Math.min(input.scrollHeight, 120);
				input.style.height = `${Math.max(naturalHeight, composerHeight)}px`;
			}, [composerHeight, draft]);
			const slashQuery = draft.startsWith("/") && !draft.includes(" ") ? draft.slice(1) : null;
			const slashOpen = slashQuery !== null && !slashDismissed;
			const slashCandidates = (0, react.useMemo)(() => {
				if (slashQuery === null) return [];
				const query = slashQuery.toLowerCase();
				return commands.filter((command) => command.name.toLowerCase().includes(query)).slice(0, 8);
			}, [commands, slashQuery]);
			const slashPick = slashCandidates[slashIndex] ?? slashCandidates[0];
			const addFiles = (files) => {
				if (files.length === 0) return;
				const unsupported = files.find((file) => !IMAGE_MEDIA_TYPES.includes(file.type));
				if (unsupported !== void 0) {
					setAttachmentError(`Unsupported file type: ${unsupported.type || "unknown"}. Only PNG/JPEG/WebP/GIF images are supported.`);
					return;
				}
				if (attachments.length + files.length > MAX_IMAGES_PER_MESSAGE) {
					setAttachmentError(`Too many images. Limit is ${MAX_IMAGES_PER_MESSAGE} per message.`);
					return;
				}
				if (files.some((file) => file.size > MAX_IMAGE_BYTES)) {
					setAttachmentError("One or more images exceed the 10 MB per-image limit.");
					return;
				}
				setAttachmentError(null);
				const next = files.map((file) => {
					attachmentSeq += 1;
					return {
						id: `pane-attachment-${attachmentSeq}`,
						file,
						previewUrl: URL.createObjectURL(file)
					};
				});
				setAttachments((prev) => [...prev, ...next]);
			};
			const removeAttachment = (id) => {
				const target = attachments.find((attachment) => attachment.id === id);
				if (target !== void 0) URL.revokeObjectURL(target.previewUrl);
				setAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
			};
			const submit = (event) => {
				event.preventDefault();
				const text = draft.trim();
				if (text === "" && attachments.length === 0 || session === void 0) return;
				if (text.startsWith("/")) {
					session.command(text);
					setDraft("");
					return;
				}
				(async () => {
					const content = [...await Promise.all(attachments.map(async (attachment) => {
						const data = bytesToBase64(new Uint8Array(await attachment.file.arrayBuffer()));
						return {
							type: "image",
							mediaType: imageMediaType(attachment.file.type),
							data,
							...attachment.file.name === "" ? {} : { name: attachment.file.name }
						};
					})), ...text === "" ? [] : [{
						type: "text",
						text
					}]];
					await session.prompt(content, "queue");
					for (const attachment of attachments) URL.revokeObjectURL(attachment.previewUrl);
					setAttachments([]);
					setDraft("");
				})().catch(() => {
					setAttachmentError("Failed to send attachment.");
				});
			};
			const onComposerKeyDown = (event) => {
				if (slashOpen && slashCandidates.length > 0) {
					if (event.key === "ArrowDown") {
						event.preventDefault();
						setSlashIndex((slashIndex + 1) % slashCandidates.length);
						return;
					}
					if (event.key === "ArrowUp") {
						event.preventDefault();
						setSlashIndex((slashIndex - 1 + slashCandidates.length) % slashCandidates.length);
						return;
					}
					if (event.key === "Enter" && slashPick !== void 0) {
						event.preventDefault();
						setDraft(`/${slashPick.name} `);
						inputRef.current?.focus();
						return;
					}
					if (event.key === "Escape") {
						event.preventDefault();
						setSlashDismissed(true);
						return;
					}
				}
				if (event.key === "Enter" && !event.shiftKey) {
					event.preventDefault();
					event.currentTarget.form?.requestSubmit();
				}
			};
			const updateAtBottom = () => {
				const chat = chatRef.current;
				if (chat === null) return;
				const next = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 24;
				atBottomRef.current = next;
				setAtBottom(next);
			};
			const scrollToBottom = (smooth) => {
				chatRef.current?.scrollTo({
					top: chatRef.current.scrollHeight,
					behavior: smooth ? "smooth" : "auto"
				});
			};
			(0, react.useEffect)(() => {
				if (chatRef.current !== null) {
					scrollToBottom(false);
					updateAtBottom();
				}
			}, []);
			(0, react.useEffect)(() => {
				if (atBottomRef.current) scrollToBottom(false);
			}, [snapshot]);
			const startComposerResize = (event) => {
				const composer = composerRef.current;
				if (composer === null) return;
				event.preventDefault();
				event.stopPropagation();
				const rect = composer.getBoundingClientRect();
				composerDragRef.current = {
					pointerId: event.pointerId,
					startY: event.clientY,
					startHeight: rect.height
				};
				setComposerLive(rect.height);
				event.currentTarget.setPointerCapture(event.pointerId);
			};
			const moveComposerResize = (event) => {
				const start = composerDragRef.current;
				if (start === null || start.pointerId !== event.pointerId) return;
				if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
				setComposerLive(Math.min(280, Math.max(48, start.startHeight - (event.clientY - start.startY))));
			};
			const finishComposerResize = (event, commit) => {
				const start = composerDragRef.current;
				if (start === null || start.pointerId !== event.pointerId) return;
				const height = commit ? composerLive : null;
				composerDragRef.current = null;
				setComposerLive(null);
				if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
				if (commit && height !== null && height !== start.startHeight) setComposerHeight(sessionId, height);
			};
			const nodes = snapshot === null ? [] : visibleNodes(snapshot.nodes);
			const partial = snapshot?.partial ?? null;
			const running = snapshot?.running ?? false;
			const hasMore = snapshot?.hasMore ?? false;
			const queue = snapshot?.queue ?? [];
			const pendingCount = snapshot?.pending.length ?? 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-mcp-chat": true,
				onDragOver: (event) => {
					if (event.dataTransfer.types.includes("Files")) event.preventDefault();
				},
				onDrop: (event) => {
					const files = [...event.dataTransfer?.files ?? []];
					if (files.length > 0) {
						event.preventDefault();
						event.stopPropagation();
						addFiles(files);
					}
				},
				onPasteCapture: (event) => {
					const files = [...event.clipboardData?.files ?? []];
					if (files.length > 0) addFiles(files);
				},
				style: {
					display: "flex",
					flexDirection: "column",
					height: "100%",
					minHeight: 0,
					fontFamily: "var(--dsw-font-family, system-ui, sans-serif)",
					color: "var(--dsw-alias-label-primary, #1f2328)"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: PANE_CSS }),
					session !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PaneToolbar, {
						session,
						directory
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: chatRef,
						"data-mcp-chat-scroll": true,
						onScroll: updateAtBottom,
						style: {
							display: "flex",
							flexDirection: "column",
							gap: 8,
							overflow: "auto",
							flex: 1,
							minHeight: 0,
							padding: 10,
							marginRight: 8
						},
						children: [
							hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-mcp-load-older": true,
								onClick: () => {
									session?.loadOlder();
								},
								style: {
									alignSelf: "center",
									padding: "4px 10px",
									fontSize: 12,
									borderRadius: 6,
									border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
									background: "var(--dsw-alias-bg-layer-1, #fff)",
									color: "var(--dsw-alias-label-primary, #1f2328)",
									cursor: "pointer"
								},
								children: "Load older"
							}),
							snapshot === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: { color: "var(--dsw-alias-label-primary-dimmed, #656d76)" },
								children: [
									"Loading session ",
									sessionId,
									"…"
								]
							}) : nodes.length === 0 && partial === null && queue.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: { color: "var(--dsw-alias-label-primary-dimmed, #656d76)" },
								children: "No messages yet."
							}) : nodes.map((node) => {
								const isUser = node.kind === "user" || node.kind === "steering";
								if (node.kind === "assistant") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										alignSelf: "stretch",
										padding: "2px 0",
										fontSize: 13,
										lineHeight: 1.6
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantBlocksView, { blocks: node.blocks })
								}, node.seq);
								if (node.kind === "tool-result") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolResultCard, { node }, node.seq);
								if (node.kind === "command") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommandCard, { node }, node.seq);
								if (node.kind === "turn-error" || node.kind === "turn-max-tokens") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										alignSelf: "center",
										color: "var(--dsw-alias-state-error-primary, #d1242f)",
										fontSize: 12
									},
									children: node.kind === "turn-error" ? node.message : "Turn stopped by the output-token limit"
								}, node.seq);
								if (node.kind !== "user" && node.kind !== "steering" && node.kind !== "context") return null;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										alignSelf: isUser ? "flex-end" : "flex-start",
										maxWidth: isUser ? "85%" : "96%",
										padding: isUser ? "6px 10px" : "2px 0",
										borderRadius: isUser ? 8 : 0,
										background: isUser ? "var(--dsw-alias-button-primary-dimmed, #e8f0fe)" : "transparent",
										border: isUser ? "1px solid var(--dsw-alias-border-l2, #d0d7de)" : "none",
										color: "var(--dsw-alias-label-primary, #1f2328)",
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
										fontSize: 13,
										lineHeight: 1.6
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: textBlocksText(node.content) })
								}, node.seq);
							}),
							partial !== null && partial.blocks.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									alignSelf: "stretch",
									padding: "2px 0",
									fontSize: 13,
									lineHeight: 1.6
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantBlocksView, {
									blocks: partial.blocks,
									streaming: true
								})
							}),
							queue.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 4
								},
								children: queue.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										alignSelf: "flex-end",
										maxWidth: "85%",
										padding: "4px 8px",
										borderRadius: 8,
										background: "var(--dsw-alias-bg-mask-drop, rgba(0,0,0,0.04))",
										border: "1px dashed var(--dsw-alias-border-l3, #d0d7de)",
										fontSize: 12,
										display: "flex",
										gap: 8,
										alignItems: "center"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["⏳ ", item.preview] }), item.placement === "queued" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-label": `Remove queued message ${item.preview}`,
										onClick: () => {
											session?.updateQueue(item.id, { kind: "remove" });
										},
										style: {
											border: 0,
											background: "transparent",
											cursor: "pointer"
										},
										children: "×"
									})]
								}, item.id))
							}),
							pendingCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-mcp-open-main": true,
								onClick: openInMain,
								style: {
									alignSelf: "center",
									padding: "6px 10px",
									fontSize: 12,
									borderRadius: 6,
									border: "1px solid var(--dsw-alias-state-warn-primary, #bf8700)",
									background: "var(--dsw-alias-bg-layer-1, #fff)",
									color: "var(--dsw-alias-label-primary, #1f2328)",
									cursor: "pointer"
								},
								children: "Approval / plan review — open in main conversation"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: composerRef,
						"data-mcp-composer": true,
						style: {
							borderTop: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
							padding: 8,
							minHeight: composerHeight,
							boxSizing: "border-box",
							background: "var(--dsw-alias-bg-layer-1, #fff)",
							flexShrink: 0,
							position: "relative"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								"data-mcp-composer-resize": true,
								"aria-label": "Resize composer",
								title: "Drag up or down to resize the composer",
								onPointerDown: startComposerResize,
								onPointerMove: moveComposerResize,
								onPointerUp: (event) => finishComposerResize(event, true),
								onPointerCancel: (event) => finishComposerResize(event, false),
								style: {
									position: "absolute",
									top: -4,
									left: 0,
									right: 0,
									height: 8,
									cursor: "ns-resize",
									touchAction: "none",
									zIndex: 4
								}
							}),
							!atBottom && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-mcp-scroll-bottom": true,
								"aria-label": "Scroll to latest message",
								title: "Scroll to latest message",
								onClick: () => scrollToBottom(true),
								style: {
									position: "absolute",
									right: 12,
									top: -34,
									width: 26,
									height: 26,
									borderRadius: "50%",
									border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
									background: "var(--dsw-alias-bg-layer-1, #fff)",
									color: "var(--dsw-alias-label-primary, #1f2328)",
									cursor: "pointer",
									boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
									zIndex: 4
								},
								children: "↓"
							}),
							slashOpen && slashCandidates.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								"data-mcp-slash-menu": true,
								role: "listbox",
								"aria-label": "Slash commands",
								style: {
									position: "absolute",
									left: 8,
									right: 8,
									bottom: "100%",
									marginBottom: 4,
									border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
									borderRadius: 8,
									background: "var(--dsw-alias-bg-layer-1, #fff)",
									boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
									overflow: "hidden",
									zIndex: 5
								},
								children: slashCandidates.map((command, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "option",
									"aria-selected": index === slashIndex,
									onMouseDown: (event) => {
										event.preventDefault();
										setDraft(`/${command.name} `);
										inputRef.current?.focus();
									},
									style: {
										display: "flex",
										alignItems: "baseline",
										gap: 8,
										width: "100%",
										padding: "6px 10px",
										border: 0,
										borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.04))",
										background: index === slashIndex ? "var(--dsw-alias-bg-layer-2, #f6f8fa)" : "transparent",
										color: "var(--dsw-alias-label-primary, #1f2328)",
										cursor: "pointer",
										textAlign: "left",
										fontSize: 12
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: {
											fontWeight: 600,
											flexShrink: 0
										},
										children: ["/", command.name]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: {
											color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap"
										},
										children: command.hint ?? command.description
									})]
								}, command.name))
							}),
							attachments.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								"data-mcp-attachment-rail": true,
								style: {
									display: "flex",
									gap: 6,
									overflowX: "auto",
									marginBottom: 6,
									paddingBottom: 2
								},
								children: attachments.map((attachment) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										position: "relative",
										flexShrink: 0
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
										src: attachment.previewUrl,
										alt: attachment.file.name,
										style: {
											width: 56,
											height: 56,
											objectFit: "cover",
											borderRadius: 6,
											border: "1px solid var(--dsw-alias-border-l2, #d0d7de)"
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-label": `Remove attachment ${attachment.file.name}`,
										onClick: () => removeAttachment(attachment.id),
										style: {
											position: "absolute",
											top: -4,
											right: -4,
											width: 18,
											height: 18,
											borderRadius: "50%",
											border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
											background: "var(--dsw-alias-bg-layer-1, #fff)",
											color: "var(--dsw-alias-label-primary, #1f2328)",
											cursor: "pointer",
											fontSize: 12,
											lineHeight: 1,
											padding: 0
										},
										children: "×"
									})]
								}, attachment.id))
							}),
							attachmentError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									marginBottom: 6,
									color: "var(--dsw-alias-state-error-primary, #d1242f)",
									fontSize: 11
								},
								children: attachmentError
							}),
							running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								"data-mcp-running": true,
								style: {
									marginBottom: 6,
									color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
									fontSize: 11
								},
								children: "● Running — live output below"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
								onSubmit: submit,
								style: {
									display: "flex",
									gap: 6,
									alignItems: "flex-end"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"data-mcp-attach": true,
										"aria-label": "Attach image",
										title: "Attach image",
										onClick: () => fileInputRef.current?.click(),
										style: {
											flexShrink: 0,
											padding: "6px 8px",
											borderRadius: 8,
											border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
											background: "var(--dsw-alias-bg-layer-1, #fff)",
											color: "var(--dsw-alias-label-primary, #1f2328)",
											cursor: "pointer",
											fontSize: 14,
											lineHeight: 1
										},
										children: "📎"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: fileInputRef,
										type: "file",
										accept: "image/png,image/jpeg,image/webp,image/gif",
										multiple: true,
										style: { display: "none" },
										onChange: (event) => {
											addFiles([...event.target.files ?? []]);
											event.target.value = "";
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										ref: inputRef,
										"aria-label": `Message ${sessionId}`,
										value: draft,
										onChange: (event) => setDraft(event.target.value),
										onKeyDown: onComposerKeyDown,
										rows: 2,
										placeholder: "Message or /command…",
										style: {
											flex: 1,
											resize: "none",
											fontSize: 13,
											lineHeight: `${COMPOSER_LINE_HEIGHT}px`,
											padding: "6px 8px",
											borderRadius: 8,
											border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
											background: "var(--dsw-alias-bg-layer-1, #fff)",
											color: "var(--dsw-alias-label-primary, #1f2328)",
											minWidth: 0,
											overflowY: "auto"
										}
									}),
									running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"data-mcp-cancel": true,
										"aria-label": "Cancel running turn",
										onClick: () => {
											session?.cancel();
										},
										style: {
											padding: "6px 10px",
											borderRadius: 8,
											border: "1px solid var(--dsw-alias-state-error-primary, #d1242f)",
											background: "var(--dsw-alias-bg-layer-1, #fff)",
											color: "var(--dsw-alias-state-error-primary, #d1242f)",
											cursor: "pointer",
											fontSize: 13,
											flexShrink: 0
										},
										children: "Stop"
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "submit",
										"data-mcp-send": true,
										style: {
											padding: "6px 12px",
											borderRadius: 8,
											border: "1px solid var(--dsw-alias-button-primary-fill, #1f2328)",
											background: "var(--dsw-alias-button-primary-fill, #1f2328)",
											color: "var(--dsw-alias-button-primary-foreground, #fff)",
											cursor: "pointer",
											fontWeight: 600,
											fontSize: 13,
											flexShrink: 0
										},
										children: "Send"
									})
								]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/MissionControlPage.tsx
		/**
		* Mission Control main page.
		*
		* Panes live in dynamic horizontal rows: a row that would overflow the
		* available width moves its rightmost pane to a new row, and a manual header
		* drag can place a pane in any row. Panes with no persisted size split their
		* row's width evenly; each row scrolls horizontally instead of auto-wrapping.
		* Panes are resizable through every edge and corner. Left-edge resizes
		* compensate the previous pane's width; top-edge resizes add a vertical
		* offset inside the row. A bottom-edge resize may grow past the current row:
		* the pane draws on top while dragging and the row height allocation below
		* gives way on commit, so taller panes squeeze the rows underneath instead of
		* being clamped at the row boundary.
		*/
		const DROP_PREVIEW_CSS = `
[data-mcp-row].mcp-drop-target {
  outline: 2px dashed var(--dsw-alias-button-primary-fill, #1f2328);
  outline-offset: -2px;
  border-radius: 8px;
}
[data-mcp-row].mcp-drop-reject {
  outline: 2px dashed var(--dsw-alias-state-error-primary, #d1242f);
  outline-offset: -2px;
  border-radius: 8px;
  background: rgba(209, 36, 47, 0.06);
}
[data-mcp-grid][data-mcp-new-row]::after {
  content: 'Drop to create a new row';
  display: block;
  padding: 10px;
  border: 2px dashed var(--dsw-alias-border-l3, #a8b0b8);
  border-radius: 8px;
  color: var(--dsw-alias-label-primary-dimmed, #656d76);
  font-size: 12px;
  text-align: center;
}
/* While a pane is actively resized its live height may exceed its row, so the
 * row and grid stop clipping and the pane paints above the rows underneath. */
[data-mcp-row]:has([data-mcp-resizing]),
[data-mcp-grid]:has([data-mcp-resizing]) {
  overflow: visible !important;
}
[data-mcp-pane][data-mcp-resizing] {
  z-index: 10;
}
`;
		function baseName(cwd) {
			if (cwd === void 0 || cwd === "") return "";
			return cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? "";
		}
		/** Directory + git branch/worktree line for one pane. */
		function GitInfoLine({ cwd }) {
			const [info, setInfo] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (cwd === void 0 || cwd === "") return;
				let cancelled = false;
				fetchGitInfo(cwd).then((value) => {
					if (!cancelled) setInfo(value);
				});
				return () => {
					cancelled = true;
				};
			}, [cwd]);
			const base = baseName(cwd);
			if (cwd === void 0 || cwd === "") return null;
			if (info === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: base });
			const parts = [base];
			if (info.isRepo && info.branch !== null) parts.push(info.branch);
			if (info.worktree !== null) parts.push(info.worktree);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: parts.join(" · ") });
		}
		/**
		* Equal-size default for a pane with no persisted size: the row's width is
		* split evenly across its panes, and the grid height is split evenly across
		* the populated rows.
		* @param count - number of panes in the row.
		* @param viewport - measured rows area, or null before the first measure.
		* @param rowCount - total populated rows.
		* @returns the pane size to use until the user resizes it.
		*/
		function rowDefaultSize(count, viewport, rowCount) {
			if (viewport === null || viewport.width <= 0 || viewport.height <= 0) return FALLBACK_PANE_SIZE;
			const height = Math.max(280, Math.floor((viewport.height - 14 * (rowCount - 1)) / rowCount));
			return {
				width: Math.max(360, Math.floor((viewport.width - 14 * (count - 1)) / count)),
				height
			};
		}
		/**
		* Desired height of each row: never less than its even split of the grid, and
		* grown to fit the tallest persisted pane in that row. Rows with a taller pane
		* therefore push the rows below down; when the rows no longer fit the grid
		* view the grid scrolls vertically instead of clamping the pane.
		* @param rowIdsByNumber - pane ids per row, in row order.
		* @param viewport - measured grid area, or null before the first measure.
		* @returns height per row, in the same order as `rowIdsByNumber`.
		*/
		function desiredRowHeights(rowIdsByNumber, viewport) {
			if (viewport === null || viewport.width <= 0 || viewport.height <= 0) return rowIdsByNumber.map(() => FALLBACK_PANE_SIZE.height);
			const even = Math.max(280, Math.floor((viewport.height - 14 * (rowIdsByNumber.length - 1)) / rowIdsByNumber.length));
			return rowIdsByNumber.map((ids) => {
				let tallest = even;
				for (const id of ids) {
					const persisted = getPaneSize(id);
					if (persisted === void 0) continue;
					const bottom = (persisted.top ?? 0) + persisted.height;
					if (bottom > tallest) tallest = bottom;
				}
				return tallest;
			});
		}
		/** One resizable, row-movable pane frame. */
		function ResizablePane({ sessionId, title, cwd, row, defaultSize, rowHeight, onClose, onOpenSingle, children }) {
			const persisted = (0, react.useSyncExternalStore)(subscribePanes, () => getPaneSize(sessionId), () => void 0);
			const frameRef = (0, react.useRef)(null);
			const dragRef = (0, react.useRef)(null);
			const liveRef = (0, react.useRef)(null);
			const [live, setLive] = (0, react.useState)(null);
			const effectiveSize = live ?? persisted ?? defaultSize;
			const top = live?.top ?? persisted?.top ?? 0;
			const size = live !== null ? live : {
				...effectiveSize,
				height: Math.min(effectiveSize.height, rowHeight - top)
			};
			const axisUsesLeft = (axis) => axis === "w" || axis === "nw" || axis === "sw";
			const axisUsesRight = (axis) => axis === "e" || axis === "ne" || axis === "se";
			const axisUsesTop = (axis) => axis === "n" || axis === "ne" || axis === "nw";
			const axisUsesBottom = (axis) => axis === "s" || axis === "se" || axis === "sw";
			const nextSize = (clientX, clientY) => {
				const start = dragRef.current;
				if (start === null) return null;
				let width = start.width;
				let height = start.height;
				let top = start.top;
				let prevWidth;
				if (axisUsesRight(start.axis)) width = Math.max(360, start.width + clientX - start.x);
				else if (axisUsesLeft(start.axis)) if (start.prevElement !== void 0 && start.prevWidth !== void 0) {
					const delta = start.x - clientX;
					width = Math.max(360, start.width + delta);
					prevWidth = Math.max(360, start.prevWidth - delta);
				} else width = Math.max(360, start.width + clientX - start.x);
				if (axisUsesTop(start.axis)) {
					const deltaY = clientY - start.y;
					const maxTop = start.top + start.height - 280;
					top = Math.max(0, Math.min(start.top + deltaY, maxTop));
					height = start.top + start.height - top;
				} else if (axisUsesBottom(start.axis)) height = Math.max(280, start.height + clientY - start.y);
				return {
					size: {
						width,
						height,
						...top === 0 ? {} : { top }
					},
					prevWidth
				};
			};
			const startResize = (event, axis) => {
				event.preventDefault();
				event.stopPropagation();
				const frame = frameRef.current;
				if (frame === null) return;
				const rect = frame.getBoundingClientRect();
				const top = parseFloat(frame.style.marginTop || "0") || 0;
				const start = {
					pointerId: event.pointerId,
					axis,
					x: event.clientX,
					y: event.clientY,
					width: rect.width,
					height: rect.height,
					top
				};
				if (axisUsesLeft(axis)) {
					const prev = frame.previousElementSibling;
					if (prev instanceof HTMLDivElement && prev.getAttribute("data-mcp-pane") !== null) {
						const prevSessionId = prev.getAttribute("data-mcp-session");
						if (prevSessionId !== null) {
							const prevRect = prev.getBoundingClientRect();
							start.prevElement = prev;
							start.prevSessionId = prevSessionId;
							start.prevPersisted = getPaneSize(prevSessionId);
							start.prevWidth = prevRect.width;
							start.prevHeight = prevRect.height;
						}
					}
				}
				dragRef.current = start;
				liveRef.current = {
					width: rect.width,
					height: rect.height,
					...top === 0 ? {} : { top }
				};
				setLive(liveRef.current);
				event.currentTarget.setPointerCapture(event.pointerId);
			};
			const moveResize = (event) => {
				if (dragRef.current === null || dragRef.current.pointerId !== event.pointerId) return;
				if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
				const next = nextSize(event.clientX, event.clientY);
				if (next === null) return;
				liveRef.current = next.size;
				setLive(next.size);
				if (next.prevWidth !== void 0 && dragRef.current.prevElement !== void 0) dragRef.current.prevElement.style.width = `${next.prevWidth}px`;
			};
			const finishResize = (event, commit) => {
				const start = dragRef.current;
				if (start === null || start.pointerId !== event.pointerId) return;
				const next = commit ? liveRef.current : null;
				dragRef.current = null;
				liveRef.current = null;
				if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
				const prevElement = start.prevElement;
				const prevWidth = prevElement === void 0 ? void 0 : parseFloat(prevElement.style.width || "0");
				if (prevElement !== void 0) prevElement.style.width = "";
				if (commit && next !== null && (next.width !== start.width || next.height !== start.height || (next.top ?? 0) !== start.top)) setPaneSize(sessionId, next);
				if (commit && prevElement !== void 0 && start.prevSessionId !== void 0 && prevWidth !== void 0 && Number.isFinite(prevWidth) && prevWidth !== start.prevWidth) {
					const prevPersisted = start.prevPersisted;
					setPaneSize(start.prevSessionId, {
						width: prevWidth,
						height: prevPersisted?.height ?? start.prevHeight ?? 280,
						...prevPersisted?.top === void 0 ? {} : { top: prevPersisted.top }
					});
				}
				setLive(null);
			};
			const startPaneDrag = (event) => {
				if (event.target instanceof Element && event.target.closest("button") !== null) {
					event.preventDefault();
					return;
				}
				event.dataTransfer.setData(PANE_DRAG_MIME, sessionId);
				event.dataTransfer.effectAllowed = "move";
				const frame = frameRef.current;
				if (frame !== null) {
					const rect = frame.getBoundingClientRect();
					event.dataTransfer.setDragImage(frame, event.clientX - rect.left, event.clientY - rect.top);
				}
			};
			const edgeStyle = {
				position: "absolute",
				zIndex: 2,
				touchAction: "none"
			};
			const topCornerStyle = {
				position: "absolute",
				zIndex: 3,
				touchAction: "none",
				width: 14,
				height: 6
			};
			const bottomCornerStyle = {
				position: "absolute",
				zIndex: 3,
				touchAction: "none",
				width: 20,
				height: 20
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: frameRef,
				"data-mcp-pane": true,
				"data-mcp-session": sessionId,
				"data-mcp-row": row,
				"data-mcp-resizing": live !== null || void 0,
				style: {
					width: size.width,
					height: size.height,
					marginTop: top,
					boxSizing: "border-box",
					flexShrink: 0,
					border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
					borderRadius: 10,
					background: "var(--dsw-alias-bg-layer-1, #fff)",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					position: "relative",
					userSelect: live !== null ? "none" : void 0,
					boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						"data-mcp-row-handle": true,
						draggable: true,
						title: row === 0 ? "Drag to reorder, or downward to open the second row" : "Drag to reorder, or upward to return to the first row",
						onDragStart: startPaneDrag,
						style: {
							position: "relative",
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: 8,
							padding: "8px 12px",
							borderBottom: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
							background: "var(--dsw-alias-bg-layer-2, #f6f8fa)",
							flexShrink: 0,
							cursor: "grab"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
								style: {
									fontSize: 13,
									fontWeight: 600,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									minWidth: 0,
									flex: 1
								},
								children: title
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								"data-mcp-drag-handle": true,
								title: "Drag to move between rows",
								style: {
									position: "absolute",
									left: "50%",
									top: "50%",
									transform: "translate(-50%, -50%)",
									color: "var(--dsw-alias-label-primary, #1f2328)",
									letterSpacing: 2,
									opacity: .55
								},
								children: "⋮⋮"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									display: "flex",
									alignItems: "center",
									gap: 6,
									flexShrink: 0
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-mcp-open-single": true,
									"aria-label": `Open ${title} in single conversation view`,
									title: "Open in single conversation view",
									onClick: onOpenSingle,
									style: {
										border: 0,
										background: "transparent",
										color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
										cursor: "pointer",
										fontSize: 14,
										lineHeight: 1,
										padding: 2
									},
									children: "⤢"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": `Close ${title}`,
									onClick: onClose,
									style: {
										border: 0,
										background: "transparent",
										color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
										cursor: "pointer",
										fontSize: 16,
										lineHeight: 1,
										padding: 2
									},
									children: "×"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							padding: "6px 12px",
							color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
							fontSize: 12,
							borderBottom: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
							flexShrink: 0
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GitInfoLine, { cwd })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							flex: 1,
							minHeight: 0
						},
						children
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-mcp-resize-edge": "e",
						"aria-hidden": "true",
						onPointerDown: (event) => startResize(event, "e"),
						onPointerMove: moveResize,
						onPointerUp: (event) => finishResize(event, true),
						onPointerCancel: (event) => finishResize(event, false),
						style: {
							...edgeStyle,
							top: 8,
							bottom: 8,
							right: 0,
							width: 8,
							cursor: "ew-resize"
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-mcp-resize-edge": "w",
						"aria-hidden": "true",
						onPointerDown: (event) => startResize(event, "w"),
						onPointerMove: moveResize,
						onPointerUp: (event) => finishResize(event, true),
						onPointerCancel: (event) => finishResize(event, false),
						style: {
							...edgeStyle,
							top: 8,
							bottom: 8,
							left: 0,
							width: 8,
							cursor: "ew-resize"
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-mcp-resize-edge": "s",
						"aria-hidden": "true",
						onPointerDown: (event) => startResize(event, "s"),
						onPointerMove: moveResize,
						onPointerUp: (event) => finishResize(event, true),
						onPointerCancel: (event) => finishResize(event, false),
						style: {
							...edgeStyle,
							left: 8,
							right: 8,
							bottom: 0,
							height: 8,
							cursor: "ns-resize"
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-mcp-resize-edge": "n",
						"aria-hidden": "true",
						onPointerDown: (event) => startResize(event, "n"),
						onPointerMove: moveResize,
						onPointerUp: (event) => finishResize(event, true),
						onPointerCancel: (event) => finishResize(event, false),
						style: {
							...edgeStyle,
							left: 8,
							right: 8,
							top: 0,
							height: 8,
							cursor: "ns-resize"
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-mcp-resize-corner": true,
						"data-mcp-resize-axis": "nw",
						"aria-label": `Resize ${title} from top-left`,
						title: `Resize ${title} from top-left`,
						onPointerDown: (event) => startResize(event, "nw"),
						onPointerMove: moveResize,
						onPointerUp: (event) => finishResize(event, true),
						onPointerCancel: (event) => finishResize(event, false),
						style: {
							...topCornerStyle,
							left: 0,
							top: 0,
							cursor: "nwse-resize"
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-mcp-resize-corner": true,
						"data-mcp-resize-axis": "ne",
						"aria-label": `Resize ${title} from top-right`,
						title: `Resize ${title} from top-right`,
						onPointerDown: (event) => startResize(event, "ne"),
						onPointerMove: moveResize,
						onPointerUp: (event) => finishResize(event, true),
						onPointerCancel: (event) => finishResize(event, false),
						style: {
							...topCornerStyle,
							right: 0,
							top: 0,
							cursor: "nesw-resize"
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-mcp-resize-corner": true,
						"data-mcp-resize-axis": "sw",
						"aria-label": `Resize ${title} from bottom-left`,
						title: `Resize ${title} from bottom-left`,
						onPointerDown: (event) => startResize(event, "sw"),
						onPointerMove: moveResize,
						onPointerUp: (event) => finishResize(event, true),
						onPointerCancel: (event) => finishResize(event, false),
						style: {
							...bottomCornerStyle,
							left: 0,
							bottom: 0,
							cursor: "nesw-resize"
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-mcp-resize-handle": true,
						"data-mcp-resize-axis": "se",
						"aria-label": `Resize ${title}`,
						title: `Resize ${title}`,
						onPointerDown: (event) => startResize(event, "se"),
						onPointerMove: moveResize,
						onPointerUp: (event) => finishResize(event, true),
						onPointerCancel: (event) => finishResize(event, false),
						style: {
							position: "absolute",
							right: 0,
							bottom: 0,
							width: 22,
							height: 22,
							cursor: "nwse-resize",
							touchAction: "none",
							zIndex: 3
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							"aria-hidden": "true",
							style: {
								position: "absolute",
								right: 4,
								bottom: 4,
								width: 12,
								height: 12,
								borderRight: "2px solid var(--dsw-alias-border-l3, #a8b0b8)",
								borderBottom: "2px solid var(--dsw-alias-border-l3, #a8b0b8)",
								borderRadius: "0 0 4px 0"
							}
						})
					})
				]
			});
		}
		/** Mission Control page with a row-based pane layout. */
		function MissionControlPage({ useSessions, getSession, getModelDirectory, listCommands, openInMain }) {
			const sessions = useSessions((s) => s);
			const paneRevision = (0, react.useSyncExternalStore)(subscribePanes, getPaneRevision, () => 0);
			const panes = (0, react.useSyncExternalStore)(subscribePanes, getPanes, getPanes);
			const gridRef = (0, react.useRef)(null);
			const [viewport, setViewport] = (0, react.useState)(null);
			const availableIds = (0, react.useMemo)(() => sessions.ids.filter((id) => !panes.includes(id)), [sessions.ids, panes]);
			const availableKey = availableIds.join("\0");
			const [selected, setSelected] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				if (selected !== "" && availableIds.includes(selected)) return;
				setSelected(availableIds[0] ?? "");
			}, [availableKey]);
			(0, react.useEffect)(() => {
				const grid = gridRef.current;
				if (grid === null) return;
				const measure = () => {
					setViewport({
						width: grid.clientWidth,
						height: grid.clientHeight
					});
				};
				measure();
				const observer = new ResizeObserver(measure);
				observer.observe(grid);
				return () => {
					observer.disconnect();
				};
			}, []);
			(0, react.useEffect)(() => {
				if (viewport === null || panes.length === 0) return;
				reflowRows(viewport.width);
			}, [
				paneRevision,
				panes,
				viewport
			]);
			const rowMap = /* @__PURE__ */ new Map();
			for (const id of panes) {
				const row = getPaneRow(id);
				const list = rowMap.get(row) ?? [];
				list.push(id);
				rowMap.set(row, list);
			}
			const rowNumbers = [...rowMap.keys()].sort((left, right) => left - right);
			const rowCount = rowNumbers.length;
			const rowIdsByNumber = rowNumbers.map((row) => rowMap.get(row) ?? []);
			const rowHeights = desiredRowHeights(rowIdsByNumber, viewport);
			const renderRow = (ids, row, rowHeight) => {
				const defaultSize = rowDefaultSize(ids.length, viewport, rowCount);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					"data-mcp-row": row,
					style: {
						display: "flex",
						gap: 14,
						alignItems: "stretch",
						overflow: "auto",
						minHeight: 0,
						height: rowHeight,
						flexShrink: 0,
						...ids.length === 0 ? {
							height: 0,
							overflow: "hidden"
						} : {}
					},
					children: ids.map((sessionId) => {
						const summary = sessions.byId[sessionId];
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ResizablePane, {
							sessionId,
							title: summary?.title ?? summary?.displayTitle ?? sessionId,
							cwd: summary?.cwd,
							row,
							defaultSize,
							rowHeight,
							onClose: () => removePane(sessionId),
							onOpenSingle: () => openInMain(sessionId),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MiniChatPane, {
								sessionId,
								session: getSession(sessionId),
								directory: getModelDirectory(sessionId),
								listCommands,
								openInMain: () => openInMain(sessionId)
							})
						}, sessionId);
					})
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					padding: 24,
					boxSizing: "border-box",
					fontFamily: "var(--dsw-font-family, system-ui, sans-serif)",
					height: "100%",
					minHeight: 0,
					background: "var(--dsw-alias-bg-base, #fff)",
					color: "var(--dsw-alias-label-primary, #1f2328)",
					overflow: "hidden"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: DROP_PREVIEW_CSS }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							marginBottom: 16,
							flexShrink: 0
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							style: {
								fontSize: 20,
								margin: 0,
								fontWeight: 600
							},
							children: "Mission Control"
						}), availableIds.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 8,
								alignItems: "center"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								"data-mcp-picker": true,
								value: selected,
								onChange: (event) => setSelected(event.target.value),
								style: {
									padding: "4px 8px",
									fontSize: 13,
									background: "var(--dsw-alias-bg-layer-2, #fff)",
									color: "var(--dsw-alias-label-primary, #1f2328)",
									border: "1px solid var(--dsw-alias-border-l2, #d0d7de)",
									borderRadius: 6
								},
								children: availableIds.map((id) => {
									const summary = sessions.byId[id];
									return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: id,
										children: summary?.title ?? summary?.displayTitle ?? id
									}, id);
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-mcp-add-pane": true,
								disabled: selected === "",
								onClick: () => addPane(selected),
								style: {
									padding: "4px 10px",
									fontSize: 13,
									cursor: "pointer",
									background: "var(--dsw-alias-button-primary-fill, #1f2328)",
									color: "var(--dsw-alias-button-primary-foreground, #fff)",
									border: 0,
									borderRadius: 6,
									fontWeight: 600
								},
								children: "Add"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: gridRef,
						"data-mcp-grid": true,
						style: {
							display: "flex",
							flexDirection: "column",
							gap: 14,
							flex: 1,
							minHeight: 0,
							overflowY: "auto",
							overflowX: "hidden"
						},
						children: panes.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: {
								color: "var(--dsw-alias-label-primary-dimmed, #656d76)",
								margin: 0
							},
							children: "Drag a conversation here to start a multi-pane view."
						}) : rowNumbers.map((row, index) => renderRow(rowIdsByNumber[index] ?? [], row, rowHeights[index] ?? FALLBACK_PANE_SIZE.height))
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		const PAGE_ID = "mission-control";
		const inject = [
			"slots",
			"layout",
			"sessions",
			"modelDirectories",
			"remote",
			"remote.commands"
		];
		function isCenterTarget(target) {
			return target instanceof Element && target.closest("[class*=\"centerSurface\"]") !== null;
		}
		function gridRowElement(grid, row) {
			return grid.querySelector(`:scope > [data-mcp-row="${row}"]`);
		}
		/** Horizontal insertion point in one row, expressed as the pane that follows it. */
		function beforeIdForDrop(rowElement, clientX, excludeId) {
			const panes = [...rowElement.querySelectorAll("[data-mcp-pane]")];
			for (const pane of panes) {
				const sessionId = pane.getAttribute("data-mcp-session");
				if (sessionId === null || sessionId === excludeId) continue;
				const rect = pane.getBoundingClientRect();
				if (clientX < rect.left + rect.width / 2) return sessionId;
			}
		}
		/** Width a pane will claim when it sits on a row: persisted size, else its DOM width. */
		function paneGridWidth(pane, sessionId) {
			const persisted = getPaneSize(sessionId);
			if (persisted !== void 0) return persisted.width;
			return pane.getBoundingClientRect().width;
		}
		/** Whether inserting `draggedId` at `beforeId` fits the row's available width. */
		function rowFitsAfterInsert(rowElement, draggedId, draggedWidth, beforeId) {
			const ids = [];
			for (const pane of rowElement.querySelectorAll("[data-mcp-pane]")) {
				const sessionId = pane.getAttribute("data-mcp-session");
				if (sessionId === null || sessionId === draggedId) continue;
				if (beforeId === sessionId) ids.push(draggedId);
				ids.push(sessionId);
			}
			if (beforeId === void 0) ids.push(draggedId);
			return ids.reduce((sum, id, index) => {
				if (id === draggedId) return sum + draggedWidth;
				const pane = rowElement.querySelector(`[data-mcp-session="${CSS.escape(id)}"]`);
				return sum + (pane === null ? 0 : paneGridWidth(pane, id));
			}, 14 * Math.max(0, ids.length - 1)) <= rowElement.clientWidth + 1;
		}
		/** Row chosen by the drop point; below the last row creates a new row. */
		function rowForDrop(grid, clientY) {
			const rows = [...grid.querySelectorAll(":scope > [data-mcp-row]")].sort((left, right) => Number(left.getAttribute("data-mcp-row")) - Number(right.getAttribute("data-mcp-row")));
			if (rows.length === 0) return 0;
			for (const row of rows) if (clientY < row.getBoundingClientRect().bottom - 12) return Number(row.getAttribute("data-mcp-row") ?? 0);
			return Number(rows[rows.length - 1]?.getAttribute("data-mcp-row") ?? 0) + 1;
		}
		/** Clear any drag-over row preview class left by a cancelled drag. */
		function clearDropPreview() {
			const grid = document.querySelector("[data-mcp-grid]");
			if (grid !== null) {
				delete grid.dataset.mcpNewRow;
				for (const row of grid.querySelectorAll(":scope > [data-mcp-row]")) {
					row.classList.remove("mcp-drop-target");
					row.classList.remove("mcp-drop-reject");
				}
			}
		}
		function apply(ctx) {
			ctx.slots.inject("sidebar.primary.action", () => ctx.slots.register({
				name: "sidebar.primary.action",
				id: PAGE_ID,
				order: 30,
				inject: () => ({
					pageId: PAGE_ID,
					open: () => {
						ctx.layout.openPrimaryPage(PAGE_ID);
					}
				})
			}, MissionControlNav));
			ctx.slots.inject("main.page", () => ctx.slots.register({
				name: "main.page",
				key: PAGE_ID,
				inject: () => ({
					getSession: (sessionId) => ctx.sessions.binding(sessionId)?.session,
					getModelDirectory: (sessionId) => {
						try {
							return ctx.modelDirectories.directoryFor(sessionId);
						} catch {
							return;
						}
					},
					listCommands: async (sessionId) => {
						try {
							const result = await ctx.remote.commands.list(sessionId);
							if (!result.ok) return [];
							return result.value.map((command) => ({
								name: command.name,
								description: command.description,
								...command.input?.hint === void 0 ? {} : { hint: command.input.hint }
							}));
						} catch {
							return [];
						}
					},
					openInMain: (sessionId) => {
						ctx.sessions.open(sessionId);
						ctx.layout.closePrimaryPage();
					}
				})
			}, MissionControlPage));
			const onDragOver = (event) => {
				if (!isCenterTarget(event.target)) return;
				if (event.dataTransfer === null) return;
				if (!event.dataTransfer.types.includes("text/plain") && !event.dataTransfer.types.includes("application/x-mcp-pane")) return;
				event.preventDefault();
				if (!event.dataTransfer.types.includes("application/x-mcp-pane")) return;
				const grid = document.querySelector("[data-mcp-grid]");
				if (grid === null) return;
				const row = rowForDrop(grid, event.clientY);
				for (const rowElement of grid.querySelectorAll(":scope > [data-mcp-row]")) {
					rowElement.classList.remove("mcp-drop-target");
					rowElement.classList.remove("mcp-drop-reject");
				}
				delete grid.dataset.mcpNewRow;
				const target = gridRowElement(grid, row);
				if (target === null) {
					grid.dataset.mcpNewRow = "1";
					return;
				}
				const draggedId = event.dataTransfer.getData(PANE_DRAG_MIME);
				const before = beforeIdForDrop(target, event.clientX, draggedId);
				const draggedPane = document.querySelector(`[data-mcp-session="${CSS.escape(draggedId)}"]`);
				if (rowFitsAfterInsert(target, draggedId, draggedPane === null ? getPaneSize(draggedId)?.width ?? 360 : draggedPane.getBoundingClientRect().width, before)) target.classList.add("mcp-drop-target");
				else target.classList.add("mcp-drop-reject");
			};
			const onDrop = (event) => {
				if (!isCenterTarget(event.target)) return;
				if (event.dataTransfer === null) return;
				const paneDragged = event.dataTransfer.types.includes(PANE_DRAG_MIME);
				const dragged = paneDragged ? event.dataTransfer.getData(PANE_DRAG_MIME) : event.dataTransfer.getData("text/plain");
				if (dragged === "") return;
				event.preventDefault();
				clearDropPreview();
				const current = ctx.sessions.list.getSnapshot().current;
				const grid = document.querySelector("[data-mcp-grid]");
				if (grid === null) {
					if (!paneDragged && current !== void 0 && current !== dragged) placePane(current, 0);
					const center = event.target instanceof Element ? event.target.closest("[class*=\"centerSurface\"]")?.getBoundingClientRect() : void 0;
					placePane(dragged, 0, current !== void 0 && center !== void 0 && event.clientX < center.left + center.width / 2 ? current : void 0);
					ctx.layout.openPrimaryPage(PAGE_ID);
					return;
				}
				const row = rowForDrop(grid, event.clientY);
				const rowElement = gridRowElement(grid, row);
				const before = rowElement === null ? void 0 : beforeIdForDrop(rowElement, event.clientX, dragged);
				if (paneDragged && rowElement !== null) {
					const draggedPane = document.querySelector(`[data-mcp-session="${CSS.escape(dragged)}"]`);
					if (!rowFitsAfterInsert(rowElement, dragged, draggedPane === null ? getPaneSize(dragged)?.width ?? 360 : draggedPane.getBoundingClientRect().width, before)) return;
				}
				placePane(dragged, row, before);
			};
			ctx.effect(() => {
				document.addEventListener("dragover", onDragOver);
				document.addEventListener("drop", onDrop);
				document.addEventListener("dragend", clearDropPreview);
				return () => {
					document.removeEventListener("dragover", onDragOver);
					document.removeEventListener("drop", onDrop);
					document.removeEventListener("dragend", clearDropPreview);
				};
			}, "multiple-chat-panels: drag-drop");
		}
		//#endregion
		exports.PAGE_ID = PAGE_ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map