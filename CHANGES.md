Vertana changelog
=================

Version 0.1.2
-------------

To be released.

### @vertana/core

 -  Hardened the system prompt against context pollution by wrapping required
    context inside an explicit `<reference_material>` block and prepending a
    rule instructing the model not to translate, quote, or echo any of it.
    This significantly reduces the chance that large fetched reference pages
    are emitted as the translation [[#7], [#10]].

[#7]: https://github.com/dahlia/vertana/issues/7
[#10]: https://github.com/dahlia/vertana/pull/1


Version 0.1.1
-------------

Released on March 3, 2026.

### @vertana/core

 -  Fixed `evaluate()` structured output schema compatibility by removing
    unsupported numeric bounds from the `score` JSON schema and clamping
    scores to the `[0, 1]` range after parsing, which resolves failures with
    Anthropic models in the refinement phase [[#6]].

[#6]: https://github.com/dahlia/vertana/issues/6


Version 0.1.0
-------------

Released on December 30, 2025.  Initial release.
