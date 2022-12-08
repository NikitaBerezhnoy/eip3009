import { ecsign } from "ethereumjs-util";
import { ethers } from "hardhat";
import assert from "assert";
import type { Wallet } from "ethers";

export function splitSignature_r_s_v(signature: any): Signature {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const splittedSignature = ethers.utils.splitSignature(signature);
    return {
        r: splittedSignature.r,
        s: splittedSignature.s,
        v: splittedSignature.v
    };
}

export function signMessage(wallet: Wallet, message: string): Signature {
    const privateKey = wallet.privateKey;
    const signingKey = new ethers.utils.SigningKey(privateKey);
    // return splitSignature_r_s_v(signingKey.signDigest(ethers.utils.arrayify(message)));
    return splitSignature_r_s_v(signingKey.signDigest(message));
}

export interface Signature {
    v: number;
    r: string;
    s: string;
}

export async function expectRevert(promise: Promise<unknown>, reason?: string | RegExp): Promise<void> {
    let err: Error | undefined;
    try {
        await promise;
    } catch (e) {
        err = e;
    }

    if (!err) {
        assert.fail("Exception not thrown");
    }

    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const errMsg: string = (err as any).hijackedMessage ?? err.message;
    assert.match(errMsg, /revert/i);

    if (!reason) {
        return;
    } else if (reason instanceof RegExp) {
        assert.match(errMsg, reason);
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        assert.include(errMsg, reason);
    }
}

export function prepend0x(v: string): string {
    return v.replace(/^(0x)?/, "0x");
}

export function strip0x(v: string): string {
    return v.replace(/^0x/, "");
}

export function hexStringFromBuffer(buf: Buffer): string {
    return "0x" + buf.toString("hex");
}

export function bufferFromHexString(hex: string): Buffer {
    return Buffer.from(strip0x(hex), "hex");
}

export function ecSign(digest: string, privateKey: string): Signature {
    const { v, r, s } = ecsign(bufferFromHexString(digest), bufferFromHexString(privateKey));

    return { v, r: hexStringFromBuffer(r), s: hexStringFromBuffer(s) };
}
