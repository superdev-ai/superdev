# Fragment: Environments - envx-Managed Secrets

**Activates on evidence:** envx markers (encrypted stage files such as `*.gpg` env files, an envx configuration file) - presence checks only; never decrypt to detect. Or an accepted decision.

**Fills:** environment sections of foundations and operational docs.

## Sections supplied

- **Stages:** the stage names that exist (from encrypted filenames) - names only.
- **Run convention:** commands execute through `envx run -e <stage> -- <command>`; documented as the project's standard invocation.
- **Variable inventory:** variable **names** per stage where discoverable without decryption; values never appear anywhere.
- **Rules recorded:** no decrypting to inspect; no printing decrypted content; no committing plaintext stages; missing-access failures distinguished from application failures.
- **Onboarding pointer:** how a new developer gets access (key exchange procedure location), without reproducing key material.
