The given-name corpus derives from `first-names.json` and `middle-names.json` in
[random-name](https://github.com/dominictarr/random-name/tree/468ae50d63f1d1ecb417d1b119748df9191431e7),
at that pinned revision. Both lists contain given names; together they cover
8,000+ distinct names and components. The upstream MIT notice is preserved in
`LICENSE.random-name`.

`given-names.sha256.json` contains sorted SHA-256 hashes of lowercase names and
their space/hyphen separated components. The hashes are a lookup representation
of public data, not a private-name list. They avoid publishing raw terms that
also happen to occur in a household's private policy. Runtime scanning hashes
capitalized words before lookup; no network call or installed package is needed.

A finite list cannot recognize every possible name. Possessives, handles and
speech attributions supplement it. The committed public cast allowlist is the
only approval mechanism for people; private terms always override it.
