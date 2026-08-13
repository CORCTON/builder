# 用户反馈 Feedback

Feedback 允许用户描述在 XBuilder 中遇到的问题，并在用户同意后分享帮助管理员排查问题的 Context。

## 背景

简短的问题描述通常不足以复现问题。管理员还可能需要了解问题发生时的页面、工程状态、代码、诊断信息和运行输出。

Feedback 将用户填写的内容与其同意分享的 Context 保存在同一条记录中，帮助管理员减少追问并开始处理问题。

## 目标

* 用户可以在 XBuilder 内提交 Feedback。
* 用户可以在 Feedback 中包含提交时采集的 Context。
* Copilot 可以准备 Feedback 草稿，交由用户检查和提交。
* 支持的 AI 功能可以在出现功能或额度问题时提供 Feedback 入口。
* 管理员可以排查、处理并回复 Feedback。
* 用户可以在 XBuilder 内收到管理员回复。

## 基本概念与规则

### 反馈 Feedback

用户提交的 Feedback 内容由三部分组成：

* Title
* Description
* Context

Context 为可选内容。

Feedback 记录还包含以下系统字段：

* User
* Status
* CreatedAt
* Reply

Title 最多 100 个字符，Description 最多 2000 个字符。

Feedback 有三种状态：

| 状态 | 含义 |
| - | - |
| `new` | 等待管理员处理 |
| `replied` | 管理员已完成回复 |
| `handled` | 管理员通过“标记为已处理”完成处理 |

状态按以下方向变化：

```text
new -> replied
new -> handled
```

`replied` 与 `handled` 是终态。Feedback 进入 `replied` 时保存一条管理员 Reply。

### 上下文 Context

Context 是随 Feedback 分享的诊断信息，包括以下类别中的可用信息：

* Source：打开 Feedback 的页面和入口
* 当前页面、语言和采集时间
* 当前工程的标识、类型、名称和资源结构
* 当前选中的角色及其基本状态
* 当前代码文件、光标、选区和附近代码
* 当前工程中的代码错误和警告
* 当前工程的运行输出
* Project Snapshot
* 当前页面截图

对于 Copilot 同样使用的诊断信息，Feedback 沿用现有的 Copilot 上下文采集和采样规则。Context 在用户确认提交时
采集，并在提交后保持固定。

用户通过“分享诊断信息”控制 Context 分享。开启后，Feedback 包含当时可用的 Context。

### 项目快照 Project Snapshot

Project Snapshot 保存提交时的工程文件内容。它属于 Context，获得授权的管理员可以在编辑器中打开快照并排查
Feedback。

### 回复 Reply

Reply 是管理员针对 Feedback 给出的文字回复。

## 权限管理

反馈管理员对应的角色为 `feedbackAdmin`，并派生 `canManageFeedback` capability。

用户可以读取自己提交的 Feedback。`feedbackAdmin` 可以：

* 查看 Feedback 列表和详情
* 查看随 Feedback 分享的 Context
* 在编辑器中打开其中的 Project Snapshot
* 回复 `new` 状态的 Feedback
* 将 `new` 状态的 Feedback 标记为 `handled`

Context 沿用所属 Feedback 的访问权限。`authorizationAdmin` 可以配置 `feedbackAdmin` 角色。

## 核心机制

### 提交与采集

用户从头像菜单打开 Feedback 表单，填写 Title 和 Description，并决定是否分享 Context。用户确认提交后，系统采集
Context。

提交过程中，表单显示进行中状态。提交失败时，表单保留已填写的内容，并提供重试操作。

### Copilot 辅助

当用户提出需要提交 Feedback，或接受 Copilot 的建议后，Copilot 可以准备 Title 和 Description 草稿。用户确认打开
Feedback 表单后，可以检查草稿、决定是否分享 Context，然后提交 Feedback。

### AI 功能与额度问题反馈

Copilot、Costume 生成和 Animation 生成分别展示对应的功能与额度问题提示。提示可以提供打开 Feedback 表单的操作，
Source 记录对应的功能和入口。

### 查看 Project Snapshot

管理员可以从 Feedback 详情通过编辑器可复用的本地工程加载能力打开 Project Snapshot，查看 Feedback 提交时的工程
内容。

### 处理 Feedback

管理员通过回复或“标记为已处理”完成 `new` 状态的 Feedback。多名管理员并发处理同一条 Feedback 时，第一个成功的
操作决定其终态，其他管理员看到最终生效的状态。

### 回复与通知

管理员成功发送 Reply 后，Feedback 进入 `replied` 状态，并为提交用户创建
[In-Product Notification](./in-product-notification.zh.md)。操作失败时，表单保留 Reply 草稿，管理员可以重试。

## User Story

### 用户反馈工程问题

用户测试工程时遇到与预期不符的结果。用户从头像菜单打开 Feedback，描述问题，选择分享 Context 并提交。管理员可以
从这条 Feedback 中了解问题描述和问题发生时的工程状态。

### 用户请求 Copilot 整理反馈

用户在 Copilot 对话中提出需要提交 Feedback。Copilot 准备草稿，并在用户确认后打开 Feedback 表单。用户检查草稿、
选择是否分享 Context，然后提交 Feedback。

### 用户反馈 AI 功能或额度问题

用户在 Copilot、Costume 生成或 Animation 生成中遇到功能或额度问题。对应提示为该功能打开 Feedback，用户检查并
提交反馈内容。

### 管理员处理 Feedback

管理员打开 `new` 状态的 Feedback，并根据 Context 排查问题。管理员可以在编辑器中打开 Project Snapshot，然后回复
用户或将 Feedback 标记为 `handled`。

### 用户查看回复

管理员回复后，用户收到 In-Product Notification，并从通知中查看 Reply。
