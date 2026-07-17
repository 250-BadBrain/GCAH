# Guarded Coding Agent Harness（GCAH）设计规格

> 状态：已完成 brainstorming 分块确认
> 项目类型：AI4SE 期末项目 A — Coding Agent Harness
> 核心贡献：治理驱动的反馈闭环
> 本文要求来源：`docs/course/AI4SE_Final_Project_通用要求.md` 与 `docs/course/AI4SE_Final_Project_A_Coding_Agent_Harness.md`

## 1. 问题陈述

### 1.1 要解决的问题

轻量 Coding Agent 经常只实现“提示模型—执行工具”，把安全性与正确性寄托于 LLM 自律。面对真实代码库，这会带来越界修改、危险命令、凭据泄露、无效重试、费用失控以及行为不可审计等风险。

GCAH 将 LLM 限定为“不可信的下一步动作提议者”，由自行实现的 harness core 掌握执行权。系统通过严格动作协议、三级治理、人工审批、确定性验证、反馈回灌、综合预算与明确停机条件，把模型建议转化为受控、可解释、可测试的编码过程。

### 1.2 目标用户

- 希望在本地代码库中安全使用 Coding Agent 的独立开发者。
- 需要查看、审批并审计 agent 行为的项目维护者。
- 需要在无网络、无真实 LLM 条件下验证 harness 机制的课程评审者。

### 1.3 为什么值得做

本项目的工程价值不在于包装某一家模型，而在于实现移除真实 LLM 后仍可独立验证的 agent 主循环、工具分发、治理护栏、反馈闭环、记忆与配置机制。重点贡献“治理驱动的反馈闭环”回答两个问题：哪些动作可以发生，以及动作发生后如何用客观证据决定继续、修正或停止。

### 1.4 产品边界

- CLI 用于服务管理、配置、凭据、任务提交、状态和审批操作。
- WebUI 是运行过程的观察窗口与人工审批入口；所有权限判断、动作执行和状态转移均由 server-side harness core 完成。
- 系统可保存多个 Run，但同一 workspace 同时最多一个活动 Run；同一 Run 内 Step 串行推进，不执行并行动作。
- 本地或 self-hosted 模式可操作用户显式允许的 workspace；默认使用受 workspace 围栏和策略约束的本地执行器，可选 Docker 沙箱执行后端。
- 公网演示模式部署为 React + Vite on Cloudflare Pages 与 API/SSE on Cloudflare Workers，只绑定固定示例 workspace 和 Mock LLM；不包含真实 LLM adapter，不提供 API key 输入、传输或存储路径，不接受项目上传，并按策略重置 demo workspace。
- 首版记录结构化运行事件与追加式审计日志，但不实现数据库级完整 event sourcing。
- 真实 LLM API key 只通过安全凭据来源读取，不进入 workspace、配置、SQLite、事件或日志，也不在 WebUI 明文展示。

### 1.5 明确不做

首版不实现多用户协作、同一 Run 内并行动作、多 agent 编排、云端 Git 仓库执行、线上项目上传、向量记忆、完整 event sourcing、Anthropic adapter 或自定义策略 DSL。

## 2. 用户故事与验收标准

以下故事遵循 INVEST：边界独立、具有用户价值、可协商、可估算、规模适中且可验证。默认 CI 不调用真实 LLM。

### US-1：提交受限编码任务

作为独立开发者，我希望通过 CLI 向指定 workspace 提交编码任务，以便 agent 在明确边界内工作。

- CLI 可创建 Run 并返回 run ID。【CLI 演示】
- workspace 不存在、不在 `allowedWorkspaceRoots`、与 GCAH 数据/凭据/审计目录重叠，或已有活动 Run 时拒绝启动。【Mock LLM/核心单元测试】

### US-2：三级治理

作为谨慎的开发者，我希望普通动作自动执行、风险动作等待审批、禁区动作绝对拒绝，以便兼顾效率与安全。

- 低风险 patch 可被允许，敏感覆盖进入审批，越界动作被拒绝。【Mock LLM 单元测试】
- 每个治理决定包含规则 ID、风险类别和解释。【核心单元测试】

### US-3：知情审批

作为审批者，我希望看到动作、参数、命中规则和风险原因，并选择仅本次或本会话同类授权，以便作出知情决定。

- WebUI 展示规范化动作、风险依据与授权范围。【CLI/WebUI 演示】
- 参数摘要变化、授权过期或作用域不符时必须重新审批。【核心单元测试】

### US-4：客观反馈与自动修正

作为开发者，我希望代码状态变化后自动运行测试、lint 和类型检查，以便 agent 根据客观失败信号修正代码。

- 状态变更动作触发配置快照中的验证器，纯读取动作不触发。【核心单元测试】
- 注入一次测试失败后，Mock LLM 收到结构化反馈并改变下一步动作。【Mock LLM 单元测试】

### US-5：预算与停机

作为开发者，我希望在超出轮数、token、时间预算或重复失败时自动暂停，以免任务失控或费用持续增加。

- 四类限制分别触发可解释的停机事件。【核心单元测试】
- 手动真实 LLM 演示可显示 token 用量变化，但不进入默认 CI。【真实 LLM integration demo】

### US-6：按需记忆

作为回访用户，我希望保存项目约定、人工审批决策和失败摘要，并通过关键词或标签按需检索，以便新会话获得必要上下文而非全量历史。

- 三类记忆均可写入并按关键词或标签检索。【核心单元测试】
- 注入上下文受数量和字符预算限制，历史批准不能绕过当前治理。【核心单元测试】

### US-7：离线机制验证

作为评审者，我希望使用 Mock LLM 重放护栏拦截、失败回灌和受控修正，以便不联网、不消耗 token 地验证核心贡献。

- 一键机制演示确定性展示：危险动作被拦截；测试失败反馈使 Mock LLM 改变下一步动作；会话同类授权到期后重新审批。【Mock LLM 单元测试/CLI 演示】
- 默认 CI 全程使用 Mock LLM，不需要 API key。【CI 证据】

### US-8：安全管理凭据

作为运维者，我希望安全录入、更新、查看状态和清除 API key，且任何界面都不回显明文，以便降低泄露风险。

- CLI 使用隐藏输入完成录入、更新与清除，状态命令不回显明文。【CLI 演示】
- fake credential store 证明 key 不进入配置、事件、日志和 repository。【核心单元测试】

### US-9：安全公网演示

作为演示观看者，我希望通过公网 WebUI 观察隔离示例任务的事件时间线和审批过程，以便理解机制而不会接触真实代码库。

- 公网 demo URL 可访问固定示例 WebUI。【WebUI 演示】
- 任意命令执行、网络、依赖安装、真实 LLM 和用户 key 均被 public-demo 策略拒绝，并限制任务启动频率。【核心单元测试/WebUI 演示】

### US-10：可复制分发与持续集成

作为评审者，我希望按照 README 的命令启动镜像并看到通过的 CI，以便在新环境中复现项目。

- Docker 镜像可通过 README 的 `docker build` 与 `docker run` 示例启动；示例包含端口映射、workspace 挂载和 GCAH 数据目录挂载。【Docker 演示】
- `.gitlab-ci.yml` 包含名为 `unit-test` 的 job，GitHub Actions 存在等价验证，最终提交对应的两套 CI 执行均为 pass。【CI 证据】

## 3. 功能规格

### 3.1 Agent 主循环

**输入**：任务、workspace、运行模式、不可变配置快照、预算状态和按需记忆。
**行为**：组装最小上下文，调用 `LlmClient`，将响应解析为严格响应协议，经 governance 决策后分发工具；对状态变更动作运行必需验证，将结构化结果回灌，再执行停机判断。
**输出**：结构化事件、状态变化、工具/验证结果和明确 `StopReason`。
**边界**：自然语言只能进入不可信的 `rationale` 展示字段，不可直接驱动工具；同一 Run 内动作串行。
**错误处理**：动作协议解析失败最多重试 `maxProtocolRetries` 次，超过后以 `PROTOCOL_ERROR` 停止。

`StopReason` 至少包含：`COMPLETED`、`BUDGET_EXHAUSTED`、`USER_CANCELLED`、`POLICY_DENIED`、`APPROVAL_REJECTED`、`UNFIXABLE_FAILURE`、`REPEATED_FAILURE`、`PROTOCOL_ERROR`、`INTERRUPTED`。

LLM 响应协议是二选一 discriminated union：

- `ToolAction`：`{ "kind": "tool", "tool": SupportedToolName, "args": object, "rationale": string }`，只能请求一个已注册工具枚举中的工具。
- `FinishAction`：`{ "kind": "finish", "summary": string, "rationale": string }`，表示模型认为任务完成。

`rationale` 不参与权限判断、路径解析、命令选择或状态转移；它是不可信纯文本展示字段，必须限长、按目标展示介质转义，并经过凭据与路径脱敏后才可进入日志或 WebUI。实现不得把 `rationale` 当作 Markdown/HTML/命令/路径解析，也不得让其参与 action hash、scope hash 或任何状态机判断。`FinishAction` 只有在最近一次代码变更后的必需验证全部通过，且没有未处理的审批、失败或预算触限时，才能把 Run 转为 `COMPLETED`；否则 core 将其转为结构化反馈并继续或按停机规则停止。

### 3.2 LLM 抽象层

**输入**：消息、可用工具 schema、模型配置。
**行为**：`LlmClient` 完成一次模型调用；`MockLlmClient` 按脚本产生确定响应；OpenAI-compatible adapter 调用可配置的 `baseUrl`、`model` 与 `providerName`。
**输出**：严格响应与 token usage。
**边界**：仅使用供应商的单次补全接口，不接入 agent runner；真实 adapter 主要连接课程 API 网关中的 DeepSeek、Qwen 等模型。
**错误处理**：网络、限流、协议和无效工具调用映射为稳定内部错误。真实调用仅用于手动 integration demo，默认 CI 禁止联网。

### 3.3 工具注册与分发

首版工具为 `list`、`read`、`write`、`patch`、`delete`、`run_command`、`run_validation` 和 `memory_search`。LLM 响应中的工具名必须来自该受支持工具枚举；未知工具名在 schema/协议层即视为无效响应，不能进入 governance 或工具分发。

**输入**：通过工具 schema 校验的参数。
**行为**：参数规范化后必须先通过 governance gateway；工具实现本身不决定权限。`patch` 是首选编辑方式；`write` 只用于新文件或经审批的已有文件全量覆盖。
**输出**：统一的状态、摘要、截断 stdout/stderr、耗时与副作用描述。
**边界**：不存在绕过 governance 的公开执行入口。`run_command` 使用结构化参数 `executable + args + cwd + timeout`，不调用系统 shell、不解释 shell 元字符，且只能匹配配置允许的命令模板；`run_validation` 是独立工具，不通过任意命令执行能力暴露给 LLM。
**错误处理**：未知工具、参数错误、路径越界、超时和输出过大均形成结构化错误，不向 LLM 暴露原始异常堆栈。

`patch` 参数必须包含 `path`、`baseSha256` 和 `unifiedDiff`。执行器在应用前读取当前文件并计算 sha256；若与 `baseSha256` 不一致，则不应用 diff，返回 `STALE_BASE`，由 core 将其作为可修正反馈回灌。`write` 创建新文件时必须确认目标不存在；已有文件全量覆盖默认 `REQUIRE_APPROVAL`。`delete` 是显式工具，不允许用空 patch 或 write 间接表达删除。

### 3.4 Governance 与审批

**输入**：规范化动作、运行模式、workspace、策略快照与有效授权。
**行为**：输出 `ALLOW`、`REQUIRE_APPROVAL` 或 `DENY`，并附规则 ID、风险类别和解释。
**输出**：可审计的 `GovernanceDecision` 或 `ApprovalRequest`。
**边界条件**：

- `ALLOW`：安全读取、列举、记忆检索与范围内低风险 patch。低风险 patch 指单个非敏感源码或文档文件内的小范围 unified diff，不创建/删除文件，不覆盖全文件，不修改配置、锁文件、CI、凭据、审计或 GCAH 自身治理相关文件，且变更行数、文件大小和路径均低于策略阈值。
- `REQUIRE_APPROVAL`：覆盖已有文件、大范围变更、新文件创建、删除文件、修改配置/锁文件/CI 文件、workspace 内破坏性操作、网络请求、依赖安装、Git 发布及本地模式中的高风险命令。大范围变更包括跨多个文件、超过行数阈值、重命名/移动目录、生成大量文件或难以人工快速审阅的 patch。
- `DENY`：越出 workspace、访问凭据区、提权、篡改 GCAH 护栏或审计记录。
- public demo mode 额外默认拒绝任意命令执行、网络、依赖安装和真实 LLM。

审批支持“仅本次”和“本会话同类动作”。同类授权必须绑定工具名、规范化路径范围、命令模板、风险类别、`scopeHash` 和过期轮次，不能按自然语言理由匹配。执行前重新计算 `normalizedActionHash` 或 `scopeHash`；参数变化、过期或越界时重新审批。

审批拒绝后当前动作不执行；core 将拒绝原因作为治理反馈回灌一次，允许 LLM 选择安全替代动作。再次请求同类被拒动作或预算耗尽时停止。重复提交、过期审批和重复响应采用幂等处理。

### 3.5 自动验证与反馈

**输入**：成功的状态变更动作以及不可变配置快照中的 test、lint、typecheck 命令。
**行为**：`write`、`patch`、依赖变更等可能改变代码状态的动作触发自动验证；`list`、`read`、`memory_search` 不触发。LLM 不能在 Run 中修改验证命令。
**输出**：退出码、耗时、截断输出、失败类别、稳定失败指纹和结构化 `Feedback`。
**错误处理**：测试断言、lint、类型错误属于可修正失败；策略拒绝、基础设施故障、超时与重复失败暂停自动修正。

反馈只给出客观诊断和关注范围，不代替 LLM 生成修复代码。失败指纹优先使用验证器类别、测试标识、文件位置与稳定诊断码，并去除时间戳等噪声。

必需验证由不可变 `ConfigSnapshot` 定义。代码状态发生变化后，Run 只有在所有必需验证通过后才允许接受 `FinishAction` 并进入 `COMPLETED`；验证未运行、失败、超时或配置缺失但被标记为必需时，均不能完成。

### 3.6 综合预算与停机

预算同时包含最大轮数、token、墙钟时间和重复失败阈值。预算用于防止无限循环，也用于控制真实 LLM 费用。任一预算触限都产生包含 `kind`、`limit`、`used`、`remaining`、`observedAtStep` 的 `BudgetStopDetail`，并以 `BUDGET_EXHAUSTED` 停止；连续相同失败触发 `REPEATED_FAILURE`。如果真实 LLM 不返回 token usage，core 必须记录 `usageUnavailable=true`，不能把缺失值当作 0；当 token 预算启用但 usage 缺失时，该 Run 不得进入自动无限继续模式，必须依赖轮数和时间预算，并在事件中提示费用不可精确统计。

### 3.7 记忆

**输入**：项目约定、人工审批决策或失败摘要。
**行为**：保存 workspace、类型、标签、关键词、来源 Run、摘要与时间；按类型、标签、关键词和时间检索。记忆写入来源仅包括：用户主动添加项目约定、core 自动记录审批摘要、失败分类器自动记录验证失败摘要。
**输出**：受条数与字符预算约束的上下文片段。
**边界**：首版无向量检索；历史批准不能成为当前授权；记忆不能修改策略；不向 LLM 暴露 `memory_write` 能力。

### 3.8 配置

项目配置位于 `.gcah/config.yaml`。覆盖顺序为：内置默认值 → 项目配置 → CLI 参数。合并、校验后形成绑定到 Run 的不可变 `ConfigSnapshot`。

配置包含 `allowedWorkspaceRoots`、运行模式、预算、验证命令、风险规则、LLM 非敏感元数据和执行后端，不包含 API key。未知字段、非法预算、危险路径或互相冲突的规则导致启动失败，并返回可定位字段的错误。

每个 Run 的 workspace 必须位于 `allowedWorkspaceRoots` 中某个规范化真实路径之下。workspace 不得与 GCAH 数据目录、credential 相关目录、审计日志目录重叠，也不得互为父子目录；违反时启动失败。该限制用于防止 LLM 通过“项目文件”读取或修改 harness 自身状态、凭据引用或审计记录。

### 3.9 凭据管理

正式实现采用 `cross-keychain`，实际版本由 `pnpm-lock.yaml` 锁定。`CredentialStore` adapter 必须在操作前验证当前 backend，只允许 Windows 的 `native-windows`、`windows`，macOS 的 `native-macos`、`macos`，Linux 的 `native-linux`、`secret-service`。必须拒绝 `file`、`null` 和任何 unknown backend；后端不可用时 fail closed，返回明确的 `backend unavailable`，不得自动降级到文件存储。

CLI 提供 `credential status/set/update/clear`，录入时隐藏输入，状态仅返回 provider、来源、backend 与更新时间。Docker/headless 环境没有操作系统凭据库时明确返回 `backend unavailable`。public demo 不提供 API key 输入、传输或存储路径。S01 只在 Windows 实测 `native-windows`；macOS、Linux 与 Docker 均未实测，不得宣称已验证支持。

### 3.10 Server、CLI 与 WebUI

本地开发、Docker 与 self-hosted 使用 Fastify composition root 提供任务、状态、事件、审批、配置状态和凭据状态 API；Cloudflare 生产使用独立的 Worker HTTP adapter/composition root。两条路径都必须先持久化事件再通过 SSE 发布，支持 cursor 重连和客户端断线恢复。CLI 连接相应 API；WebUI 展示时间线、风险解释、验证结果和审批入口。

local/self-hosted 模式使用单用户管理令牌认证，本地首次启动生成令牌并存入系统凭据库；self-hosted 部署可使用显式 Secret。public-demo 模式使用匿名但能力受限的接口，只允许访问固定示例 Run、启动受限示例任务和提交演示审批，不提供真实 workspace、真实 LLM、凭据或任意命令能力。部署 Secret 只在 server 侧读取，绝不暴露给浏览器。

浏览器认证采用 same-origin cookie；REST 与 SSE 均依赖同源 Cookie 认证和 CSRF/Origin 校验，不把 bearer token 放入前端 JavaScript 可读存储。SSE 连接必须与 API 同源；断线后用事件游标补取。

服务异常重启后，活动 Run 标记为 `INTERRUPTED`。首版取消 `INTERRUPTED` Run 原地恢复：用户只能查看、关闭该 Run，或基于原任务创建新的 Run；系统绝不自动重放可能产生副作用的动作。

## 4. 非功能性需求

### 4.1 性能

- 排除 LLM、工具和验证器外部耗时后，普通开发机上的单次策略判定与事件写入目标 p95 小于 100 ms。
- SSE 在事件成功持久化后 1 秒内推送。
- 事件、工具输出、记忆注入与 LLM 上下文均有大小上限。

### 4.2 安全与威胁模型

**威胁来源**：恶意或错误的 LLM 输出、workspace prompt injection、路径穿越、symlink 逃逸、命令参数注入、审批复用、恶意配置、日志泄密和 public demo 滥用。

**凭据威胁**：API key 可能被 LLM 请求读取、被 workspace 中的提示注入诱导输出、被日志/WebUI 泄露，或被误写进配置、事件与存储。凭据明文只在 LLM adapter 调用边界短暂可用；core 其他模块只接触 `CredentialStatus`。日志脱敏作为第二道防线，但不能替代数据流隔离。

**路径策略**：先规范化路径，再解析真实路径；解析后的真实路径必须仍位于 workspace root。默认禁止跟随指向 workspace 外部的 symlink。

**主要对策**：严格响应协议、命令模板、执行前治理、审批哈希二次校验、不可变配置快照、敏感值隔离与脱敏、单 workspace 运行锁、public-demo 硬拒绝规则及频率限制。workspace 内容始终视为不可信数据，不能修改系统策略。

public demo 不接受用户 API key，不持久化用户上传内容，并对任务启动频率实施基础限制。demo workspace 从仓库内固定示例或镜像内只读模板重置；每次示例 Run 前恢复到已知状态，Run 后可丢弃临时副本，防止跨访客污染。

### 4.3 可用性

- CLI 与 WebUI 使用一致状态术语。
- 每次暂停显示原因和下一步操作。
- 审批展示动作预览、风险类别、命中规则和授权范围。
- 系统凭据后端不可用时返回可操作错误，不静默创建明文文件。

### 4.4 可观测性与审计

每个事件包含 run ID、step ID、事件类型、时间、相关规则或工具、结果摘要、关联 ID 和递增游标。审计明确区分 LLM 建议、治理决策、人工决定、工具结果与验证反馈。

默认日志不记录完整文件内容、完整模型提示或凭据。结构化运行事件支持 WebUI 时间线和 CLI 游标查询，但不承担完整 event sourcing。

### 4.5 可靠性

- 核心状态转换必须幂等，或通过唯一 action ID 防重。
- 数据库写入失败时不得继续执行工具。
- SSE 断连不影响 core；客户端可按游标补取事件。
- 服务异常退出后的活动 Run 统一标记 `INTERRUPTED`，只能查看、关闭或基于原任务创建新 Run，不能原地恢复。

## 5. 系统架构

### 5.1 组件

```text
CLI ───────────────┐
                   v
WebUI ─REST/SSE─> Node Server ─> Harness Core ─> LlmClient
                                  │   │             ├─ MockLlmClient
                                  │   │             └─ OpenAI-compatible Adapter
                                  │   v
                                  │ Governance ─> Approval State Machine
                                  │   │
                                  │   v
                                  ├─ Tool Gateway ─> Local Executor / Docker Executor
                                  ├─ Validation & Feedback
                                  └─ Repository Interfaces ─> In-memory / SQLite / D1
```

- `harness-core`：主循环、上下文组织、状态机、预算与停机；不依赖 HTTP、UI 或具体 LLM。
- `llm`：可注入的 LLM 接口、Mock 实现和 OpenAI-compatible adapter。
- `tools-and-governance`：工具注册、路径/命令规范化、策略、审批与执行网关。
- `validation-and-memory`：确定性验证、失败分类、反馈指纹和记忆检索。
- `server-and-cli`：本地/Docker/self-hosted 的 Fastify composition root、Cloudflare Worker HTTP adapter/composition root，以及 API、SSE、认证、任务与凭据命令。
- `webui`：运行观察、风险解释和审批交互。

core 的 LLM、repository、clock、tool gateway 等依赖均通过接口注入，且不得依赖 SQLite、D1、Fastify 或 Worker。单元测试默认使用 in-memory repository；SQLite adapter 用于本地开发、测试、Docker 与 self-hosted，D1 repository adapter 用于 Cloudflare。必要时 Durable Objects 仅承担 per-run 协调与 SSE fan-out；KV 和 R2 不得替代关系型 run/audit/event repository。

### 5.2 数据流

```text
CLI 提交任务
  → Server 创建 Run 与不可变配置快照
  → Core 检索受预算约束的记忆
  → LLM 提出严格 ToolAction / FinishAction
  → Governance 判定 ALLOW / REQUIRE_APPROVAL / DENY
  → 必要时暂停并等待 WebUI/CLI 审批
  → Tool Gateway 调用本地或 Docker 执行器
  → 状态变更动作触发验证
  → 结构化反馈回灌下一轮
  → 完成、拒绝、失败、取消或预算停机
```

工具执行前必须经过 governance；工具实现不直接决定权限。默认执行后端是受 workspace 围栏和策略约束的 `LocalExecutor`，Docker 沙箱是可选后端，不改变 core 契约。`LocalExecutor` 不是 OS 级沙箱：它能在执行前限制 GCAH 直接发起的路径和命令，但不能保证已批准子进程不会访问宿主其他文件或网络；因此高风险命令、网络、依赖安装和 public-demo 命令执行必须由治理策略限制或拒绝。

### 5.3 外部依赖

- 课程 API 网关或其他 OpenAI-compatible 单次补全接口，仅用于手动 demo。
- 操作系统凭据库：Windows Credential Manager、macOS Keychain、Linux Secret Service。
- SQLite、HTTP/SSE、schema 与 UI 底层库。
- 用户配置的 test、lint 与 typecheck 工具。

不使用 LangChain AgentExecutor、AutoGen、CrewAI、LlamaIndex agent 或任何 SDK 自带 agent runner。

## 6. 数据模型

### 6.1 实体

- `Workspace`：ID、规范化根路径、所属 `allowedWorkspaceRoot`、执行后端、运行模式。
- `Run`：ID、workspace ID、任务摘要、状态、配置快照 ID、预算用量、时间、`StopReason` 与可选 `StopDetail`。
- `Step`：ID、run ID、串行序号、上下文摘要、LLM usage、usage 是否缺失、状态。
- `Action`：ID、step ID、`kind`、工具名或 finish summary、严格参数、rationale、规范化摘要、风险类别、状态。
- `GovernanceDecision`：action ID、结果、规则 ID、风险类别、解释、时间。
- `ApprovalRequest`：action ID、`normalizedActionHash`、动作摘要、状态、创建/过期时间、人工理由。
- `SessionGrant`：run ID、工具名、路径范围、命令模板、风险类别、`scopeHash`、过期轮次、授权者。
- `ToolResult`：action ID、状态、退出码、工具错误码、截断输出、耗时、副作用摘要。
- `ValidationResult`：action ID、类型、命令快照、结果、失败类别、失败指纹、诊断摘要、耗时。
- `Feedback`：来源 decision/validation ID、类别、摘要、是否已回灌。
- `MemoryEntry`：workspace ID、类型、标签、关键词、来源 run ID、摘要、时间。
- `RunEvent`：run ID、step ID、类型、关联实体 ID、摘要、时间、递增游标。
- `ConfigSnapshot`：非敏感配置、`allowedWorkspaceRoots`、schema 版本、内容哈希；创建后不可变。
- `CredentialStatus`：provider、是否配置、来源类型、更新时间；不含密钥。

实体 schema 必须显式区分 required、optional 和 nullable：ID、外键、状态、序号、时间戳、schema 版本和审计所需关联字段为 required；仅在实体生命周期中尚未产生或确实不存在的值才可 optional；只有业务语义允许“已知为空”的字段才可 nullable。密钥明文、原始未脱敏 rationale、原始异常堆栈和浏览器/环境 Secret 永远不得成为任何实体 schema 字段。

### 6.2 状态与约束

- `Run.status` 至少包含 `PENDING`、`RUNNING`、`WAITING_APPROVAL`、`COMPLETED`、`STOPPED`、`FAILED`、`INTERRUPTED`、`CANCELLED`。
- `Step.status` 至少包含 `PENDING`、`BUILDING_CONTEXT`、`WAITING_LLM`、`PARSING_RESPONSE`、`PROPOSED_ACTION`、`WAITING_APPROVAL`、`EXECUTING_TOOL`、`VALIDATING`、`FEEDBACK_RECORDED`、`COMPLETED`、`FAILED`、`SKIPPED`。
- `Action.status` 至少包含 `PROPOSED`、`DENIED`、`WAITING_APPROVAL`、`APPROVED`、`EXECUTED`、`FAILED`、`SKIPPED`。
- 典型映射：`COMPLETED` status 只对应 `StopReason=COMPLETED`；`CANCELLED` status 对应 `USER_CANCELLED`；`INTERRUPTED` status 对应 `INTERRUPTED`；`STOPPED` status 对应 `BUDGET_EXHAUSTED`、`POLICY_DENIED`、`APPROVAL_REJECTED`、`REPEATED_FAILURE` 或 `PROTOCOL_ERROR`；`FAILED` status 对应 `UNFIXABLE_FAILURE` 或不可恢复基础设施错误。`WAITING_APPROVAL` 不设置最终 `StopReason`。
- `BUDGET_EXHAUSTED` 必须携带 `BudgetStopDetail`；非预算停机可携带对应类别的 `StopDetail`。
- 同一 workspace 最多一个活动 Run；同一 Run 内 Step 序号唯一且串行推进。
- 每个工具执行结果必须追溯到 `ALLOW` 决策或仍有效的审批授权。
- 已有文件的全量 write 必须关联有效审批。
- `patch` 必须存储或可重建 `path`、`baseSha256`、`unifiedDiff` 与 `STALE_BASE` 错误。
- `rationale` 入库前必须限长、转义和脱敏；它不能参与 action hash、scope hash 或权限判断。
- 事件游标单调递增；配置快照不可变。
- 持久化 schema 中不存在 API key 明文字段。

## 7. 凭据与分发设计

### 7.1 凭据生命周期

首次使用真实 LLM 时，CLI 检查 `cross-keychain` 当前 backend 并引导隐藏录入。正式支持声明以实测证据为准：S01 已实测 Windows `native-windows`；macOS、Linux 和 Docker 未实测。Docker/headless 没有操作系统凭据库时返回 `backend unavailable`，不得回退为文件、环境变量、Secret 文件或 `.env` 存储。

### 7.2 分发形态

- Cloudflare 公网生产交付物：Pages 静态站点、Worker API/SSE bundle、D1 migration，以及必要时的 Durable Object binding。
- Docker/OCI 是本地开发、测试、课程分发与 self-hosted fallback 的独立交付路径，不是 Cloudflare 生产部署方式。
- 已验证凭据平台仅为 Windows 原生；macOS、Linux 与 Docker 凭据库仍未实测。
- CI 至少构建 Linux `amd64` 镜像。
- README 必须提供可复制的单条 `docker build` 和 `docker run` 示例，包含端口映射、workspace 挂载和 GCAH 数据目录挂载。
- GCAH 数据目录只保存 SQLite、审计日志和非敏感运行状态，不保存 API key 明文。

### 7.3 公网部署

公网生产目标为 React + Vite 部署到 Cloudflare Pages，API 与 SSE 部署到 Cloudflare Workers，关系型 run/audit/event 数据持久化到 D1；仅在需要 per-run 协调或 SSE fan-out 时使用 Durable Objects。public demo 只绑定 Mock LLM，不包含真实 LLM adapter，不接受用户 API key，不开放任意 shell、依赖安装、网络访问或 workspace 上传。Pages/Workers/Wrangler 配置可自动化验证，但 Cloudflare 登录、授权、令牌配置、实际部署、自定义域名、DNS 与 HTTPS 绑定均为人工授权步骤。

## 8. 技术选型与理由

- **TypeScript / Node.js LTS / pnpm workspace**：前后端共享 schema 与类型，适合实现可注入接口和结构化协议。
- **Fastify + Worker HTTP adapter**：Fastify 仅用于本地开发、Docker 与 self-hosted composition root；Cloudflare 生产使用独立 Fetch/Worker composition root；二者都不承担 agent 决策。
- **Zod 4**：运行时校验 Action、配置、工具参数和 API 输入；正式实现必须通过 `pnpm-lock.yaml` 锁定兼容版本，schema 写法以 Zod 4 API 为准。
- **SQLite / D1 repository adapters**：SQLite 用于本地、测试、Docker 与 self-hosted，D1 用于 Cloudflare；core 只依赖 repository ports。KV/R2 不承担关系型 run/audit/event 存储。
- **React + Vite**：构建轻量运行控制台。计划采用 Open Design 的 `linear-app` 设计系统；若工具不可用，使用等价的简洁工程控制台风格，并在 `AGENT_LOG.md` 记录偏离原因。计划使用 `od-react-export` skill 辅助 UI 产出。
- **Vitest**：Mock LLM、假时钟、in-memory repository 和 fake executor 驱动确定性测试。
- **CredentialStore adapter**：正式采用 `cross-keychain` 并由 `pnpm-lock.yaml` 锁定实际版本；验证并仅允许平台对应的 OS backend，拒绝 `file`、`null` 与 unknown backend，底层不可用时 fail closed。
- **OpenAI-compatible adapter**：通过 `baseUrl`、`model`、`apiKey`、`providerName` 接入课程网关的 DeepSeek、Qwen 等模型；暂不实现 Anthropic。
- **Cloudflare Pages / Workers / D1**：公网生产目标；Durable Objects 为可选协调层。
- **Docker / OCI**：用于本地开发、测试、课程分发与 self-hosted fallback；Docker 沙箱仅为可选执行后端。
- **GitLab CI + GitHub Actions**：两者均要求提供；`.gitlab-ci.yml` 必须包含 `unit-test` job，GitHub Actions 镜像默认离线验证与镜像构建，二者共同作为 CI 证据。

所有第三方库只承担 HTTP、数据库、schema、UI、系统凭据或单次 LLM 调用等底层能力。agent loop、工具治理、审批、反馈、记忆选择和停机逻辑均由本项目代码实现。

## 9. 领域与机制设计

### 9.1 Coding 领域所需工具

- 文件发现与读取：`list`、`read`。
- 代码修改：优先 `patch`，受控 `write`。
- 命令：基于配置模板的结构化 `run_command`，不使用系统 shell。
- 客观验证：独立 `run_validation`。
- 上下文：`memory_search`。

### 9.2 客观反馈信号

test、lint、typecheck 的退出码和结构化诊断构成客观信号。反馈机制由代码解析、分类、指纹化并回灌，不依赖“让 LLM 自行检查”的提示词。

### 9.3 危险动作

风险动作包括文件全量覆盖、大范围变更、新文件、删除文件、敏感配置/锁文件/CI 修改、网络、依赖安装、Git 发布和高风险命令；绝对禁区包括 workspace 外访问、workspace 与 GCAH 数据/凭据/审计目录重叠、凭据探测、提权与治理/审计篡改。识别、拦截、审批与二次校验均是确定性代码机制。

### 9.4 记忆需求

跨会话只保存项目约定、人工审批决策和失败摘要，并通过关键词/标签按需提供。首版不做全量历史注入或向量召回。

### 9.5 重点机制：治理驱动的反馈闭环

治理是每个副作用动作的强制前置条件；反馈决定动作之后是否继续自动修正。两者由同一显式状态机衔接：

```text
PROPOSED ToolAction / FinishAction
  → ALLOW → EXECUTE → VALIDATE → NEXT / COMPLETED / STOPPED
  → REQUIRE_APPROVAL → APPROVE → EXECUTE
                     → REJECT → FEEDBACK_ONCE → SAFE_ALTERNATIVE / STOPPED
  → DENY → STOPPED
```

主要贡献体现在：结构化规则解释、不可覆盖禁区、哈希绑定的限时授权、public/local 双模式、确定性失败分类、稳定失败指纹、一次治理反馈和综合预算停机。移除真实 LLM 后，这些行为仍可通过脚本化 Mock LLM 验证。

## 10. 验收标准

### 10.1 核心机制

- Mock LLM 可完整驱动主循环、工具分发、治理、反馈、记忆和停机测试。
- 严格 `ToolAction | FinishAction` 响应协议阻止自然语言直接触发工具。
- 所有工具执行均有治理决定或有效审批授权。
- 代码变更后，只有必需验证全部通过才允许 `FinishAction` 进入 `COMPLETED`。
- patch 的 `baseSha256` 不一致时返回 `STALE_BASE` 且不修改文件。
- 一键机制演示稳定复现危险动作拦截、失败反馈后改变动作、会话授权过期后重新审批。
- 自动验证只由可能改变代码状态的动作触发，且命令来自不可变配置快照。

### 10.2 安全

- realpath 后的访问仍限制于 workspace，外部 symlink 被拒绝。
- workspace 必须落在 `allowedWorkspaceRoots` 中，且不得与 GCAH data、credential、audit 目录重叠。
- 凭据不出现在请求、workspace、配置、浏览器状态、SQLite、D1、KV、R2、事件、日志、错误或 WebUI。
- public demo 拒绝命令执行、网络、依赖安装、真实 LLM 和用户 key，浏览器无法读取部署 Secret。
- 审批哈希、作用域和过期轮次均通过确定性测试。

### 10.3 分发与 CI

- README 的 build/run 命令可在全新环境启动 Linux `amd64` 镜像。
- `.gitlab-ci.yml` 包含 `unit-test` job；GitHub Actions 也存在并执行等价默认验证。
- `pnpm test` 运行离线单元测试；`pnpm verify` 运行 lint、typecheck 与 test；`pnpm demo:mechanisms` 一键运行确定性机制演示。
- 最后一次提交证据中的 GitLab CI/CD 和 GitHub Actions 状态为 pass。
- Linux `amd64` 镜像被构建并推送到公开 registry。
- 公网 demo URL 可访问固定示例 WebUI。

### 10.4 真实 LLM 手动演示

- 用户显式配置安全凭据后，可通过 OpenAI-compatible adapter 调用课程网关中的 DeepSeek 或 Qwen。
- integration demo 失败不影响默认 CI；不得在演示产物中记录 key。

## 11. 风险与未决问题

### 11.1 已识别风险及对策

- **系统凭据库兼容性**：S01 仅验证 Windows `native-windows`；macOS、Linux 与 Docker 未实测。adapter 必须验证 backend 并 fail closed，不得把未实测平台写成已验证支持。
- **Docker 与宿主凭据隔离**：容器只接受显式环境变量或 Secret 映射；public demo 禁用真实 LLM。
- **命令模板规避**：`run_command` 使用 executable 与 args，不调用系统 shell；无法匹配声明模板时拒绝或审批。
- **跨平台路径差异**：规范化与 realpath 双重校验，并建立 Windows、POSIX、容器测试矩阵。
- **审批范围过宽**：使用工具、路径、命令模板、风险类别、哈希和过期轮次联合约束。
- **反馈循环抖动**：失败指纹去除非稳定噪声；综合预算和重复失败阈值强制停机。
- **SQLite/D1 与 SSE 一致性**：两种 repository adapter 共享 contract；事件先持久化再发布，支持 cursor replay 和断线恢复；写入失败时暂停，不执行后续副作用。
- **Open Design 不可用**：降级到等价工程控制台风格并在 `AGENT_LOG.md` 说明偏离。
- **公网资源滥用**：固定 workspace、Mock LLM、频率限制和任务预算；不接受上传与 key。
- **课程 API 额度耗尽或模型不可用**：默认测试与机制演示使用 Mock LLM；DeepSeek/Qwen 仅手动 integration demo，失败不阻断默认 CI。
- **SPEC/PLAN 含隐性上下文**：正式实现前由不同类型 agent 在全新 session 中仅凭 `SPEC.md` 与 `PLAN.md` 冷启动试做 1–2 个 task；将误解、提问和修订 diff 记录到 `SPEC_PROCESS.md`。
- **npm 供应链风险**：提交并锁定 pnpm lockfile；CI 使用 frozen lockfile；关键安全依赖变更记录到 `AGENT_LOG.md`。
- **本地执行器隔离不足**：`LocalExecutor` 不是 OS 级沙箱，不能限制已批准子进程的全部宿主文件和网络访问；通过默认拒绝/审批高风险命令、public-demo 禁止命令执行和可选 Docker 后端降低风险。
- **范围膨胀**：多用户、云端仓库、向量记忆、多 agent、完整 event sourcing 和 Anthropic adapter 均推迟。

### 11.2 实现前需验证的适配器选择

S01 已选定 `cross-keychain` 并仅完成 Windows 实测；S02 已验证 Cloudflare Pages + Workers + D1 的架构可行性，但未进行 Cloudflare 登录、授权、令牌创建、实际部署、域名或 DNS 操作。macOS、Linux、Docker 凭据行为以及真实 Cloudflare 部署仍未验证，必须保留为后续人工授权/平台验证步骤，不得声称 spike 已完成远程部署。

## 12. 测试与机制演示策略

- **核心单元测试**：Mock LLM、fake clock、in-memory repository、fake credential store 和 fake executor；无网络、无真实 key。
- **工具/适配器测试**：临时 workspace、路径/symlink 边界、命令模板、SQLite 与 D1 repository contract 一致性、Fastify/Worker HTTP API，以及 SSE cursor replay。
- **public-demo 安全测试**：证明请求、浏览器状态、日志、D1、KV、R2 和错误中均不存在 API key，且无 API key 输入/传输路径或真实 LLM adapter。
- **WebUI 测试**：状态渲染、事件时间线、审批提交与 SSE 重连。
- **机制演示**：一键脚本使用 Mock LLM 确定性演示三项核心行为。
- **手动 integration demo**：显式启用时调用课程 API 网关 DeepSeek/Qwen；不进入默认 CI。
- **CI**：GitLab `unit-test` 为必交 job；GitHub Actions 也必须存在。CI 使用 frozen lockfile，运行 `pnpm test`、`pnpm verify`、`pnpm demo:mechanisms`，并至少构建 Linux `amd64` 镜像。镜像推送到公开 registry；真实 LLM integration demo 不进入默认 CI。

在 `SPEC.md` 与后续 `PLAN.md` 通过冷启动验证之前，不开始实现代码。
