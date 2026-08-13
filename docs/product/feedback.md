# Feedback

Feedback lets users describe a problem they encounter in XBuilder and, with their consent, share Context that helps
administrators investigate it.

## Background

A short description rarely contains enough information to reproduce a problem. Administrators may also need the page,
project state, code, diagnostics, and runtime output from when the problem occurred.

Feedback keeps the user's description and the Context they agree to share in one record, so administrators can understand
and process the problem with fewer follow-up questions.

## Goals

* Users can submit Feedback within XBuilder.
* Users can include Context captured at submission time.
* Copilot can prepare a Feedback draft for the user to review and submit.
* Supported AI features can provide a Feedback entry when a feature or quota issue occurs.
* Administrators can investigate, process, and reply to Feedback.
* Users can receive administrator replies within XBuilder.

## Basic Concepts and Rules

### Feedback

User-submitted Feedback content has three parts:

* Title
* Description
* Context

Context is optional.

A Feedback record also contains these system fields:

* User
* Status
* CreatedAt
* Reply

Title is limited to 100 characters. Description is limited to 2000 characters.

Feedback has three statuses:

| Status | Meaning |
| - | - |
| `new` | Awaiting administrator processing |
| `replied` | Completed with an administrator Reply |
| `handled` | Completed through the administrator's "Mark as handled" action |

The allowed status transitions are:

```text
new -> replied
new -> handled
```

`replied` and `handled` are terminal states. A Feedback item stores one administrator Reply when it reaches `replied`.

### Context

Context is the diagnostic information shared with a Feedback item. It includes available information from the following
categories:

* Source: the page and entry point from which Feedback was opened
* Current page, language, and capture time
* Current project's identifier, type, name, and resource structure
* Selected sprite and its basic state
* Current code file, cursor, selection, and nearby source
* Code errors and warnings in the current project
* Runtime output from the current project
* Project Snapshot
* Current page screenshot

For diagnostic items also used by Copilot, Feedback follows the existing Copilot context collection and sampling rules.
Context is captured when the user confirms submission and remains fixed after submission.

Users control Context sharing through "Share diagnostic information." When enabled, the available Context is included in
Feedback.

### Project Snapshot

A Project Snapshot preserves the current project files at the time of submission. It is part of Context and can be opened
in the editor by an authorized administrator investigating the Feedback.

### Reply

A Reply is an administrator's written response to a Feedback item.

## Permissions

The feedback administrator role is `feedbackAdmin`, with the derived `canManageFeedback` capability.

Users can read the Feedback they submitted. `feedbackAdmin` can:

* View Feedback lists and details
* View the Context shared with a Feedback item
* Open its Project Snapshot in the editor
* Reply to Feedback in the `new` state
* Mark Feedback in the `new` state as `handled`

Context follows the authorization of its Feedback item. `authorizationAdmin` can assign the `feedbackAdmin` role.

## Core Mechanisms

### Submission and Capture

Users open the Feedback form from the profile menu, enter a Title and Description, and decide whether to share Context.
The system captures Context after the user confirms submission.

The form indicates progress while Feedback is being submitted. If submission fails, the form keeps the entered content
and provides an action to try again.

### Copilot Assistance

When a user asks to submit Feedback or accepts Copilot's suggestion, Copilot can prepare a Title and Description draft.
After the user confirms opening the Feedback form, they can review the draft, decide whether to share Context, and submit
the Feedback.

### Feedback for AI Feature and Quota Issues

Copilot, Costume Generation, and Animation Generation each present messages for their corresponding feature and quota
issues. A message can provide an action that opens the Feedback form, with Source identifying the affected feature and
entry point.

### Viewing a Project Snapshot

From Feedback details, an administrator can open the Project Snapshot through the editor's reusable local project-loading
capability and inspect the project as it was when the Feedback was submitted.

### Processing Feedback

An administrator completes Feedback in the `new` state by replying or selecting "Mark as handled." When administrators
process the same Feedback concurrently, the first successful action determines its terminal state, and the other
administrators see the resulting state.

### Reply and Notification

After an administrator successfully sends a Reply, Feedback enters the `replied` state and creates an
[In-Product Notification](./in-product-notification.md) for the submitting user. If the operation fails, the Reply draft
remains available and the administrator can try again.

## User Story

### User Reports a Project Problem

While testing a project, a user encounters an unexpected result. The user opens Feedback from the profile menu, describes
the problem, chooses to share Context, and submits it. The resulting Feedback gives an administrator the description and
the project state from when the problem occurred.

### User Asks Copilot to Prepare Feedback

The user asks to submit Feedback during a Copilot conversation. Copilot prepares a draft and, after confirmation, opens
the Feedback form. The user reviews the draft, chooses whether to share Context, and submits it.

### User Reports an AI Feature or Quota Issue

The user encounters a feature or quota issue in Copilot, Costume Generation, or Animation Generation. The corresponding
message opens Feedback for that feature, where the user reviews and submits the report.

### Administrator Processes Feedback

An administrator opens Feedback in the `new` state and uses its Context to investigate the problem. The administrator can
open the Project Snapshot in the editor, then reply to the user or mark the Feedback as `handled`.

### User Views a Reply

After an administrator replies, the user receives an In-Product Notification and opens it to read the Reply.
