"""Hash table trace generator (Phase D, POST /hash).

The response compares two independent strategies over the same op log:

* separate chaining (one list per bucket), and
* open addressing with linear probing and visible tombstones.

Both panels are rebuilt statelessly from ``ops`` on every request, then the
requested action is applied to both. Steps are emitted per panel, with all
chaining steps first and all open-addressing steps second.
"""

from typing import Any, Dict, List, Optional, Tuple

import validation
from tracing import make_step
from validation import ValidationError

THRESHOLD_CHAINING = 1.0
THRESHOLD_OPEN = 0.75


# --- hashing primitives ----------------------------------------------------

def hash_terms(key: str, hash_fn: str) -> Tuple[List[Dict[str, Any]], int]:
    """Return per-character accumulation terms and the raw hash value."""
    terms: List[Dict[str, Any]] = []
    if hash_fn == "sum_mod":
        running = 0
        for ch in key:
            running += ord(ch)
            terms.append({"char": ch, "code": ord(ch), "running": running})
        return terms, running
    if hash_fn == "poly":
        running = 0
        for ch in key:
            running = (running * 31 + ord(ch)) % (2 ** 32)
            terms.append({"char": ch, "code": ord(ch), "running": running})
        return terms, running
    raise ValidationError(f"Unknown hash function: {hash_fn}", field="hash_fn")


def hash_index(key: str, hash_fn: str, table_size: int) -> int:
    _, raw = hash_terms(key, hash_fn)
    return raw % table_size


class _Entry:
    __slots__ = ("id", "key")

    def __init__(self, entry_id: int, key: str):
        self.id = entry_id
        self.key = key


def _is_tombstone(cell: Any) -> bool:
    return isinstance(cell, dict) and cell.get("tombstone") is True


class _HashSim:
    def __init__(self, hash_fn: str, table_size: int):
        self.hash_fn = hash_fn
        self.steps: List[Dict[str, Any]] = []
        self.trace = False
        self.chaining: Dict[str, Any] = {
            "size": table_size,
            "buckets": [[] for _ in range(table_size)],
            "count": 0,
            "collisions": 0,
            "total_probes": 0,
            "resizes": 0,
        }
        self.open: Dict[str, Any] = {
            "size": table_size,
            "slots": [None] * table_size,
            "count": 0,
            "tombstones": 0,
            "collisions": 0,
            "total_probes": 0,
            "resizes": 0,
        }

    # --- snapshots ---------------------------------------------------------

    def _chaining_snapshot(self) -> Dict[str, Any]:
        state = self.chaining
        size = state["size"]
        return {
            "strategy": "chaining",
            "size": size,
            "count": state["count"],
            "load_factor": round(state["count"] / size, 4),
            "threshold": THRESHOLD_CHAINING,
            "buckets": [
                [{"id": e.id, "key": e.key} for e in bucket]
                for bucket in state["buckets"]
            ],
        }

    def _open_snapshot(self) -> Dict[str, Any]:
        state = self.open
        size = state["size"]
        slots = []
        for cell in state["slots"]:
            if cell is None:
                slots.append(None)
            elif _is_tombstone(cell):
                slots.append({"tombstone": True})
            else:
                slots.append({"id": cell.id, "key": cell.key})
        return {
            "strategy": "open",
            "size": size,
            "count": state["count"],
            "tombstones": state["tombstones"],
            "load_factor": round(state["count"] / size, 4),
            "threshold": THRESHOLD_OPEN,
            "slots": slots,
        }

    def snapshot(self) -> Dict[str, Any]:
        return {"chaining": self._chaining_snapshot(), "open": self._open_snapshot()}

    # --- metrics -----------------------------------------------------------

    def _max_probe_length(self) -> int:
        state = self.open
        size = state["size"]
        best = 0
        for slot, cell in enumerate(state["slots"]):
            if cell is None or _is_tombstone(cell):
                continue
            home = hash_index(cell.key, self.hash_fn, size)
            best = max(best, ((slot - home) % size) + 1)
        return best

    def chaining_metrics(self) -> Dict[str, Any]:
        state = self.chaining
        return {
            "collisions": state["collisions"],
            "max_chain_length": max((len(b) for b in state["buckets"]), default=0),
            "total_probes": state["total_probes"],
            "resizes": state["resizes"],
            "tombstones": 0,
            "load_factor": round(state["count"] / state["size"], 4),
            "size": state["size"],
            "count": state["count"],
        }

    def open_metrics(self) -> Dict[str, Any]:
        state = self.open
        return {
            "collisions": state["collisions"],
            "max_probe_length": self._max_probe_length(),
            "total_probes": state["total_probes"],
            "resizes": state["resizes"],
            "tombstones": state["tombstones"],
            "load_factor": round(state["count"] / state["size"], 4),
            "size": state["size"],
            "count": state["count"],
        }

    # --- step emission -----------------------------------------------------

    def _emit(self, panel: str, step_type: str, note: str,
              payload: Optional[Dict[str, Any]] = None,
              roles: Optional[Dict[str, List[int]]] = None) -> None:
        if not self.trace:
            return
        suffixed: Dict[str, List[int]] = {}
        for role, ids in (roles or {}).items():
            if ids:
                suffixed[f"{role}_{panel}"] = list(ids)
        step = make_step(
            step_type,
            [],
            self.snapshot(),
            note,
            kind="grid",
            panel=panel,
            payload=payload or {},
            **suffixed,
        )
        self.steps.append(step)
        if len(self.steps) > validation.MAX_HASH_STEPS:
            raise ValidationError(
                f"Operation produces too many steps (limit {validation.MAX_HASH_STEPS})",
                field="key",
            )

    # --- resize ------------------------------------------------------------

    def _maybe_resize_chaining(self) -> None:
        state = self.chaining
        size = state["size"]
        if (state["count"] + 1) / size <= THRESHOLD_CHAINING:
            return

        old_size = size
        new_size = old_size * 2 + 1
        in_place = new_size > validation.MAX_TABLE_SIZE
        if in_place:
            new_size = old_size
        if (state["count"] + 1) / new_size > THRESHOLD_CHAINING:
            raise ValidationError("table at maximum capacity", field="key")

        projected = (state["count"] + 1) / old_size
        self._emit(
            "chaining", "resize_start",
            f"Chaining load would exceed 1.0; rehashing {old_size} -> {new_size}.",
            payload={
                "old_size": old_size,
                "new_size": new_size,
                "load_factor": round(projected, 4),
                "threshold": THRESHOLD_CHAINING,
                "in_place": in_place,
            },
        )

        entries = []
        for from_index, bucket in enumerate(state["buckets"]):
            for entry in bucket:
                entries.append((from_index, entry))
        total = len(entries)
        state["buckets"] = [[] for _ in range(new_size)]
        state["size"] = new_size
        state["count"] = 0
        state["resizes"] += 1

        for placed, (from_index, entry) in enumerate(entries):
            to_index = hash_index(entry.key, self.hash_fn, new_size)
            state["buckets"][to_index].append(entry)
            state["count"] += 1
            self._emit(
                "chaining", "rehash_move",
                f"Rehash '{entry.key}' from bucket {from_index} to {to_index}.",
                payload={
                    "key": entry.key,
                    "from": from_index,
                    "to": to_index,
                    "probes": 0,
                    "remaining": total - placed - 1,
                },
                roles={"highlighted": [to_index]},
            )

        self._emit(
            "chaining", "resize_done",
            f"Chaining table resized to {new_size}.",
            payload={
                "old_size": old_size,
                "new_size": new_size,
                "size": new_size,
                "count": state["count"],
                "tombstones": 0,
                "in_place": in_place,
            },
        )

    def _probe_place(self, entries: List[_Entry], key: str, entry: _Entry,
                     size: int) -> Tuple[int, int]:
        """Insert an entry with linear probing; return (slot, probes)."""
        start = hash_index(key, self.hash_fn, size)
        probes = 0
        for attempt in range(size):
            slot = (start + attempt) % size
            probes += 1
            if entries[slot] is None:
                entries[slot] = entry
                return slot, probes
        raise ValidationError("table at maximum capacity", field="key")

    def _maybe_resize_open(self) -> None:
        state = self.open
        size = state["size"]
        projected_cells = state["count"] + state["tombstones"] + 1
        if projected_cells / size <= THRESHOLD_OPEN:
            return

        old_size = size
        new_size = old_size * 2 + 1
        in_place = new_size > validation.MAX_TABLE_SIZE
        if in_place:
            new_size = old_size
        # An in-place rehash clears tombstones; if live keys alone still do
        # not fit, the table genuinely is at capacity.
        if (state["count"] + 1) / new_size > THRESHOLD_OPEN:
            raise ValidationError("table at maximum capacity", field="key")

        self._emit(
            "open", "resize_start",
            f"Open-addressing load would exceed 0.75; rehashing {old_size} -> {new_size}.",
            payload={
                "old_size": old_size,
                "new_size": new_size,
                "load_factor": round(projected_cells / old_size, 4),
                "threshold": THRESHOLD_OPEN,
                "in_place": in_place,
            },
        )

        live = [
            (slot, cell)
            for slot, cell in enumerate(state["slots"])
            if cell is not None and not _is_tombstone(cell)
        ]
        total = len(live)
        state["slots"] = [None] * new_size
        state["size"] = new_size
        state["count"] = 0
        state["tombstones"] = 0
        state["resizes"] += 1

        for placed, (from_slot, entry) in enumerate(live):
            to_slot, probes = self._probe_place(state["slots"], entry.key, entry, new_size)
            state["count"] += 1
            self._emit(
                "open", "rehash_move",
                f"Rehash '{entry.key}' from slot {from_slot} to {to_slot}.",
                payload={
                    "key": entry.key,
                    "from": from_slot,
                    "to": to_slot,
                    "probes": probes,
                    "remaining": total - placed - 1,
                },
                roles={"highlighted": [to_slot]},
            )

        self._emit(
            "open", "resize_done",
            f"Open-addressing table resized to {new_size}; tombstones cleared.",
            payload={
                "old_size": old_size,
                "new_size": new_size,
                "size": new_size,
                "count": state["count"],
                "tombstones": 0,
                "in_place": in_place,
            },
        )

    # --- shared action helpers --------------------------------------------

    def _compute(self, panel: str, key: str) -> Tuple[int, Dict[str, Any]]:
        state = self.chaining if panel == "chaining" else self.open
        size = state["size"]
        terms, raw = hash_terms(key, self.hash_fn)
        index = raw % size
        payload = {
            "key": key,
            "hash_fn": self.hash_fn,
            "terms": terms,
            "raw": raw,
            "table_size": size,
            "index": index,
        }
        self._emit(
            panel, "hash_compute",
            f"hash({key}) = {raw} mod {size} = {index}.",
            payload=payload,
            roles={"highlighted": [index]},
        )
        return index, payload

    def _done(self, panel: str, action: str, extra: Optional[Dict[str, Any]] = None) -> None:
        metrics = self.chaining_metrics() if panel == "chaining" else self.open_metrics()
        payload = dict(metrics)
        if extra:
            payload.update(extra)
        self._emit(
            panel, f"hash_{action}_done",
            f"{panel.capitalize()} {action} complete.",
            payload=payload,
        )

    # --- insert ------------------------------------------------------------

    def insert_chaining(self, key: str, entry_id: int) -> None:
        self._maybe_resize_chaining()
        state = self.chaining
        index, _ = self._compute("chaining", key)
        bucket = state["buckets"][index]
        if bucket:
            state["collisions"] += 1
        for position, existing in enumerate(bucket):
            state["total_probes"] += 1
            self._emit(
                "chaining", "chain_compare",
                f"Compare '{key}' with '{existing.key}' in bucket {index}.",
                payload={
                    "key": key,
                    "occupant_key": existing.key,
                    "index": index,
                    "chain_pos": position,
                    "match": False,
                },
                roles={"probing": [index]},
            )
        entry = _Entry(entry_id, key)
        bucket.append(entry)
        state["count"] += 1
        self._emit(
            "chaining", "chain_append",
            f"Append '{key}' to bucket {index} (chain length {len(bucket)}).",
            payload={
                "key": key,
                "index": index,
                "chain_pos": len(bucket) - 1,
                "chain_length": len(bucket),
            },
            roles={"created": [index], "new_node": [index]},
        )
        self._done("chaining", "insert")

    def insert_open(self, key: str, entry_id: int) -> None:
        self._maybe_resize_open()
        state = self.open
        size = state["size"]
        index, _ = self._compute("open", key)

        first_tombstone: Optional[int] = None
        empty_slot: Optional[int] = None
        collided = False
        for attempt in range(size):
            slot = (index + attempt) % size
            cell = state["slots"][slot]
            state["total_probes"] += 1
            if cell is None:
                state_state = "empty"
                occupant = None
            elif _is_tombstone(cell):
                state_state = "tombstone"
                occupant = None
                if first_tombstone is None:
                    first_tombstone = slot
            else:
                state_state = "occupied"
                occupant = cell.key
                collided = True
            self._emit(
                "open", "probe",
                f"Probe slot {slot} for '{key}': {state_state}.",
                payload={
                    "key": key,
                    "slot": slot,
                    "attempt": attempt,
                    "state": state_state,
                    "occupant_key": occupant,
                    "index": index,
                },
                roles={"probing": [slot]},
            )
            if cell is None:
                empty_slot = slot
                break

        if empty_slot is None:
            raise ValidationError("table at maximum capacity", field="key")

        if collided:
            state["collisions"] += 1
        reuse = first_tombstone is not None
        slot_to_use = first_tombstone if reuse else empty_slot
        state["slots"][slot_to_use] = _Entry(entry_id, key)
        state["count"] += 1
        if reuse:
            state["tombstones"] -= 1
        self._emit(
            "open", "place",
            f"Place '{key}' in slot {slot_to_use}"
            + (" (reusing a tombstone)." if reuse else "."),
            payload={
                "key": key,
                "slot": slot_to_use,
                "index": index,
                "reused_tombstone": reuse,
                "probes": (slot_to_use - index) % size + 1,
            },
            roles={"created": [slot_to_use], "new_node": [slot_to_use]},
        )
        self._done("open", "insert")

    # --- search ------------------------------------------------------------

    def search_chaining(self, key: str) -> None:
        state = self.chaining
        index, _ = self._compute("chaining", key)
        bucket = state["buckets"][index]
        found_at: Optional[int] = None
        for position, existing in enumerate(bucket):
            state["total_probes"] += 1
            match = existing.key == key
            self._emit(
                "chaining", "chain_compare",
                f"Compare '{key}' with '{existing.key}' in bucket {index}.",
                payload={
                    "key": key,
                    "occupant_key": existing.key,
                    "index": index,
                    "chain_pos": position,
                    "match": match,
                },
                roles={"probing": [index], "matched": [index] if match else []},
            )
            if match:
                found_at = position
                break
        if found_at is not None:
            self._emit(
                "chaining", "found",
                f"Found '{key}' in bucket {index} at chain position {found_at}.",
                payload={"key": key, "index": index, "chain_pos": found_at},
                roles={"selected": [index], "matched": [index]},
            )
        else:
            self._emit(
                "chaining", "not_found",
                f"'{key}' is not in bucket {index}.",
                payload={"key": key, "index": index, "chain_length": len(bucket)},
                roles={"probing": [index]},
            )
        self._done("chaining", "search", {"found": found_at is not None})

    def search_open(self, key: str) -> None:
        state = self.open
        size = state["size"]
        index, _ = self._compute("open", key)
        found_at: Optional[int] = None
        for attempt in range(size):
            slot = (index + attempt) % size
            cell = state["slots"][slot]
            state["total_probes"] += 1
            if cell is None:
                state_name = "empty"
                occupant = None
            elif _is_tombstone(cell):
                state_name = "tombstone"
                occupant = None
            else:
                state_name = "occupied"
                occupant = cell.key
            match = state_name == "occupied" and occupant == key
            self._emit(
                "open", "probe",
                f"Probe slot {slot} for '{key}': {state_name}.",
                payload={
                    "key": key,
                    "slot": slot,
                    "attempt": attempt,
                    "state": state_name,
                    "occupant_key": occupant,
                    "index": index,
                    "match": match,
                },
                roles={"probing": [slot], "matched": [slot] if match else []},
            )
            if match:
                found_at = slot
                break
            if cell is None:
                break
        if found_at is not None:
            self._emit(
                "open", "found",
                f"Found '{key}' in slot {found_at}.",
                payload={"key": key, "slot": found_at, "index": index},
                roles={"selected": [found_at], "matched": [found_at]},
            )
        else:
            self._emit(
                "open", "not_found",
                f"'{key}' is not present.",
                payload={"key": key, "index": index},
                roles={"probing": [index]},
            )
        self._done("open", "search", {"found": found_at is not None})

    # --- delete ------------------------------------------------------------

    def delete_chaining(self, key: str) -> None:
        state = self.chaining
        index, _ = self._compute("chaining", key)
        bucket = state["buckets"][index]
        found_at: Optional[int] = None
        for position, existing in enumerate(bucket):
            state["total_probes"] += 1
            match = existing.key == key
            self._emit(
                "chaining", "chain_compare",
                f"Compare '{key}' with '{existing.key}' in bucket {index}.",
                payload={
                    "key": key,
                    "occupant_key": existing.key,
                    "index": index,
                    "chain_pos": position,
                    "match": match,
                },
                roles={"probing": [index], "matched": [index] if match else []},
            )
            if match:
                found_at = position
                break
        if found_at is None:
            raise ValidationError(f"Key '{key}' not found", field="key")
        del bucket[found_at]
        state["count"] -= 1
        self._emit(
            "chaining", "chain_remove",
            f"Remove '{key}' from bucket {index}.",
            payload={"key": key, "index": index, "chain_pos": found_at},
            roles={"selected": [index]},
        )
        self._done("chaining", "delete", {"deleted": True})

    def delete_open(self, key: str) -> None:
        state = self.open
        size = state["size"]
        index, _ = self._compute("open", key)
        found_at: Optional[int] = None
        for attempt in range(size):
            slot = (index + attempt) % size
            cell = state["slots"][slot]
            state["total_probes"] += 1
            if cell is None:
                state_name = "empty"
                occupant = None
            elif _is_tombstone(cell):
                state_name = "tombstone"
                occupant = None
            else:
                state_name = "occupied"
                occupant = cell.key
            match = state_name == "occupied" and occupant == key
            self._emit(
                "open", "probe",
                f"Probe slot {slot} for '{key}': {state_name}.",
                payload={
                    "key": key,
                    "slot": slot,
                    "attempt": attempt,
                    "state": state_name,
                    "occupant_key": occupant,
                    "index": index,
                    "match": match,
                },
                roles={"probing": [slot], "matched": [slot] if match else []},
            )
            if match:
                found_at = slot
                break
            if cell is None:
                break
        if found_at is None:
            raise ValidationError(f"Key '{key}' not found", field="key")
        state["slots"][found_at] = {"tombstone": True}
        state["count"] -= 1
        state["tombstones"] += 1
        self._emit(
            "open", "tombstone",
            f"Mark slot {found_at} as a tombstone for '{key}'.",
            payload={"key": key, "slot": found_at, "index": index},
            roles={"selected": [found_at], "mismatch": [found_at]},
        )
        self._done("open", "delete", {"deleted": True})

    # --- replay ------------------------------------------------------------

    def apply(self, op: str, key: str, entry_id: Optional[int] = None,
              trace: bool = False) -> None:
        previous = self.trace
        self.trace = trace
        try:
            if op == "insert":
                self.insert_chaining(key, entry_id if entry_id is not None else 0)
                self.insert_open(key, entry_id if entry_id is not None else 0)
            elif op == "delete":
                self.delete_chaining(key)
                self.delete_open(key)
            else:
                raise ValidationError(f"Unknown hash op: {op}", field="ops")
        finally:
            self.trace = previous


def _key_of(action: Any) -> str:
    if isinstance(action, dict):
        return action.get("key")
    return None


def hash_op_steps(algorithm: str, hash_fn: str = "sum_mod", table_size: int = 7,
                  probing: str = "linear", ops: Optional[List[Dict[str, Any]]] = None,
                  action: Optional[Any] = None) -> Dict[str, Any]:
    key = _key_of(action)
    if not isinstance(key, str) or not key:
        raise ValidationError("Missing 'key' for hash action", field="key")

    sim = _HashSim(hash_fn, table_size)
    live = set()

    # Silent stateless replay of the committed op log.
    for index, op in enumerate(ops or []):
        op_name = op["op"]
        op_key = op["key"]
        if op_name == "insert":
            if op_key in live:
                raise ValidationError(f"Duplicate key: {op_key} already exists", field="key")
            if len(live) >= validation.MAX_LIVE_KEYS:
                raise ValidationError(
                    f"At most {validation.MAX_LIVE_KEYS} live keys are supported", field="key")
            sim.apply("insert", op_key, entry_id=index)
            live.add(op_key)
        elif op_name == "delete":
            if op_key not in live:
                raise ValidationError(f"Key '{op_key}' not found", field="key")
            sim.apply("delete", op_key)
            live.remove(op_key)

    # Validate the action against the replayed state before emitting steps.
    if algorithm == "hash_insert":
        if key in live:
            raise ValidationError(f"Duplicate key: {key} already exists", field="key")
        if len(live) >= validation.MAX_LIVE_KEYS:
            raise ValidationError(
                f"At most {validation.MAX_LIVE_KEYS} live keys are supported", field="key")
        sim.apply("insert", key, entry_id=len(ops or []), trace=True)
        live.add(key)
    elif algorithm == "hash_delete":
        if key not in live:
            raise ValidationError(f"Key '{key}' not found", field="key")
        sim.apply("delete", key, trace=True)
        live.remove(key)
    elif algorithm == "hash_search":
        # Search is split so the found/not-found outcome is explicit per panel.
        sim.trace = True
        try:
            sim.search_chaining(key)
            sim.search_open(key)
        finally:
            sim.trace = False
    else:
        raise ValidationError(f"Unknown hash algorithm: {algorithm}", field="algorithm")

    warnings = []
    if hash_fn == "sum_mod":
        warnings.append("Sum of character codes ignores order, so anagrams collide.")

    return {
        "steps": sim.steps,
        "final_state": sim.snapshot(),
        "metrics": {
            "chaining": sim.chaining_metrics(),
            "open": sim.open_metrics(),
        },
        "metadata": {
            "hash_fn": hash_fn,
            "table_size_initial": table_size,
            "probing": probing,
            "warnings": warnings,
        },
    }
