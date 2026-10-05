# Original Book artwork

## Public visuals refresh

Generated with the built-in imagegen tool from text only. No reference images, household photographs, private scenes, real identities or franchise characters were inputs. The guide is saved at `actors/guide-map.webp` with its original alpha; the castle painting is saved at `bg/castle-garden.webp`. Both are metadata-free lossless WebP encodings. `docs/showcase/showcase-art.mjs` selects this art only for the memory-only fictional demo; it maps the explorer to the original fox and removes child stand-ins from the authored chapter. Puzzles and layout come from the current public player, not an image generator. The guide occupies about 40% of a landscape story frame.

Exact guide prompt:

Use case: illustration-story. Asset: transparent full-body cutout for an actual painted adventure game.
Create one wholly original fictional adult woman explorer, about 55, richly painted with fine traditional gouache and watercolor brushwork, believable expressive anatomy, warm copper-brown skin, long silver hair in a loose braid, kind intelligent face with subtle laugh lines, muted forest-green long field jacket, cream linen shirt, russet trousers, weathered leather walking boots, small satchel. Full body in a lively natural three-quarter action pose: weight on one leg, other knee bent forward, torso turning toward the LEFT, one arm reaching invitingly with an open hand toward a discovery at upper left, other hand holding an unfolded parchment map near her waist. Warm delighted expression, relaxed fingers, moving jacket hem. Face small relative to body, no huge cartoon head. Sophisticated illustrated children's book with luminous warm reflected sunlight and rich fabric texture, polished traditional painting, no 3D rendering, no stiff straight-on standing, no stick figures, no chibi style. Entire body including boots, generous clear transparent margins. True transparent background, no backdrop or ground, no text, no logo, no real person or franchise resemblance. A single character only.

Castle prompt (generic architectural exclusions condensed):

Use case: illustration-story. Asset: a complete background painting for a real interactive fantasy story game, wide landscape composition, 16:9.
An original magical ivy-covered stone castle entrance in a forest, viewed close enough to see warm sandstone texture, lichen, intricately carved oak double doors with brass hinges and three plain round brass medallions. Door opening bounding rectangle centered across the top half (x 36% to 64%, y 4% to 46%), large stone arch surrounding it. No people or animals anywhere. Rich, sophisticated traditional gouache and watercolor illustration, luminous warm late afternoon light, fine leafy brush textures, natural layered depth, professional illustrated storybook.
The LOWER HALF must be a richly painted near foreground, not a vast empty flat field: fern fronds and bluebell clusters sweeping in from both bottom corners, a mossy stone ledge and flowering vines along left side, leafy shrubs and an ancient tree root at lower right, wildflower beds with daisies and orange poppies along a gently curved walkway. The sunlit walkway is modest and walkable across the central portion of the lower half with visible irregular flagstones and tiny sprigs between them, never an empty sandy courtyard. Foreground leaves large and detailed, midground flowers softer, castle behind crisp; ample central standing room in bottom center. Door and its three medallions unobscured; neither flowers nor roots cover it. Atmospheric and beautiful, hand painted, no 3D rendering, no cartoon vector shapes, no text, no signage, no flags with logos, no people, only invented fantasy architecture, with no resemblance to any real private place. This is wholly imagined fantasy castle architecture.


The painted cutouts and seven scene pairs are original AI-generated project artwork. They are not family photographs, traced identities, licensed franchise characters or third-party illustrations. No household character assets or real personal objects are distributed. The internal actor IDs remain compatible: `hero` is a boy, `bo` his older sister, `grown-up` a guide, and `pip` a plush fox.

## Fictional cutouts v2 — superseded

The initial standing/arms-up studies were replaced by v3. These original prompts record the earlier provenance.

### Initial prompts — October 3, 2026

Generated with the built-in image generation tool. Real household pictures were never supplied as generation inputs. Cheer variants used only the newly generated fictional idle cutout as their edit reference. Transparency is real alpha, preserved when encoding metadata-free WebP. The library records the actual encoded size and aspect ratio of every pose.

Prompt set:

- **Shared style:** one full-body transparent cutout for a painted children's storybook game; warm gouache/watercolor, softly modeled faces and fabric, visible brush texture, natural proportions, entire body/feet, centred with transparent margins; no backdrop, ground plane, text, logos or franchise likeness.
- **hero / idle:** wholly fictional curious boy about seven, olive skin, dark curly hair, round glasses, teal jumper, ochre shorts and brown hiking shoes; relaxed standing with a curious smile.
- **bo / idle:** wholly fictional older sister about nine, warm brown skin, chestnut twin braids, rust-orange dungarees over a cream shirt, olive shoes; relaxed standing with a confident smile.
- **grown-up / idle:** wholly fictional friendly adult guide, dark brown skin, short curly black hair, lavender shirt, dark blue trousers and tan walking shoes; relaxed standing with a welcoming smile.
- **pip / idle:** original cuddly plush fox, burnt-orange felt, cream muzzle/belly/tail tip, button eyes and stitched smile; seated with paws on belly; no clothing or franchise resemblance.
- **Each cheer edit:** preserve the fictional identity, clothing, colours and paint style of the supplied idle image; change only pose to happy cheering with both arms/paws raised, retaining the full body and transparent margins.
- **treasure-chest:** original antique wooden chest with brass bands/latch, lid open, golden coins and rolled parchment inside; gouache/watercolor, three-quarter front view, entire chest centred on transparency; no people, labels, gifts, wrapping or brands.

## Painted scenes

The following original project paintings were selected individually and visually inspected in both orientations: castle gate, castle forest, chess courtyard, volcano, pirate ship at a river dock, treehouse town and soccer pitch. Only these fourteen files and their layout entries were transferred. They contain fictional places and generic scenery; no household-specific objects. The castle door bounds and volcano target rectangles belong to the paintings themselves.

Artwork provenance does not change the repository's software licensing or introduce a blanket project licence. Third-party components retain their own notices in `THIRD_PARTY_NOTICES.md`.

## Fictional action cast v3

Generated with the built-in image generation tool, using only the public castle-gate painting and newly generated fictional cast studies as style references. Four six-pose studies were reviewed. The guide's reaching candidate was rejected for crossing a sprite boundary; five guide poses and six poses for each other character were selected. Hands, faces and complete bodies were inspected. Transparent-alpha sprite extraction removes unrelated fragments and prepares metadata-free WebP; it does not redraw the paintings. The `idle` aliases use a natural walk/carry pose for compatibility.

Final prompt set:

- **Shared:** illustration-story, production sprite sheet, true transparent alpha, three columns by two rows, separated full bodies with generous gutters. Fine textured hand-painted gouache matching the original castle's sunlight, soft edges, fabric detail, warm reflected light, natural anatomy and expressive faces. Three-quarter views, full hands and feet. No photographs, real identities, scenery backing, text, labels, watermarks or franchise resemblance.
- **Guide:** wholly fictional adult woman, dark brown skin, short curly black hair, lavender rolled-sleeve shirt, indigo walking trousers, tan hiking boots and an unbranded cloth backpack. Walking, pointing diagonally toward the door, reaching for a key (rejected), kneeling to point at a stone, carrying an unmarked map, and cheering with one arm lifted and the other on her heart.
- **Explorer:** wholly fictional boy about seven, olive skin, dark curls, round glasses, teal jumper, ochre shorts, brown hiking boots and an unbranded backpack. Walking, pointing toward an opening, kicking a generic football, kneeling to count, carrying a rolled unmarked parchment, and cheering with one fist raised.
- **Sister:** wholly fictional girl about nine, warm brown skin, chestnut twin braids, rust-orange dungarees over a cream shirt, olive boots and an unbranded backpack. Walking, pointing, reaching, kneeling to count on her fingers, carrying an open unmarked map, and cheering with one hand raised.
- **Fox:** one original burnt-orange felt companion, cream muzzle/belly/tail tip, small sewn eyes, embroidered smile, rounded ears and visible stitching. Walking, pointing, reaching toward a star, kneeling beside a generic stone, carrying a rolled parchment, and cheering with one paw raised. No clothing, rainbow colours, hedgehog design or familiar franchise likeness.

Authored scene composition chooses poses, foot positions, relative size and gaze direction. The standing guide occupies 40% of the landscape frame height. Scene-specific celebration retains the guide's pointing and sister's map-carrying poses while the explorer reacts. Soft CSS contact shadows ground the figures; overlapping depth follows their foot positions.
