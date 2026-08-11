# Feedback

Users may encounter broken features, unexpected runtime results, or situations where they do not know how to continue while using XBuilder. Feedback allows users to describe a problem directly in XBuilder. With the user's consent, the Feedback includes Context to help administrators investigate it.

## Background

User feedback often consists of a short description. Administrators then need to ask where the user was, what the project looked like, and which errors occurred before they can start investigating.

Feedback therefore stores the user's Title and Description, and the Context the user agrees to share. Administrators can review and process the problem from one shared list.

## Goals

* Users can submit Feedback from within XBuilder.
* Feedback can include Context.
* Copilot can help users prepare Feedback, but the user confirms and submits the final content.
* Users can still access Feedback when Copilot is temporarily unavailable or its quota is exhausted.
* Administrators can review, process, and reply to Feedback.
* Users can receive administrator replies within XBuilder.

## Basic Concepts

### Feedback

A Feedback item has three parts:

* Title
* Description
* Context

Context may be empty.

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

`replied` and `handled` are terminal states. A Feedback item can have at most one Reply.

### Context

Context is the information in a Feedback item used to investigate the reported problem. It includes:

* The current page, language, and capture time
* The current project's identifier, type, name, and resource structure
* The selected sprite and its basic state
* The current code file, cursor, selection, and nearby source
* Code errors and warnings in the current project
* The latest 50 runtime outputs
* The Project Snapshot
* The current page screenshot

Context is captured when the user confirms submission, rather than when the form is opened. It is not updated when the project or page changes after submission.

Users can turn off "Share diagnostic information." When it is off, Context is empty. Some contextual details may be omitted when unavailable, but this must not prevent Feedback from being submitted.

Context in a Feedback item is not a public resource. Only the submitting user and administrators with the `feedbackAdmin` role can access it.

### Reply

A Reply is an administrator's written response to a Feedback item.

### In-Product Notification

An In-Product Notification delivers an administrator's reply to the user.

It contains the reply and reply time. Users can view the unread count, notification list, and notification details from the navigation bar.

## Core Mechanisms

### Submission and Capture

Users open "Send feedback" from the profile menu in the top-right corner, enter a Title and Description, and decide whether to share Context.

When the user agrees, the Feedback includes the Context captured at confirmation. The form shows an in-progress state while submitting to prevent repeated actions. It closes and shows a completion state after the server confirms that the Feedback was created. When submission fails, the form keeps the user's input and allows a retry.

The same submission uses a stable Submission ID:

* The same Submission ID and the same content return the existing Feedback.
* The same Submission ID with different content causes a conflict.
* The same content with a different Submission ID is not merged automatically.

### Viewing a Project Snapshot

From Feedback details, administrators select "Open project snapshot" to open the Project Snapshot included in Feedback in the editor.

### Copilot Assistance

After the user explicitly asks for Feedback, or accepts Copilot's suggestion, Copilot may generate a Title and Description draft and open the Feedback form.

The user can edit the draft and decide whether to share Context. Copilot cannot submit Feedback directly or open the form without the user's confirmation.

The quota-exhausted message may provide a direct action to open the Feedback form. Users can always open Feedback from the profile menu.

### Permissions

The feedback administrator role is `feedbackAdmin`, with the derived `canManageFeedback` capability.

`feedbackAdmin` can:

* View Feedback lists and details
* View user-shared Context in Feedback details
* Open the Project Snapshot included in Feedback in the editor
* Reply to Feedback in the `new` state
* Mark Feedback as `handled`

`authorizationAdmin` can assign `feedbackAdmin`. Feedback management operations require the `feedbackAdmin` role; other administrator roles do not include this permission.

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

When users encounter broken behavior, unexpected runtime results, or do not know how to continue, they can submit Feedback from the profile menu. They decide whether to share Context; if submission fails, the form keeps their input for retry.

### User Asks Copilot to Prepare Feedback

The user asks for Feedback in a Copilot conversation. Copilot prepares a draft and opens the Feedback form, and the user reviews and edits it before submission.

### Administrator Processes Feedback

An administrator with `feedbackAdmin` opens the Feedback details and uses Context to investigate the problem. When needed, the administrator opens the Project Snapshot in the editor; after processing, the administrator replies to the user or marks the Feedback as requiring no reply.

### User Views a Reply

After an administrator replies, the user sees an unread notification in the navigation bar and opens its details to view the reply.
