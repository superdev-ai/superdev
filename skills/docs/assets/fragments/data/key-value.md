# Fragment: Key-Value Store

**Activates on evidence:** key-value client configuration and key-construction code - record the paths found. Or an accepted decision.

**Fills:** the "Persistence specifics" section of the data template.

## Sections supplied

- **Key schema:** key construction pattern per data class (prefixes, separators, id components) - collisions are a design defect, document the namespace plan.
- **Value shape:** serialization format and versioning of stored values.
- **TTL:** expiry policy per key class; what happens when expired data is requested.
- **Durability:** whether this store is cache (rebuildable) or record (authoritative) - per key class, explicitly.
- **Eviction:** behavior under memory pressure for cache classes.
