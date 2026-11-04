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

## Third visual candidate: Yonghe, entry-relative layout in the continuous mine

### Sources actually read, and story boundaries

Read the current Notion [Yonghe place entry](https://app.notion.com/p/96fc1a4047de44fe8d4cb62c5b61c621), [mine/Yonghe discussion summary](https://app.notion.com/p/3fcb138d1e11817ea09ff236221dc6bd), [implementation/history plan](https://app.notion.com/p/3fcb138d1e1181aab86dd35e9594daca), current `commercialCafeStory.ts` and the historic `243c007:src/center/runtime/yongheSurvey.ts`/scene model. The Notion entry contains an explicitly labelled excerpt/summary of the uploaded old 修杰3; this run did not reopen the original 世界 archive. The current decisions supersede the old left-hand front door/top rear door and open-back-alley story. No owner identity, new dialogue, Chen rumour, evidence, survey conclusion or open rear route is introduced.

Historic four observation categories are tables, counter/stove, central aisle and locked rear door. Their old entity identities and preview descriptions are reused. **The current integrated base no longer contains `yongheSurvey.ts` or its Page coordinator.** This visual trial does not claim to restore survey completion counting. It leaves all old scene-state fields intact and adds no new survey progress writes; reconciling the old saved survey namespace/count is a later technical compatibility item, alongside the already confirmed mine room-identity migration blocker.

### What the picture means

The front door is on the right, so an arriving person faces left. Their right-hand wall is the upper wall: menu is there. Their left-hand wall is the lower wall. Two tables along each wall provide four two-person tables/eight indoor seats, with a136px physical character-edge aisle between the inner chairs. Ahead of the customer is a continuous vertical counter at localx224; behind it is the224px-deep kitchen. Stove and chopping board are separate actual two-character props, not decorative storage. The existing rear door moves down the same left wall to localy252, the left-hand back corner beside the stove. It keeps the same ID, locked access, no destination and display 门.

The front, room700×308 wall-center bounds, mine depth/width/street and other shops do not move. The counter is16glyphs at16px pitch,y16…256; its16×256 physical body is exactly their visible cell union. Its upper end meets the wall, so an11/16px actor cannot use a nominal upper gap. The lower end leaves approximately36px between body and the actual inside wall edge for the employee entry. A role-only kitchen permission region follows the real work side; it is not a physical invisible counter. Static anonymous worker 人 has no owner identity or commerce/dialogue AI.

The historical two outdoor groups are restored using their old IDs at local(742,84) and(742,252),42px outside the facade and on opposite sides of the front door at localy168. Both entire groups stay within this shop's y0…308 frontage. They remain on the wall side of the168px lane; the lane centre is84px outward, beyond their physical extent. No table is moved to the pharmacy or road centre. The current empty-shell base contained neither outdoor group, so this is a restoration of the two historical groups into the new frontage, not a claim that the old numeric positions were preserved. Outdoor chairs are now usable under the latest chair-interaction instruction; the old analytics expectation excluding them was changed to require their interaction keys, not deleted.

### Files and specific behavior

- `yongheInteriorTrial.ts/trialYongheInterior`: only the two mine IDs receive this post-alignment trial. Builds four original indoor table/group IDs and two original outdoor groups,32×16 text-sized tables/chairs,22px table-to-chair centre difference and positive6px gaps. No whole-group air wall. Menu is a real upper-wall content feature with a legal floor contact atlocal(616,28). Only three original observation descriptions plus the original locked-door observation are reused; no full old novel scene is activated.
- Replaces the sole existing rear `wallOpenings` source at the new corner and sets `doorFlankCount:0`. The old centre atlocal(0,168) is again an ordinary wall glyph/collision with no passage ID, rather than an invisible old door. New rear physical doorway is one28px grid cell; it remains locked. The old84px flank reservation is not carried into the corner.
- The original front portal retains its ID/room endpoints/permissions; its obsolete empty-room transition caption becomes 进入永和小馆. No cross-scene loading or teleport is introduced.
- `mainlineSceneModel.ts` applies this data function only after mine grid alignment; no generic renderer, movement, seating or save handler change. Prior Cafe4206 and takeaway4208 frozen packages remain unchanged.
- `tests/yongheInteriorTrial.test.ts`: both mine IDs check menu direction,4tables/8indoor seats, new locked rear position, old centre ordinary visible wall/no passage, all12indoor/outdoor seat routes, blocked6px gaps for11/16px bodies, menu/front-door approaches, exterior frontage ownership/clear door normal, public/staff region distinction and worker-to-public/locked-rear routes. Upper counter closure is tested with staff access so role permissions cannot disguise a physical gap.

### Actual running candidate and evidence

Final isolated candidate **http://127.0.0.1:4211/?scene=yonghe-mining-perimeter**, PID37360 at creation, `.tmp/yonghe-layout-counter-joined-dist`. Intermediate4209/4210 are not the final handoff. JS `index-BJx0VcSW.js`850496bytes/SHA256 `5b77ed93b6b1639aa650419ae763075c1f1d29c7564f08f69e014a76f1f5095d`; CSS `index-CGh3wNIs.css`200573bytes/SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`. HTML/JS/CSS readback HTTP200, bytes/hash match.

Actual Chrome1920×1300, five fresh isolated contexts on final4211:

- `full-room.png`: actual room screenshot clipped from real viewport; visually inspected. `entry.png`: actual front-door-side camera. `outdoor-connection.png`: true exterior connection with both tables and the industrial-side road. No fabricated montage or injected movement.
- Real upper-wall menu click walks to the legal inside-wall contact and shows the preview description. The first internal attempt used a floor-object selector for this wall feature and timed out; the corrected script uses its actual accessible button, no runtime input fix or test bypass.
- Real front-door clicks exit to(46.0005,46.889) and return to(34.0005,46.889), with the same scene/world ID.
- Indoor yonghe-upper-left-group-chair-bottom and outdoor yonghe-outdoor-chair-1-bottom each accept a normal click, set the actual protagonist seat attribute, and clear it after a normal open-floor click. These are two browser samples, not twelve actual sit/stand runs.
- Clicking the actual rear door leaves the protagonist unchanged and shows 后门目前无法通行. No rear traversal.
- All five contexts had zero pageerrors; browsers closed. Full traces and PNGs `.tmp/yonghe-layout-counter-browser/results.json` and sibling files.

22/22 focused checks across the four-shop trial tests plus analytics catalog; typecheck, isolated build and diff-check pass. Existing chunk warning remains. Not full-suite acceptance, physical mobile/Safari, dynamic employee operation, all-seat real input, complete survey progress compatibility, old mine/furniture-position migration or author aesthetic acceptance. The static worker routes use the real16px body and permissions, but no new worker operating simulation has been built.

### Known review follow-ups deliberately not mixed into this picture phase

Parent Cafe QA confirms7free chairs sit/stand, but the original Lao Zhou chair stays unavailable after he leaves because `nextMainlinePlayerSeatId/isMainlineSeatAvailable` still rebuild static occupancy. Also cafe-floor-server remains blocked on the new first-table service task; coffee-owner delivery success is not floor-server success. These are confirmed pending C technical fixes; this report does not call all8Cafe seats usable or service fully passed. Two-tea external reviews request a shorter milk-tea rear return and a closer fruit cutting/packing grouping; keep4208's reviewed images frozen and apply those minimal changes in a new phase. Mine layout-version/room-identity migration and B test-contract reconciliation remain pending. Public publication is still denied awaiting direct author authorization; no push or public switch occurred.

## Fourth visual candidate: minimum tea-shop review adjustments,4214

Parent subsequently independently passed the two narrow Cafe runtime fixes in4213 (live seat release and rendered-label movement footprint). The exact runtime diffs/results are in `2026-10-21-cafe-runtime-trial-fixes.md`; do not read the preceding historical pending notes as their latest status. Cafe's reviewed geometry itself is unchanged. This stage adjusts only two tea-shop data plans and their character-cycle construction. Original4208 and all other frozen ports stay unchanged.

### What changed and why

Read the actual external-review handoff `E:/NewTone-Preview/reviews/takeaway-review-handoff-2026-10-21.md` before editing. Keep both room336×700 envelopes, distinct shapes, actual front/rear doors, no seating/internal warehouse/toilet,16font/furniture pitch,28wall grid and existing scale.

- Milk-tea: keep the entire right longitudinal counter atx224,y112…560. Its rear return shrinks from7glyphs/112px body to2glyphs/32px body at(208,560),(192,560), removing80px of unexplained projection into the customer area. Same pickup marker movesy448→528, near this short finishing end. The trial's former full-width rear140px staff-only region is removed; only the actual right work lane remains staff-only. The open rear turning floor is not represented as an invisible internal warehouse. The real rear door remains locked. A16px worker can leave the work line around the actual counter end and approach its inside threshold.
- Fruit-tea: keep the short left L and all customer stations. Cutting moves(224,168)→(224,224); packing(224,252)→(224,280). Centre distance84→56px. Actual shared text-footprint packing bottom to counter top is about38.4px, leaving room for a16px worker instead of intersecting the service bar. Wash and cold-store positions remain unchanged; no wall or opening is added to create a shortcut.
- Counter elbows: the runs already meet at16px spacing without duplicating their corner glyph. New optional `glyphOffset` continues the 柜/台 cycle around each elbow, so two repeated label starts do not visually suggest a double corner. Bodies remain the exact visible16px cell union and only touch at their shared edge; no positive-area body overlap or invisible extra mass.

Only `shopInteriorTrial.ts/TakeawayTrial`, `buildTakeawayTrial`, `trialTakeawayInteriors` change runtime behavior. No commerce, story, phone ordering, global renderer, Cafe/Yonghe layout or save migration change. Menu/order/pickup still provide short inspections, not newly invented beverage actions. Anonymous workers remain static in the running visual prototype.

### Evidence: customer uses normal input, worker route uses the actual model adapter

Final candidate **http://127.0.0.1:4214/?scene=commercial-street**, PID1492 at creation, `.tmp/takeaway-review-adjusted-dist`. JS `index-BE5Vg_AL.js`850542bytes/SHA256 `f240ea2db45021f348769c802032d45e7ce4188e10bc94de2723e238af755f5d`; CSS `index-CGh3wNIs.css`200573bytes/SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`. HTML and both resources read backHTTP200, bytes/SHA match.

Real Chrome1920×1300, four fresh isolated contexts: each full-room shot, then each complete road→true front door→order inspection→dismiss reading normally→pickup inspection→dismiss→true front door→street journey. No movement injected. Each fixture begins at the real door's public-safe road point; the first fruit point is the approved+8 offset, not the old overlapping patrol point. The isolated fixture marks the unrelated question-mark narrative complete solely to focus this layout flow; it is not a new-game or whole-plot claim. No pageerrors.

Milk actor:(92.2083,59.1109)road→(92.2083,73.1109)inside→(94.3619,82.6665)order→(94.3619,116)pickup→(92.2083,61.1109)street. Fruit:(22.2083,41.4072)road→(22.2083,27.4072)inside→(20.9583,1.0135)order→(25.9583,1.0135)pickup→(22.2083,39.4072)street.251+239=490actual actor samples have zero overlap against the real counter/equipment rectangles using the11px body (allowing.02reference-pixel DOM-coordinate rounding). This check is not an exhaustive dynamic-NPC/wall/performance claim. `.tmp/takeaway-review-adjusted-browser/results.json` contains the full input sequence and samples; browsers closed.

Employee evidence is explicitly a **model execution**, not a video of new working AI. `takeaway-review-worker-routes.mjs` and committed `tests/takeawayWorkerOperationRoutes.test.ts` instantiate the existing `createNpcMovementAdapter`/free-roam controller, real16px label body, role permissions and live occupancy registry. They execute milk tea/sealing/washing operation-side contacts→inside handoff→locked rear inside threshold→work return (6legs/218samples); fruit cold-store→wash→cut→pack→inside handoff→locked rear threshold→return (7legs/305samples). All13legs actually complete their movement callbacks and523sampled model positions remain legal; no counter passage or teleport exemption. Paths/samples `.tmp/takeaway-review-worker-routes.json`. The fruit wash/cut route goes around the L's existing open upper end, not through it.

`tests/takeawayReviewAdjustment.test.ts` checks32px milk end/same pickup ID, removed unjustified rear region/locked door, fruit56px preparation spacing/actual packing-to-counter clearance, unique corner glyphs and edge-only counter-body contact. Combined with worker execution and existing takeaway/body/seat regressions:17/17; typecheck/build/diff-check pass, existing chunk advisory remains. No whole-suite claim.

### New pictures, old versions preserved

`.tmp/takeaway-review-adjusted-browser/` contains **milk-tea-full-room.png, milk-tea-entry.png, fruit-tea-full-room.png, fruit-tea-entry.png**, both `*-counter-corner.png`, order/pickup-contact and exit frames. They are actual viewport captures/crops; both full rooms and corner images were visually inspected. Visible character strokes do not cover each other in the two captured elbows. No old4208 evidence was overwritten and no Library upload was retried. Parent can send these as a distinct review version.

Author/independent review of this revision, phone/Safari, real autonomous employee operation, full phone order/fulfillment and old-position compatibility remain untested. Mine old-save room identity is still a confirmed blocker; B contracts/full suite and historical Yonghe survey counting remain pending. Yonghe's normal visible abstract观察 label is deliberately unchanged: removing it or adding outside-world查看周围 is an author expression choice, not authorized as part of this data adjustment. No push or public publication.
