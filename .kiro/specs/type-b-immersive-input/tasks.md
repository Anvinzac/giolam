# Implementation Plan: Type B Immersive Input

## Overview

This implementation plan breaks down the Type B Immersive Input feature into discrete coding tasks. The feature introduces a sequential, card-based salary entry interface optimized for Type B employees (shift_type: 'overtime'). Each task builds incrementally on previous work, with testing integrated throughout.

## Tasks

- [x] 1. Create core component files and interfaces
  - Create `src/components/salary/ImmersiveInputTypeB.tsx` component file
  - Create `src/components/salary/SquircleCard.tsx` component file
  - Create `src/components/salary/ClockOutChipGrid.tsx` component file
  - Create `src/components/salary/ViewToggle.tsx` component file
  - Define TypeScript interfaces for all component props
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 2.1, 2.2, 2.3, 3.1, 3.2, 3.6, 9.1, 9.4_

- [ ] 2. Implement ClockOutChipGrid component
  - [x] 2.1 Implement chip time generation logic
    - Write `generateChipTimes()` function to create 30-minute increments from base time
    - Generate times from globalClockIn + 0.5h to +5h
    - Format times as HH:MM strings
    - _Requirements: 3.2, 3.4_
  
  - [x] 2.2 Write unit tests for chip generation
    - Test chip generation with various base times
    - Test edge cases (midnight crossing, invalid inputs)
    - Verify 30-minute increment logic
    - _Requirements: 3.2, 3.4_
  
  - [x] 2.3 Implement chip grid layout and styling
    - Create responsive grid layout with Tailwind CSS
    - Ensure minimum 44x44px touch targets
    - Add 8px spacing between chips
    - Display times in decimal format (17.5 instead of 17:30)
    - _Requirements: 3.1, 3.6, 7.4, 14.1_
  
  - [x] 2.4 Implement chip selection handler
    - Add onClick handler to chips
    - Provide visual feedback on selection (highlight state)
    - Disable chips during transitions
    - _Requirements: 3.3, 3.5, 11.1, 11.2, 11.3_

- [ ] 3. Implement SquircleCard component
  - [x] 3.1 Create card layout structure
    - Implement squircle shape with rounded corners (border-radius: 24px)
    - Add date and weekday display at top
    - Add read-only clock-in time display
    - Add space for ClockOutChipGrid
    - Add daily summary section at bottom
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 10.1, 10.2, 10.3_
  
  - [x] 3.2 Implement focus and review states
    - Create two visual states: 'focus' (large, interactive) and 'review' (small, read-only)
    - Apply different sizing and styling based on state prop
    - Make review state tappable for editing
    - _Requirements: 2.2, 2.3, 5.1, 5.2_
  
  - [x] 3.3 Implement daily wage calculation display
    - Use existing `computeTotalSalaryTypeB` logic to calculate daily wage
    - Display base wage, allowances, and total
    - Format currency values appropriately
    - _Requirements: 1.1, 8.4_
  
  - [x] 3.4 Write unit tests for SquircleCard
    - Test rendering in focus state
    - Test rendering in review state
    - Test edit callback invocation
    - Test with various entry data
    - _Requirements: 2.2, 2.3, 5.2_

- [x] 4. Checkpoint - Ensure component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement ImmersiveInputTypeB main component
  - [x] 5.1 Set up component structure and props
    - Define ImmersiveInputTypeBProps interface
    - Accept entries, rates, allowances, and callback props
    - Initialize component state (currentDayIndex, isTransitioning, editingPreviousDay)
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  
  - [x] 5.2 Implement working days filtering logic
    - Create `getWorkingDays()` function to filter out off-days
    - Filter entries where is_day_off === false
    - Store filtered working days in state
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 5.3 Write unit tests for working days filtering
    - Test filtering with mixed off-days and working days
    - Test with all off-days
    - Test with no off-days
    - Test with empty entries array
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 5.4 Implement two-panel layout
    - Render exactly two SquircleCards (review state on top, focus state on bottom)
    - Position cards using Flexbox or Grid
    - Handle edge case when only one day remains
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 6. Implement clock-out selection and data updates
  - [x] 6.1 Create handleChipSelect function
    - Accept selected time as parameter
    - Call onEntryUpdate with current entry date, sort_order, and clock_out update
    - Set isTransitioning to true during save
    - Handle save errors with toast notification
    - _Requirements: 3.3, 8.4, 13.2_
  
  - [x] 6.2 Implement optimistic UI updates
    - Update local state immediately on chip selection
    - Revert on save failure
    - Show loading state during transition
    - _Requirements: 3.5, 15.1_
  
  - [x] 6.3 Write integration tests for clock-out selection
    - Test successful clock-out update flow
    - Test error handling and revert logic
    - Test that UI doesn't advance on save failure
    - _Requirements: 3.3, 8.4, 13.2_

- [ ] 7. Implement slide transition animations
  - [x] 7.1 Add Framer Motion animations for card transitions
    - Animate current card moving to review state (slide up, shrink)
    - Animate next card sliding in from bottom to focus state
    - Use transform and opacity for GPU acceleration
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  
  - [x] 7.2 Implement transition timing and easing
    - Set transition duration to 500ms
    - Use appropriate easing function (ease-in-out)
    - Prevent input during transitions (check isTransitioning flag)
    - _Requirements: 4.4, 4.5, 4.6, 15.2_
  
  - [x] 7.3 Add advanceToNextDay function
    - Increment currentDayIndex after successful save
    - Trigger animation sequence
    - Reset isTransitioning after animation completes
    - _Requirements: 2.4, 2.5, 4.1, 4.2, 4.3_
  
  - [x] 7.4 Implement reduced motion support
    - Detect prefers-reduced-motion media query
    - Reduce animation duration to 0.01ms when enabled
    - Maintain functionality without animations
    - _Requirements: 4.5, 14.4_

- [x] 8. Checkpoint - Test animation flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement previous day correction feature
  - [x] 9.1 Add edit handler to review state card
    - Make review state SquircleCard tappable
    - Set editingPreviousDay state to true on tap
    - Display ClockOutChipGrid for previous day
    - _Requirements: 5.2, 5.3_
  
  - [x] 9.2 Implement correction save logic
    - Update previous day's clock_out time
    - Return to current focus state after save
    - Reset editingPreviousDay to false
    - _Requirements: 5.4, 5.5_
  
  - [x] 9.3 Write integration tests for correction flow
    - Test entering edit mode for previous day
    - Test saving corrected time
    - Test returning to focus state
    - Test error handling during correction
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [ ] 10. Implement ViewToggle component
  - [x] 10.1 Create toggle UI component
    - Create button or switch to toggle between 'table' and 'immersive' views
    - Add clear labels for each view mode
    - Style consistently with design system
    - _Requirements: 9.1, 9.2, 9.4_
  
  - [x] 10.2 Implement view mode persistence
    - Store selected view mode in sessionStorage as 'typeB_viewMode'
    - Load persisted preference on component mount
    - Update storage when toggle is activated
    - _Requirements: 9.3_
  
  - [x] 10.3 Integrate toggle into EmployeeSalaryEntry page
    - Add ViewToggle component to EmployeeSalaryEntry.tsx
    - Show toggle only for Type B employees (shift_type === 'overtime')
    - Conditionally render SalaryTableTypeB or ImmersiveInputTypeB based on viewMode
    - _Requirements: 9.1, 9.2, 9.5_

- [ ] 11. Implement completion and error states
  - [x] 11.1 Create completion screen
    - Detect when currentDayIndex reaches end of workingDays array
    - Display completion message with checkmark icon
    - Show total salary summary
    - Add button to return to main salary view
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [x] 11.2 Implement error state UI
    - Create error display component for data loading failures
    - Show retry button and fallback to table view option
    - Display user-friendly error messages in Vietnamese
    - _Requirements: 13.1, 13.3, 13.4_
  
  - [x] 11.3 Handle edge cases
    - Handle empty working days list (show appropriate message)
    - Handle single working day (hide review state)
    - Handle period not active (disable immersive view)
    - _Requirements: 12.4, 13.5_
  
  - [x] 11.4 Write unit tests for completion and error states
    - Test completion screen rendering
    - Test error state rendering
    - Test edge case handling
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.3, 13.4, 13.5_

- [ ] 12. Implement responsive design and mobile optimization
  - [x] 12.1 Add responsive styling with Tailwind CSS
    - Optimize layout for 320px-428px viewport widths
    - Scale SquircleCard appropriately for different screen sizes
    - Adapt ClockOutChipGrid columns based on screen width
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 12.2 Ensure touch-friendly spacing
    - Verify minimum 44x44px touch targets for all interactive elements
    - Ensure minimum 8px spacing between chips
    - Test tap accuracy on mobile devices
    - _Requirements: 7.4, 14.1_
  
  - [x] 12.3 Optimize typography for readability
    - Set date display to 24px font size
    - Set clock-in display to 18px font size
    - Set chip labels to 16px font size
    - Ensure minimum 16px for all body text
    - _Requirements: 1.6, 14.2_

- [ ] 13. Implement accessibility features
  - [x] 13.1 Add ARIA labels and semantic HTML
    - Use semantic HTML elements (button, time, article)
    - Add aria-label to all interactive elements
    - Add aria-live region for state change announcements
    - _Requirements: 14.5_
  
  - [x] 13.2 Implement keyboard navigation
    - Ensure proper tab order (review card → chips → toggle)
    - Add Enter/Space key handlers for chip selection
    - Add Escape key handler to cancel edit mode
    - Add visible focus indicators
    - _Requirements: 14.4_
  
  - [x] 13.3 Verify color contrast
    - Ensure primary text meets 7:1 contrast ratio (AAA)
    - Ensure secondary text meets 4.5:1 contrast ratio (AA)
    - Ensure chip borders meet 3:1 contrast ratio
    - Ensure selected chip meets 4.5:1 contrast ratio
    - _Requirements: 14.3_

- [x] 14. Checkpoint - Final integration and testing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Performance optimization
  - [x] 15.1 Add React.memo and useMemo optimizations
    - Wrap SquircleCard with React.memo
    - Memoize workingDays computation with useMemo
    - Memoize calculateDailySummary with useMemo
    - _Requirements: 15.1, 15.2, 15.4_
  
  - [x] 15.2 Optimize animation performance
    - Use transform and opacity for animations (avoid height/width)
    - Add will-change property during transitions only
    - Remove will-change after transition completes
    - _Requirements: 15.2, 15.5_
  
  - [x] 15.3 Add debouncing for rapid interactions
    - Debounce chip taps during transitions
    - Prevent double-submission of clock-out times
    - _Requirements: 15.1_

- [ ] 16. Final integration and wiring
  - [x] 16.1 Wire ImmersiveInputTypeB into EmployeeSalaryEntry page
    - Import ImmersiveInputTypeB component
    - Pass all required props from existing hooks
    - Connect onEntryUpdate callback to useSalaryEntries
    - Ensure realtime updates work correctly
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 16.2 Test complete user flow end-to-end
    - Test loading immersive view with working days
    - Test selecting clock-out times for multiple days
    - Test editing previous day
    - Test completion screen
    - Test toggling between table and immersive views
    - _Requirements: All requirements_
  
  - [x] 16.3 Write end-to-end integration tests
    - Test complete salary entry flow from start to finish
    - Test error recovery scenarios
    - Test view toggle persistence
    - _Requirements: All requirements_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are not optional and can't be skipped
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- All code should be written in TypeScript with React/TSX
- Use existing hooks (useSalaryEntries, useSpecialDayRates, etc.) for data management
- Follow existing code style and conventions in the codebase
- Leverage Tailwind CSS for styling
- Use Framer Motion for animations (already in project dependencies)
