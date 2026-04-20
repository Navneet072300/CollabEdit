/**
 * Operational Transform — core types and transform function (client side).
 *
 * An Operation represents an atomic change to a plain-text document.
 * We only need two operation types:
 *   insert(position, text)   — insert text at a character offset
 *   delete(position, length) — delete `length` characters starting at offset
 *
 * The transform(opA, opB) function answers:
 *   "opA and opB were created against the same document state.
 *    opB has already been applied.
 *    What should opA become (opA') so that applying opA' after opB
 *    produces the same logical result as applying opA directly?"
 *
 * This is the inclusion transform, also written IT(A, B).
 */

export type InsertOp = {
  op_type: "insert";
  position: number;
  text: string;
  length?: never;
};

export type DeleteOp = {
  op_type: "delete";
  position: number;
  length: number;
  text?: never;
};

export type Operation = InsertOp | DeleteOp;

// ── Transform ────────────────────────────────────────────────────────────────

export function transform(opA: Operation, opB: Operation): Operation {
  if (opA.op_type === "insert" && opB.op_type === "insert") {
    return transformInsertInsert(opA, opB);
  }
  if (opA.op_type === "insert" && opB.op_type === "delete") {
    return transformInsertDelete(opA, opB);
  }
  if (opA.op_type === "delete" && opB.op_type === "insert") {
    return transformDeleteInsert(opA, opB);
  }
  return transformDeleteDelete(opA as DeleteOp, opB as DeleteOp);
}

function transformInsertInsert(opA: InsertOp, opB: InsertOp): InsertOp {
  /**
   * Both ops want to insert text.
   * After opB inserts at opB.position, the document shifts right by opB.text.length
   * for all positions >= opB.position.
   *
   * Tiebreak: if both insert at the same position, opB wins (server-side op
   * is considered "earlier"), so opA shifts right.
   */
  if (opB.position <= opA.position) {
    return { op_type: "insert", position: opA.position + opB.text.length, text: opA.text };
  }
  return opA;
}

function transformInsertDelete(opA: InsertOp, opB: DeleteOp): InsertOp {
  /**
   * opA inserts; opB deletes range [opB.position, opB.position + opB.length).
   *
   * After opB's deletion:
   * 1. opA.position is before the deletion → no change
   * 2. opA.position is inside the deleted range → clamp to opB.position
   * 3. opA.position is after the deleted range → shift left by opB.length
   */
  const delEnd = opB.position + opB.length;

  if (opA.position <= opB.position) {
    return opA; // insert is before deletion — unaffected
  }
  if (opA.position < delEnd) {
    // insert point was inside the deleted region — clamp
    return { op_type: "insert", position: opB.position, text: opA.text };
  }
  // insert is after deletion — shift left
  return { op_type: "insert", position: opA.position - opB.length, text: opA.text };
}

function transformDeleteInsert(opA: DeleteOp, opB: InsertOp): DeleteOp {
  /**
   * opA deletes; opB inserts at opB.position.
   *
   * After opB's insertion, characters shift right, which can:
   * 1. Push the whole delete range right (if insert is before delete start)
   * 2. Expand the delete range (if insert is inside delete range)
   * 3. Leave delete range unchanged (if insert is after delete end)
   */
  const delEnd = opA.position + opA.length;

  if (opB.position <= opA.position) {
    // insert before delete range — shift start right
    return { op_type: "delete", position: opA.position + opB.text.length, length: opA.length };
  }
  if (opB.position < delEnd) {
    // insert inside delete range — we must also delete the newly inserted text
    return { op_type: "delete", position: opA.position, length: opA.length + opB.text.length };
  }
  // insert after delete range — unaffected
  return opA;
}

function transformDeleteDelete(opA: DeleteOp, opB: DeleteOp): DeleteOp {
  /**
   * Both ops delete. opB already ran; we need opA to only delete what
   * opB didn't already remove.
   *
   * Let aEnd = opA.position + opA.length
   *     bEnd = opB.position + opB.length
   */
  const aEnd = opA.position + opA.length;
  const bEnd = opB.position + opB.length;

  if (bEnd <= opA.position) {
    // opB entirely before opA — shift opA left by opB.length
    return { op_type: "delete", position: opA.position - opB.length, length: opA.length };
  }
  if (opB.position >= aEnd) {
    // opB entirely after opA — unaffected
    return opA;
  }

  // There is overlap — compute what's left to delete after opB ran.
  const overlapStart = Math.max(opA.position, opB.position);
  const overlapEnd = Math.min(aEnd, bEnd);
  const overlapLen = overlapEnd - overlapStart;
  const newLen = opA.length - overlapLen;

  if (newLen <= 0) {
    // opA's entire range was already deleted by opB — no-op
    // Position clamps to where the deletion happened
    return { op_type: "delete", position: Math.min(opA.position, opB.position), length: 0 };
  }

  // Partial overlap. opA's surviving characters need a corrected start position.
  // Characters in [opA.position, overlapStart) survive on the left.
  // Characters in [overlapEnd, aEnd) survive on the right, but shifted left by opB.length.
  // The new start of opA's deletion is opA.position (or opB.position if opB started first,
  // because those characters before opB.position shifted left by opB.length already).
  let newPos: number;
  if (opB.position <= opA.position) {
    // opB started before (or at) opA — opA's entire range has shifted left by opB.length,
    // but part of it was deleted. What remains starts at opB.position.
    newPos = opB.position;
  } else {
    // opB started inside opA — opA's start is unchanged
    newPos = opA.position;
  }

  return { op_type: "delete", position: newPos, length: newLen };
}
