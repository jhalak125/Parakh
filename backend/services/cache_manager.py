from __future__ import annotations
from typing import Dict, Optional
from cachetools import TTLCache

class CacheManager:
    def __init__(self, ttl_seconds: int = 86400, max_size: int = 256):
        self.cache = TTLCache(maxsize=max_size, ttl=ttl_seconds)

    def get(self, key: str) -> Optional[Dict]:
        return self.cache.get(key)

    def set(self, key: str, value: dict) -> None:
        self.cache[key] = value

    def invalidate(self, key: str) -> None:
        if key in self.cache:
            del self.cache[key]

    def stats(self) -> dict:
        return {
            "size": len(self.cache),
            "max_size": self.cache.maxsize,
            "ttl_seconds": self.cache.ttl
        }

cache = CacheManager()
