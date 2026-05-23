declare module 'viem' {
  export function createPublicClient(config: any): any;
  export function createWalletClient(config: any): any;
  export function http(url: string): any;
  export function encodeAbiParameters(params: any, values: any): `0x${string}`;
  export function keccak256(input: any): `0x${string}`;
  export function toBytes(input: string): Uint8Array;
  export function decodeEventLog(config: any): any;
  export function toHex(input: any): `0x${string}`;
}

declare module 'viem/chains' {
  export const base: any;
}

declare module 'viem/accounts' {
  export function privateKeyToAccount(pk: `0x${string}`): any;
}
