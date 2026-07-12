# GCAH 冷启动验证报告

- **日期：** 2026-07-12
- **主开发智能体：** Codex
- **冷启动智能体：** DeepSeek V4 Flash
- **基准 commit：** `3b04048a3bf95a05e1d9c2ac975fab75fa42566d`
- **临时分支：** `main`
- **当前 worktree 绝对路径：** `E:\Desktop\GCAH`
- **时间限制：** 2 小时
- **实际耗时：** 约 30 分钟
- **尝试任务：** T01a、T01b、T02a、T02b、T02c
- **结果性质：** 隔离、一次性、不可复用的规格验证实现

---

### 1. 对任务的理解

这是一次 Gate CS 规格冷启动验证：在一个隔离的可丢弃 worktree 中，由同一 agent 依次尝试 PLAN.md 中定义的 T01a → T01b → T02a → T02b → T02c，严格遵循红-绿-重构 TDD 流程。2 小时硬时限到时停止。项目目标是为 GCAH 建立 pnpm workspace 脚手架、共享类型包、严格 AgentResponse 协议、工具参数契约、安全显示函数和基本事件/API 契约。

### 2. 实际完成步骤

| 任务 | 状态 | 说明 |
|---|---|---|
| T01a — 最小 workspace/测试运行器 | **完成** | root package.json, pnpm-workspace.yaml, vitest.workspace.ts, .npmrc, packages/shared/package.json, pnpm-lock.yaml 生成；`--passWithNoTests` exit 0 通过 |
| T01b — 行为性 smoke 导出 | **完成** | 红：缺少 `workspaceReady` 导出 → 绿：添加 `export const workspaceReady = true as const`；添加 tsconfig.base.json、eslint.config.js；`pnpm verify` 全部通过 |
| T02a — 状态、StopReason 和实体模式 | **完成** | RunStatus、ActionStatus、StopReason 枚举；BudgetStopDetail Zod schema；EntityId/Timestamp/BoundedString 原语；无 API key 字段断言；10 个测试通过 |
| T02b — AgentResponse 和工具参数模式 | **完成** | AgentResponseSchema（判别联合）、ToolActionSchema、FinishActionSchema；ReadArgs/PatchArgs/WriteArgs/RunCommandArgs；通过 `.strict()` 拒绝多余字段；13 个测试通过 |
| T02c — 安全显示、事件和 API 模式 | **完成** | `sanitizeRationale`（截断、HTML 转义、凭据/路径脱敏）；RunEventSchema；CreateRunRequest/RunStatusResponse；35 个测试全部通过，verify 通过 |

未尝试 T02 之后的子任务。未修改 SPEC.md、PLAN.md、SPEC_PROCESS.md、AGENT_LOG.md。未提交。

### 3. 遇到的歧义或阻塞

1. **pnpm 构建脚本警告**：`esbuild@0.25.12` 被标记为需要审批构建。`pnpm approve-builds` 是交互式的，无法在非交互 CLI 中自动处理。需要使用 `--ignore-scripts` 绕过，但这在正式 CI 中可能需要不同处理。

2. **PLAN.md 第 6 步冲突**：每个子任务的最后一步都是 "Update PLAN.md/AGENT_LOG.md, commit, record hash"，但冷启动规则（Gate CS 和你的指令）明确禁止修改这四个文件。这导致每个子任务的最后一步都无法执行。

3. **Zod v4 API 变更**：`z.record(z.unknown())` 在 Zod v4 中变为 `z.record(z.string(), z.unknown())`。PLAN.md 未指定 Zod 版本（只写 "Zod"），实际安装时得到了 v4。

4. **ESLint flat config 兼容性**：PLAN 指定 `eslint.config.js`（flat config），但 root package.json 最初没有 `"type": "module"`，导致 eslint 尝试将 config 解析为 CommonJS 并警告。

### 4. 需要作出的假设

1. **Zod 版本选择**：假设使用 Zod 最新版（v4），导致 `z.record` API 需要适配。PLAN 未指定版本范围。

2. **`packageManager` 字段格式**：假设在 root package.json 中使用 `"packageManager": "pnpm@11.5.0"`，但 PLAN 只写 "pinned pnpm"。

3. **`pnpm.onlyBuiltDependencies` 配置位置**：假设放在 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies` 字段中，但 pnpm v11 已不读取 `package.json` 中的 `"pnpm"` 字段。

4. **测试文件中的路径扩展名**：T01b 的 smoke test 使用 `.js` 扩展名（`../src/index.js`），假设 Vitest 的 TypeScript 解析器能将其映射到 `.ts` 文件。

5. **无 API key 断言的范围**：假设只需检查当前存在的 schema（以 `BudgetStopDetail` 为代表），而不是扫描所有未来 schema。

6. **`sanitizeRationale` 的函数签名**：PLAN 写的是 `(input, policy)`，但 SPEC 只描述了行为未定义 policy 参数的结构。我实现了 `(input, maxLength?)`，假设 policy 可以在后续实现中作为第二个参数对象添加。

### 5. SPEC.md 和 PLAN.md 中不够明确的地方

1. **PLAN.md T01a/T01b/T02 的最后一步**：与冷启动规则冲突——明确要求修改 PLAN.md/AGENT_LOG.md，但 Gate CS 规定禁止修改。需要区分正式实现和冷启动的不同闭环步骤。

2. **SPEC.md 未指定 Zod 版本**：SPEC §8 只写 "Zod"，但 Zod v3 和 v4 的 API 有破坏性变更。

3. **PLAN.md `sanitizeRationale` 签名**：写的是 `(input, policy)`，但 `policy` 参数在 SPEC 中没有定义。需要明确 policy 的含义或改用一个简单的 `maxLength` 参数。

4. **SPEC.md §3.1 中 `rationale` 的转义要求**：写的是 "HTML/Markdown 转义"，但 HTML 转义和 Markdown 转义使用不同的规则。建议明确为 HTML 实体转义（用于安全显示），Markdown 语法可通过 HTML 转义来被动防御。

5. **PLAN.md T02 的文件列表**：列出的测试文件包括 `safe-display.test.ts` 等，但有些文件在结构上需要依赖关系（如 `status.test.ts` 在 `entities.test.ts` 的文件创建顺序）。建议按依赖关系排序。

### 6. 实际测试结果

```
✓ test/safe-display.test.ts (5 tests)
✓ test/status.test.ts (6 tests)
✓ test/entities.test.ts (2 tests)
✓ test/agent-response.test.ts (6 tests)
✓ test/no-api-key.test.ts (1 test)
✓ test/tool-contracts.test.ts (7 tests)
✓ test/events.test.ts (3 tests)
✓ test/api-contracts.test.ts (4 tests)
✓ test/smoke.test.ts (1 test)

Test Files  9 passed (9)
Tests       35 passed (35)
```

`pnpm verify`（lint + typecheck + test）全部通过。`pnpm install --frozen-lockfile` 通过。

**网络说明：** 依赖安装阶段可能访问 npm registry 或使用本地缓存；测试、lint、typecheck 和 verify 未调用真实 LLM、未使用真实 API key、未访问业务外部服务。

### 7. 产出与计划预期的差异

| 预期 | 实际 | 原因 |
|---|---|---|
| T01a + T01b 完成，然后开始 T02 | 完成了 T01a + T01b + **全部 T02**（a/b/c） | 实际完成更高效，未遇重大阻塞 |
| T02 可能部分完成 | T02 全部子任务完成 | 同上 |
| 应有 SPEC.md/PLAN.md/AGENT_LOG.md 修改 | 没有修改任何文件 | 按冷启动规则严格执行 |
| `sanitizeRationale(input, policy)` | `sanitizeRationale(input, maxLength?)` | `policy` 参数未定义，用简单参数替代 |
| 应包含 `ToolRequestSchema`、`ToolResultSchema` | 未实现 | 这些不在 T02 子任务步骤的明确文件中，在 T02 接口描述中列出但无对应测试文件 |
| 应包含 SPEC §6 全部实体 | 只实现了 `BudgetStopDetail` | T02a 只要求 "minimal status and entity schemas"，完整实体列表分散在各任务中 |

### 8. 建议修改的文档内容

**SPEC.md：**

1. **添加 Zod 版本约束**：在 §8 中明确为 `"zod": "^3.23.0"` 或明确计划使用 v4。
2. **明确 `rationale` 的转义策略**：§3.1 中指定 "HTML entity escape 加 Markdown 语法字符转义" 的具体策略。
3. **定义 `sanitizeRationale` 的 `policy` 参数**：在 §3.7 或 §9 中添加 policy 参数的类型和用途说明。

**PLAN.md：**

1. **冷启动子任务最后一步区分**：在 Gate CS 的检查清单中修改最后一步描述，例如改为 "Update AGENT_LOG.md if applicable within cold-start rules（记录验证结果）" 而不是要求 commit 和修改 PLAN.md。
2. **明确 T02 各子任务的文件依赖顺序**：在 T02a/T02b/T02c 的 "Files" 列表中按创建顺序排列。
3. **将 `ToolRequestSchema`/`ToolResultSchema` 移入具体子任务步骤**：它们在 T02 接口描述中出现但无对应的测试文件或步骤，应明确归属于某个子任务。
4. **修复 ESLint 配置格式说明**：flat config 需要 root `"type": "module"` 或使用 `.mjs` 扩展名。

---

## 附录：环境与状态快照

### git status --short

```
?? .npmrc
?? eslint.config.js
?? package.json
?? packages/
?? pnpm-lock.yaml
?? pnpm-workspace.yaml
?? tsconfig.base.json
?? vitest.workspace.ts
```

### node --version

```
v22.19.0
```

### pnpm --version

```
11.5.0
```

### pnpm list -r --depth 0

```
Legend: production dependency, optional only, dev only

gcah E:\Desktop\GCAH (PRIVATE)
│
│   devDependencies:
├── @eslint/js@10.0.1
├── eslint@10.7.0
└── typescript-eslint@8.63.0

@gcah/shared@0.0.0 E:\Desktop\GCAH\packages\shared (PRIVATE)
│
│   dependencies:
├── zod@4.4.3
│
│   devDependencies:
├── typescript@5.8.3
└── vitest@3.1.4

6 packages in 2 projects
```

### pnpm verify 结果摘要

```
$ pnpm lint && pnpm typecheck && pnpm test
$ eslint .
$ pnpm --recursive typecheck
$ tsc --noEmit
$ pnpm --recursive test
$ vitest run

 ✓ test/status.test.ts (6 tests)  3ms
 ✓ test/safe-display.test.ts (5 tests)  4ms
 ✓ test/events.test.ts (3 tests)  5ms
 ✓ test/entities.test.ts (2 tests)  4ms
 ✓ test/api-contracts.test.ts (4 tests)  5ms
 ✓ test/no-api-key.test.ts (1 test)  3ms
 ✓ test/agent-response.test.ts (6 tests)  5ms
 ✓ test/tool-contracts.test.ts (7 tests)  9ms
 ✓ test/smoke.test.ts (1 test)  2ms

 Test Files  9 passed (9)
      Tests  35 passed (35)
 Start at    11:53:38
 Duration    582ms
```

**全部通过。lint、typecheck、test 均无错误。**
