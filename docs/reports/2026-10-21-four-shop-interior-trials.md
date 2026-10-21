# Four-shop interior trials — Cafe first visual candidate

This is an isolated author-review prototype, not a public release. It includes B53a7461 and the mining d674025 changes, integrated as 2cfd6f4. Public remains bae6afb; the A publication denial remains in force. Milk-tea, fruit-tea and Yonghe layouts have not yet changed in this first candidate.

## What the Cafe picture now does

The 672×700 reference-pixel wall-center envelope and its front/warehouse doors stay in place. Enter at the lower left. A vertical counter on the left and its rear return separate staff from customers. The employee walks behind the counter to the coffee machine or rear warehouse door; the customer walks around the front end into the middle. The right has four two-person tables, eight actual seats. The center reserves a 168px-wide clear standing/queue/dialogue strip, with a larger clear front turning area. These are trial dimensions for author review, not proof of realistic capacity or final layout acceptance.

The existing warehouse rear door stays locked. A separate customer-side toilet door is on the rear wall at local x560px, aligned to the existing28 grid. It also stays locked and only indicates the approved rearward toilet extension: no toilet interior or new story has been invented. No interior warehouse partition, storage decoration or fake employee door remains in the Cafe.

All Cafe actors display 人 in this trial. Their IDs, roles, original story lines and service duties remain. Lao Zhou retains commercial-cafe-right-window-upper-group-chair-top; Xiujie's dialogue chair retains commercial-cafe-right-window-upper-group-chair-bottom. That story pair is at the front-left of the four right-side table groups. Other rooms and street pedestrians retain their labels.

## Actual code changes

- `shopInteriorTrial.ts/trialCafeInterior`: runs after grid alignment and the existing continuous-Cafe story binding. Replaces only this room's old floor furniture/groups and old Cafe continuous counter bodies; keeps every other storefront's furniture. Four tables are centered at local reference pixels(448,196),(588,196),(448,448),(588,448). Two-character tables/chairs occupy32×16px, using the existing shared text footprint for movement. Chair centers are22px from their table: a positive6px gap, smaller than the11px player and16px actor bodies. No group-wide invisible obstruction is added.
- The counter is made of individual16px 柜/台 glyphs. Its vertical run has29 cells at x168,y112…560; the horizontal return14 cells at y112,x184…392, without duplicating the elbow. Physical bodies equal the union of those visible16px cells (vertical16×464px; return224×16px), instead of retaining the old wider authored anchor collision. Only the service glyph keeps the existing cafe-order action; order/pickup markers face the customer strip.
- The existing Cafe-only staff permission region is relocated to the actual work side, plus the rear return area. It does not add a physical wall. Service/prep/ambient/floor-server point IDs are retained and moved with the layout. Coffee preparation and narrative state machines are unchanged.
- The toilet portal clones the existing locked rear-door mechanics at a separate28-grid anchor, with its own single-source opening. The warehouse portal's coordinates/access are unchanged. The toilet is explicitly unavailable, not an open route to unbuilt space.
- `mainlineSceneModel.ts`: applies this trial to commercial-street after `bindContinuousCafe(alignSceneBlueprint(...))`. No renderer, projection, font, wall spacing, global navigation, story dialogue or other shop layout change.
- `tests/cafeInteriorTrial.test.ts`: four targeted checks:4tables/8seats and legacy identities;32×16text footprint; all8seats reachable from the public central space;11/16px actors cannot cross the6px gaps; clear central samples and front-door approach; legal warehouse/toilet locked and old fake employee door absent. The shared footprint rounds percentages to4decimals, so pixel assertions allow <.005px rounding, not layout drift.

## Real browser evidence

Frozen local candidate http://127.0.0.1:4206/, `.tmp/cafe-layout-first-dist`, PID37552 at creation. Chrome isolated contexts1920×1300, actual unchanged device scale1.09713 from the shared formula. No injected movement or real user storage. Seeded isolated completed-progress saves only position the camera inside for layout inspection.

- `.tmp/cafe-layout-browser/full.png`: full viewport; `full-room.png`: screenshot clipped to the actual projected room plus28px margins, not an assembled diagram. Visually inspected: left counter, four right tables and center floor are visible.
- `entry.png`: actual near-front camera view; normal door click exits to(122.833,39.4072), second click re-enters to(122.833,27.4072). `exit.png` and `reentry.png` retain evidence.
- `seated.png`: normal click on cafe-trial-table-group-1-chair-bottom results in the actual protagonist seat data attribute. Normal central-floor click clears the seat and walks to(135.959,.999807); `standing.png`.
- `results.json`: input outcomes/NPC positions/errors. All three contexts had no pageerror; browsers closed.
- 4/4 targeted tests pass; `tsc --noEmit`, isolated Vite build and diff-check pass. Existing large-chunk warning remains.

## Frozen resources

JS `index-DRYpqNiK.js`,842401bytes,SHA256 `89a05df0d9a3ca482cae460697046c30912ef4526711a040bb91464e2951c7e7`.
CSS `index-CGh3wNIs.css`,200573bytes,SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`.

## Pending, do not claim passed

Only one free chair's real sit/stand was exercised; all8have model reachability, not8browser interaction runs. No full coffee/narrative replay, phone path, arbitrary old-furniture-position migration, physical phone/Safari, full-suite or independent layout review has run for C. B's prior independent story validation cannot be represented as validating this rearrangement. Old Cafe room-local saved positions could now overlap a new prop and need a later explicit compatibility pass. Mining old-position migration and the first missing-wall paint incident remain pending. B has39new old-contract items and16inherited failures awaiting a fresh full run; it has not been rerun to establish a current55-failure total.

Library screenshot upload was already blocked at official-helper `prepare_uploads failed`; no IDs have been fabricated and no alternate write flow was used. Local actual screenshots are available at the paths above. No push, public replacement, main/staging/Vercel or real-save change.

## Second visual candidate: distinct milk-tea and fruit-tea takeaway layouts

Cafe4206 remains frozen. This new package is4208, `.tmp/takeaway-layout-inspect-dist`; it retains Cafe's same trial geometry but adds two other layouts. Both shops keep their336×700 wall-center envelope, original front/rear doors,28wall grid,16font/glyph spacing and existing device scale. No new toilet, interior warehouse or decorative door is added. Existing phone milk-tea state/app code is untouched.

### Milk-tea: long right work line, customers stay left

The front is the top of this room. A right counter at local x224 runs fromy112toy560, with a rear return extending left tox112. The16px glyph-union bodies are16×464 and112×16px. Ordering is near the entrance aty168, collection farther down aty448, so a person waiting to collect does not stand on the entry/order point. The left side and front turn stay empty. Menu is near the front-left. Behind the counter, tea machine/sealer/washing station are atx280, with a real16px anonymous worker at(264,392). The right work lane reaches the rear turning area and original locked warehouse door. No seats were retained in this narrow trial.

Existing milk-tea menu/order/pickup label IDs are retained. The former warehouse/kitchen fake door glyphs, partition runs, storage signs and table are removed from this room. Their old continuous collision bodies are removed too, not merely hidden.

### Fruit-tea: shorter left L, open front waiting floor

This room's front is at the bottom. It uses a short left return atx112,y112…336 and a service counter aty336,x128…272. Bodies are16×240 and160×16px. Customers enter into the open front half; order atx144 and pickup atx240 are side-by-side on the customer face rather than copied from milk-tea's long queue line. Preparation stays behind: wash to the left, fruit cutting and packing to the right, cold storage at the back. A16px anonymous worker at(168,252) has clear workspace and a path to the actual locked rear door. The original internal retail-storage partition/body is removed. There are no seats, internal warehouse or additional door.

This fruit-tea division is an explicit minimal takeaway-shop assumption, not an approved historical drawing or newly authored story. The anonymous workers in both rooms use existing noninteractive pedestrian actor staging, display 人, and have no commerce AI or new dialogue. Equipment has its existing shared text collision footprint, not fictional full-size appliance boxes; counters use only their visible16px character-cell union.

### Files, interactions and actual checks

`shopInteriorTrial.ts/buildTakeawayTrial` shares only the character/body construction and room-scoped replacement. `trialTakeawayInteriors` supplies the two different shapes, equipment arrangements, work regions and customer contacts. `mainlineSceneModel.ts` applies it after the unchanged Cafe trial. Role-only staff areas move with the work side; they are not new physical walls. Actual locked portals and their positions/openings are unchanged.

Interaction inventory: menu, order and pickup markers are clickable inspection contacts using existing generic exploration text. They do not place a new order, produce a beverage or create an inventory item. Equipment is physical scenery, noninteractive for customers; anonymous workers are noninteractive. True front doors work normally; rear doors retain locked feedback. Existing phone ordering is unchanged, not claimed revalidated here. An initial internal4207 build reached the contacts but showed no inspection text because `interactionText` alone is not an exploration pool; corrected4208 adds corresponding `explorationText` entries and real clicking now shows those existing generic text surfaces. No page interaction handler was rewritten.

11/11 targeted tests (Cafe4 plus takeaway7), typecheck/build and diff-check pass. Takeaway tests require empty seat/door-floor lists, no old partition bodies, both customer contacts and front-door approaches reachable, public denial of staff workspace, each16px worker's real path to its locked warehouse threshold, and every counter body exactly matching its visible glyph union. They do not represent full story or migration acceptance.

Actual isolated Chrome1920×1300, eight contexts on final4208: both shop full-room and entrance pictures; normal front-door exit/reentry; normal point/order and pickup clicks move to the proper public counter contact and show inspection text. No pageerror. Milk exit/reentry(92.2083,61.1109)→(92.2083,73.1109); fruit(22.2083,39.4072)→(22.2083,27.4072). Evidence `.tmp/takeaway-layout-final-browser/results.json`; pictures `milk-tea-full-room.png`,`milk-tea-entry.png`,`fruit-tea-full-room.png`,`fruit-tea-entry.png`, plus contact and door-roundtrip screenshots. Full-room images are clipped actual rendering, not schematic plans. Browsers closed after checks.

Resources: JS `index-DgY_mnyq.js`846444bytes/SHA256 `8c1875b644251c75a5f7a36bbb190571a731612f8c7bc7b40757aca53fe4d0d9`; CSS `index-CGh3wNIs.css`200573bytes/SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`.

Pending: author/realistic-layout review, mobile contacts, old furniture-position migration, full phone order/fulfillment and full-suite. Parent independent mining QA has now proved old saved positions can land in the wrong expanded shop (old Yonghe→shoe repair, old pharmacy→Yonghe); room-identity/version migration is a confirmed release blocker, not just a hypothetical. It will be a separate technical phase, not silently repaired here. Mine first missing-wall incident remains unassigned. Parent supplied mining image IDs: old libfile_d93783707a6c8191978b22e5598a7762, new libfile_ac31fc09547081918e75616a15191497, mobile libfile_c7a54ba51ba481918bc8b48d34a36448. These IDs are mining evidence, not this layout's images. No new Library upload was attempted after the earlier helper failure. Yonghe interior is next and not yet implemented. Public and all frozen prior ports remain unchanged; no push/publication.
