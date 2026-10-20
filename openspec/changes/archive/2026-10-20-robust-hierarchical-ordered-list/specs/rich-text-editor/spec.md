# Spec Delta

## ADDED Requirements

### Requirement: Hierarchical Ordered List Backspace Guard
The rich-text editor SHALL guard ordered list deletion boundaries against accidental list splitting. When a backspace action occurs at the leading offset of a nested list item, the editor SHALL outdent and lift the item by a single hierarchy level without splitting the outer list. When a backspace action occurs at an empty root-level list item, the editor SHALL unwrap the item into a regular paragraph.

#### Scenario: Non-empty nested list item backspace at leading offset
- **WHEN** user presses Backspace at offset 0 of a nested ordered list item (e.g. `1.2xxxx`)
- **THEN** the editor lifts the item by a single level to become a sibling of the parent item (`2.xxxx`), preserving the continuous sequence numbering of surrounding items

#### Scenario: Empty root list item backspace
- **WHEN** user presses Backspace inside an empty root-level list item
- **THEN** the editor unwraps the item into a standard text paragraph without breaking remaining list siblings

### Requirement: Consecutive List Auto-Join and Numbering Continuity
The rich-text editor SHALL automatically detect and fuse adjacent sibling ordered lists within document transactions. When an editing operation temporarily splits an ordered list or leaves contiguous sibling ordered lists, the editor SHALL join them into a single contiguous ordered list to preserve continuous sequence numbering.

#### Scenario: Automatic fusion of severed sibling ordered lists
- **WHEN** a list item deletion or extraction leaves two adjacent ordered list nodes as siblings in the document tree
- **THEN** the editor joins the two lists into a single continuous ordered list during transaction post-processing, retaining uninterrupted sequential numbering

#### Scenario: Parent numbering continuity after child item deletion
- **WHEN** a child list item (`1.2`) is completely deleted from a nested ordered list
- **THEN** the subsequent parent list item (`2.xxx`) remains strictly numbered as `2.xxx` without resetting to `1.xxx`

### Requirement: Multi-Level Outline Numbering Conformance
The rich-text editor SHALL render nested ordered lists with hierarchical outline numbering (`1.`, `1.1`, `1.2`, `1.2.1`) using dynamic stylesheet counters. When intermediate items are deleted or added, subsequent sibling counters SHALL recompute reactively to reflect the updated hierarchical sequence.

#### Scenario: Dynamic renumbering on intermediate item removal
- **WHEN** item `1.2` is removed from a sequence containing `1.1`, `1.2`, and `1.3`
- **THEN** former item `1.3` automatically displays as `1.2` without manual text modification

#### Scenario: Dual-theme outline visual alignment
- **WHEN** multi-level ordered lists are displayed in either the modern theme or the Retro Pixel theme
- **THEN** counters and clean hierarchical indentation render with correct token-based spacing, typography, and indentation offsets without vertical guide lines
