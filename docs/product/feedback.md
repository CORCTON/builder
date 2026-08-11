# Feedback

Users may encounter broken features, unexpected runtime results, or situations where they do not know how to continue while using XBuilder. Feedback allows users to describe a problem directly in XBuilder and, with their consent, attach Context captured at submission time to help administrators investigate it.

## Background

User feedback often consists of a short description. Administrators then need to ask where the user was, what the project looked like, and which errors occurred before they can start investigating.

Feedback therefore stores the user's Title and Description, and the Context the user agrees to share. Administrators can review and process the problem from one shared list.

## Goals

* Users can submit Feedback from within XBuilder.
* Feedback can include Context captured when it is submitted.
* Copilot can help users prepare Feedback, but the user confirms and submits the final content.
* Users can still access Feedback when Copilot is temporarily unavailable or its quota is exhausted.
* Administrators can review, process, and reply to Feedback, and view the shared Context.
* Users can receive administrator replies within XBuilder.

## Basic Concepts

### Feedback

A Feedback has three parts:

* Title
* Description
* Context

Title is limited to 100 characters. Description is limited to 2000 characters.

Feedback has three statuses:

| Status | Meaning |
| - | - |
| `new` | Not processed yet |
| `replied` | An administrator has replied |
| `handled` | Processed without a reply |

The allowed status transitions are:

```text
new -> replied
new -> handled
```

`replied` and `handled` are terminal states. A Feedback can have at most one Reply.

### Context

Context is diagnostic information collected when the user confirms Feedback submission. It includes:

* The current page, language, and capture time
* The current project's identifier, type, name, and resource structure
* The selected sprite and its basic state
* The current code file, cursor, selection, and nearby source
* Code errors and warnings in the current project
* The latest 50 runtime outputs
* The Project Snapshot
* The current page screenshot

Context is captured when the user confirms submission, rather than when the form is opened. It is not updated when the project or page changes after submission.

Users can turn off "Share diagnostic information." When it is off, XBuilder does not capture Context. Some contextual details may be omitted when unavailable, but this must not prevent Feedback from being submitted.

Context is not a public resource. Only the submitting user and administrators with the `feedbackAdmin` role can access it.

### Reply

A Reply is an administrator's written response to a Feedback.

After a Reply is saved, the Feedback changes to `replied` and the submitting user receives an In-Product Notification.

### In-Product Notification

An In-Product Notification delivers an administrator's reply to the user.

It contains the reply and reply time. Users can view the unread count, notification list, and notification details from the navigation bar.

## Core Mechanisms

### Submission and Capture

Users open "Send feedback" from the profile menu in the top-right corner, enter a Title and Description, and decide whether to share Context.

When the user agrees, the system captures Context when submission is confirmed. The form shows an in-progress state while submitting to prevent repeated actions. It closes and shows a completion state after the server confirms that the Feedback was created. When submission fails, the form keeps the user's input and allows a retry.

The same submission uses a stable Submission ID:

* The same Submission ID and the same content return the existing Feedback.
* The same Submission ID with different content causes a conflict.
* The same content with a different Submission ID is not merged automatically.

### Copilot Assistance

After the user explicitly asks for Feedback, or accepts Copilot's suggestion, Copilot may generate a Title and Description draft and open the Feedback form.

The user can edit the draft and decide whether to share Context. Copilot cannot submit Feedback directly or open the form without the user's confirmation.

The quota-exhausted message may provide a direct action to open the Feedback form. Users can always open Feedback from the profile menu.

### Permissions

The feedback administrator role is `feedbackAdmin`, with the derived `canManageFeedback` capability.

`feedbackAdmin` can:

* View Feedback lists and details
* View the Context shared by users
* Reply to Feedback in the `new` state
* Mark Feedback as `handled`

`authorizationAdmin` can assign `feedbackAdmin`. Other administrator roles do not include Feedback management permissions.

The frontend uses `canManageFeedback` to control the management entry point. Admin APIs must still check `feedbackAdmin` on the server.

### Processing Feedback

When administrators process the same Feedback, the first successful operation wins:

* The first successful operation takes effect.
* Later operations do not overwrite the result that has already taken effect.
* The frontend reloads the Feedback and shows its final state.

After Feedback enters a terminal state, it no longer accepts processing requests. If an administrator repeats a request after a network timeout, the server rejects the duplicate operation based on the current state and does not create another Reply or Notification.

### Reply and Notification

The Reply, Feedback status change, and In-Product Notification are saved as one complete operation.

If any step fails:

* The Feedback remains `new`.
* No partial Reply is saved.
* No user notification is created.
* The administrator's reply remains available.
* The interface reports the failure and allows a retry.

The interface shows "Reply sent" after the complete operation succeeds. After the notification record has been saved, a failure to refresh the navigation badge does not affect the notification. Users can still view it the next time they open the notification center.

Marking Feedback as `handled` does not create a Notification.

## User Story

### User Submits Feedback

The user enters a Title and Description, decides whether to share Context, and submits Feedback. On success, the user sees a clear completion state. On failure, the user can retry with the original content.

### User Asks Copilot to Prepare Feedback

Copilot prepares a Title and Description draft after the user explicitly asks for it. The user reviews and edits the content, decides whether to share Context, and submits Feedback.

### Administrator Processes Feedback

An administrator with `feedbackAdmin` opens the Feedback details, views the shared Context, replies to the user, or marks the Feedback as requiring no reply. When concurrent processing occurs, the interface shows the result that has already taken effect.

### User Views a Reply

After an administrator replies, the user sees an unread notification in the navigation bar and can view the reply.
