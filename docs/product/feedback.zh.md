# 用户反馈 Feedback

用户在使用 XBuilder 时可能遇到功能异常、运行结果不符合预期，或不知道如何继续操作。Feedback 允许用户在
XBuilder 内描述问题。用户同意后，Feedback 可以包含帮助管理员排查问题的 Context。

## 背景

用户反馈通常只包含一段文字，管理员还需要询问用户所在页面、工程状态和错误信息，才能开始排查。

因此，Feedback 将用户填写的内容和用户同意分享的 Context 组合到同一条记录中，供管理员排查和处理。

## 目标

* 用户可以在 XBuilder 内提交反馈。
* Feedback 可以包含提交时采集的 Context。
* Copilot 可以帮助用户整理反馈，但最终内容由用户确认和提交。
* Copilot 暂时不可用或额度耗尽时，用户仍然可以使用反馈入口。
* 管理员可以查看、处理并回复 Feedback。
* 用户可以在 XBuilder 内收到管理员回复。

## 基本概念与规则

本节定义 Feedback 记录、Context 以及处理流程使用的状态。

### 反馈 Feedback

用户提交的 Feedback 内容由三部分组成：

* Title
* Description
* Context

Context 可以为空。

Feedback 记录还包含以下系统字段：

* User
* Status
* CreatedAt
* Reply

Title 最多 100 个字符，Description 最多 2000 个字符。

Feedback 有三种状态：

| 状态 | 含义 |
| - | - |
| `new` | 尚未处理 |
| `replied` | 管理员已经回复 |
| `handled` | 管理员已处理，不需要回复 |

状态按以下方向变化：

```text
new -> replied
new -> handled
```

`replied` 与 `handled` 是终态。一条 Feedback 最多包含一条 Reply。

### 上下文 Context

Context 是 Feedback 中用于定位问题的信息，包括：

* Source：触发 Feedback 的页面和入口
* 当前页面、语言和采集时间
* 当前工程的标识、类型、名称和资源结构
* 当前选中的角色及其基本状态
* 当前代码文件、光标、选区和附近代码
* 当前工程中的代码错误和警告
* 当前工程的运行输出
* Project Snapshot
* 页面截图

Context 由内联诊断信息和较大内容的引用组成：

* 内联诊断信息沿用现有采集规则：包含最近 50 条运行输出，以及当前光标前后最多 21 行代码。
* Feedback API 定义内联 Context 序列化后的最大尺寸，客户端和服务端使用同一限制进行校验。
* Project Snapshot 是当前工程 `exportFiles()` 返回的 `files` 集合。提交时将其 JSON 内容保存到 Kodo，Context 只保存 Kodo 对象引用，不把整个集合嵌入 Feedback 记录。
* 页面截图保存到 Kodo，Context 只保存 Kodo 对象引用，不把图片嵌入 Feedback 记录。截图遵循现有 Upload Session 返回的 `maxSize` 限制。
* 内联诊断信息或较大内容无法采集，或超出 API/上传限制时，省略对应 Context 项并标记为不可用；剩余内容仍可提交。

Context 在用户确认提交时采集，而不是在打开表单时采集。工程和页面在提交后继续发生变化，不会更新已经保存的 Context。

用户可以关闭“分享诊断信息”。关闭后 Context 为空。部分上下文信息不可用时可以省略对应内容，但不能因此阻止 Feedback 提交。

### 回复 Reply

Reply 是管理员针对 Feedback 给出的文字回复。

### 站内通知 In-Product Notification

In-Product Notification 用于把管理员的 Reply 交给用户。

通知包含回复内容和回复时间。用户可以从导航栏查看未读数量、通知列表和通知详情。

## 权限管理

反馈管理员对应的角色为 `feedbackAdmin`，并派生 `canManageFeedback` capability。

用户侧的 Feedback 读取范围限定为当前用户提交的 Feedback。拥有 `feedbackAdmin` 角色的管理员可以读取全部
Feedback 记录，包括用户分享的 Context。Context 中的快照和截图引用遵循同一归属校验，不提供公开下载资源。

`feedbackAdmin` 可以：

* 查看 Feedback 列表和详情
* 查看 Feedback 详情中用户同意分享的 Context
* 在编辑器中打开 Feedback 中的 Project Snapshot
* 回复 `new` 状态的 Feedback
* 将 Feedback 标记为 `handled`

`authorizationAdmin` 可以为用户配置 `feedbackAdmin`。Feedback 管理操作必须由 `feedbackAdmin` 执行，其他管理员
角色不包含该权限。

前端通过 `canManageFeedback` 控制管理入口，Feedback 管理 API 仍必须在服务端检查 `feedbackAdmin`。

Feedback 列表只返回轻量的记录字段和 Context 是否可用。详情页按需加载内联 Context；通过归属校验的用户或管理员
打开、预览时，才获取 Project Snapshot 的 JSON 和截图内容。

## 核心机制

### 提交与采集

用户从右上角头像菜单打开反馈表单，填写 Title 和 Description，并决定是否分享 Context。

用户同意分享时，系统在确认提交时采集 Context。提交过程中显示进行中状态，避免用户重复操作。服务端确认
Feedback 创建成功后，界面显示完成状态并关闭表单；提交失败时保留用户输入并允许重试。

同一次提交使用稳定的 Submission ID。Submission ID 以提交用户为作用域，不同用户使用相同值时视为不同提交：

* Submission ID 与内容均相同，返回已经创建的 Feedback。
* Submission ID 相同但内容不同，请求发生冲突。
* 内容相同但 Submission ID 不同，不自动合并。

### Copilot 辅助

当用户明确提出需要反馈，或接受 Copilot 的建议后，Copilot 可以生成 Title 和 Description 草稿并打开 Feedback
表单。

用户可以修改草稿并决定是否分享 Context。Copilot 不能直接提交 Feedback，也不能在用户未确认时打开表单。

Copilot 生成的草稿不替代 Feedback 的 Context。用户确认提交时，Feedback 按上述规则采集 Context。

Copilot 暂时不可用或额度耗尽时，提示中可以提供直接打开 Feedback 表单的操作。用户也始终可以从头像菜单进入
Feedback。

### 查看 Project Snapshot

管理员从 Feedback 详情选择“打开项目快照”。客户端从 Kodo 获取引用的 JSON，将其中的 `files` 集合交给编辑器的
本地加载能力，在本地打开快照；此过程不会创建或保存新的 SPX Project。

### 处理 Feedback

管理员并发处理同一条 Feedback 时，服务端接受第一个有效的状态迁移：

* 被接受的迁移决定最终状态和 Reply。
* 后续操作不会覆盖已接受的处理结果。
* 前端重新加载 Feedback，并展示最终状态。

Feedback 进入终态后不再接受处理请求。管理员因网络超时重复发送请求时，服务端根据当前状态拒绝重复处理，不重复
创建 Reply 或 Notification。

### 回复与通知

Reply、Feedback 状态变化和 In-Product Notification 作为一次完整操作保存。

如果保存 Reply 或创建通知记录失败：

* Feedback 保持 `new`。
* 不保存不完整的 Reply。
* 不创建用户通知。
* 管理员未发送的回复继续保留在表单中，可以重试。
* 界面提示操作失败，并允许重试。

完整操作成功后，界面显示“回复已发送”。通知记录保存后，即使导航栏角标刷新失败，也不影响通知；用户下次打开
通知列表时仍然可以查看通知。

将 Feedback 标记为 `handled` 时不创建 Notification。

## User Story

### 用户提交反馈

用户遇到功能异常、运行结果不符合预期或不知道如何继续时，可以从头像菜单提交 Feedback。用户决定是否分享
Context；提交失败时，可以在原内容基础上重试。

### 用户请求 Copilot 整理反馈

用户在 Copilot 对话中提出需要反馈。Copilot 生成草稿并打开 Feedback 表单，用户检查和修改后提交。

### 管理员处理反馈

拥有 `feedbackAdmin` 的管理员查看 Feedback 详情，并根据 Context 排查问题。需要时，管理员可以在编辑器中打开
Project Snapshot；处理完成后回复用户或将 Feedback 标记为无需回复。

### 用户查看回复

管理员回复后，用户在导航栏看到未读通知，并从通知详情查看 Reply。
