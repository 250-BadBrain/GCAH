# Reflection

## Superpowers 中最有价值的部分

在 GCAH 这个项目里，发挥最大作用的 Superpowers 技能不是某一个单点技巧，而是“规格 -> 小任务 -> TDD -> 验证证据”的组合。GCAH 涉及 LLM adapter、治理、审批、工具执行、验证、凭据、SQLite、Server、CLI 和分发；没有持续约束范围的计划，很容易变成“看起来什么都有，但没有一条真实可用路径”的项目。按可独立验收的阶段拆解工作，能让每个阶段有明确的交付面。

TDD 对安全边界尤其有用。凭据不能进入日志、SQLite、事件或 CLI/API 输出；workspace 必须 realpath 并执行 fence；DENY 不能调用工具；REQUIRE_APPROVAL 必须暂停；validation failure 必须反馈给下一轮 LLM。这类要求如果只靠实现者自觉，很容易遗漏。先写测试会把这些“不能发生”的行为变成可观察证据。

另一个有价值的部分是 worktree / branch / gate check 纪律。每个阶段从 clean main 创建独立 worktree，完成后合并和清理，能显著降低 AI 协作中误改 main、污染阶段边界、把临时文件带进提交的概率。

## 哪些部分形式大于实质

最明显的是两轮 fresh reviewer 审查。在理想状态下，独立审查能补足实现代理的盲区；但实际执行中 reviewer 工具多次无响应，或者持续返回不分优先级的意见，导致“修复 -> 再审查 -> 又出现非阻塞问题”的循环。这个流程在安全核心模块上有价值，但在一些已经有本地验证、且问题不影响功能的场景里，容易变成仪式。

另一个形式化过强的点是对极小文档或 UX 调整也套完整 Red/Green/Refactor。对于凭据泄漏、路径逃逸、审批暂停这类机制，TDD 是必要的；但对于 help 文案换行、clear 命令体验、终端输出排版，完全按同样粒度执行会让反馈周期变慢。更好的做法是区分“安全机制测试”“集成证据测试”和“交互体验检查”。

## TDD 是阻碍还是放大器

结论是：TDD 在机制层是放大器，在体验层如果验收不清会变成阻碍。

它放大的部分是安全和正确性。GCAH 的核心价值不是让模型随便改文件，而是让模型提出 action 后经过 governance、approval、tool gateway、validation、feedback 和 budget 控制。TDD 强制我们证明这些链路真实存在，而不是只在代码里有类名。集成验证应确认正式 AgentLoop 被调用、工具在受限 workspace 中执行、验证结果反馈到下一轮，并且事件得到持久化。

它成为阻碍的地方，是测试可能只证明“实现符合当前狭窄描述”，却不证明“用户真的觉得这是一个 agent 工具”。T29 一开始做成了 local one-shot 命令，测试可以通过，但用户实际期望是类似 opencode 的交互式终端：启动后持续输入提示词、切换 workspace/model、查看事件、退出。这个差异不是靠原来的 TDD 能发现的，因为 UX 目标没有进入测试。

## subagent-driven 工作流能自主多久

subagent-driven 工作流适合短时间、边界清晰、产物可验证的任务，例如“检查当前 PR 是否越界实现后续任务”“检查凭据是否可能泄漏”“检查 path fence 是否被绕过”。这类任务通常可以自主运行一个 PR 阶段而不偏离主题。

但它不适合在目标仍然含糊时长期自治。GCAH 中出现过 reviewer 不断提出新问题的情况，其中一部分是有效问题，一部分只是偏好或非阻塞建议。如果没有明确的 severity、验收标准和“哪些问题必须修、哪些记录即可”的规则，subagent 会把工作流拖进无限修补。最后真正有效的是：以规格和用户可运行结果为主，reviewer 只能作为风险发现者，不能替代验收标准。

## 最优 task 颗粒度

最优颗粒度是“一个可独立验证的机制或一条用户可完成的路径”。太大时，AI 容易在多个模块之间丢失上下文；太小时，提交和审查成本会超过收益。

比较合适的例子是：

- “实现 CredentialStore，并测试 key 不进入日志和持久化”
- “实现 local production composition root，使 CLI run submit 调用正式 AgentLoop”
- “实现 REPL 的 /workspace、/model、/events 和自然语言任务循环”

不合适的颗粒度是“完成整个 CLI”或“修一下终端体验”。前者太大，后者太模糊。T30 后期的修复能快速推进，是因为用户给出了非常具体的终端现象：`/help` 和 `/status` 输出挤在一行、`/clear` 不像真正清屏、自然语言任务输出混入大量底层日志。这些都能转化为明确的小任务。

## SPEC 如何影响实现质量

SPEC 的质量直接决定 AI 是在实现产品，还是在填充结构。GCAH 早期的 SPEC 对安全边界写得很清楚，所以凭据、workspace fence、approval、DENY、validation 这些机制实现得比较稳。相反，只要规约没有把“可使用”说清楚，AI 就容易做出形式正确但体验不对的东西。

一个案例是本地生产 agent：早期实现先打通了一次性任务链路，之后才把持续交互终端作为验收目标，补上 REPL、斜杠命令和易读输出。把用户如何完成整条路径写进验收标准，可以更早发现这类差距。

## 最有效的 prompt / context 策略

最有效的策略是：权威文档优先、任务范围收窄、把真实终端输出作为上下文。

每个阶段先读 SPEC、相关 Spike 和 AGENT_LOG，可以防止 AI 用记忆或想象替代项目事实。每次只处理一个紧密相关阶段，可以防止实现范围扩张。用户给出的 PowerShell transcript 尤其有效：比如 `run submit failed`、`WAITING_APPROVAL`、`PATH_BOUNDARY_VIOLATION`、`BUDGET_EXHAUSTED`、`/clear` 没有真正清屏。这些输出让问题不再是抽象抱怨，而是可以复现和修复的 bug。

对模型行为本身，最有效的 prompt 是具体、动作化、带约束的。例如“只修改 src/calculator.ts，把 Value: 改成 Result:，然后运行验证并结束”比“修复 calculator 模块”效果更好。前者减少了模型重复 read、误读验证失败、越界访问路径的空间。

## 凭据与分发迫使我想清楚的问题

凭据要求迫使项目把“能接 API key”与“安全接 API key”区分开。一个简单实现可以从命令行参数、环境变量或配置文件读取 key，但这会进入 shell history、日志、配置、甚至事件。最终 GCAH 必须走 OS CredentialStore -> CredentialResolver -> OpenAI-compatible client 的短路径；status 不能显示明文，backend 不可用时 fail closed。

分发要求则暴露了很多平时容易忽略的问题：构建后的 ESM import 是否指向 dist 文件，SQLite migration 是否随 dist 一起可读，CLI bin 是否能在纯构建产物上运行，Windows 下 `pnpm.cmd` 和路径 realpath 是否正常，`.gcah/` 运行时数据库是否被 git 忽略。后续用户提出希望打包成 exe，也说明分发不是最后写 README 的事情，而应该更早进入架构：本地状态目录、首次启动向导、默认配置、模型选择、凭据录入和错误展示都属于产品体验的一部分。

## 如果重做我会改变什么

如果重做，我会更早定义三条端到端路径：

1. local production：真实 OpenAI-compatible provider，安全凭据，本地 workspace，CLI 可审批。
2. interactive agent：一个启动命令进入 REPL，支持 /help、/workspace、/model、/base-url、/validation、/events、/clear、/exit，并能持续提交自然语言任务。

我也会更早加入 transcript-based UX 测试，而不是只测 API 和 repository。对于终端工具，“输出是否能读”“是否及时显示”“错误是否可行动”本身就是验收标准。

另外，我会调整审查流程：安全核心任务继续要求严格独立审查；普通交互和文档任务使用轻量检查；reviewer 意见必须分级，只有违反 SPEC、安全边界或验收标准的问题才阻塞合并。

## 对 Superpowers 方法论的批判

Superpowers 方法论隐含几个假设：第一，SPEC 足够清楚；第二，任务可以被稳定切分；第三，测试能够代表真实质量；第四，subagent 审查成本低于缺陷成本；第五，AI 会在长流程中持续遵守边界。

这些假设在 GCAH 的安全和后端机制上基本成立。凭据、治理、审批、工具、验证、持久化都可以被切成明确任务，也可以用测试证明。它们不太成立的地方是产品体验和最终演示。用户所谓“能用的 agent 工具”，不只是有 AgentLoop、LLM adapter 和 CLI 命令，而是启动后自然地配置、选择模型、进入工作区、持续对话、看到清楚的模型结果。这个质量很难完全从类图或单元测试推导出来。

因此我对 Superpowers 的看法是：它非常适合把 AI 从“随手写代码”约束成“按规约交付工程证据”，但它不能替代产品判断。规约写得好时，它是放大器；规约含糊时，它会高效地产生形式完整但方向偏差的结果。真正有效的做法，是把 Superpowers 的工程纪律和真实用户试用反馈结合起来：机制靠 SPEC/TDD 保底，体验靠可运行 transcript 和人工判断校准。
