# Spec Delta

## ADDED Requirements

### Requirement: AI Configuration Preference Management
The settings dialog SHALL include a dedicated "AI配置" (AI Configuration) management panel allowing users to configure default model selections, provider channel credentials, and skill preferences.

#### Scenario: Navigating to AI configuration panel
- **WHEN** user opens the settings dialog and selects the "AI配置" tab
- **THEN** the system displays provider channel settings, active model selectors, preset skill parameters, and MCP connection status

#### Scenario: Persisting active model preferences
- **WHEN** user updates the preferred primary model or fallback model in the AI configuration panel
- **THEN** the system saves the preference configuration and applies the new model routing rules to subsequent AI workspace and skill invocations immediately
