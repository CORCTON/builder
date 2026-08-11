# Feedback

Users may encounter broken features, unexpected runtime results, or situations where they do not know how to continue
while using XBuilder. Feedback lets users describe a problem in XBuilder. With the user's consent, a Feedback can
include Context that helps administrators investigate the problem.

## Background

User feedback often consists of a short description. Administrators then need to ask where the user was, what the
project looked like, and which errors occurred before they can start investigating.

Feedback combines the user's description with the Context the user agrees to share, so administrators can investigate
and process the problem from one record.

## Goals

* Users can submit Feedback from within XBuilder.
* Feedback can include Context captured at submission time.
* Copilot can help users prepare Feedback, but the user confirms and submits the final content.
* Users can still access Feedback when Copilot is temporarily unavailable or its quota is exhausted.
* Administrators can review, process, and reply to Feedback.
* Users can receive administrator replies within XBuilder.

## Basic Concepts and Rules

This section defines the Feedback record, its Context, and the states used by the processing flow.

### Feedback

User-submitted Feedback content has three parts:

* Title
* Description
* Context

Context may be empty.

The Feedback record also contains these system fields:

* User
* Status
* CreatedAt
* Reply

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

* Source: the page and entry point that triggered the Feedback
* The current page, language, and capture time
* The current project's identifier, type, name, and resource structure
* The selected sprite and its basic state
* The current code file, cursor, selection, and nearby source
* Code errors and warnings in the current project
* Runtime outputs from the current project
* The Project Snapshot
* The current page screenshot

Context contains inline diagnostics and references to larger artifacts:

* Inline diagnostics use the existing sampling rules: the latest 50 runtime outputs and at most 21 source-code lines around the current cursor are included.
* The Feedback API defines the maximum serialized size for inline Context, and both client and server enforce the same limit.
* The Project Snapshot is the `files` collection returned by the current project's `exportFiles()`. At submission time, the JSON representation is stored in Kodo, and Context stores its Kodo object reference instead of embedding the collection in the Feedback record.
* The current page screenshot is stored in Kodo, and Context stores its Kodo object reference instead of embedding the image in the Feedback record. The screenshot uses the existing Upload Session `maxSize` limit.
* If an inline diagnostic or artifact cannot be captured, or exceeds its API or upload limit, that Context item is omitted and marked unavailable. Feedback submission continues with the remaining content.

Context is captured when the user confirms submission, rather than when the form is opened. It is not updated when the
project or page changes after submission.

Users can turn off "Share diagnostic information." When it is off, Context is empty. Some contextual details may be
omitted when unavailable, but this must not prevent Feedback from being submitted.

### Reply

A Reply is an administrator's written response to a Feedback item.

### In-Product Notification

An In-Product Notification delivers an administrator's Reply to the user.

It contains the Reply and reply time. Users can view the unread count, notification list, and notification details from
the navigation bar.

## Permissions

The feedback administrator role is `feedbackAdmin`, with the derived `canManageFeedback` capability.

User-facing Feedback reads are limited to Feedback submitted by the current user. The `feedbackAdmin` role can read all
Feedback records, including the Context shared by users. Context artifacts use the same ownership check and are not
public download resources.

`feedbackAdmin` can:

* View Feedback lists and details
* View user-shared Context in Feedback details
* Open the Project Snapshot included in Feedback in the editor
* Reply to Feedback in the `new` state
* Mark Feedback as `handled`

`authorizationAdmin` can assign `feedbackAdmin`. Feedback management operations require the `feedbackAdmin` role; other
administrator roles do not include this permission.

The frontend uses `canManageFeedback` to control the management entry point. Feedback management APIs must still check
`feedbackAdmin` on the server.

Feedback lists return lightweight record fields and Context availability only. The detail view loads inline Context on
demand; the Project Snapshot JSON and screenshot bytes are fetched only when an authorized reader opens or previews them.

## Core Mechanisms

### Submission and Capture

Users open the Feedback form from the profile menu in the top-right corner, enter a Title and Description, and decide
whether to share Context.

When the user agrees, the system captures Context when submission is confirmed. The form shows an in-progress state
while submitting to prevent repeated actions. It closes and shows a completion state after the server confirms that the
Feedback was created. When submission fails, the form keeps the user's input and allows a retry.

The same submission uses a stable Submission ID. The Submission ID is scoped to the submitting user; the same value
submitted by different users is treated as a different submission.

* The same Submission ID and the same content return the existing Feedback.
* The same Submission ID with different content causes a conflict.
* The same content with a different Submission ID is not merged automatically.

### Copilot Assistance

After the user explicitly asks for Feedback, or accepts Copilot's suggestion, Copilot may generate a Title and
Description draft and open the Feedback form.

The user can edit the draft and decide whether to share Context. Copilot cannot submit Feedback directly or open the
form without the user's confirmation.

Copilot's draft does not replace Feedback Context. When the user confirms submission, Feedback captures Context using the
rules defined above.

When Copilot is temporarily unavailable or its quota is exhausted, the message may provide a direct action to open the
Feedback form. Users can always open Feedback from the profile menu.

### Viewing a Project Snapshot

From Feedback details, an administrator selects "Open project snapshot". The client fetches the referenced JSON from
Kodo, passes its `files` collection to the editor's local loading capability, and opens the snapshot locally. This does
not create or save a new SPX Project.

### Processing Feedback

When administrators process the same Feedback concurrently, the server accepts the first valid state transition:

* The accepted transition determines the final status and any Reply.
* Later operations do not overwrite the accepted result.
* The frontend reloads the Feedback and shows its final state.

After Feedback enters a terminal state, it no longer accepts processing requests. If an administrator repeats a request
after a network timeout, the server rejects the duplicate operation based on the current state and does not create
another Reply or Notification.

### Reply and Notification

The Reply, Feedback status change, and In-Product Notification are saved as one complete operation.

If saving the Reply or creating the notification record fails:

* The Feedback remains `new`.
* No partial Reply is saved.
* No user notification is created.
* The administrator's unsent reply remains in the form for a retry.
* The interface reports the failure and allows a retry.

The interface shows "Reply sent" after the complete operation succeeds. After the notification record has been saved, a
failure to refresh the navigation badge does not affect the notification. Users can still view it the next time they
open the notification list.

Marking Feedback as `handled` does not create a Notification.

## User Story

### User Submits Feedback

When users encounter broken behavior, unexpected runtime results, or do not know how to continue, they can submit
Feedback from the profile menu. They decide whether to share Context and can retry with the original content if
submission fails.

### User Asks Copilot to Prepare Feedback

The user asks for Feedback in a Copilot conversation. Copilot prepares a draft and opens the Feedback form, and the user
reviews and edits it before submission.

### Administrator Processes Feedback

An administrator with `feedbackAdmin` opens the Feedback details and uses Context to investigate the problem. When
needed, the administrator opens the Project Snapshot in the editor; after processing, the administrator replies to the
user or marks the Feedback as requiring no reply.

### User Views a Reply

After an administrator replies, the user sees an unread notification in the navigation bar and opens its details to view
the Reply.
