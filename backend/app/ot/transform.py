"""
Operational Transform (OT) engine — server side.

The transform(op_a, op_b) function answers the question:
  "Op A was composed at the same document state as Op B.
   Op B has already been applied to the document.
   What should A become so that applying A' on top of B gives the correct result?"

This is the classic OT 'inclusion transform': transform A against B so that A'
can be applied AFTER B has already been applied.

Four cases:
  insert vs insert
  insert vs delete
  delete vs insert
  delete vs delete
"""

from dataclasses import dataclass
from typing import Literal


@dataclass
class Op:
    op_type: Literal["insert", "delete"]
    position: int
    text: str | None = None    # present for insert
    length: int | None = None  # present for delete

    @property
    def insert_length(self) -> int:
        return len(self.text) if self.text else 0

    @property
    def delete_length(self) -> int:
        return self.length or 0


def transform(op_a: Op, op_b: Op) -> Op:
    """
    Transform op_a against op_b.
    Returns a new Op that, when applied after op_b, produces the same
    logical result as if op_a had been applied to the original document.
    """
    if op_a.op_type == "insert" and op_b.op_type == "insert":
        return _transform_insert_insert(op_a, op_b)
    elif op_a.op_type == "insert" and op_b.op_type == "delete":
        return _transform_insert_delete(op_a, op_b)
    elif op_a.op_type == "delete" and op_b.op_type == "insert":
        return _transform_delete_insert(op_a, op_b)
    else:  # delete vs delete
        return _transform_delete_delete(op_a, op_b)


def _transform_insert_insert(op_a: Op, op_b: Op) -> Op:
    """
    Both ops insert text. After op_b inserts at its position, the document
    is longer, so op_a's position may need to shift right.

    Rule: if op_b's insert position is strictly BEFORE op_a's position,
    shift op_a right by op_b's insert length.
    If positions are equal we use a tiebreak: op_b is considered "earlier"
    (server wins), so we shift op_a right.
    """
    pos_a = op_a.position
    if op_b.position <= pos_a:
        # op_b inserts at or before op_a — characters shift right
        pos_a += op_b.insert_length
    return Op(op_type="insert", position=pos_a, text=op_a.text)


def _transform_insert_delete(op_a: Op, op_b: Op) -> Op:
    """
    op_a is an insert, op_b is a delete.
    op_b removes [op_b.position, op_b.position + op_b.length).
    After that deletion, where should op_a insert?

    Cases:
    1. op_a.position <= op_b.position  →  no shift (insert is before delete)
    2. op_a.position is inside the deleted range
       →  clamp to op_b.position (insert at the deletion point)
    3. op_a.position > op_b.position + op_b.length
       →  shift left by op_b.length (characters before op_a were removed)
    """
    pos_a = op_a.position
    del_start = op_b.position
    del_end = op_b.position + op_b.delete_length

    if pos_a <= del_start:
        pass  # no adjustment needed
    elif pos_a < del_end:
        # insertion point was inside the deleted range; clamp to deletion start
        pos_a = del_start
    else:
        # insertion point was after the deleted range; shift left
        pos_a -= op_b.delete_length

    return Op(op_type="insert", position=pos_a, text=op_a.text)


def _transform_delete_insert(op_a: Op, op_b: Op) -> Op:
    """
    op_a is a delete, op_b is an insert.
    op_b adds characters at op_b.position.
    After that insertion, the delete range may need to shift.

    Cases:
    1. op_b.position <= op_a.position
       →  shift delete start right by op_b.insert_length
    2. op_b.position is inside op_a's delete range
       →  the delete range grew; extend length to cover the inserted text too
    3. op_b.position >= op_a.position + op_a.length
       →  no adjustment (insert is after delete range)
    """
    pos_a = op_a.position
    del_len = op_a.delete_length
    ins_pos = op_b.position

    if ins_pos <= pos_a:
        # insert is before delete range — shift the whole range right
        pos_a += op_b.insert_length
    elif ins_pos < pos_a + del_len:
        # insert is INSIDE delete range — the deletion must also remove what was inserted
        del_len += op_b.insert_length
    # else: insert is after delete range — no change needed

    return Op(op_type="delete", position=pos_a, length=del_len)


def _transform_delete_delete(op_a: Op, op_b: Op) -> Op:
    """
    Both ops delete text. op_b's deletion happened first; now we need to
    adjust op_a to delete the right characters.

    Let da = [pa, pa+la), db = [pb, pb+lb)

    Four sub-cases:
    1. Non-overlapping, db entirely before da  → shift da left by lb
    2. Non-overlapping, db entirely after da   → no change
    3. da entirely inside db                   → op_a becomes a no-op (length=0)
    4. Partial/full overlap                    → shrink da by the intersection
    """
    pa, la = op_a.position, op_a.delete_length
    pb, lb = op_b.position, op_b.delete_length

    da_end = pa + la
    db_end = pb + lb

    if db_end <= pa:
        # Case 1: op_b entirely before op_a
        return Op(op_type="delete", position=pa - lb, length=la)

    if pb >= da_end:
        # Case 2: op_b entirely after op_a
        return Op(op_type="delete", position=pa, length=la)

    # There is overlap. Compute the surviving (non-overlapping) part of op_a.
    # Characters in the intersection were already deleted by op_b.
    overlap_start = max(pa, pb)
    overlap_end = min(da_end, db_end)
    overlap_len = overlap_end - overlap_start

    new_len = la - overlap_len
    if new_len <= 0:
        # Case 3: op_a is entirely covered by op_b — nothing left to delete
        return Op(op_type="delete", position=min(pa, pb), length=0)

    # Case 4: partial overlap — adjust start position and shrink length.
    # If op_b started before (or at) op_a, characters before op_a shifted left
    # by op_b's length, so op_a now starts at op_b's position.
    # If op_b started inside op_a, op_a's start position is unchanged.
    if pb <= pa:
        new_pos = pb
    else:
        new_pos = pa
    return Op(op_type="delete", position=new_pos, length=new_len)


def apply_op(document: str, op: Op) -> str:
    """Apply a single operation to a document string, returning the new string."""
    if op.op_type == "insert":
        pos = min(op.position, len(document))
        return document[:pos] + (op.text or "") + document[pos:]
    else:  # delete
        pos = min(op.position, len(document))
        end = min(pos + (op.length or 0), len(document))
        return document[:pos] + document[end:]
