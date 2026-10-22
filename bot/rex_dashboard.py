"""rex_dashboard.py - connects the REX Discord bot to the REX web dashboard.

Drop this file next to main.py (it is a discord.py 2.x extension) and load it:

    await bot.load_extension("rex_dashboard")      # inside setup_hook / before bot.start()

Environment variables on the bot host (Ryft):
    REX_DASHBOARD_URL   https://rex.g7m4fcmnz9.workers.dev
    REX_BOT_API_KEY     same value as BOT_API_KEY in Cloudflare
    REX_HEARTBEAT_SECONDS   optional, default 300 (minimum 60)

What it does
  * every few minutes sends bot stats (latency, uptime, servers, ...) to the dashboard
  * keeps the dashboard's server list, channels, roles and premium flag in sync
  * lets the rest of your bot read the settings people change on the website

Using the settings anywhere in your bot:

    link = bot.get_cog("DashboardLink")
    if await link.setting(guild.id, "anti_spam", False):
        ...

Premium: this file cannot see your premium storage, so it asks YOU. Do one of:
    bot.is_guild_premium = my_async_function      # async def my_async_function(guild) -> bool
or  bot.get_cog("DashboardLink").premium_check = my_async_function
Until you do, every server is reported as NOT premium (the safe default).
After a successful /redeem, call:  bot.get_cog("DashboardLink").mark_dirty()
so the website learns about it within a minute.

Optional health report shown on the dashboard's owner page (/admin):

    bot.rex_health = {
        "features": {"Database": {"state": "ok", "detail": "reachable"}},   # ok | degraded | down | unknown
        "last_check": int(time.time()), "next_check": int(time.time()) + 3600,
    }

Call  bot.get_cog("DashboardLink").record_error()  from your error handlers to fill "Errors (1h)".

The bot never receives any command from the website; it only asks for settings.
Your existing code still decides what it does with them, and must keep its own
owner/premium checks.
"""
from __future__ import annotations

import asyncio
import inspect
import logging
import math
import os
import time
from typing import Any, Optional

import aiohttp
import discord
from discord.ext import commands, tasks

log = logging.getLogger("rex.dashboard")

DASHBOARD_URL = os.getenv("REX_DASHBOARD_URL", "https://rex.g7m4fcmnz9.workers.dev").rstrip("/")
API_KEY = os.getenv("REX_BOT_API_KEY", "")
HEARTBEAT_SECONDS = max(60, int(os.getenv("REX_HEARTBEAT_SECONDS", "300")))
FULL_SYNC_SECONDS = 600       # re-send everything (the dashboard skips unchanged servers)
SETTINGS_TTL = 60             # how long fetched settings are cached
SYNC_BATCH = 10               # servers per request


class DashboardLink(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.session: Optional[aiohttp.ClientSession] = None
        self.started_at = time.time()
        self.premium_check = None
        self._dirty = True
        self._last_full_sync = 0.0
        self._errors: list[float] = []
        self._cache: dict[str, tuple[float, dict]] = {}

    # ------------------------------------------------------------------ lifecycle
    async def cog_load(self):
        if not API_KEY:
            log.warning("REX_BOT_API_KEY is not set - dashboard link disabled.")
            return
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=20),
            headers={"Authorization": f"Bearer {API_KEY}", "User-Agent": "REX-Bot/1.0"},
        )
        self.heartbeat_loop.change_interval(seconds=HEARTBEAT_SECONDS)
        self.heartbeat_loop.start()
        self.sync_loop.start()

    async def cog_unload(self):
        self.heartbeat_loop.cancel()
        self.sync_loop.cancel()
        if self.session:
            await self.session.close()

    # ------------------------------------------------------------------ public helpers
    def mark_dirty(self):
        """Ask for a sync on the next 60-second tick (e.g. after /redeem)."""
        self._dirty = True

    def record_error(self):
        self._errors.append(time.time())

    async def settings(self, guild_id: int) -> dict[str, Any]:
        """Effective dashboard settings for a server (cached ~60 s).

        Returns {} when the dashboard is unreachable and nothing is cached,
        so always read with a default:  settings.get("key", default).
        """
        gid = str(guild_id)
        cached = self._cache.get(gid)
        if cached and time.monotonic() - cached[0] < SETTINGS_TTL:
            return cached[1]
        status, data = await self._call("GET", f"/api/bot/guilds/{gid}/settings")
        if status == 200 and isinstance(data, dict) and isinstance(data.get("settings"), dict):
            self._cache[gid] = (time.monotonic(), data["settings"])
            return data["settings"]
        if cached:
            return cached[1]  # keep last known settings during an outage
        return {}

    async def setting(self, guild_id: int, key: str, default: Any = None) -> Any:
        return (await self.settings(guild_id)).get(key, default)

    # ------------------------------------------------------------------ http
    async def _call(self, method: str, path: str, payload: Any = None):
        if not self.session:
            return 0, None
        try:
            async with self.session.request(method, DASHBOARD_URL + path, json=payload) as resp:
                data = await resp.json(content_type=None) if resp.content_length != 0 else None
                if resp.status >= 400 and resp.status != 404:
                    log.warning("Dashboard %s %s -> %s", method, path, resp.status)
                return resp.status, data
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as err:
            log.warning("Dashboard %s %s failed: %s", method, path, err)
            return 0, None

    # ------------------------------------------------------------------ payloads
    async def _is_premium(self, guild: discord.Guild) -> bool:
        check = self.premium_check or getattr(self.bot, "is_guild_premium", None)
        if check is None:
            return False
        try:
            result = check(guild)
            if inspect.isawaitable(result):
                result = await result
            return bool(result)
        except Exception:
            log.exception("premium check failed for guild %s - treating as not premium", guild.id)
            return False

    async def _guild_payload(self, guild: discord.Guild) -> dict[str, Any]:
        channels = [
            {"id": str(c.id), "name": c.name, "type": "announcement" if c.is_news() else "text"}
            for c in guild.text_channels
        ]
        roles = [
            {"id": str(r.id), "name": r.name, "color": r.color.value, "managed": r.managed, "position": r.position}
            for r in guild.roles if not r.is_default()
        ]
        return {
            "id": str(guild.id),
            "name": guild.name,
            "icon": guild.icon.key if guild.icon else None,
            "member_count": guild.member_count or 0,
            "premium": await self._is_premium(guild),
            "channels": channels[:500],
            "roles": roles[:250],
        }

    def _stats_payload(self) -> dict[str, Any]:
        bot = self.bot
        now = time.time()
        self._errors = [t for t in self._errors if now - t < 3600]
        latency = bot.latency
        stats: dict[str, Any] = {
            "status": "online" if bot.is_ready() and not bot.is_closed() else "starting",
            "latency_ms": round(latency * 1000) if math.isfinite(latency) else None,
            "uptime_s": int(now - getattr(bot, "start_time", self.started_at)),
            "guild_count": len(bot.guilds),
            "user_count": sum(g.member_count or 0 for g in bot.guilds),
            "command_count": len(bot.tree.get_commands()),
            "shard_count": bot.shard_count or 1,
            "errors_last_hour": len(self._errors),
            "version": str(getattr(bot, "version", ""))[:32],
        }
        health = getattr(bot, "rex_health", None)
        if isinstance(health, dict):
            stats["features"] = health.get("features", {})
            stats["last_health_check"] = health.get("last_check")
            stats["next_health_check"] = health.get("next_check")
        return stats

    # ------------------------------------------------------------------ background tasks
    @tasks.loop(seconds=300)
    async def heartbeat_loop(self):
        await self._call("POST", "/api/bot/heartbeat", self._stats_payload())

    @tasks.loop(seconds=60)
    async def sync_loop(self):
        due = time.monotonic() - self._last_full_sync > FULL_SYNC_SECONDS
        if self._dirty or due:
            await self._sync_all()

    @heartbeat_loop.before_loop
    @sync_loop.before_loop
    async def _wait_ready(self):
        await self.bot.wait_until_ready()

    @heartbeat_loop.error
    @sync_loop.error
    async def _loop_error(self, err: BaseException):
        log.exception("Dashboard loop error: %s", err)

    async def _sync_all(self):
        guilds = list(self.bot.guilds)
        ids = [str(g.id) for g in guilds]
        self._dirty = False  # events during the sync set it again
        ok = True
        if not guilds:
            status, _ = await self._call("POST", "/api/bot/sync", {"guilds": [], "prune_to": []})
            ok = status == 200
        for i in range(0, len(guilds), SYNC_BATCH):
            chunk = guilds[i:i + SYNC_BATCH]
            payload = [await self._guild_payload(g) for g in chunk]
            last = i + SYNC_BATCH >= len(guilds)
            status, _ = await self._call("POST", "/api/bot/sync", {"guilds": payload, "prune_to": ids if last else None})
            ok = ok and status == 200
        if ok:
            self._last_full_sync = time.monotonic()
        else:
            self._dirty = True  # retry on the next tick

    # ------------------------------------------------------------------ events that change what the site shows
    @commands.Cog.listener("on_guild_join")
    @commands.Cog.listener("on_guild_update")
    @commands.Cog.listener("on_guild_channel_create")
    @commands.Cog.listener("on_guild_channel_delete")
    @commands.Cog.listener("on_guild_channel_update")
    @commands.Cog.listener("on_guild_role_create")
    @commands.Cog.listener("on_guild_role_delete")
    @commands.Cog.listener("on_guild_role_update")
    async def _something_changed(self, *args):
        self._dirty = True

    @commands.Cog.listener()
    async def on_guild_remove(self, guild: discord.Guild):
        self._cache.pop(str(guild.id), None)
        await self._call("DELETE", f"/api/bot/guilds/{guild.id}")


async def setup(bot: commands.Bot):
    await bot.add_cog(DashboardLink(bot))
