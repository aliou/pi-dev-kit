---
"@aliou/pi-dev-kit": patch
---

Document stale contexts in deferred work in the pi-extension skill and update command: after a reload or session replacement every `ctx` getter and `pi` action throws, and an escaping error from a timer, socket callback, or un-awaited promise kills Pi. Close long-lived resources in `session_shutdown`, guard continuations with a flag, and drop stale-context errors.
