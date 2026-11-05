# Announcement-return test premise correction

Only test/docs changes on f5b7be09e92675ecfe578806afc4f216e11e1e50. Announcement entry deliberately unmounts Landing controls, so returning creates a new Start surface. The previous short-updates-return called the expansion-specific same-DOM assertion and failed despite a valid new button. No product code changed to satisfy the test.

The assertion helper now optionally omits ONLY old DOM identity for that one announcement-return call. All expansion/confirmation/repeated Start/cancel/Escape calls retain same-node assertions. Visible label, full frame/text progress, original Start-slot and Updates anchor coordinates remain checked at announcement return. Enabled and scrollTop0 are explicit; a new identity baseline is recorded before reopening choices. Full persistence snapshot equality, actual Continue and scene/cover-clear assertions remain unchanged. No skips, timeout increase or swallowed assertion.

src/ tracked file raw bytes were hashed before/after this patch and are identical; product Git diff against f5b7 is empty. Exact product tree/count/raw aggregate are in entry-return-test-product-identity.json. This allows Terra to prove use of its existing f5b7 product build rather than rebuild. Supplied existing dist aggregate13files:1dbb5727ecb03156014042893df4622edc06808db49cf4dc25fe15c85aee4e1f; this worker does not claim to have rerun it.

Parse-only and diff checks only; no test/build/service run. Terra can rerun only the375 Chromium touch case, preserving existing PC/390/121/menu/type/build evidence, and finish the previously unreached Continue step. Keep original failure artifacts. No server/preview/staging/main/push/deploy changes. Stop after commit for independent review.
