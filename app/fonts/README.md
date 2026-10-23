# Self-hosted fonts

These are the latin-subset WOFF2 files previously fetched by `next/font/google`
at build time. They are now loaded with `next/font/local` in `app/layout.tsx`,
so builds and page loads make no request to Google Fonts.

| File | Family | Style | Weight axis | CSS variable |
| --- | --- | --- | --- | --- |
| `inter-latin-variable.woff2` | Inter | normal | 100–900 | `--font-sans` |
| `sora-latin-variable.woff2` | Sora | normal | 100–800 | `--font-display` |
| `space-grotesk-latin-variable.woff2` | Space Grotesk | normal | 300–700 | `--font-heading` |
| `jetbrains-mono-latin-variable.woff2` | JetBrains Mono | normal | 100–800 | `--font-mono` |
| `fraunces-latin-variable.woff2` | Fraunces | normal | 100–900 (incl. `opsz`) | `--font-serif` |
| `fraunces-latin-italic-variable.woff2` | Fraunces | italic | 100–900 (incl. `opsz`) | `--font-serif` |
| `alex-brush-latin-400.woff2` | Alex Brush | normal | 400 | `--font-script` |

All seven files were downloaded from the official Google Fonts CSS API
(`fonts.googleapis.com/css2` → `fonts.gstatic.com`) and contain only the
`latin` unicode range, matching the previous `subsets: ["latin"]` config.

License: each family is distributed under the SIL Open Font License 1.1, which
permits self-hosting. Source projects:

- Inter — https://github.com/rsms/inter
- Sora — https://github.com/sora-xor/sora-font
- Space Grotesk — https://github.com/floriankarsten/space-grotesk
- JetBrains Mono — https://github.com/JetBrains/JetBrainsMono
- Fraunces — https://github.com/undercasetype/Fraunces
- Alex Brush — https://fonts.google.com/specimen/Alex+Brush
