## Dynamic Client Gallery Rendering

### What will change
- Show only the first 5 client-gallery images when the gallery opens.
- Insert the requested `load-more-images` container and `load-button` immediately after the currently rendered image batch.
- Each “Load More pictures” click reveals the next 5 images until the full gallery is visible.
- Observe rendered photos while the visitor scrolls and remove top photos after they have moved above the viewport, reducing active page content.
- Show a “Load Top” control at the top of the gallery whenever photos have been removed; clicking it restores all removed photos and scrolls back to the restored section.
- Preserve original image positions for lightbox navigation, downloads, shapes, and numbering.

### Technical details
- Keep separate `hiddenCount` and `visibleCount` state so removing top photos does not alter gallery order.
- Use `IntersectionObserver` plus scroll direction/position checks to hide only the leading contiguous photos that have fully passed above the viewport.
- Reset the visible range when a different gallery token loads.
- Add plain CSS for both controls using the existing OSLNZ semantic design tokens and responsive layout.
- Verify the initial five-image limit, incremental loading, automatic hiding, restoration, and current download/lightbox behavior in the preview.
