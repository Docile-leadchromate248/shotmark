# Release TODO

## Console Usage Audit

- [ ] `stories/Shotmark.stories.tsx`: example snippet includes `console.log(res.image)` (docs snippet only, not runtime).

## Behavior Verification Before Release

- [x] Verify `1~9` tool hotkeys in Storybook `KeyboardShortcutsLab` with both top-row digits and numpad.
- [x] Verify default download filename when `fileName` is empty.（`stage.download-name.test.ts` 覆盖）
- [x] Verify custom `fileName` still overrides default naming.（同上测试覆盖）
