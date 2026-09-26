/** Toy cost model: pairwise (client fan-out) vs Sender Keys (server fan-out) for one sender in one group. */

export interface FanoutInput {
  members: number
  devicesPerMember: number
  messages: number
  leaves: number
}

export interface SchemeCost {
  /** Encryptions performed on the sender's phone. */
  encryptions: number
  /** Ciphertexts the sender's phone uploads. */
  uploads: number
  /** Copies the server delivers to devices. */
  deliveries: number
}

export interface FanoutResult {
  recipientsDevices: number
  pairwise: SchemeCost
  senderKeys: SchemeCost
  /** Key-distribution messages the whole group sends after members leave (Sender Keys only). */
  groupRekeys: number
}

/** Devices one sender must reach: every other member's devices plus the sender's own companions. */
export const devicesToReach = (members: number, d: number) => Math.max(0, (members - 1) * d + (d - 1))

export function fanoutCost({ members, devicesPerMember: d, messages, leaves }: FanoutInput): FanoutResult {
  const n = Math.max(2, Math.floor(members))
  const l = Math.max(0, Math.min(leaves, n - 2))
  const m = Math.max(1, Math.floor(messages))

  // Leaves are spread evenly across the conversation, so later messages reach fewer devices.
  let pairEnc = 0
  let skKeyMsgs = devicesToReach(n, d)
  let delivered = 0
  for (let i = 0; i < m; i++) {
    const left = Math.floor((i * (l + 1)) / m)
    const r = devicesToReach(n - Math.min(left, l), d)
    pairEnc += r
    delivered += r
  }
  // Each leave forces this sender to hand a fresh sender key to every remaining device.
  for (let k = 1; k <= l; k++) skKeyMsgs += devicesToReach(n - k, d)

  let groupRekeys = 0
  for (let k = 1; k <= l; k++) {
    const remaining = n - k
    groupRekeys += remaining * devicesToReach(remaining, d)
  }

  return {
    recipientsDevices: devicesToReach(n, d),
    pairwise: { encryptions: pairEnc, uploads: pairEnc, deliveries: delivered },
    senderKeys: { encryptions: skKeyMsgs + m, uploads: skKeyMsgs + m, deliveries: delivered + skKeyMsgs },
    groupRekeys,
  }
}
