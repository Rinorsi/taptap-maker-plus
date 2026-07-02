# Maker preview shell UI

The TapTap Maker child WebView uses `maker-preview-shell.css` for its injected shell UI.

Edit this CSS file for visual changes only:

- `.tmp-toolbar`, `.tmp-toolbar-actions`, `.tmp-button`: WebView shell top bar and icon buttons.
- `.tmp-settings`, `.tmp-field`, `.tmp-select`: device settings card.
- `.tmp-stage`, `.tmp-frame`, `.tmp-viewport`: preview background, preview card, and iframe viewport.
- `.tmp-host-chrome`, `.tmp-island`, `.tmp-capsule`: dynamic island and mini app capsule placeholders.
- `.tmp-loading`, `.tmp-toast`: loading and toast overlays.

Do not edit the JavaScript shell lifecycle in `src/lib.rs` for styling changes. That code creates the shell, finds the TapTap game iframe, and mounts it into `.tmp-viewport`.
