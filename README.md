# Reading Flow Coach

Chrome extension for improving English article reading flow with quick chunking, memo capture, real translation fetch, and a collapsible right sidebar.

## Current features

- Selection-based floating toolbar
- Persistent floating **영역 분석** button
- HTML area click analysis mode
- Five correction modes: flow, chunk, structure, simplify, compare
- Save selected words or sentences to a memo list
- Collapsible right sidebar with search and type filters
- Editable translation and note fields inside memo cards
- Translation fetch via background request
- Popup and options page

## Load locally

1. Open Chrome extensions page.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select this project folder.
5. Refresh the target page after reloading the extension.

## Test the HTML click mode

1. Click the floating **영역 분석** button, or open it from the popup.
2. Click a paragraph or content block in the page.
3. Switch between the five correction tabs in the overlay.
4. Save the result to the memo sidebar if needed.

## Translation note

Longer sentences now request Korean translation through the background worker. If the translation request fails, the overlay shows a fallback error message.
