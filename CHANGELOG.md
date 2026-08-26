# Changelog

This changelog is automatically managed by [Release Please](https://github.com/googleapis/release-please).

## [0.2.0](https://github.com/verygoodplugins/mcp-pirsch/compare/mcp-pirsch-v0.1.2...mcp-pirsch-v0.2.0) (2026-08-25)


### Features

* **client:** add isolated Pirsch API v1 read foundation ([#37](https://github.com/verygoodplugins/mcp-pirsch/issues/37)) ([d196f5f](https://github.com/verygoodplugins/mcp-pirsch/commit/d196f5f9537e7e72ce94989787c503b9da4a0cad))
* **server:** cut over stdio entrypoint to v2 tools ([#53](https://github.com/verygoodplugins/mcp-pirsch/issues/53)) ([1414daf](https://github.com/verygoodplugins/mcp-pirsch/commit/1414daf2c3b998bf69850a90a48b16aeca5188ee))


### Bug Fixes

* **ci:** request merge queue checks explicitly ([#58](https://github.com/verygoodplugins/mcp-pirsch/issues/58)) ([9fe3456](https://github.com/verygoodplugins/mcp-pirsch/commit/9fe3456670a3f41d801478633fd6f06c66bade23))
* exit orphaned stdio MCP servers on parent death ([#33](https://github.com/verygoodplugins/mcp-pirsch/issues/33)) ([46cb797](https://github.com/verygoodplugins/mcp-pirsch/commit/46cb7971354a1e0c61176f4dbe1a705f328ea7f3))
* resolve symlinked bin path before entry-point comparison ([#31](https://github.com/verygoodplugins/mcp-pirsch/issues/31)) ([08652ee](https://github.com/verygoodplugins/mcp-pirsch/commit/08652ee6b29fd1b60cb22653ea9d53fe6e1cd52d))
* **server:** resolve comparison periods in timezone ([#51](https://github.com/verygoodplugins/mcp-pirsch/issues/51)) ([172140b](https://github.com/verygoodplugins/mcp-pirsch/commit/172140b97709017169b4ba81626fe4e4e1a9696b))
* sync server.json version to 0.1.2 ([#22](https://github.com/verygoodplugins/mcp-pirsch/issues/22)) ([986452d](https://github.com/verygoodplugins/mcp-pirsch/commit/986452dd3b5abacb1d3856c1b1b26577917d38b7))

## [0.1.2](https://github.com/verygoodplugins/mcp-pirsch/compare/mcp-pirsch-v0.1.1...mcp-pirsch-v0.1.2) (2026-04-06)


### Bug Fixes

* **ci:** ignore major version bumps for coupled toolchain packages ([#17](https://github.com/verygoodplugins/mcp-pirsch/issues/17)) ([6937fb0](https://github.com/verygoodplugins/mcp-pirsch/commit/6937fb0dd1301f512d65350ce07e854fd8be325f))

## [0.1.1](https://github.com/verygoodplugins/mcp-pirsch/compare/mcp-pirsch-v0.1.0...mcp-pirsch-v0.1.1) (2026-03-25)


### Features

* add CI/CD, MCP Registry, and standardization ([68edcad](https://github.com/verygoodplugins/mcp-pirsch/commit/68edcadaeab6565057072bd2aaa5fcb184d1177e))
* align with mcp-ecosystem standards ([#4](https://github.com/verygoodplugins/mcp-pirsch/issues/4)) ([ebc5467](https://github.com/verygoodplugins/mcp-pirsch/commit/ebc5467192e48788ab082cd286c8a38a3a418f53))


### Bug Fixes

* stabilize pirsch analytics server ([#11](https://github.com/verygoodplugins/mcp-pirsch/issues/11)) ([75334c2](https://github.com/verygoodplugins/mcp-pirsch/commit/75334c29dd93ade15fdb8dc731c37625892aebf0))

## [0.1.0] - 2025-09-02

### Added
- Initial release
- Pirsch Analytics API integration
- Token caching with auto-refresh
- Multi-domain support
- Tools for stats, comparisons, and page analytics
- Filter system for detailed queries
