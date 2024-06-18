import {Address, beginCell, Cell, contractAddress, StateInit} from "@ton/core";
import BN from "bn.js";
import { getNftGiverCodeCell } from "./NftGiver.code";
import { encodeOffChainContent } from "../lib/utils";

export type RoyaltyParams = {
    royaltyFactor: number
    royaltyBase: number
    royaltyAddress: Address
}

export type MiningData = {
    powComplexity: BN
    lastSuccess: number
    seed: BN
    targetDelta: number
    minComplexity: number
    maxComplexity: number
}

export type NftGiverData = {
    ownerAddress: Address
    nextItemIndex: number | BN
    collectionContent: string
    commonContent: string
    nftItemCode: Cell
    royaltyParams: RoyaltyParams
} & MiningData

// default#_ royalty_factor:uint16 royalty_base:uint16 royalty_address:MsgAddress = RoyaltyParams;
//
// storage#_
//  owner_address:MsgAddress next_item_index:uint64
//  ^[collection_content:^Cell common_content:^Cell]
//  nft_item_code:^Cell
//  royalty_params:^RoyaltyParams
//  = Storage;

export function buildNftGiverDataCell(data: NftGiverData) {
    let builder = beginCell();

    builder.storeAddress(data.ownerAddress);
    builder.storeUint(BigInt(data.nextItemIndex.toString()), 64);

    let contentCell = beginCell();

    let collectionContent = encodeOffChainContent(data.collectionContent);

    let commonContent = beginCell();
    commonContent.storeBuffer(Buffer.from(data.commonContent));

    contentCell.storeRef(collectionContent);
    contentCell.storeRef(commonContent.endCell());
    builder.storeRef(contentCell.endCell());

    builder.storeRef(data.nftItemCode);

    let royaltyCell = beginCell();
    royaltyCell.storeUint(data.royaltyParams.royaltyFactor, 16);
    royaltyCell.storeUint(data.royaltyParams.royaltyBase, 16);
    royaltyCell.storeAddress(data.royaltyParams.royaltyAddress);
    builder.storeRef(royaltyCell.endCell());

    builder.storeUint(BigInt(data.powComplexity.toString()), 256);
    builder.storeUint(data.lastSuccess, 32);
    builder.storeUint(BigInt(data.seed.toString()), 128);
    builder.storeUint(data.targetDelta, 32);
    builder.storeUint(data.minComplexity, 8);
    builder.storeUint(data.maxComplexity, 8);

    return builder.endCell();
}

export async function buildNftGiverStateInit(conf: NftGiverData) {
    const dataCell = buildNftGiverDataCell(conf);
    const codeCell = await getNftGiverCodeCell();

    const stateInit = {
        code: codeCell,
        data: dataCell
    };

    let stateInitCell = beginCell();
    stateInitCell.storeRef(codeCell);
    stateInitCell.storeRef(dataCell);

    let address = contractAddress(0, stateInit); // workchain is 0

    return {
        stateInit: stateInitCell.endCell(),
        stateInitMessage: stateInit,
        address
    };
}

export const OperationCodes = {
    ChangeOwner: 3,
    EditContent: 4,
    GetRoyaltyParams: 0x693d3950,
    GetRoyaltyParamsResponse: 0xa8cb00ad,
    Mine: 0x4d696e65,
    RescaleComplexity: 0x5253636c,
}

export type MineMessageParams = {
    expire: number;
    mintTo: Address;
    data1: BN;
    seed: BN;
    data2?: BN;
}

export const Queries = {
    changeOwner: (params: { queryId?: number; newOwner: Address }) => {
        let msgBody = beginCell();
        msgBody.storeUint(OperationCodes.ChangeOwner, 32);
        msgBody.storeUint(params.queryId || 0, 64);
        msgBody.storeAddress(params.newOwner);
        return msgBody.endCell();
    },
    getRoyaltyParams: (params: { queryId?: number }) => {
        let msgBody = beginCell();
        msgBody.storeUint(OperationCodes.GetRoyaltyParams, 32);
        msgBody.storeUint(params.queryId || 0, 64);
        return msgBody.endCell();
    },
    editContent: (params: { queryId?: number; collectionContent: string; commonContent: string; royaltyParams: RoyaltyParams }) => {
        let msgBody = beginCell();
        msgBody.storeUint(OperationCodes.EditContent, 32);
        msgBody.storeUint(params.queryId || 0, 64);

        let royaltyCell = beginCell();
        royaltyCell.storeUint(params.royaltyParams.royaltyFactor, 16);
        royaltyCell.storeUint(params.royaltyParams.royaltyBase, 16);
        royaltyCell.storeAddress(params.royaltyParams.royaltyAddress);

        let contentCell = beginCell();

        let collectionContent = encodeOffChainContent(params.collectionContent);

        let commonContent = beginCell();
        commonContent.storeBuffer(Buffer.from(params.commonContent));

        contentCell.storeRef(collectionContent);
        contentCell.storeRef(commonContent.endCell());

        msgBody.storeRef(contentCell.endCell());
        msgBody.storeRef(royaltyCell.endCell());

        return msgBody.endCell();
    },
    mine: (params: MineMessageParams) => beginCell()
        .storeUint(OperationCodes.Mine, 32)
        .storeUint(params.expire, 32)
        .storeAddress(params.mintTo)
        .storeUint(BigInt(params.data1.toString()), 256)
        .storeUint(BigInt(params.seed.toString()), 128)
        .storeUint(params.data2 ? BigInt(params.data2.toString()) : BigInt(params.data1.toString()), 256)
        .endCell(),
    rescaleComplexity: (params: { queryId?: number; expire: number }) => beginCell()
        .storeUint(OperationCodes.RescaleComplexity, 32)
        .storeUint(params.queryId || 0, 64)
        .storeUint(params.expire, 32)
        .endCell(),
}