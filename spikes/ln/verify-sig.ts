// Spike D6: verify an RLN /signmessage signature against a node pubkey.
// Scheme (LND/LDK "Lightning Signed Message"): 65-byte recoverable ECDSA signature
// [31 + recid, r(32), s(32)], zbase32-encoded, over sha256d("Lightning Signed Message:" + msg).
// Usage: node verify-sig.ts <message> <signed_message> <pubkey-hex>
import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

const ZBASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769';

export function zbase32Decode(s: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const v = ZBASE32.indexOf(ch);
    if (v < 0) throw new Error(`not zbase32: ${ch}`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

export function lightningMessageHash(message: string): Uint8Array {
  return sha256(sha256(utf8ToBytes('Lightning Signed Message:' + message)));
}

export function recoverSigner(message: string, signedMessage: string): string {
  const raw = zbase32Decode(signedMessage);
  if (raw.length !== 65) throw new Error(`expected 65 bytes, got ${raw.length}`);
  const header = raw[0]!;
  if (header < 31 || header > 34) throw new Error(`unexpected header byte ${header}`);
  const recovered = new Uint8Array(65);
  recovered[0] = header - 31; // noble 'recovered' format: [recid, r, s]
  recovered.set(raw.subarray(1), 1);
  const pub = secp.recoverPublicKey(recovered, lightningMessageHash(message), { prehash: false });
  return bytesToHex(pub);
}

export function verifySignedMessage(message: string, signedMessage: string, pubkeyHex: string): boolean {
  try {
    return recoverSigner(message, signedMessage) === pubkeyHex.toLowerCase();
  } catch {
    return false;
  }
}

const [, , message, signed, pubkey] = process.argv;
if (message !== undefined && signed && pubkey) {
  const signer = recoverSigner(message, signed);
  console.log(JSON.stringify({ signer, expected: pubkey, valid: verifySignedMessage(message, signed, pubkey) }));
}
