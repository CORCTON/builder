# In-Product Notification

XBuilder uses In-Product Notification to deliver asynchronous product updates to users inside XBuilder. A Notification is
a reusable delivery mechanism; the product feature that creates it defines the event and content.

## Background

Some product operations finish after the user has left the page where they started. A persistent entry in XBuilder keeps
the result available after the user leaves the original page.

## Goals

* Users can find product updates addressed to them in XBuilder.
* Users can distinguish unread notifications from notifications they have read.
* Product features share one Notification List and read-state behavior.

## Basic Concepts

### Notification

A Notification is a message addressed to one User about a product event.

A Notification contains:

* Recipient
* Title
* Body
* CreatedAt
* ReadAt

`ReadAt` is empty for an unread Notification and contains the time at which the user read it after it has been read.

### Notification List

The Notification List is the current user's collection of Notifications. It provides the unread count and the
Notifications ordered from newest to oldest.

The Recipient can read a Notification. The server validates the Recipient for list, detail, and read-state operations.

## Core Mechanisms

### Creating a Notification

The originating product feature creates a Notification as part of its user-facing operation. The feature defines when the
operation succeeds, its transaction behavior, and the Notification's Title and Body.

For Feedback, a successful administrator Reply creates an In-Product Notification for the submitting user. The Feedback
document defines the transaction and failure behavior for this integration.

### Reading Notifications

Users open the Notification List from the navigation bar. Opening a Notification shows its details and records the read
time. The unread count updates after the read state changes.

### Failure Handling

Notification creation follows the transaction rules of its originating feature. A saved Notification remains available
when the navigation badge refresh is delayed or fails.

## User Story

### User Receives a Notification

The user can return to XBuilder later and find an update addressed to them, even after leaving the page where the update
was created.

### User Reads a Notification

The user opens the Notification List, selects a Notification, and reads the complete message.
