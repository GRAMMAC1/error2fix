# error2fix

`error2fix` 用来整理命令失败后的日志，把真正有用的错误信息提出来。

这个项目目前有两部分：

- CLI：记录终端里失败的命令，方便用户自己查看最近一次失败。
- MCP Server：给 IDE 或 Agent 调用，当前主要面向前端项目，让模型先拿到整理过的错误信息，而不是直接读完整日志。

这个项目想解决的问题很简单：失败日志通常很长，但真正有用的内容可能只有几行。

## 为什么做这个

现在让 AI 帮忙看报错，经常要先把一大段日志贴给它，还要补充自己执行了什么命令、在哪个目录、用的什么环境。日志一长，模型在真正看到错误之前就已经消耗了不少 token。

`error2fix` 的思路是：

1. 命令照常运行，不需要用特殊命令包一层。
2. 命令失败后，由 CLI 或 MCP 工具读取失败信息。
3. 先提取最关键的错误摘要；如果还不够，再查更具体的证据片段。

这样可以减少直接复制整段日志的情况，也方便后续比较不同日志分析策略的效果。

## CLI 安装

安装 CLI：

```bash
npm install -g @error2fix/cli
```

初始化 shell hook：

```bash
e2f init
```

之后正常使用终端。命令失败后执行：

```bash
e2f
```

CLI 的本地数据保存在 `~/.e2f`。

## MCP 安装

安装 MCP Server：

```bash
npm install -g @error2fix/mcp
```

启动命令是：

```bash
e2f-mcp
```

在 MCP 客户端里把它配置成 stdio server。

VS Code 配置示例：

```json
{
  "servers": {
    "error2fix": {
      "type": "stdio",
      "command": "e2f-mcp"
    }
  }
}
```

Cursor、Claude Desktop、Cline 等客户端一般使用 `mcpServers`：

```json
{
  "mcpServers": {
    "error2fix": {
      "command": "e2f-mcp"
    }
  }
}
```

## 产品思路

`error2fix` 走的是 post-failure 流程。用户不需要把命令改成 `e2f run -- <command>` 这种形式，而是继续正常执行命令；失败之后，再用 `e2f` 或 MCP 工具分析。

在 Agent 场景下，MCP 目前先聚焦前端项目的失败日志，例如 npm/pnpm/yarn 脚本、Vite、Next.js、React、Svelte、Tailwind、bundler、测试工具、依赖解析和框架编译错误。它还不是一个通用编程语言诊断工具。

MCP 的调用流程尽量保持简单：

1. 先拿一份压缩后的失败摘要。
2. 工具缓存这次失败，返回 `sessionId`。
3. 如果摘要不够，再按 `sessionId` 查更具体的日志片段。
4. 只有修复需要环境信息时，再读取命令、工作目录、系统等上下文。

目标不是把日志藏起来，而是让模型优先看到有价值的信息。

## MCP 工具

当前提供三个面向前端失败诊断的工具：

- `e2f_get_latest_failure_brief`：接收前端失败命令的 `stdout`、`stderr` 和可选命令信息，返回错误摘要、证据 ID、token 相关统计和 `sessionId`。
- `e2f_query_failure_evidence`：根据 `sessionId` 查询更具体的前端失败日志片段，不返回完整原始日志。
- `e2f_get_runtime_context`：根据 `sessionId` 返回客户端提供的命令、工作目录、shell、系统、git 或安全环境变量信息，用于补充前端修复所需上下文。

典型流程：

```text
failed command output
  -> e2f_get_latest_failure_brief
  -> 信息够就直接回答
  -> 信息不够再调用 e2f_query_failure_evidence
  -> 环境信息会影响判断时再调用 e2f_get_runtime_context
```

## Benchmark

仓库里有一组早期 benchmark 数据，位置是 `benchmarks/failures`。每个 case 只保留原始日志 `raw.log`，脚本会自己组装 MCP 输入并生成结果。

当前前端日志 benchmark：

- case 数量：7
- 信号命中：21/26
- 平均减少：60.9%
- MCP 返回内容约占原日志：39.1%
- 当前每个 case 只调用 1 次工具
- 汇总报告：`benchmarks/reports/report.md`

这组数据还很早期，而且日志普遍不算长。短日志会让结构化返回的固定开销变得明显，所以 MCP brief 会对较小的原始日志使用更小的 compact 输出。

运行 benchmark：

```bash
pnpm benchmark:mcp
```
