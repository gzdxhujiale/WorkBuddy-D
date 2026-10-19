/**
 * This file is part of Tiptap Pro and is licensed under the Tiptap Pro License.
 * https://tiptap.dev/pro-license
 *
 * Unauthorized copying, modification, distribution, or use of this file,
 * in whole or in part, is strictly prohibited without a valid license.
 *
 * The use of this software for the purpose of training, fine-tuning, or
 * improving machine learning or AI models is prohibited.
*/
import { Extension } from "@tiptap/core";
//#region src/PasteHandler.d.ts
/**
 * Main HTML transformation function.
 * Processes clipboard HTML to handle various paste sources (Excel, SharePoint Word, etc.)
 *
 * IMPORTANT: Transformation Order Dependencies
 * ============================================
 * The order of transformations is critical. Do NOT reorder without understanding dependencies:
 *
 * 1. CSS Class Resolution - Must run FIRST to resolve styles before other transforms use them
 * 2. Border Dividers - Must run BEFORE MSO cleanup (detection keys on the mso-element marker it strips)
 * 3. MSO Content Cleanup - Removes Office-specific elements (<o:p>, mso-* styles, color:black)
 * 4. Bookmark Cleanup - Removes Word bookmark markers
 * 5. Table Cell Text Styles - Must run AFTER CSS resolution, wraps cell text styles in spans
 * 6. Background Color to Mark - Must run AFTER table cell text styles (needs inline spans)
 * 7. ARIA Headings - Independent, but should run early before structural changes
 * 8. Horizontal Rules - Must run BEFORE soft line breaks (dividers have zero margins and would be merged)
 * 9. Soft Line Breaks - Must run AFTER horizontal rules, BEFORE orphan break cleanup
 * 10. Nested Lists - Independent structural transform
 * 11. Normalize Ordered Lists - Strips inline list-style-type so destination CSS controls styling
 * 12. Orphan Break Cleanup - Must run LAST to clean up any remaining orphan <br> tags
 */
declare function transformPastedHTML(html: string): string;
/**
 * PasteHandler Extension
 *
 * Custom paste handler for improved compatibility with:
 * - Microsoft Excel (macOS & SharePoint Web)
 * - Microsoft Word (SharePoint Web & desktop)
 * - Google Docs
 *
 * Features:
 * 1. CSS Class Style Resolution - Resolves Excel's class-based formatting to inline styles
 * 2. Border Divider Detection - Converts Word paragraph border dividers to <hr>
 * 3. MSO Content Cleanup - Removes Office-specific elements (<o:p>, mso-* styles, color:black)
 * 4. Bookmark Cleanup - Removes Word bookmark markers and empty anchor tags
 * 5. Table Cell Text Styles - Wraps table cell text formatting in spans for Tiptap marks
 * 6. Background Color to Mark - Converts background-color styles to <mark> for highlight support
 * 7. ARIA Heading Detection - Converts <p role="heading"> to <h1>-<h6>
 * 8. Horizontal Rule Detection - Converts text-based dividers (───) to <hr>
 * 9. Soft Line Break Detection - Merges zero-margin paragraphs with <br>
 * 10. Nested List Reconstruction - Rebuilds SharePoint's flat list structure into proper nesting
 * 11. Ordered List Normalization - Ensures all ordered lists use decimal numbering
 * 12. Orphan Break Cleanup - Removes <br> tags between block elements that cause extra spacing
 * 13. First Block Preservation - Keeps the first block's attributes (e.g. alignment) when a
 *     multi-block paste lands in an empty paragraph or replaces the whole document
 *
 * @see transformPastedHTML for transformation order dependencies
 */
declare const PasteHandler: Extension<any, any>;
//#endregion
//#region src/transformers/ariaHeadings.d.ts
/**
 * Transform ARIA heading elements to semantic HTML headings.
 * SharePoint Word uses <p role="heading" aria-level="N"> instead of <h1>-<h6>
 */
declare function transformAriaHeadings(doc: Document): number;
//#endregion
//#region src/transformers/backgroundColorToMark.d.ts
/**
 * Transform background-color inline styles to <mark> tags for Tiptap Highlight extension.
 *
 * Problem: External sources (Excel, Word, Google Docs) use <span style="background-color: ...">
 * but Tiptap's Highlight extension only parses <mark> tags.
 *
 * Solution: Convert <span style="background-color: ...">text</span>
 *        to <mark data-color="...">text</mark>
 */
declare function transformBackgroundColorToMark(doc: Document): number;
//#endregion
//#region src/transformers/bookmarkCleanup.d.ts
/**
 * Clean up Microsoft Word bookmark elements from pasted HTML.
 *
 * Word inserts bookmark markers as:
 * - Elements with mso-bookmark style property
 * - Empty anchor tags with name attribute (e.g., <a name="_Toc123456"></a>)
 *
 * These are internal Word references and should be removed for clean paste.
 */
declare function cleanupBookmarks(doc: Document): number;
//#endregion
//#region src/transformers/borderDividers.d.ts
/**
 * Transform Word paragraph border dividers to <hr> elements.
 *
 * Desktop Word draws divider lines as a top or bottom border on a wrapper div
 * (mso-element:para-border-div), not as <hr>. The editor has no div node, so
 * the line would silently disappear. The wrapper's content is kept and an <hr>
 * is inserted where the border was drawn.
 */
/**
 * Must run BEFORE MSO cleanup: detection keys on the mso-element:para-border-div
 * marker, which the cleanup strips.
 */
declare function transformBorderDividers(doc: Document): number;
//#endregion
//#region src/transformers/cleanupOrphanBreaks.d.ts
/**
 * Remove orphan <br> tags that appear between block-level elements.
 * Google Docs adds <br> tags between sections that cause extra spacing.
 */
declare function cleanupOrphanBreaks(doc: Document): number;
//#endregion
//#region src/transformers/cssClassStyles.d.ts
/**
 * Resolve CSS class-based styles to inline styles.
 * Excel (macOS & SharePoint) uses <style> blocks with classes like .xl65 for formatting.
 */
declare function resolveCssClassStyles(doc: Document): number;
//#endregion
//#region src/transformers/horizontalRules.d.ts
/**
 * Transform text-based horizontal rules to <hr> elements.
 * Google Docs uses repeated Unicode box drawing characters instead of <hr>.
 */
declare function transformHorizontalRules(doc: Document): number;
//#endregion
//#region src/transformers/msoCleanup.d.ts
/**
 * Clean up Microsoft Office specific content from pasted HTML.
 *
 * This transformer handles:
 * 1. <o:p> tags - Office XML namespace elements (empty paragraph markers)
 * 2. mso-* style properties - Microsoft Office specific CSS properties
 * 3. color: black - Unnecessary default color that adds noise
 *
 * These elements/styles are specific to Word and don't add value in the editor.
 */
declare function cleanupMsoContent(doc: Document): number;
//#endregion
//#region src/transformers/nestedLists.d.ts
/**
 * Reconstruct nested lists from SharePoint Word's flat structure.
 * SharePoint Word outputs each list item in its own wrapper div with data-aria-level.
 *
 * Input structure:
 * <div class="ListContainerWrapper"><ul><li data-aria-level="1">Item 1</li></ul></div>
 * <div class="ListContainerWrapper"><ul><li data-aria-level="2">Nested A</li></ul></div>
 * <div class="ListContainerWrapper"><ul><li data-aria-level="1">Item 2</li></ul></div>
 *
 * Output structure:
 * <ul><li>Item 1<ul><li>Nested A</li></ul></li><li>Item 2</li></ul>
 */
declare function reconstructNestedLists(doc: Document): number;
//#endregion
//#region src/transformers/normalizeOrderedLists.d.ts
/**
 * Strip list-style-type from ordered lists so the destination editor's CSS controls styling.
 *
 * Source applications (Word, Google Docs, etc.) often embed inline list-style-type styles.
 * By removing these, we let the target editor's CSS rules decide how nested lists should
 * appear (e.g., traditional 1 → a → i, or all-decimal).
 */
declare function normalizeOrderedLists(doc: Document): number;
//#endregion
//#region src/transformers/softLineBreaks.d.ts
/**
 * Merge consecutive zero-margin paragraphs into single paragraphs with <br>.
 * Google Docs uses separate <p> elements for soft line breaks (Shift+Enter).
 *
 * NOTE: SharePoint Word already handles soft line breaks internally - it sends
 * Shift+Enter content as a single paragraph. We don't need to merge SharePoint
 * paragraphs, and doing so causes issues (merging ENTER-separated paragraphs).
 */
declare function mergeSoftLineBreaks(doc: Document): number;
//#endregion
//#region src/transformers/tableCellTextStyles.d.ts
/**
 * Extract text formatting styles from table cells and wrap content in styled spans.
 *
 * Problem: Excel applies text styles (color, font-weight, font-style, text-decoration)
 * directly to <td>/<th> elements, but Tiptap's marks (Color, Bold, Italic, etc.)
 * only parse inline elements like <span>.
 *
 * Solution: Extract text formatting styles from table cells and wrap their text content
 * in <span> elements with those styles.
 *
 * Example:
 *   <td style="color: green; font-weight: bold">Hello</td>
 *   →
 *   <td><span style="color: green; font-weight: bold">Hello</span></td>
 */
declare function transformTableCellTextStyles(doc: Document): number;
//#endregion
export { PasteHandler, PasteHandler as default, cleanupBookmarks, cleanupMsoContent, cleanupOrphanBreaks, mergeSoftLineBreaks, normalizeOrderedLists, reconstructNestedLists, resolveCssClassStyles, transformAriaHeadings, transformBackgroundColorToMark, transformBorderDividers, transformHorizontalRules, transformPastedHTML, transformTableCellTextStyles };