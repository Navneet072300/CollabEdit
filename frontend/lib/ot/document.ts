import type { Operation } from "./operations";

/** Apply a single operation to a plain string document. */
export function applyOp(doc: string, op: Operation): string {
  if (op.op_type === "insert") {
    const pos = Math.min(op.position, doc.length);
    return doc.slice(0, pos) + op.text + doc.slice(pos);
  }
  // delete
  const pos = Math.min(op.position, doc.length);
  const end = Math.min(pos + op.length, doc.length);
  return doc.slice(0, pos) + doc.slice(end);
}
