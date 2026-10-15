# Spec Delta

## Purpose

Enables predictive route prefetching upon user hover and non-blocking view transitions across the client application.

## ADDED Requirements

### Requirement: Intent-based client route preloading
The application router SHALL configure intent-based preloading with a 50ms hover delay, automatically initiating background loading of route bundles and loader assets before the user initiates click navigation.

#### Scenario: Hovering navigation link
- **WHEN** user points or focuses on a navigation tool link in the sidebar for more than 50ms
- **THEN** the router preloads the corresponding route code bundle in the background

### Requirement: Non-blocking view transition scheduling
The application SHALL schedule heavy view and document replacements inside concurrent transition boundaries, ensuring continuous responsiveness for user typing and navigation controls.

#### Scenario: Switching date or note document
- **WHEN** user selects a different date in Daily Review or note in Knowledge Base
- **THEN** the document swap is scheduled via concurrent transition without freezing interactive controls
