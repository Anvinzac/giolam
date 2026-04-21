# Requirements Document

## Introduction

This document specifies requirements for an immersive, simplified salary entry interface designed specifically for Type B employees (overtime shift type). Type B employees are typically older and less tech-savvy, requiring a more intuitive, focused input experience compared to the current table-based interface. The interface presents working days sequentially in large, rounded square cards (squircles), allowing users to input clock-out times one day at a time with minimal cognitive load.

## Glossary

- **Type_B_Employee**: An employee with shift_type 'overtime' who receives base salary plus overtime wages
- **Squircle**: A rounded square UI container (card) that displays a single working day's information
- **Clock_Out_Chip**: A tappable button displaying a time option for clock-out selection
- **Working_Day**: A day where the employee is scheduled to work (not an off-day)
- **Focus_State**: The active, interactive squircle where user input is expected (bottom half, larger size)
- **Review_State**: The previous day's squircle shown in the top half (smaller, read-only but correctable)
- **Immersive_View**: The two-panel sequential input interface (alternative to table view)
- **Table_View**: The existing multi-row table interface for salary entry
- **Global_Clock_In**: The fixed, default clock-in time for Type B employees (stored in profile)

## Requirements

### Requirement 1: Display Working Days in Squircle Cards

**User Story:** As a Type B employee, I want to see each working day in a large, clear card format, so that I can focus on one day at a time without distraction.

#### Acceptance Criteria

1. THE Immersive_View SHALL display each Working_Day in a Squircle card
2. THE Squircle SHALL show the date and weekday prominently
3. THE Squircle SHALL display the Global_Clock_In time as read-only text
4. THE Squircle SHALL present Clock_Out_Chip options in a grid layout
5. WHEN a day is marked as off-day, THE Immersive_View SHALL skip that day and not display a Squircle for it
6. THE Squircle SHALL use large, touch-friendly typography suitable for older users

### Requirement 2: Two-Panel Sequential Layout

**User Story:** As a Type B employee, I want to see two days at once (current and previous), so that I can easily correct mistakes without scrolling.

#### Acceptance Criteria

1. THE Immersive_View SHALL display exactly two Squircles on screen simultaneously
2. THE Squircle in the bottom half SHALL be in Focus_State (larger, interactive)
3. THE Squircle in the top half SHALL be in Review_State (smaller, read-only display)
4. WHEN the user selects a Clock_Out_Chip, THE current Squircle SHALL transition to Review_State
5. WHEN a Squircle transitions to Review_State, THE next Working_Day Squircle SHALL slide in from bottom to Focus_State
6. THE Review_State Squircle SHALL remain visible and allow corrections without scrolling

### Requirement 3: Clock-Out Time Input via Chips

**User Story:** As a Type B employee, I want to tap a time chip to enter my clock-out time, so that I can input data quickly without typing.

#### Acceptance Criteria

1. THE Immersive_View SHALL display Clock_Out_Chip options in a grid within the Focus_State Squircle
2. THE Clock_Out_Chip grid SHALL present time options in 30-minute increments
3. WHEN a user taps a Clock_Out_Chip, THE Immersive_View SHALL record that time as clock_out for the current Working_Day
4. THE Clock_Out_Chip options SHALL be based on the Global_Clock_In time plus reasonable overtime durations
5. THE selected Clock_Out_Chip SHALL provide clear visual feedback (highlighted state)
6. THE Clock_Out_Chip buttons SHALL be large enough for easy tapping (minimum 44x44 CSS pixels)

### Requirement 4: Smooth Slide Transitions

**User Story:** As a Type B employee, I want smooth animations when moving between days, so that I understand the flow and don't feel lost.

#### Acceptance Criteria

1. WHEN a Clock_Out_Chip is selected, THE current Squircle SHALL animate upward to the top half
2. WHEN a Squircle moves to Review_State, THE Squircle SHALL shrink smoothly to the smaller size
3. WHEN the next Working_Day appears, THE new Squircle SHALL slide in from the bottom with animation
4. THE transition animation SHALL complete within 500 milliseconds
5. THE animations SHALL use easing functions appropriate for smooth, natural motion
6. WHILE a transition is animating, THE Immersive_View SHALL prevent additional input to avoid race conditions

### Requirement 5: Previous Day Correction

**User Story:** As a Type B employee, I want to correct the previous day's entry if I made a mistake, so that I don't have to exit the flow or scroll through a table.

#### Acceptance Criteria

1. THE Review_State Squircle SHALL display the previously entered clock-out time
2. WHEN a user taps the Review_State Squircle, THE Immersive_View SHALL allow editing of that day's clock-out time
3. WHEN editing the Review_State entry, THE Immersive_View SHALL display the Clock_Out_Chip grid for that day
4. WHEN a correction is made, THE Immersive_View SHALL save the updated time
5. WHEN correction is complete, THE Immersive_View SHALL return to the current Focus_State day

### Requirement 6: Skip Off-Days Automatically

**User Story:** As a Type B employee, I want the interface to skip days when the restaurant is closed, so that I don't waste time on irrelevant entries.

#### Acceptance Criteria

1. WHEN determining the next Working_Day, THE Immersive_View SHALL check the is_day_off flag
2. IF a day has is_day_off set to true, THE Immersive_View SHALL skip that day
3. THE Immersive_View SHALL advance to the next Working_Day where is_day_off is false
4. THE Immersive_View SHALL not display any Squircle for skipped off-days

### Requirement 7: Mobile-First Responsive Design

**User Story:** As a Type B employee, I want the interface to work well on my phone, so that I can enter my hours from anywhere.

#### Acceptance Criteria

1. THE Immersive_View SHALL be optimized for mobile viewport sizes (320px to 428px width)
2. THE Squircle cards SHALL scale appropriately for different screen sizes
3. THE Clock_Out_Chip grid SHALL adapt to available screen width
4. THE Immersive_View SHALL use touch-friendly spacing (minimum 8px between interactive elements)
5. THE Immersive_View SHALL work correctly on both iOS and Android mobile browsers

### Requirement 8: Integration with Type B Employee Data

**User Story:** As a Type B employee, I want the interface to use my existing employee data, so that I don't have to re-enter information.

#### Acceptance Criteria

1. THE Immersive_View SHALL load data only for employees where shift_type equals 'overtime'
2. THE Immersive_View SHALL retrieve the Global_Clock_In from the employee's default_clock_in profile field
3. THE Immersive_View SHALL read Working_Days from the salary_entries table for the current period
4. WHEN a Clock_Out_Chip is selected, THE Immersive_View SHALL update the corresponding salary_entries record
5. THE Immersive_View SHALL respect the current working period boundaries (period_id)

### Requirement 9: View Toggle Between Table and Immersive

**User Story:** As a Type B employee, I want to switch between table view and immersive view, so that I can choose the interface that works best for me.

#### Acceptance Criteria

1. THE salary entry page SHALL provide a toggle control to switch between Table_View and Immersive_View
2. WHEN the toggle is activated, THE interface SHALL switch to the selected view mode
3. THE selected view mode SHALL persist for the current session
4. THE toggle control SHALL be clearly labeled and easy to find
5. WHERE the user is a Type B employee, THE toggle control SHALL be visible

### Requirement 10: Read-Only Display of Clock-In Time

**User Story:** As a Type B employee, I want to see my fixed clock-in time displayed, so that I know what time is being used for calculations.

#### Acceptance Criteria

1. THE Focus_State Squircle SHALL display the Global_Clock_In time
2. THE Global_Clock_In display SHALL be clearly labeled (e.g., "Giờ vào:")
3. THE Global_Clock_In display SHALL be visually distinct from editable fields
4. THE Global_Clock_In SHALL not be editable within the Immersive_View
5. THE Global_Clock_In SHALL match the value from the employee's profile

### Requirement 11: Visual Feedback for Selection

**User Story:** As a Type B employee, I want clear visual feedback when I tap a time chip, so that I know my input was registered.

#### Acceptance Criteria

1. WHEN a Clock_Out_Chip is tapped, THE chip SHALL immediately change appearance (color, border, or background)
2. THE selected Clock_Out_Chip SHALL remain highlighted while in Review_State
3. THE visual feedback SHALL be visible within 100 milliseconds of the tap
4. THE visual feedback SHALL use high contrast colors for accessibility
5. THE visual feedback SHALL be consistent with the application's design system

### Requirement 12: End of Period Handling

**User Story:** As a Type B employee, I want to know when I've completed all entries for the period, so that I understand I'm done.

#### Acceptance Criteria

1. WHEN the last Working_Day entry is completed, THE Immersive_View SHALL display a completion message
2. THE completion message SHALL indicate that all days have been entered
3. THE Immersive_View SHALL provide a button to return to the main salary view
4. THE Immersive_View SHALL not attempt to load additional days beyond the period end date
5. THE completion state SHALL be visually distinct from the normal entry flow

### Requirement 13: Error State Handling

**User Story:** As a Type B employee, I want clear error messages if something goes wrong, so that I know what to do next.

#### Acceptance Criteria

1. IF the salary_entries data fails to load, THE Immersive_View SHALL display an error message
2. IF a clock-out time update fails to save, THE Immersive_View SHALL notify the user and allow retry
3. THE error messages SHALL be written in simple, non-technical language
4. THE error messages SHALL be displayed prominently within the Squircle or as an overlay
5. WHEN an error occurs, THE Immersive_View SHALL not advance to the next day until resolved

### Requirement 14: Accessibility Compliance

**User Story:** As a Type B employee with potential vision or motor challenges, I want the interface to be accessible, so that I can use it effectively.

#### Acceptance Criteria

1. THE Clock_Out_Chip buttons SHALL have a minimum touch target size of 44x44 CSS pixels
2. THE text SHALL have a minimum font size of 16px for body text
3. THE color contrast SHALL meet WCAG AA standards (4.5:1 for normal text)
4. THE interactive elements SHALL have visible focus indicators for keyboard navigation
5. THE Squircle cards SHALL use semantic HTML for screen reader compatibility

### Requirement 15: Performance Requirements

**User Story:** As a Type B employee, I want the interface to respond quickly, so that I can complete my entries without frustration.

#### Acceptance Criteria

1. WHEN a Clock_Out_Chip is tapped, THE interface SHALL respond within 200 milliseconds
2. WHEN transitioning between days, THE animation SHALL complete within 500 milliseconds
3. THE initial load of the Immersive_View SHALL complete within 2 seconds on a 3G connection
4. THE Immersive_View SHALL not cause layout shifts during transitions
5. THE Immersive_View SHALL maintain 60fps during animations on modern mobile devices
