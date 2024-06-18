import {Address, toNano} from "@ton/core";
import {getHttpEndpoint} from "@orbs-network/ton-access";
import {BN} from 'bn.js'
import {unixNow} from "./src/lib/utils";
import {MineMessageParams, Queries} from "./src/giver/NftGiver.data";
import { TonClient } from "@ton/ton";

async function main () {

  const wallet = Address.parse('YOUR_WALLET_ADDRESS');
  const collection = Address.parse('COLLECTION_ADDRESS');

  const endpoint = await getHttpEndpoint({
    network: "testnet",
  });

  // initialize ton library
  const client = new TonClient({ endpoint });

  const { stack } = await client.runMethod(collection, 'get_mining_data')

  console.log(stack);
  console.log(stack.peek());

  const parseStackNum = (sn: bigint) => new BN(sn.toString(10), 10);

  const complexity = parseStackNum(stack.readBigNumber());
  const last_success = parseStackNum(stack.readBigNumber());
  const seed = parseStackNum(stack.readBigNumber());
  const target_delta = parseStackNum(stack.readBigNumber());
  const min_cpl = parseStackNum(stack.readBigNumber());
  const max_cpl = parseStackNum(stack.readBigNumber());

  console.log('complexity', complexity);
  console.log('last_success', last_success.toString());
  console.log('seed', seed);
  console.log('target_delta', target_delta.toString());
  console.log('min_cpl', min_cpl.toString());
  console.log('max_cpl', max_cpl.toString());

  const mineParams : MineMessageParams = {
    expire: unixNow() + 300, // 5 min is enough to make a transaction
    mintTo: wallet, // your wallet
    data1: new BN(0), // temp variable to increment in the miner
    seed // unique seed from get_mining_data
  };

  let msg = Queries.mine(mineParams); // transaction builder
  let progress = 0;

  while (new BN(msg.hash(), 'be').gt(complexity)) {
    progress += 1
    console.clear()
    console.log(`Mining started: please, wait for 30-60 seconds to mine your NFT!`)
    console.log(' ')
    console.log(`⛏ Mined ${progress} hashes! Last: `, new BN(msg.hash(), 'be').toString())

    mineParams.expire = unixNow() + 300
    mineParams.data1.iaddn(1)
    msg = Queries.mine(mineParams)
  }

  console.log(' ')
  console.log('💎 Mission completed: msg_hash less than pow_complexity found!');
  console.log(' ')
  console.log('msg_hash: ', new BN(msg.hash(), 'be').toString())
  console.log('pow_complexity: ', complexity.toString())
  console.log('msg_hash < pow_complexity: ', new BN(msg.hash(), 'be').lt(complexity))

  console.log(' ');
  console.log("💣 WARNING! As soon as you find the hash, you should quickly send the transaction.");
  console.log("If someone else sends a transaction before you, the seed changes, and you'll have to find the hash again!");
  console.log(' ');

  // flags work only in user-friendly address form
  const collectionAddr = collection.toString({
    urlSafe: true,
    bounceable: true,
  })
  // we must convert TON to nanoTON
  const amountToSend = toNano('0.05').toString()
 // BOC means Bag Of Cells here
  const preparedBodyCell = msg.toBoc().toString('base64url')

  // final method to build a payment URL
  const tonDeepLink = (address: string, amount: string, body: string) => {
    return `ton://transfer/${address}?amount=${amount}&bin=${body}`;
  };

  const link = tonDeepLink(collectionAddr, amountToSend, preparedBodyCell);

  console.log('🚀 Link to receive an NFT:')
  console.log(link);

  const qrcode = require('qrcode-terminal');

  qrcode.generate(link, {small: true}, function (qrcode : any) {
    console.log('🚀 Link to mine your NFT (use Tonkeeper in testnet mode):')
    console.log(qrcode);
    console.log('* If QR is still too big, please run script from the terminal. (or make the font smaller)')
  });
}

main()