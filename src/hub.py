"""Hub - one small Durable Object that holds the website <-> bot queue.

Why: Workers KV is eventually consistent (a write made in one city can take up to a minute to show in another), so a change saved on the
website could sit unseen for a long time before the bot's next poll reached the same copy. A Durable Object is one single, strongly
consistent place, so the bot sees a new change the moment it is saved, and a "wait" call lets the bot hear about it instantly
instead of asking again and again.

Hot keys (the queue, results, live server snapshots) live here; everything else stays in KV. The Worker falls back to KV by itself if the
binding is missing, so deploying this can never take the site down.
"""
import asyncio
import json
import time

from workers import DurableObject, Response


def _j(data, status=200):
    return Response(json.dumps(data, separators=(",", ":")), status=status, headers={"Content-Type": "application/json"})


class Hub(DurableObject):
    def __init__(self, ctx, env):
        super().__init__(ctx, env)
        self.ctx = ctx
        self.env = env
        self.waiters = []          # futures waiting for the next change

    # --- storage helpers (SQLite-backed Durable Object key/value) -------------------------------------------
    def _get(self, key):
        raw = self.ctx.storage.kv.get(key)
        if raw is None:
            return None
        try:
            rec = json.loads(str(raw))
        except ValueError:
            return None
        exp = rec.get("e")
        if exp and exp < time.time():
            self.ctx.storage.kv.delete(key)
            return None
        return rec

    def _put(self, key, value, ttl=None):
        rec = {"v": value}
        if ttl:
            rec["e"] = int(time.time()) + int(ttl)
        self.ctx.storage.kv.put(key, json.dumps(rec, separators=(",", ":")))

    def _version(self):
        raw = self.ctx.storage.kv.get("_ver")
        try:
            return int(raw) if raw is not None else 0
        except (TypeError, ValueError):
            return 0

    def _bump(self):
        ver = self._version() + 1
        self.ctx.storage.kv.put("_ver", ver)
        waiting, self.waiters = self.waiters, []
        for fut in waiting:
            if not fut.done():
                fut.set_result(ver)
        return ver

    # --- one endpoint: POST {op, key, value, ttl, since, timeout} -------------------------------------------
    async def fetch(self, request):
        try:
            msg = json.loads(await request.text())
        except ValueError:
            return _j({"ok": False}, status=400)
        op = msg.get("op")
        key = str(msg.get("key") or "")
        if op == "get":
            rec = self._get(key)
            return _j({"ok": True, "found": rec is not None, "value": rec["v"] if rec else None, "ver": self._version()})
        if op == "put":
            self._put(key, msg.get("value"), msg.get("ttl"))
            ver = self._bump() if key in ("q:all", "xpq") else self._version()
            return _j({"ok": True, "ver": ver})
        if op == "delete":
            self.ctx.storage.kv.delete(key)
            return _j({"ok": True})
        if op == "wait":
            since = int(msg.get("since") or 0)
            timeout = max(0.0, min(float(msg.get("timeout") or 0), 25.0))
            if self._version() == since and timeout:
                fut = asyncio.get_event_loop().create_future()
                self.waiters.append(fut)
                try:
                    await asyncio.wait_for(fut, timeout)
                except asyncio.TimeoutError:
                    pass
                finally:
                    if fut in self.waiters:
                        self.waiters.remove(fut)
            return _j({"ok": True, "ver": self._version()})
        return _j({"ok": False}, status=400)
