/**
 * Client-side OT state machine.
 *
 * Tracks three pieces of state:
 *   revision    — the last server revision this client has acknowledged
 *   pendingOps  — ops we sent to the server but haven't been ACK'd yet
 *
 * The invariant we maintain:
 *   At any point, the local document equals:
 *     serverDocument + apply(pendingOps)
 *
 * When we receive a remote op (from another user, via the server):
 *   1. Transform the remote op against each pending op, getting remoteOp'.
 *   2. Apply remoteOp' to the local document.
 *   3. Transform each pending op against the original remote op,
 *      so our pending ops are still valid against the new document state.
 *
 * When we receive an ACK for our own op:
 *   1. Remove the earliest pending op (the one just ACK'd).
 *   2. Update our revision.
 */

import { transform, type Operation } from "./operations";
import { applyOp } from "./document";

export interface PendingOp {
  op: Operation;
  revision: number; // server revision when this op was sent
}

export class ClientOTState {
  revision: number;
  pendingOps: PendingOp[];

  constructor(revision = 0) {
    this.revision = revision;
    this.pendingOps = [];
  }

  /** Called when the user makes a local edit. Returns the op to send. */
  localOp(op: Operation): { op: Operation; revision: number } {
    this.pendingOps.push({ op, revision: this.revision });
    return { op, revision: this.revision };
  }

  /** Called when the server ACKs one of our ops. */
  ack(serverRevision: number): void {
    // The earliest pending op has been integrated by the server.
    this.pendingOps.shift();
    this.revision = serverRevision;
  }

  /**
   * Called when we receive a remote op from the server.
   * Returns the transformed op that should be applied to the local document.
   *
   * We must also transform all our pending ops against the remote op,
   * because those pending ops will eventually be applied after the remote op.
   */
  remoteOp(incomingOp: Operation, serverRevision: number): Operation {
    let transformedIncoming = incomingOp;

    // Transform the incoming op against each of our pending ops.
    // After this loop, transformedIncoming can be safely applied on top of
    // our locally-modified document.
    const newPending: PendingOp[] = [];

    for (const pending of this.pendingOps) {
      // Transform: what does the incoming op become given that pending.op already happened locally?
      const newIncoming = transform(transformedIncoming, pending.op);
      // Transform: what does pending.op become given that incoming op happened on the server?
      const newPendingOp = transform(pending.op, transformedIncoming);

      transformedIncoming = newIncoming;
      newPending.push({ op: newPendingOp, revision: pending.revision });
    }

    this.pendingOps = newPending;
    this.revision = serverRevision;

    return transformedIncoming;
  }
}

/** Utility: apply a sequence of ops to a document string. */
export function applyOps(doc: string, ops: Operation[]): string {
  return ops.reduce(applyOp, doc);
}
