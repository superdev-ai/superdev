# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The CLI and the plugin share one version. A release moves both.



# [0.3.0](https://github.com/superdev-ai/superdev/compare/v0.2.1...v0.3.0) (2026-07-28)


### Bug Fixes

* judge a check by containment, and never leave an active task unowned ([1a5a18a](https://github.com/superdev-ai/superdev/commit/1a5a18a50abbf7210368aa49fcb7892d6d1879c3))


### Features

* merge a duplicate task into the one that keeps the work ([7767d08](https://github.com/superdev-ai/superdev/commit/7767d08679dea6382928deb1c962e618aafd69fc))

## [0.2.1](https://github.com/superdev-ai/superdev/compare/v0.2.0...v0.2.1) (2026-07-28)


### Bug Fixes

* **hooks:** call work untracked only when it is newly changed ([3dff172](https://github.com/superdev-ai/superdev/commit/3dff172ae4d05efbcc1b521de0a8365b028b2a45)), closes [hi#severity](https://github.com/hi/issues/severity)
* **service:** say whose port it is, and stop claiming the reader is blocked ([a85ff39](https://github.com/superdev-ai/superdev/commit/a85ff39bbc5aaae2bc9b947e144ab74d670dbfe2))

# [0.2.0](https://github.com/superdev-ai/superdev/compare/v0.1.2...v0.2.0) (2026-07-28)


### Features

* make a readiness area settleable, and its warning honest ([943d7cf](https://github.com/superdev-ai/superdev/commit/943d7cf29ab5f05ef44086644f9a44a4cbf89cab)), closes [hi#severity](https://github.com/hi/issues/severity) [hi#severity](https://github.com/hi/issues/severity)

## [0.1.2](https://github.com/superdev-ai/superdev/compare/v0.1.1...v0.1.2) (2026-07-28)


### Bug Fixes

* repair eight defects a first-run report found, and gate three of them ([659d576](https://github.com/superdev-ai/superdev/commit/659d576ff3bda764f760d890c15e6004a1c95a6d))

## [0.1.1](https://github.com/superdev-ai/superdev/compare/v0.1.0...v0.1.1) (2026-07-28)


### Bug Fixes

* **check:** tell a corrected Docs skill apart from a drifting one ([3732538](https://github.com/superdev-ai/superdev/commit/37325385b810eb81845d119653a570544d538ed1))
* **cli:** dispatch when run through a symlink, which is how npm installs a bin ([70ddfca](https://github.com/superdev-ai/superdev/commit/70ddfca73102806f0d5792ef71d9072ee7dfce60))
* **release:** stop the dry run leaving the version bumped ([bd38998](https://github.com/superdev-ai/superdev/commit/bd38998fd852ad8c3c4475350b574b7806ac9dc7))
* **skills:** stop the docs skill pointing at an engine that was deleted ([436a150](https://github.com/superdev-ai/superdev/commit/436a15000d425abfb311a0489f84e5fb167f4554))
