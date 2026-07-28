# Fragment: No Persistence

**Activates on evidence:** no database or durable store configured - state held in memory, files, or the client only. Or an accepted decision.

**Fills:** the "Persistence specifics" section of the data template.

## Sections supplied

- **Statement:** the project persists no server-side data - recorded explicitly so absence is a fact, not an oversight.
- **Where state lives:** in-memory (lost on restart - stated), local files (paths, formats), or client-side (storage mechanism, clearing behavior).
- **Restart behavior:** exactly what is lost and what survives a process restart.
- **Future trigger:** the revisit condition under which persistence would be introduced (becomes a decision when it happens).
