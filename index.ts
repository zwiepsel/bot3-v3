import 'dotenv/config'
import {getPancakeRouterAddress} from './src/utils/addressHelpers'
import decoder from './src/utils/decoder'
import logger from './src/utils/logger'
import {checkTransaction, Helper} from './helper'
import {TokenAmountModel} from "./src/Models/TokenAmountModel";
import {decodeModel} from "./src/Models/decodeModel";
import {makeTransaction} from "./TransactionFunctions";
import {PancakeRouterABI} from "./src/abis";
import {isSell} from "./src/utils/checks";
import fs from "fs";
const abiDecoder = require('abi-decoder')

const chainId = process.env.CHAIN_ID as string
const privateKey = process.env.PRIVATE_KEY?.toLowerCase() as string
let walletAddress = process.env.WALLET?.toLowerCase() as string;
const gasLimit = Number(process.env.GAS_LIMIT)
const amountBNB = Number(process.env.AMOUNT_BNB) || 0.001
const amountBUSD = Number(process.env.AMOUNT_BUSD) || 1
const botNumber = Number(process.env.BOT) || 1
const liquidityInBNB = Boolean(process.env.LIQUIDITY_IN_BNB === 'true')
const snipelist = process.env.SNIPELIST?.toLowerCase().split(", ");
const tradelist = process.env.TRADELIST?.toLowerCase().split(", ");
const follow = process.env.FOLLOW?.toLowerCase().split(", ");
const botApiKey = process.env.BOTAPIKEY as string
const chatId = process.env.CHATID as string
const errorId = process.env.ERRORID as string
const customRouters = process.env.CUSTOMROUTERS?.toLowerCase().split(", ");
const fallBackCoin = process.env.FALLBACK?.toLowerCase() as string;
const slippagePercentage = Number(process.env.SLIPPAGEPERCENTAGE) || 1;
// const {Telegraf} = require('telegraf');
// const bot = new Telegraf(botApiKey);

const {Telegraf} = require('telegraf');
const bot = new Telegraf('1974875737:AAEOEGtLUcoxVtiCW9fJEsCxbsPkp9ISEcU');

const {Client} = require('pg')
const Ethers = require('ethers')
const Query = require('pg').Query
const Web3 = require('web3');

//======================= Test Settings ==============================================
// var web3 = new Web3(new Web3.providers.WebsocketProvider('http://51.89.40.43:8546'));
// const client = new Client({
//     user: "admin",
//     host: "51.89.40.43",
//     database: "bsc",
//     password: "P@ssw0rd",
//     port: 5432,
// })

const options = {
    timeout: 30000, // ms
    reconnect: {
        auto: true,
        delay: 1000, // ms
        maxAttempts: 15,
        onTimeout: false,
    },
    clientConfig: {
        maxReceivedFrameSize: 100000000,   // bytes - default: 1MiB
        maxReceivedMessageSize: 100000000, // bytes - default: 8MiB
        // Useful to keep a connection alive
        keepalive: true,
        keepaliveInterval: -1 // ms
    },
}

var web3 = new Web3(new Web3.providers.WebsocketProvider('http://localhost:8546'),options);
const client = new Client({
    user: "admin",
    host: "localhost",
    database: "bsc",
    password: "P@ssw0rd",
    port: 5432,
})



// The minimum ABI required to get the ERC20 Token balance
const minABI = [
    // balanceOf
    {
        constant: true,
        inputs: [{name: "_owner", type: "address"}],
        name: "balanceOf",
        outputs: [{name: "balance", type: "uint256"}],
        type: "function",
    },
];

let tokensBought: TokenAmountModel[] = [];
const purchaseAmount = liquidityInBNB ? amountBNB : amountBUSD
let whiteList:any = [];



if (!privateKey) {
    logger.error('Missing Private Key or Target Token')
    process.exit(0)
}
sendMessage('bot started')
const subscription = web3.eth.subscribe('pendingTransactions', (err: any, res: any) => {
    if (err) {
        if(err.includes('network block skew detected')){
            sendMessage(new Date().toString() + 'network problem detected: ' + err);
        }
        else {
            sendMessage(new Date().toString() + 'Unknow error on blockchain: ' + err);
        }
    }
});

subscription.on('data',(txHash: any) => {
    setTimeout(async () => {
            try {
                let tx = await getTransaction(txHash)
                if (tx) {
                    if (tx?.to?.toLowerCase() === getPancakeRouterAddress()) {
                        if (tx) {
                            jsonReader("../whitelist.json");
                            // 1 ON 1  TRADE FOLLOWING
                            if (tradelist?.includes(tx.from.toLowerCase())) {
                                //     if (1 === 1) {
     
                                const txInputDecoded = decoder(tx?.input)
                                const decodedMessage: Array<decodeModel> = txInputDecoded.params
                                let tokenIn = ''
                                let tokenOut = ''
                                let option = 1;
                                let amountIn: any = 0;
                                let amountOutMin: any = 0;
                                let amountInMax: any = 0;
                                var path: any = [];
                                let swap = false;
                                let exit = false;
                                for (const prop1 of decodedMessage) {
                                    if (prop1.name === 'path') {
                                        path = prop1.value;
                                        tokenIn = prop1.value[0];
                                        tokenOut = prop1.value[prop1.value.length - 1]
                                    }
                                    if (prop1.name === 'tokens') {
                                        tokenIn = prop1.value[0];
                                        tokenOut = prop1.value[prop1.value.length - 1]
                                    }

                                    // if (prop1.name === 'amountInMin') {
                                    //     amountIn = prop1.value;
                                    // }
                                    
                                    
                                    // OPTION 1
                                    if (prop1.name === 'amountIn') {
                                        amountIn = prop1.value;
                                    }

                                    if(prop1.name === 'amountOutMin')
                                    {
                                        amountOutMin = prop1.value;
                                    }
                                    
                                    
                                    // OPTION 2
                                    if(prop1.name === 'amountOut')
                                    {
                                        //option 1
                                        amountOutMin = prop1.value;
                                        // amountInMax = prop1.value;
                                        // option = 2;
                                    }
                                    if (prop1.name === 'amountInMax') {
                                        amountInMax = prop1.value;
                                        option = 2;
                                    }
                                }

                                if (tx.value > 0.1) {
                                    amountIn = tx.value;
                                }
                                if(!isSell(tokenOut) && !isSell(tokenIn)){
                                    swap = true;
                                }


                                // console.log(amountOutWithSlippage);
                                //  console.log( Ethers.utils.parseUnits(`${amountOutWithSlippage}`, 'wei'))
                                console.log('=====================================') // a visual separator
                                sendMessage(new Date().toISOString() + ` Nieuwe trade | https://www.bscscan.com/tx/${txHash}`);
                                let result = false;
                                // var transactionReceipt = await getTransactionReceipt(txHash);
                                // if (!transactionReceipt.status) {
                                //     sendMessage(new Date().toString() + ' transfer check failed for transaction: ' + txHash)
                                //     return;
                                // }


                                if (tokenIn === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' && (tokenOut === '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'.toLowerCase() || tokenOut === '0x4fabb145d64652a948d72533023f6e7a623c7c53'.toLowerCase() || tokenOut === '0x55d398326f99059fF775485246999027B3197955'.toLowerCase()))
                                    //Don’t follow!!! Dit is van bnb naar stable
                                {
                                    sendMessage(`Trade not allowed, stablecoin swap: ${tokenOut}`)
                                    return;
                                }
                                if (tokenIn === '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'.toLowerCase() && (tokenOut === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'.toLowerCase() || tokenOut === '0x4fabb145d64652a948d72533023f6e7a623c7c53'.toLowerCase() || tokenOut === '0x55d398326f99059fF775485246999027B3197955'.toLowerCase()))
                                    // Don’t follow!!! Dit is van busd naar stable of bnb
                                {
                                    sendMessage(`Trade not allowed, stablecoin swap: ${tokenOut}`)
                                    return;
                                }
                                if (tokenIn === '0x4fabb145d64652a948d72533023f6e7a623c7c53'.toLowerCase() && (tokenOut === '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'.toLowerCase() || tokenOut === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'.toLowerCase() || tokenOut === '0x55d398326f99059fF775485246999027B3197955'.toLowerCase())) {
                                    sendMessage(`Trade not allowed, stablecoin swap: ${tokenOut}`)
                                    return;
                                }
                                if (tokenIn === '0x55d398326f99059fF775485246999027B3197955'.toLowerCase() && (tokenOut === '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'.toLowerCase() || tokenOut === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'.toLowerCase() || tokenOut === '0x4fabb145d64652a948d72533023f6e7a623c7c53'.toLowerCase())) {
                                    sendMessage(`Trade not allowed, stablecoin swap: ${tokenOut}`)
                                    return;
                                }
                                if (!whiteList?.includes(tokenOut!.toLowerCase()) && !swap) {
                                    sendMessage(new Date().toISOString() + `Token not allowed: ${tokenOut} - poocoin chart : https://poocoin.app/tokens/${tokenOut}`);
                                    sendNotAllowedMessage( botNumber + '-TokenToAllow: ' + tokenOut!.toLowerCase());
                                    return;
                                }
                                if (!whiteList?.includes(tokenOut!.toLowerCase()) && swap) {
                                    tokenOut = fallBackCoin;
                                }

                                // if (tokenOut !== '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' && tokenOut !== '0x4fabb145d64652a948d72533023f6e7a623c7c53' && tokenOut !== '0xe9e7cea3dedca5984780bafc599bd69add087d56' && tokenOut !== '0x55d398326f99059fF775485246999027B3197955') {
                                //     if (Ethers.utils.formatUnits(amountIn, "ether") < 0.1) {
                                //         console.log('=====================================') // a visual separator
                                //         sendMessage(`Amount smaller then 0.1 bnb, no buy: ${txHash}`)
                                //         return;
                                //
                                //     }
                                // }
                                //buy or sell token
                                await makeTransaction(tokenIn, tokenOut, walletAddress, tx.gas, path, amountIn, amountOutMin, txHash, option, amountInMax, tx.gasPrice, tx.nonce, swap, slippagePercentage);
                            }
                        }
                    }
                    else{
                        if (tradelist?.includes(tx.from.toLowerCase())) {
                            // sendCriticalMessage(tx);
                        }
                    }
                }
                else {
                    // sendMessage(new Date().toString() + 'transactie niet verwerkt, duurt langer dan 6 seconde: ' + txHash); 
                }
            } catch
                (err) {
                sendMessage(new Date().toISOString() + 'Fout: ' + err);
            }
        }
    )
})
;

export function sendMessage(message: string) {
    bot.telegram.sendMessage(chatId, message)
    console.log(message)
}

export function sendCriticalMessage(message: string) {
    bot.telegram.sendMessage(errorId, message)
    console.log(message)
}

export function sendNotAllowedMessage(message: string) {
    bot.telegram.sendMessage(chatId, message, {
        reply_markup: {
            inline_keyboard: [[{
                text: 'Add to whitelist',
                callback_data: message,

            }]]
        }
    })
}
async function getTransaction(transactionHash: string) {
    for (let attempt = 1; attempt <= 120; attempt++) {
        const transaction = await web3.eth.getTransaction(transactionHash);
        if (transaction) return transaction;
        await Helper.sleep(100);
    }
}

async function readFile() {
    for (let attempt = 1; attempt <= 240; attempt++) {
        const transaction = await fs.readFileSync("../whitelist.json")
        if (transaction) return transaction;
        await Helper.sleep(100);
    }
}

export async function getTransactionReceipt(transactionHash: string) {
    for (let attempt = 1; attempt <= 100; attempt++) {
        const transaction = await web3.eth.getTransactionReceipt(transactionHash);
        if (transaction) return transaction;
        await Helper.sleep(100);
    }
}

export async function getBalance(tokenIn:any) {
    for (let attempt = 1; attempt <= 100; attempt++) {
        const contractIn = new web3.eth.Contract(minABI, tokenIn);
        const result = await contractIn.methods.balanceOf(walletAddress).call();
        if (result) return result;
        await Helper.sleep(50);
    }
}

export function jsonReader(filePath:any) {
    whiteList =  fs.readFileSync(filePath,'utf8')
}

export async function getAllowance(walletAddress:any, contractOut: any, tokenOut: any) {
    for (let attempt = 1; attempt <= 600; attempt++) {
        let result = null;
        result =   await contractOut.methods.allowance(walletAddress, '0x10ED43C718714eb63d5aA57B78B54704E256024E').call();
        if (result) return result;
        await Helper.sleep(100);
    }
}

process.on('SIGINT', function () {
    sendMessage('Bot gestopt')
    process.exit(0)
})

process.on('exit', (code) => {
    sendMessage('Bot gestopt met code: ' + code);
});

process.on('uncaughtException', (err, origin) => {
    sendMessage('Niet gevangen fout in bot op :' + err)
});

