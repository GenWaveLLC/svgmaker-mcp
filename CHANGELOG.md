# Changelog

All notable changes to the svgmaker-mcp project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - Unreleased

### Added
- HTTP transport (`build/http.js`) for remote/hosted use, served at `https://mcp.svgmaker.io` — the stdio entry point (`build/index.js`) is unchanged and still uses an API key
- OAuth 2.0 protected-resource support for the HTTP transport: browser login via bearer tokens, verified locally against the auth server's JWKS
- `svgmaker_remove_background` tool
- Generate and edit return a hosted URL when `output_path` is omitted
- Dockerfile, Cloud Run deploy script (`deploy.sh`), and `docs/RELEASE.md`

### Changed
- **Minimum Node.js is now 20.9.0** (was 18.0.0), required by `sharp` 0.35
- Upgraded `@genwave/svgmaker-sdk` to 1.2.0 and `@modelcontextprotocol/sdk` to 1.30.0

### Fixed
- `sharp` 0.35.3 picks up the libvips CVE fixes (CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591)
- Removed dependency overrides that pinned `hono`, `fast-uri`, `ip-address` and others to versions that later became vulnerable, blocking `npm audit fix`
- `SVGMAKER_API_KEY` environment variable name typo
- Fatal startup errors and a missing API key are now logged to stderr

## [2.0.0] - 2026-06-12

### Changed
- Version jumped from 1.0.0 to 2.0.0 because 1.0.0 was permanently taken on npm by a stale 2025 publish — no breaking changes, the 1.0.0 feature set below is what shipped as 2.0.0
- Documented raster mode, storage params, and the full style parameter reference (`style`, `color_mode`, `image_complexity`, `composition`, `text_style`, `quality`, `aspectRatio`, `background`)

## [1.0.0] - 2026-05-22

### Added
- Account management tools: `svgmaker_account_info` and `svgmaker_account_usage`
- Generations management tools: `svgmaker_generations_list`, `svgmaker_generations_get`, `svgmaker_generations_delete`, `svgmaker_generations_share`, `svgmaker_generations_download`, `svgmaker_generations_preview`
- Gallery browsing tools: `svgmaker_gallery_list`, `svgmaker_gallery_get`, `svgmaker_gallery_download`, `svgmaker_gallery_preview`
- Local file preview tool: `svgmaker_preview` for previewing PNG, SVG, WebP, and SVGZ files directly in chat
- Cloud-based editing via `generation_id` parameter in the edit tool (works for both generations and gallery items)
- Cloud storage enabled by default for all edits
- `sharp` dependency for image format conversion

### Changed
- Edit tool `input_path` is now optional — provide either `input_path` or `generation_id`

## [0.4.0] - 2026-02-20

### Added
- Style parameters for generate and edit tools: `style`, `color_mode`, `image_complexity`, `composition`, `text_style`
- Automated release pipeline with AI-generated release notes
- `/prepare-release` Claude Code slash command

### Changed
- Upgraded SDK dependency to `@genwave/svgmaker-sdk@^1.0.0`
- Migrated API base URL from `svgmaker.io/api` to `api.svgmaker.io`
- Release workflow now uses version-change detection instead of tag-based triggers

### Removed
- Unused documentation files and images
- Manual release scripts (replaced by automated pipeline)

## [0.1.1] - 2025-06-04

### Added
- Initial release of the svgmaker-mcp tool
- Support for generating SVGs from text descriptions
- Support for editing existing SVGs with text prompts
- Support for converting images to SVG format
- Progress reporting during operations
- Path validation and security features

### Changed
- Enhanced tool descriptions for better LLM interactions

### Fixed
- Path validation and security improvements
