"""calendar-pane — Google Calendar agenda in a desktop side pane.

This plugin is dashboard-first: the pane UI lives in ``desktop/plugin.js`` and its backend in
``dashboard/plugin_api.py`` (mounted by the dashboard plugin host at ``/api/plugins/calendar-pane/``).
It registers no agent tools, hooks or slash commands — ``register()`` exists only so the plugin
loads cleanly as a native directory plugin (the loader requires an ``__init__.py`` with
``register(ctx)``) and can be toggled from Capabilities → Plugins.
"""

from __future__ import annotations


def register(ctx) -> None:  # noqa: ARG001 - signature required by the plugin loader
    """No agent-side registrations: the pane and its API are declared in desktop/ and dashboard/."""
    return None
