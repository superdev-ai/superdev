# Third-party notices

Superdev itself is Copyright 2026 Rahul Retnan, licensed under the Apache
License 2.0. See `LICENSE` for the terms and `NOTICE` for the attribution
notice that accompanies them.

This file exists because Superdev redistributes other people's code. The
control center is compiled from `ui/` into a single committed file,
`src/service/assets/control-center.html`, and that file is a compiled copy of
React, Radix UI, xyflow, lucide, cmdk, dagre, zustand, d3 and the rest of the
interface dependency tree. The bundler strips upstream comments, so a search
for the word "copyright" inside that file returns nothing. MIT, ISC and
BSD-3-Clause all require the copyright notice and the permission notice to
travel with copies, including compiled copies. This file is where they travel.

The notices below cover:

- `src/service/assets/control-center.html`, which is tracked by git.
- Any package assembled from this tree, including the standalone package built
  by `scripts/package/build-standalone.mjs`, which copies the same file.

They do not cover `node_modules`. That directory is git-ignored, is installed
by the consumer's own package manager from the public registry, and carries
each package's own licence file as published.

## How this list was produced

The list is the production dependency tree of `ui/`, taken from
`npm ls --omit=dev --all` in that directory, with each package's `license`
field and the copyright lines from its own licence file. Type-only packages
(`@types/*`, `csstype`) are excluded because they contribute no code to the
bundle. `tailwindcss` is a dev dependency of `ui/`, but its generated CSS is
part of the bundle, so it is listed.

Re-derive the list with the same command after any change to `ui/package.json`.

## MIT

The following packages are distributed under the MIT licence. The copyright
holder for each is listed; the permission notice follows once, because the text
is identical for all of them.

| Package | Version | Copyright |
| --- | --- | --- |
| @floating-ui/core | 1.8.0 | Copyright (c) 2021-present Floating UI contributors |
| @floating-ui/dom | 1.8.0 | Copyright (c) 2021-present Floating UI contributors |
| @floating-ui/react-dom | 2.1.9 | Copyright (c) 2021-present Floating UI contributors |
| @floating-ui/utils | 0.2.12 | Copyright (c) 2021-present Floating UI contributors |
| @radix-ui/number | 1.1.3 | Copyright (c) 2022 WorkOS |
| @radix-ui/primitive | 1.1.7 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-arrow | 1.1.15 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-collection | 1.1.15 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-compose-refs | 1.1.5 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-context | 1.2.2 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-dialog | 1.1.23 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-direction | 1.1.4 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-dismissable-layer | 1.1.19 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-dropdown-menu | 2.1.24 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-focus-guards | 1.1.6 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-focus-scope | 1.1.16 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-id | 1.1.4 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-menu | 2.1.24 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-popover | 1.1.23 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-popper | 1.3.7 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-portal | 1.1.17 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-presence | 1.1.10 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-primitive | 2.1.10 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-progress | 1.1.16 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-roving-focus | 1.1.19 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-scroll-area | 1.2.18 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-select | 2.3.7 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-separator | 1.1.15 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-slot | 1.3.3 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-switch | 1.3.7 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-tabs | 1.1.21 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-tooltip | 1.2.16 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-use-callback-ref | 1.1.4 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-use-controllable-state | 1.2.6 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-use-effect-event | 0.0.5 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-use-is-hydrated | 0.1.3 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-use-layout-effect | 1.1.4 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-use-previous | 1.1.4 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-use-rect | 1.1.4 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-use-size | 1.1.4 | Copyright (c) 2022 WorkOS |
| @radix-ui/react-visually-hidden | 1.2.11 | Copyright (c) 2022 WorkOS |
| @radix-ui/rect | 1.1.3 | Copyright (c) 2022 WorkOS |
| @xyflow/react | 12.11.2 | Copyright (c) 2019-2025 webkid GmbH |
| @xyflow/system | 0.0.79 | Copyright (c) 2019-2025 webkid GmbH |
| aria-hidden | 1.2.6 | Copyright (c) 2017 Anton Korzunov |
| classcat | 5.0.5 | Copyright (c) Jorge Bucaran |
| clsx | 2.1.1 | Copyright (c) Luke Edwards (lukeed.com) |
| cmdk | 1.1.1 | Copyright (c) 2022 Paco Coursey |
| dagre | 0.8.5 | Copyright (c) 2012-2014 Chris Pettitt |
| detect-node-es | 1.1.0 | Copyright (c) 2017 Ilya Kantor |
| get-nonce | 1.0.1 | Copyright (c) 2020 Anton Korzunov |
| graphlib | 2.1.8 | Copyright (c) 2012-2014 Chris Pettitt |
| lodash | 4.18.1 | Copyright OpenJS Foundation and other contributors, based on Underscore.js, copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters and Editors |
| react | 19.2.8 | Copyright (c) Meta Platforms, Inc. and affiliates |
| react-dom | 19.2.8 | Copyright (c) Meta Platforms, Inc. and affiliates |
| react-remove-scroll | 2.7.2 | Copyright (c) 2017 Anton Korzunov |
| react-remove-scroll-bar | 2.3.8 | Anton Korzunov (see "Unresolved" below) |
| react-style-singleton | 2.2.3 | Copyright (c) 2017 Anton Korzunov |
| scheduler | 0.27.0 | Copyright (c) Meta Platforms, Inc. and affiliates |
| tailwind-merge | 3.6.0 | Copyright (c) 2021 Dany Castillo |
| tailwindcss | 4.3.3 | Copyright (c) Tailwind Labs, Inc. |
| use-callback-ref | 1.3.3 | Copyright (c) 2017 Anton Korzunov |
| use-sidecar | 1.1.3 | Copyright (c) 2017 Anton Korzunov |
| use-sync-external-store | 1.6.0 | Copyright (c) Meta Platforms, Inc. and affiliates |
| zustand | 4.5.7 | Copyright (c) 2019 Paul Henschel |

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## ISC

| Package | Version | Copyright |
| --- | --- | --- |
| d3-color | 3.1.0 | Copyright 2010-2022 Mike Bostock |
| d3-dispatch | 3.0.1 | Copyright 2010-2021 Mike Bostock |
| d3-drag | 3.0.0 | Copyright 2010-2021 Mike Bostock |
| d3-interpolate | 3.0.1 | Copyright 2010-2021 Mike Bostock |
| d3-selection | 3.0.0 | Copyright 2010-2021 Mike Bostock |
| d3-timer | 3.0.1 | Copyright 2010-2021 Mike Bostock |
| d3-transition | 3.0.1 | Copyright 2010-2021 Mike Bostock |
| d3-zoom | 3.0.0 | Copyright 2010-2021 Mike Bostock |
| lucide-react | 0.545.0 | Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025. |

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

Portions of lucide-react derive from Feather, under the MIT licence:

Copyright (c) 2013-2023 Cole Bemis

The MIT permission notice is reproduced in the MIT section above and applies to
those portions.

## BSD-3-Clause

`d3-ease` 3.0.1.

Copyright 2010-2021 Mike Bostock
Copyright 2001 Robert Penner
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the author nor the names of contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## 0BSD

`tslib` 2.8.1.

Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

## Apache-2.0

`class-variance-authority` 0.7.1, Copyright 2022 Joe Bell.

The full licence text is the same Apache License 2.0 reproduced in this
repository's `LICENSE` file. That package ships no NOTICE file, so section 4(d)
of the licence imposes no further obligation here.

## Vendored source

The 20 files in `ui/src/components/ui/` are derived from shadcn/ui. shadcn/ui
is distributed as source to be copied into a project rather than installed as a
package, so there is no dependency entry for it and no licence file in
`node_modules`. Its published terms are the MIT licence. The copied files carry
no attribution header today; see "Unresolved" below.

## The runtime dependency

Superdev's own runtime has one dependency, `@tursodatabase/database` 0.7.1,
which declares the MIT licence in its `package.json`. It is installed by the
consumer, not vendored into this repository and not embedded in any committed
artifact, so no notice from it is redistributed here.

## Unresolved

These are known gaps, recorded rather than papered over.

- `react-remove-scroll-bar` 2.3.8 declares the MIT licence in its
  `package.json` but ships no licence file, so no copyright line could be read
  from the package itself. It is authored by Anton Korzunov, the author of the
  sibling `react-remove-scroll` packages listed above.
- `ui/src/assets/logo.png` has no recorded provenance. No document in this
  repository states who made it or under what terms, and it is redistributed
  inside the committed bundle. This must be settled before the repository is
  published.
- No copyright holder is named for Superdev itself. The `LICENSE` file is the
  unmodified Apache text with the appendix placeholder intact. The Apache grant
  runs from the Licensor, so a downstream user cannot currently tell whose
  grant they hold.
- This file is maintained by hand. Nothing in `npm run validate` checks it
  against `ui/package.json`, so it can fall behind a dependency change without
  failing a gate.
