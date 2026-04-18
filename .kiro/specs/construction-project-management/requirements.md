# Requirements Document

## Introduction

A multi-site construction project management platform that gives project managers real-time visibility across many construction sites simultaneously. The system centralizes operational data including construction progress, materials procurement, worker management, third-party contractors, photo proof of work, vendor management, and customer reporting. It supports multiple parallel projects with different locations, customers, phases, materials, workforces, and suppliers. Field workers, supervisors, and project managers collaborate through structured reporting and verifiable evidence (photos, timestamps, GPS). The platform is mobile-first for field use, offline-capable, and designed for outdoor readability.

---

## Glossary

- **Platform**: The multi-site construction project management application.
- **Project_Manager**: A user with full control over projects, phases, workers, purchases, reports, and suppliers.
- **Site_Supervisor**: A user who manages on-site workers, confirms work completion, and uploads proof photos.
- **Worker**: A field user who views assigned tasks, submits work updates, and uploads photo evidence.
- **Supplier**: A vendor user who provides material offers, confirms deliveries, and updates supply status.
- **Customer**: A read-only user who views project progress, milestone reports, and photo proof.
- **Project**: A construction engagement with a defined customer, location, phases, budget, and timeline.
- **Phase**: A named stage of construction (e.g., Foundation, Electrical) with defined start/end dates, assigned workers, and materials.
- **Progress_Report**: A structured submission by a Worker or Site_Supervisor documenting completed work, materials used, issues, and photos for a given Phase.
- **Purchase_Order**: A formal record of materials ordered from a Supplier, including quantities, costs, delivery status, and invoice.
- **Photo**: A timestamped, GPS-tagged image uploaded as evidence of work completion or site conditions.
- **Milestone**: A significant project event (phase completion, scheduled date) that triggers customer reporting.
- **Auth_Service**: The authentication and authorization subsystem managing user identity and role-based access.
- **Notification_Service**: The subsystem responsible for delivering priority-based alerts to users.
- **Sync_Service**: The subsystem managing offline data caching, queued uploads, and background synchronization.
- **Material**: A tracked resource with category, brand, quality grade, unit, and quantity attributes.
- **Dashboard**: A role-specific overview screen presenting aggregated project data, alerts, and activity feeds.
- **Timeline**: A visual representation of project phases, deliveries, milestones, and worker logs over time.
- **Construction_Time_Machine**: A scrubable slider UI feature showing the full visual evolution of a project through photos, phases, and deliveries.
- **Cloud_API**: A future external service integration for material price comparison and supplier recommendations.

---

## Requirements

### Requirement 1: User Authentication and Role-Based Access Control

**User Story:** As a platform user, I want to authenticate securely and access only the features relevant to my role, so that sensitive project data is protected and each user sees an appropriate interface.

#### Acceptance Criteria

1. THE Auth_Service SHALL support email and password authentication for all user roles.
2. THE Auth_Service SHALL support phone number OTP authentication for all user roles.
3. WHEN a user submits valid credentials, THE Auth_Service SHALL issue a session token and redirect the user to their role-specific Dashboard.
4. WHEN a user submits invalid credentials, THE Auth_Service SHALL return a descriptive error message without revealing which field is incorrect.
5. WHEN a session token expires, THE Auth_Service SHALL require the user to re-authenticate before accessing protected resources.
6. THE Auth_Service SHALL enforce role-based permissions such that a Worker cannot access Project_Manager or Site_Supervisor administrative functions.
7. THE Auth_Service SHALL enforce role-based permissions such that a Customer cannot access any write operations on any resource.
8. THE Auth_Service SHALL enforce role-based permissions such that a Supplier can only access supply status, delivery confirmation, and material offer functions.
9. WHEN a user attempts to access a resource outside their role permissions, THE Auth_Service SHALL return an authorization error and log the attempt.
10. WHEN a user performs a sensitive action (e.g., deleting a project, approving a purchase), THE Platform SHALL require explicit confirmation before executing the action.

---

### Requirement 2: Multi-Project Creation and Management

**User Story:** As a Project_Manager, I want to create and manage multiple construction projects simultaneously, so that I can oversee all active sites from a single platform.

#### Acceptance Criteria

1. THE Platform SHALL allow a Project_Manager to create a Project with the following fields: name, customer, location, start date, projected completion date, budget, and notes.
2. THE Platform SHALL assign a unique Project ID to each Project upon creation.
3. WHEN a Project is created, THE Platform SHALL set its status to "Active" by default.
4. THE Platform SHALL allow a Project_Manager to update any field of an existing Project.
5. THE Platform SHALL allow a Project_Manager to change a Project's status to one of: Active, On Hold, Completed, or Cancelled.
6. THE Platform SHALL display all Projects assigned to a Project_Manager on the Project_Manager Dashboard with current status, progress percentage, and budget utilization.
7. WHEN a Project's actual cost exceeds 90% of its budget, THE Notification_Service SHALL send a Warning alert to the assigned Project_Manager.
8. WHEN a Project's actual cost exceeds 100% of its budget, THE Notification_Service SHALL send a Critical alert to the assigned Project_Manager.
9. THE Platform SHALL support hundreds of concurrent Projects without degradation of Dashboard load time beyond 3 seconds.

---

### Requirement 3: Construction Phase Management

**User Story:** As a Project_Manager, I want to define and manage construction phases within each project, so that work is organized into trackable stages with clear ownership and progress.

#### Acceptance Criteria

1. THE Platform SHALL allow a Project_Manager to create one or more Phases within a Project, each with: name, start date, end date, status, assigned workers, materials used, suppliers, progress percentage, photos, and notes.
2. THE Platform SHALL support the following standard phase names: Site Preparation, Foundation, Structural Work, Electrical, Plumbing, and Finishing.
3. THE Platform SHALL allow a Project_Manager to define custom phase names beyond the standard set.
4. THE Platform SHALL allow phase-specific custom fields: Foundation phases SHALL support concrete volume and steel reinforcement fields; Electrical phases SHALL support cable type and power capacity fields.
5. WHEN a Phase's status is set to "Completed", THE Notification_Service SHALL send an Info alert to the assigned Project_Manager and Customer.
6. THE Platform SHALL display Phases on a vertical timeline within the Project page, ordered by start date.
7. WHEN a Phase's end date passes and its status is not "Completed", THE Notification_Service SHALL send a Warning alert to the assigned Project_Manager.
8. THE Platform SHALL allow a Site_Supervisor to update the progress percentage of a Phase assigned to their site.

---

### Requirement 4: Worker Management

**User Story:** As a Project_Manager, I want to manage workers across all sites, so that I can assign the right people to the right phases and track their contributions.

#### Acceptance Criteria

1. THE Platform SHALL store the following fields for each Worker: worker ID, name, role, phone number, skill type, assigned site, assigned phase, and authentication credentials.
2. THE Platform SHALL allow a Project_Manager to create, update, and deactivate Worker accounts.
3. THE Platform SHALL allow a Project_Manager or Site_Supervisor to assign a Worker to a specific Project and Phase.
4. WHEN a Worker is assigned to a Phase, THE Platform SHALL display that Phase and its tasks in the Worker's mobile interface.
5. THE Platform SHALL allow a Worker to submit a work completion update for an assigned Phase, including: work completed description, materials used, issues encountered, and photos.
6. THE Platform SHALL allow a Worker to report an issue on an assigned Phase with a description and optional photo.
7. WHEN a Worker submits a Progress_Report, THE Notification_Service SHALL send an Info alert to the assigned Site_Supervisor.
8. THE Platform SHALL support thousands of concurrent Worker accounts without degradation of assignment or reporting functions.

---

### Requirement 5: Material Management

**User Story:** As a Project_Manager, I want to track all materials across projects, so that I have accurate visibility into what has been ordered, delivered, and consumed.

#### Acceptance Criteria

1. THE Platform SHALL store the following fields for each Material: material ID, name, category, brand, quality grade, unit, quantity required, quantity purchased, quantity used, vendor, and price per unit.
2. THE Platform SHALL allow a Project_Manager to define required materials for each Phase.
3. THE Platform SHALL calculate and display the variance between quantity required and quantity purchased for each Material in a Phase.
4. THE Platform SHALL calculate and display the variance between quantity purchased and quantity used for each Material in a Phase.
5. WHEN quantity used exceeds quantity purchased for any Material, THE Notification_Service SHALL send a Warning alert to the assigned Project_Manager.
6. THE Platform SHALL display material cost trends over time on the Analytics Dashboard.

---

### Requirement 6: Vendor and Supplier Management

**User Story:** As a Project_Manager, I want to manage a directory of suppliers and track their performance, so that I can make informed procurement decisions.

#### Acceptance Criteria

1. THE Platform SHALL store the following fields for each Supplier: supplier ID, company name, contact person, phone number, address, material categories supplied, pricing history, and reliability score.
2. THE Platform SHALL allow a Project_Manager to create, update, and deactivate Supplier records.
3. THE Platform SHALL calculate a reliability score for each Supplier based on on-time delivery rate and order accuracy across all Purchase_Orders.
4. THE Platform SHALL display Supplier reliability scores on the procurement interface.
5. THE Platform SHALL allow a Supplier user to confirm delivery of a Purchase_Order and update supply status.
6. THE Platform SHALL maintain a pricing history for each Supplier per material category.

---

### Requirement 7: Purchase Order Management

**User Story:** As a Project_Manager, I want to create and track purchase orders for materials, so that procurement is documented and delivery is verifiable.

#### Acceptance Criteria

1. THE Platform SHALL store the following fields for each Purchase_Order: purchase order ID, project ID, supplier ID, material list with quantities, total cost, order date, expected delivery date, delivery status, and invoice attachment.
2. THE Platform SHALL allow a Project_Manager to create a Purchase_Order linked to a Project and Supplier.
3. THE Platform SHALL allow a Project_Manager to attach an invoice document to a Purchase_Order.
4. WHEN a Purchase_Order's expected delivery date passes and delivery status is not "Delivered", THE Notification_Service SHALL send a Warning alert to the assigned Project_Manager.
5. WHEN a Supplier confirms delivery of a Purchase_Order, THE Platform SHALL update the delivery status to "Delivered" and record the confirmation timestamp.
6. THE Platform SHALL allow a Project_Manager to approve a Purchase_Order before it is transmitted to the Supplier.

---

### Requirement 8: Progress Reporting

**User Story:** As a Worker or Site_Supervisor, I want to submit structured progress reports with photo evidence, so that project status is accurately documented and verifiable.

#### Acceptance Criteria

1. THE Platform SHALL store the following fields for each Progress_Report: report ID, project ID, phase ID, worker ID, date, work completed description, materials used, issues encountered, photos, location tag, and timestamp.
2. THE Platform SHALL allow a Worker to submit a Progress_Report for an assigned Phase.
3. THE Platform SHALL allow a Site_Supervisor to submit a Progress_Report for any Phase on their assigned site.
4. WHEN a Progress_Report is submitted, THE Platform SHALL record the submission timestamp and the submitting user's ID automatically.
5. THE Platform SHALL allow a Site_Supervisor to verify a Progress_Report submitted by a Worker, changing its status to "Verified".
6. WHEN a Progress_Report is verified, THE Notification_Service SHALL send an Info alert to the submitting Worker.
7. THE Platform SHALL display all Progress_Reports for a Phase in reverse chronological order within the Phase view.

---

### Requirement 9: Photo Proof System

**User Story:** As a Worker, I want to upload geotagged, timestamped photos as proof of work, so that progress is visually documented and auditable.

#### Acceptance Criteria

1. THE Platform SHALL store the following fields for each Photo: photo ID, worker ID, project ID, phase ID, upload timestamp, GPS coordinates, caption, and file URL.
2. THE Platform SHALL allow a Worker to upload a Photo from the mobile field interface using a streamlined workflow: tap to initiate, capture or select image, add caption, submit.
3. WHEN a Photo is uploaded, THE Platform SHALL automatically record the upload timestamp, GPS coordinates, and the uploading Worker's ID without requiring manual entry.
4. THE Platform SHALL display Photos in a visual feed within the Phase view, ordered by upload timestamp.
5. THE Platform SHALL provide a full-screen photo inspection viewer with zoom and side-by-side comparison capabilities.
6. THE Platform SHALL support millions of stored Photos without degradation of feed load time beyond 3 seconds per page of results.
7. THE Platform SHALL display Photos as part of the Construction_Time_Machine feature, ordered chronologically by upload timestamp.

---

### Requirement 10: Customer Reporting

**User Story:** As a Project_Manager, I want to generate and deliver structured reports to customers at milestones, so that customers have transparent, evidence-backed visibility into project progress.

#### Acceptance Criteria

1. THE Platform SHALL allow a Project_Manager to generate a customer report at any Milestone, scheduled date, or Phase completion.
2. THE Platform SHALL include the following in each customer report: progress summary, materials used, cost updates, photo proof, next steps, and timeline update.
3. THE Platform SHALL allow a Customer to view all reports generated for their Project in read-only mode.
4. WHEN a Phase is marked "Completed", THE Notification_Service SHALL send an Info alert to the assigned Customer indicating a new report is available.
5. WHEN a scheduled customer report date arrives, THE Notification_Service SHALL send a Warning alert to the assigned Project_Manager indicating the report is due.
6. THE Platform SHALL allow a Project_Manager to attach Photos to a customer report.

---

### Requirement 11: Project Manager Dashboard

**User Story:** As a Project_Manager, I want a command-center dashboard showing all my projects, so that I can monitor status, budget, and alerts across all sites at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display all active Projects assigned to the authenticated Project_Manager with: project name, current status, progress percentage, budget utilization, upcoming milestones, and active alerts.
2. THE Dashboard SHALL display a live activity feed showing the most recent Progress_Reports, Photo uploads, Purchase_Order updates, and Phase status changes across all Projects.
3. THE Dashboard SHALL display a site map view showing the geographic location of all active Projects.
4. THE Dashboard SHALL display an alerts panel showing all Critical and Warning notifications in priority order.
5. WHEN the Dashboard is loaded, THE Platform SHALL render all project overview cards within 3 seconds.
6. THE Dashboard SHALL update the activity feed without requiring a full page reload.

---

### Requirement 12: Site Dashboard

**User Story:** As a Site_Supervisor, I want a site-specific dashboard showing tasks, workers, materials, and daily reports, so that I can manage on-site operations efficiently.

#### Acceptance Criteria

1. THE Dashboard SHALL display all active Phases for the assigned site with: phase name, status, progress percentage, and assigned workers.
2. THE Dashboard SHALL display a list of Workers currently assigned to the site with their active task.
3. THE Dashboard SHALL display the delivery status of all Purchase_Orders associated with the site's active Phases.
4. THE Dashboard SHALL display all Progress_Reports submitted for the site within the current day.
5. THE Dashboard SHALL provide a direct action to initiate a Photo upload from the site dashboard.

---

### Requirement 13: Worker Mobile Interface

**User Story:** As a Worker, I want a simple, large-button mobile interface, so that I can complete field tasks quickly even in outdoor conditions with limited attention.

#### Acceptance Criteria

1. THE Platform SHALL present the Worker interface as a mobile-first layout with large tap targets of at least 44x44 pixels.
2. THE Platform SHALL display only the Phases and tasks assigned to the authenticated Worker on the Worker's home screen.
3. THE Platform SHALL provide a photo upload workflow completable in 3 taps or fewer: initiate, capture/select, submit.
4. THE Platform SHALL display text at a minimum font size of 16px in the Worker interface to support outdoor readability.
5. THE Platform SHALL support high contrast mode in the Worker interface for outdoor visibility.

---

### Requirement 14: Offline-First Field Operation

**User Story:** As a Worker, I want to submit reports and photos even without an internet connection, so that field work is not blocked by connectivity issues.

#### Acceptance Criteria

1. THE Sync_Service SHALL cache assigned tasks, phase data, and recent Progress_Reports locally on the Worker's device for offline access.
2. WHEN a Worker submits a Progress_Report or Photo while offline, THE Sync_Service SHALL queue the submission locally and display a "Sync Pending" status indicator.
3. WHEN network connectivity is restored, THE Sync_Service SHALL automatically upload all queued submissions in the background and update the status indicator to "Uploading" then "Synced".
4. WHEN a background sync completes successfully, THE Sync_Service SHALL display a "Synced" status indicator and remove the item from the pending queue.
5. IF a queued submission fails to sync after 3 retry attempts, THEN THE Sync_Service SHALL display an error indicator and retain the submission in the queue for manual retry.

---

### Requirement 15: Notification System

**User Story:** As a platform user, I want to receive timely, priority-based notifications about events relevant to my role, so that I can respond to critical issues without constantly monitoring the platform.

#### Acceptance Criteria

1. THE Notification_Service SHALL deliver notifications at three priority levels: Critical, Warning, and Info.
2. THE Notification_Service SHALL send notifications for the following triggers: Phase completion, material delivery confirmation, budget overrun, Worker Progress_Report submission, upcoming Milestone within 48 hours, and customer report due date.
3. THE Platform SHALL display notifications in a priority-ordered panel, with Critical notifications displayed before Warning, and Warning before Info.
4. WHEN a Critical notification is generated, THE Notification_Service SHALL deliver it to the recipient within 60 seconds.
5. THE Platform SHALL allow a user to mark a notification as read, removing it from the active alerts panel.

---

### Requirement 16: Timeline Visualization

**User Story:** As a Project_Manager, I want a sophisticated interactive timeline for each project, so that I can understand the full sequence of phases, deliveries, milestones, and worker activity at a glance.

#### Acceptance Criteria

1. THE Platform SHALL display a Timeline for each Project showing: Phases with start/end dates, Purchase_Order delivery dates, customer report Milestones, and Progress_Report submissions.
2. THE Timeline SHALL be scrubable, allowing a user to navigate to any point in the project's history.
3. THE Timeline SHALL visually distinguish between Phases, deliveries, milestones, and worker log events using distinct visual markers.
4. THE Platform SHALL display the Construction_Time_Machine as a scrubable slider within the Timeline, showing Photos ordered chronologically to visualize project evolution.
5. WHEN a user scrubs the Construction_Time_Machine slider to a specific date, THE Platform SHALL display all Photos uploaded on or before that date.

---

### Requirement 17: Analytics Dashboard

**User Story:** As a Project_Manager, I want an analytics dashboard with charts and metrics, so that I can identify trends, inefficiencies, and risks across all projects.

#### Acceptance Criteria

1. THE Platform SHALL display the following metrics on the Analytics Dashboard: project completion velocity, material cost trends, worker productivity by phase, supplier reliability scores, and budget usage per project.
2. THE Platform SHALL display a Gantt chart view of all active Projects showing Phase timelines.
3. THE Platform SHALL display material cost trend graphs showing price changes over time per material category.
4. THE Platform SHALL display a worker productivity heat map showing Progress_Report submission frequency by worker and phase.
5. WHEN the Analytics Dashboard is loaded, THE Platform SHALL render all charts within 5 seconds.

---

### Requirement 18: Cloud Material Price Comparison (Future Integration)

**User Story:** As a Project_Manager, I want the platform to compare material prices against market data, so that I can make cost-effective procurement decisions.

#### Acceptance Criteria

1. THE Platform SHALL expose a POST /api/material/purchase endpoint that accepts purchase data and submits it to the Cloud_API for market comparison.
2. THE Platform SHALL expose a GET /api/material/recommendations endpoint that retrieves supplier recommendations from the Cloud_API.
3. WHEN the Cloud_API is unavailable, THE Platform SHALL display the procurement interface using locally stored pricing data without returning an error to the user.
4. THE Platform SHALL display Cloud_API price comparison results alongside locally stored Supplier pricing history in the procurement interface.
5. WHERE the Cloud_API integration is enabled, THE Platform SHALL display a market price indicator for each Material showing whether the current purchase price is above, at, or below market rate.

---

### Requirement 19: Scalability and Performance

**User Story:** As a platform operator, I want the system to scale to hundreds of projects, thousands of workers, and millions of photos, so that the platform remains performant as usage grows.

#### Acceptance Criteria

1. THE Platform SHALL support a minimum of 500 concurrent Projects without degradation of core read operations beyond 3 seconds.
2. THE Platform SHALL support a minimum of 10,000 registered Worker accounts without degradation of authentication or task assignment operations.
3. THE Platform SHALL support storage and retrieval of a minimum of 1,000,000 Photos with paginated feed load times not exceeding 3 seconds per page.
4. THE Platform SHALL implement lazy loading and infinite scrolling for all list and feed views containing more than 20 items.
5. THE Platform SHALL support deployment across multiple geographic regions to reduce latency for field workers in different locations.
