import { ethers } from "hardhat";
import { expect } from "chai";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { Wallet } from "@ethersproject/wallet";
import type { Token } from "../typechain-types";
import { AuthorizationUsed, Transfer } from "../typechain-types";
import { ecSign, expectRevert, Signature, strip0x, signMessage } from "./helpers";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ACCOUNTS_AND_KEYS, MAX_UINT256 } from "./helpers/constants";

// const Token = artifacts.require("Token");

const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.utils.id(
    "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
);

const RECEIVE_WITH_AUTHORIZATION_TYPEHASH = ethers.utils.id(
    "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
);

const CANCEL_AUTHORIZATION_TYPEHASH = ethers.utils.id("CancelAuthorization(address authorizer,bytes32 nonce)");

describe("EIP3009", function () {
    const mnemonic = "test test test test test test test test test test test junk";
    // const mnemonic = "stamp ugly bachelor lizard field defense neglect diamond van embody elegant festival";

    let token: Token;
    let domainSeparator: string;
    let deployer: Wallet, alice: Wallet, bob: Wallet, charlie: Wallet;

    let nonce: string;

    const initialBalance = 10e6;
    before(async () => {
        // [deployer, alice, bob, charlie,] = await ethers.getSigners();
        // get default hardhat provider
        const provider = ethers.provider;
        deployer = ethers.Wallet.createRandom().connect(provider);
        alice = ethers.Wallet.createRandom().connect(provider);
        bob = ethers.Wallet.createRandom().connect(provider);
        charlie = ethers.Wallet.createRandom().connect(provider);

        // set balance to each account
        await setBalance(deployer.address, ethers.utils.parseEther("1000"));
        await setBalance(alice.address, ethers.utils.parseEther("1000"));
        await setBalance(bob.address, ethers.utils.parseEther("1000"));
        await setBalance(charlie.address, ethers.utils.parseEther("1000"));
    });

    beforeEach(async () => {
        const Token = await ethers.getContractFactory("Token");
        token = await Token.connect(deployer).deploy("Token", "1", "TOK", 4, initialBalance);
        domainSeparator = await token.DOMAIN_SEPARATOR();
        nonce = "0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8";

        await token.connect(deployer).transfer(await alice.getAddress(), initialBalance);
    });

    it("has the expected type hashes", async () => {
        expect(await token.TRANSFER_WITH_AUTHORIZATION_TYPEHASH()).to.equal(TRANSFER_WITH_AUTHORIZATION_TYPEHASH);

        expect(await token.RECEIVE_WITH_AUTHORIZATION_TYPEHASH()).to.equal(RECEIVE_WITH_AUTHORIZATION_TYPEHASH);

        expect(await token.CANCEL_AUTHORIZATION_TYPEHASH()).to.equal(CANCEL_AUTHORIZATION_TYPEHASH);
    });

    describe("transferWithAuthorization", () => {
        let transferParams: {
            from: string;
            to: string;
            value: number;
            validAfter: number | string;
            validBefore: number | string;
        };
        before(async () => {
            transferParams = {
                from: await alice.getAddress(),
                to: await bob.getAddress(),
                value: 7e6,
                validAfter: 0,
                validBefore: MAX_UINT256
            };
        });

        it("executes a transfer when a valid authorization is given", async () => {
            const { from, to, value, validAfter, validBefore } = transferParams;
            // create an authorization to transfer money from Alice to Bob and sign
            // with Alice's key
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // check initial balance
            expect((await token.balanceOf(from)).toNumber()).to.equal(10e6);
            expect((await token.balanceOf(to)).toNumber()).to.equal(0);

            expect(await token.authorizationState(from, nonce)).to.be.false;

            // a third-party, Charlie (not Alice) submits the signed authorization
            const result = await token
                .connect(charlie)
                .transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);

            // check that balance is updated
            expect((await token.balanceOf(from)).toNumber()).to.equal(initialBalance - value);
            expect((await token.balanceOf(to)).toNumber()).to.equal(value);

            // // check that AuthorizationUsed event is emitted
            // const log0 = result.logs[0] as Truffle.TransactionLog<AuthorizationUsed>;
            // expect(log0.event).to.equal("AuthorizationUsed");
            // expect(log0.args[0]).to.equal(from);
            // expect(log0.args[1]).to.equal(nonce);

            // // check that Transfer event is emitted
            // const log1 = result.logs[1] as Truffle.TransactionLog<Transfer>;
            // expect(log1.event).to.equal("Transfer");
            // expect(log1.args[0]).to.equal(from);
            // expect(log1.args[1]).to.equal(to);
            // expect(log1.args[2].toNumber()).to.equal(value);

            // check that the authorization is now used
            expect(await token.authorizationState(from, nonce)).to.be.true;
        });

        it("reverts if the signature does not match given parameters", async () => {
            const { from, to, value, validAfter, validBefore } = transferParams;
            // create a signed authorization
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to cheat by claiming the transfer amount is double
            await expectRevert(
                token.connect(charlie).transferWithAuthorization(
                    from,
                    to,
                    value * 2, // pass incorrect value
                    validAfter,
                    validBefore,
                    nonce,
                    v,
                    r,
                    s
                ),
                "invalid signature"
            );
        });

        it("reverts if the signature is not signed with the right key", async () => {
            const { from, to, value, validAfter, validBefore } = transferParams;
            // create an authorization to transfer money from Alice to Bob, but
            // sign with Bob's key instead of Alice's
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                bob
            );

            // try to cheat by submitting the signed authorization that is signed by
            // a wrong person
            await expectRevert(
                token
                    .connect(charlie)
                    .transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "invalid signature"
            );
        });

        it("reverts if the authorization is not yet valid", async () => {
            const { from, to, value, validBefore } = transferParams;
            // create a signed authorization that won't be valid until 10 seconds
            // later
            const validAfter = Math.floor(Date.now() / 1000) + 10;
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization early
            await expectRevert(
                token
                    .connect(charlie)
                    .transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "authorization is not yet valid"
            );
        });

        it("reverts if the authorization is expired", async () => {
            // create a signed authorization that expires immediately
            const { from, to, value, validAfter } = transferParams;
            const validBefore = Math.floor(Date.now() / 1000);
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization that is expired
            await expectRevert(
                token
                    .connect(charlie)
                    .transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "authorization is expired"
            );
        });

        it("reverts if the authorization has already been used", async () => {
            const { from, to, validAfter, validBefore } = transferParams;
            // create a signed authorization
            const value = 1e6;
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token
                .connect(charlie)
                .transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);

            // try to submit the authorization again
            await expectRevert(
                token
                    .connect(charlie)
                    .transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "authorization is used"
            );
        });

        it("reverts if the authorization has a nonce that has already been used by the signer", async () => {
            const { from, to, value, validAfter, validBefore } = transferParams;
            // create a signed authorization
            const authorization = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token
                .connect(charlie)
                .transferWithAuthorization(
                    from,
                    to,
                    value,
                    validAfter,
                    validBefore,
                    nonce,
                    authorization.v,
                    authorization.r,
                    authorization.s
                );

            // create another authorization with the same nonce, but with different
            // parameters
            const authorization2 = await signTransferAuthorization(
                from,
                to,
                1e6,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization again
            await expectRevert(
                token
                    .connect(charlie)
                    .transferWithAuthorization(
                        from,
                        to,
                        1e6,
                        validAfter,
                        validBefore,
                        nonce,
                        authorization2.v,
                        authorization2.r,
                        authorization2.s
                    ),
                "authorization is used"
            );
        });

        it("reverts if the authorization includes invalid transfer parameters", async () => {
            const { from, to, validAfter, validBefore } = transferParams;
            // create a signed authorization that attempts to transfer an amount
            // that exceeds the sender's balance
            const value = initialBalance + 1;
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization with invalid transfer parameters
            await expectRevert(
                token
                    .connect(charlie)
                    .transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "transfer amount exceeds balance"
            );
        });

        it("reverts if the authorization is not for transferWithAuthorization", async () => {
            const { from: owner, to: spender, value, validAfter, validBefore } = transferParams;
            // create a signed authorization for an approval (granting allowance)
            const { v, r, s } = await signReceiveAuthorization(
                owner,
                spender,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the approval authorization
            await expectRevert(
                token
                    .connect(charlie)
                    .transferWithAuthorization(owner, spender, value, validAfter, validBefore, nonce, v, r, s),
                "invalid signature"
            );
        });
    });

    describe("receiveWithAuthorization", () => {
        let receiveParams: {
            from: string;
            to: string;
            value: number;
            validAfter: number | string;
            validBefore: number | string;
        };
        before(async () => {
            receiveParams = {
                from: await alice.getAddress(),
                to: await charlie.getAddress(),
                value: 7e6,
                validAfter: 0,
                validBefore: MAX_UINT256
            };
        });

        it("executes a transfer when a valid authorization is submitted by the payee", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create a receive authorization to transfer money from Alice to Charlie
            // and sign with Alice's key
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // check initial balance
            expect((await token.balanceOf(from)).toNumber()).to.equal(10e6);
            expect((await token.balanceOf(to)).toNumber()).to.equal(0);

            expect(await token.authorizationState(from, nonce)).to.be.false;

            // The payee submits the signed authorization
            const result = await token
                .connect(charlie)
                .receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);

            // check that balance is updated
            expect((await token.balanceOf(from)).toNumber()).to.equal(initialBalance - value);
            expect((await token.balanceOf(to)).toNumber()).to.equal(value);

            // // check that AuthorizationUsed event is emitted
            // const log0 = result.logs[0] as Truffle.TransactionLog<AuthorizationUsed>;
            // expect(log0.event).to.equal("AuthorizationUsed");
            // expect(log0.args[0]).to.equal(from);
            // expect(log0.args[1]).to.equal(nonce);

            // // check that Transfer event is emitted
            // const log1 = result.logs[1] as Truffle.TransactionLog<Transfer>;
            // expect(log1.event).to.equal("Transfer");
            // expect(log1.args[0]).to.equal(from);
            // expect(log1.args[1]).to.equal(to);
            // expect(log1.args[2].toNumber()).to.equal(value);

            // check that the authorization is now used
            expect(await token.authorizationState(from, nonce)).to.be.true;
        });

        it("reverts if the caller is not the payee", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create a signed authorization
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // check initial balance
            expect((await token.balanceOf(from)).toNumber()).to.equal(10e6);
            expect((await token.balanceOf(to)).toNumber()).to.equal(0);

            expect(await token.authorizationState(from, nonce)).to.be.false;

            // The payee submits the signed authorization
            await expectRevert(
                token
                    .connect(deployer)
                    .receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "caller must be the payee"
            );
        });

        it("reverts if the signature does not match given parameters", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create a signed authorization
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to cheat by claiming the transfer amount is double
            await expectRevert(
                token.connect(charlie).receiveWithAuthorization(
                    from,
                    to,
                    value * 2, // pass incorrect value
                    validAfter,
                    validBefore,
                    nonce,
                    v,
                    r,
                    s
                ),
                "invalid signature"
            );
        });

        it("reverts if the signature is not signed with the right key", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create an authorization to transfer money from Alice to Bob, but
            // sign with Bob's key instead of Alice's
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                bob
            );

            // try to cheat by submitting the signed authorization that is signed by
            // a wrong person
            await expectRevert(
                token
                    .connect(charlie)
                    .receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "invalid signature"
            );
        });

        it("reverts if the authorization is not yet valid", async () => {
            const { from, to, value, validBefore } = receiveParams;
            // create a signed authorization that won't be valid until 10 seconds
            // later
            const validAfter = Math.floor(Date.now() / 1000) + 10;
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization early
            await expectRevert(
                token
                    .connect(charlie)
                    .receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "authorization is not yet valid"
            );
        });

        it("reverts if the authorization is expired", async () => {
            // create a signed authorization that expires immediately
            const { from, to, value, validAfter } = receiveParams;
            const validBefore = Math.floor(Date.now() / 1000);
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization that is expired
            await expectRevert(
                token
                    .connect(charlie)
                    .receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "authorization is expired"
            );
        });

        it("reverts if the authorization has already been used", async () => {
            const { from, to, validAfter, validBefore } = receiveParams;
            // create a signed authorization
            const value = 1e6;
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token
                .connect(charlie)
                .receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);

            // try to submit the authorization again
            await expectRevert(
                token
                    .connect(charlie)
                    .receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "authorization is used"
            );
        });

        it("reverts if the authorization has a nonce that has already been used by the signer", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create a signed authorization
            const authorization = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token
                .connect(charlie)
                .receiveWithAuthorization(
                    from,
                    to,
                    value,
                    validAfter,
                    validBefore,
                    nonce,
                    authorization.v,
                    authorization.r,
                    authorization.s
                );

            // create another authorization with the same nonce, but with different
            // parameters
            const authorization2 = await signReceiveAuthorization(
                from,
                to,
                1e6,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization again
            await expectRevert(
                token
                    .connect(charlie)
                    .receiveWithAuthorization(
                        from,
                        to,
                        1e6,
                        validAfter,
                        validBefore,
                        nonce,
                        authorization2.v,
                        authorization2.r,
                        authorization2.s
                    ),
                "authorization is used"
            );
        });

        it("reverts if the authorization includes invalid transfer parameters", async () => {
            const { from, to, validAfter, validBefore } = receiveParams;
            // create a signed authorization that attempts to transfer an amount
            // that exceeds the sender's balance
            const value = initialBalance + 1;
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization with invalid transfer parameters
            await expectRevert(
                token
                    .connect(charlie)
                    .receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s),
                "transfer amount exceeds balance"
            );
        });

        it("reverts if the authorization is not for receiveWithAuthorization", async () => {
            const { from: owner, to: spender, value, validAfter, validBefore } = receiveParams;
            // create a signed authorization for an approval (granting allowance)
            const { v, r, s } = await signTransferAuthorization(
                owner,
                spender,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the approval authorization
            await expectRevert(
                token
                    .connect(charlie)
                    .receiveWithAuthorization(owner, spender, value, validAfter, validBefore, nonce, v, r, s),
                "invalid signature"
            );
        });
    });

    describe("cancelAuthorization", () => {
        it("cancels an unused transfer authorization if the signature is valid", async () => {
            const from = await alice.getAddress();
            const to = await bob.getAddress();
            const value = 7e6;
            const validAfter = 0;
            const validBefore = MAX_UINT256;

            // create a signed authorization
            const authorization = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // create cancellation
            const cancellation = await signCancelAuthorization(from, nonce, domainSeparator, alice);

            // check that the authorization is ununsed
            expect(await token.authorizationState(from, nonce)).to.be.false;

            // cancel the authorization
            await token
                .connect(charlie)
                .cancelAuthorization(from, nonce, cancellation.v, cancellation.r, cancellation.s);

            // check that the authorization is now used
            expect(await token.authorizationState(from, nonce)).to.be.true;

            // attempt to use the canceled authorization
            await expectRevert(
                token
                    .connect(charlie)
                    .transferWithAuthorization(
                        from,
                        to,
                        value,
                        validAfter,
                        validBefore,
                        nonce,
                        authorization.v,
                        authorization.r,
                        authorization.s
                    ),
                "authorization is used"
            );
        });

        it("cancels an unused receive authorization if the signature is valid", async () => {
            const from = await alice.getAddress();
            const to = await charlie.getAddress();
            const value = 7e6;
            const validAfter = 0;
            const validBefore = MAX_UINT256;

            // create a signed authorization
            const authorization = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // create cancellation
            const cancellation = await signCancelAuthorization(from, nonce, domainSeparator, alice);

            // check that the authorization is ununsed
            expect(await token.authorizationState(from, nonce)).to.be.false;

            // cancel the authorization
            await token
                .connect(charlie)
                .cancelAuthorization(from, nonce, cancellation.v, cancellation.r, cancellation.s);

            // check that the authorization is now used
            expect(await token.authorizationState(from, nonce)).to.be.true;

            // attempt to use the canceled authorization
            await expectRevert(
                token
                    .connect(charlie)
                    .receiveWithAuthorization(
                        from,
                        to,
                        value,
                        validAfter,
                        validBefore,
                        nonce,
                        authorization.v,
                        authorization.r,
                        authorization.s
                    ),
                "authorization is used"
            );
        });

        it("reverts if the authorization is already canceled", async () => {
            // create cancellation
            const cancellation = await signCancelAuthorization(await alice.getAddress(), nonce, domainSeparator, alice);

            // submit the cancellation
            await token
                .connect(charlie)
                .cancelAuthorization(await alice.getAddress(), nonce, cancellation.v, cancellation.r, cancellation.s);

            // try to submit the same cancellation again
            await expectRevert(
                token
                    .connect(charlie)
                    .cancelAuthorization(
                        await alice.getAddress(),
                        nonce,
                        cancellation.v,
                        cancellation.r,
                        cancellation.s
                    ),
                "authorization is used"
            );
        });
    });
});

async function signTransferAuthorization(
    from: string,
    to: string,
    value: number | string,
    validAfter: number | string,
    validBefore: number | string,
    nonce: string,
    domainSeparator: string,
    ethersSigner: Wallet
): Promise<Signature> {
    return signEIP712(
        domainSeparator,
        TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
        ["address", "address", "uint256", "uint256", "uint256", "bytes32"],
        [from, to, value, validAfter, validBefore, nonce],
        ethersSigner
    );
}

async function signReceiveAuthorization(
    from: string,
    to: string,
    value: number | string,
    validAfter: number | string,
    validBefore: number | string,
    nonce: string,
    domainSeparator: string,
    ethersSigner: Wallet
): Promise<Signature> {
    return signEIP712(
        domainSeparator,
        RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
        ["address", "address", "uint256", "uint256", "uint256", "bytes32"],
        [from, to, value, validAfter, validBefore, nonce],
        ethersSigner
    );
}

export async function signCancelAuthorization(
    signer: string,
    nonce: string,
    domainSeparator: string,
    ethersSigner: Wallet
): Promise<Signature> {
    return signEIP712(
        domainSeparator,
        CANCEL_AUTHORIZATION_TYPEHASH,
        ["address", "bytes32"],
        [signer, nonce],
        ethersSigner
    );
}

async function signEIP712(
    domainSeparator: string,
    typeHash: string,
    types: string[],
    parameters: (string | number)[],
    // privateKey: string
    ethersSigner: Wallet
): Promise<Signature> {
    // const digest = ethers.utils.keccak256(
    //     ethers.utils.solidityPack(
    //         "0x1901",
    //         domainSeparator,
    //         ethers.utils.keccak256(
    //             ethers.utils.defaultAbiCoder.encode(["bytes32", ...types], [typeHash, ...parameters])
    //         )
    //     )
    // );
    // console.log(ethers.utils.keccak256(ethers.utils.solidityPack(["bytes32", ...types], [typeHash, ...parameters])));
    // console.log("Data JS___:")
    // console.log(ethers.utils.defaultAbiCoder.encode(["bytes32", ...types], [typeHash, ...parameters]));
    // console.log("Domain Separator JS___:");
    // console.log(domainSeparator);

    const digest = ethers.utils.keccak256(
        "0x1901" +
            strip0x(domainSeparator) +
            domainSeparator +
            strip0x(ethers.utils.keccak256(ethers.utils.solidityPack(["bytes32", ...types], [typeHash, ...parameters])))
    );

    // console.log("Digest JS___:");
    // console.log(digest);

    console.log("Unhashed");

    const { v, r, s } = await signMessage(ethersSigner, digest);

    // console.log("v, r, s JS___:");
    // console.log(v);
    // console.log(r);
    // console.log(s);
    // console.log("Signer address JS___:");
    // console.log(await ethersSigner.getAddress());

    return { v, r, s };
}
