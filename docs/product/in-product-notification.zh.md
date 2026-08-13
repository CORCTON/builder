# 站内通知 In-Product Notification

XBuilder 使用 In-Product Notification 在站内向用户传递异步的产品更新。Notification 是可复用的传递机制；创建通知的
产品功能负责定义触发事件和通知内容。

## 背景

部分产品操作会在用户离开起始页面后完成。XBuilder 提供持久入口，让用户离开原页面后仍可查看结果。

## 目标

* 用户可以在 XBuilder 内找到发送给自己的产品更新。
* 用户可以区分未读和已读通知。
* 各产品功能共用 Notification List 和已读状态行为。

## 基本概念

### Notification

Notification 是针对一个 User、用于传递某个产品事件的消息。

一个 Notification 包含：

* Recipient
* Title
* Body
* CreatedAt
* ReadAt

未读 Notification 的 `ReadAt` 为空；用户阅读后，`ReadAt` 记录阅读时间。

### 通知列表 Notification List

Notification List 是当前用户收到的 Notification 集合，提供未读数量，并按最新到最早的顺序展示通知。

Recipient 可以读取对应的 Notification。服务端对列表、详情和已读状态操作执行 Recipient 校验。

## 核心机制

### 创建 Notification

发起功能在面向用户的操作中创建 Notification，并定义操作何时成功、事务行为，以及 Notification 的 Title 和 Body。

对于 Feedback，管理员成功回复后，系统为提交用户创建一条 In-Product Notification。Feedback 文档定义这一集成的事务和
失败处理规则。

### 查看 Notification

用户从导航栏打开 Notification List。打开某条 Notification 时展示详情并记录阅读时间；已读状态变化后更新未读数量。

### 失败处理

Notification 的创建遵循发起功能的事务规则。导航栏角标延迟刷新或刷新失败时，已保存的 Notification 仍可查看。

## User Story

### 用户收到通知

用户离开产生更新的页面后，仍然可以回到 XBuilder 查看发送给自己的更新。

### 用户查看通知

用户打开 Notification List，选择某条 Notification，查看完整消息。
