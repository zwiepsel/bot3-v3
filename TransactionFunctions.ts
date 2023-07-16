import {getAllowance, getBalance, getTransactionReceipt, sendCriticalMessage, sendMessage} from "./index";
import {BigNumber, Wallet} from "ethers";
import {isSell} from "./src/utils/checks";
import {PancakeRouterABI} from "./src/abis";
import {getPancakeRouterAddress} from "./src/utils/addressHelpers";

const privateKey = process.env.PRIVATE_KEY?.toLowerCase() as string
const slippage = Number(process.env.SLIPPAGE)
const gasPriceEnv = Number(process.env.GAS)
const gasLimitEnv = Number(process.env.GAS_LIMIT)
const frontrun = Boolean(process.env.FRONTRUN === 'true')
var Web3 = require('web3');
const Ethers = require('ethers')
const {Client} = require('pg')
const amountBNB = process.env.AMOUNT_BNB as string
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
    // allowance
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            },
            {
                "name": "_spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

const client = new Client({
    user: "admin",
    host: "localhost",
    database: "bsc",
    password: "P@ssw0rd",
    port: 5432,
})

var rpcProvider = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
//======================= Test Settings ==============================================
// var web3 = new Web3(new Web3.providers.WebsocketProvider('http://51.89.40.43:8546'));
// const client = new Client({
//     user: "admin",
//     host: "51.89.40.43",
//     database: "bsc",
//     password: "P@ssw0rd",
//     port: 5432,
// })

const provider = new Ethers.providers.JsonRpcProvider('https://silent-black-moon.bsc.quiknode.pro/85d014e16c9bddf4bfd5544c9eed0767a93d6fb0/');

const wallet = new Ethers.Wallet(privateKey);
const account = wallet.connect(provider);

const AmountOutABI = {
    "inputs": [{
        "internalType": "uint256",
        "name": "amountIn",
        "type": "uint256"
    }, {"internalType": "address[]", "name": "path", "type": "address[]"}],
    "name": "getAmountsOut",
    "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
}

const router = new Ethers.Contract(
    '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    [
        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
        'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ],
    account
);


export async function makeTransaction(tokenIn: any, tokenOut: any, walletAddress: string, gasLimit: number, path: any[], amountIn: any, amountOutMin: any, txHash: any, option: number, amountInMax: any, newGasPrice: any, nonce: any, swap: boolean, slippagePercentage: number) {
    let contractIn = new rpcProvider.eth.Contract(minABI, tokenIn);
    let contractOut = new rpcProvider.eth.Contract(minABI, tokenOut);
    let pancakeContract = new rpcProvider.eth.Contract(PancakeRouterABI, getPancakeRouterAddress());
    let balance = await getBalance(tokenIn);
    let allowanceApprove = await getAllowance(walletAddress, contractOut, tokenOut)

    var amountInToCalculate = 0;
    var amountOutWithSlippage = '';
    let amountToSell = amountIn;

    var transactionFollowFailed = false;
    var transactionOursFailed = false;
    var failedAmount = 0;
    if (balance === 0 || balance === "0") {
        //sendMessage('amount to sell is 0 no transaction: ' + tokenIn + ' => ' + tokenOut);
        return;
    }

    var amountBig = '';
    var biggestAmount = 0;
    var swapWithChange = false;
    if (frontrun) {
        newGasPrice = newGasPrice.slice(0, -1) + 1;
    }
    if (slippagePercentage !== 1) {
        gasLimit = Math.round(gasLimit * slippagePercentage);
    }

    if (Number(amountToSell) >= Number(balance)) {
        if (!isSell(tokenOut) && !swap) {
            sendMessage('More then balance do nothing  ' + balance + ' tokenswap: ' + tokenIn + ' => ' + tokenOut);
            //sendCriticalMessage('Cannot follow dont have enough balance for buying: ' + tokenOut + ' Balance is: ' + balance)
            return;
        }
        amountToSell = balance
        failedAmount = balance
        if (option === 1) {
            var amountOutRetreived = await pancakeContract.methods.getAmountsOut(balance, [tokenIn, tokenOut]).call();
            amountInToCalculate = amountOutRetreived[1] * 0.970000000
        }
        //  sendMessage('Sell with more out then balance switch to balance: ' + balance + ' tokenswap: ' + tokenIn + ' => ' + tokenOut);
    } else {
        // amountOut functie
        if (option === 1) {
            amountInToCalculate = amountOutMin / slippage;
            failedAmount = amountToSell;
        }

        // amountInMax functie
        if (option === 2) {
            amountInToCalculate = amountInMax * slippage;
            failedAmount = amountInMax
        }
    }
    amountOutWithSlippage = eToNumber(amountInToCalculate).toString().split('.')[0]

    if (swap && isSell(tokenOut)) {
        sendMessage('Swap (token naar token) and sell amountOutMin is 0')
        amountOutWithSlippage = "0";
        if (path.includes('0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c')) {
            var index = path.indexOf('0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c');
            if (index !== -1) {
                path.splice(index + 1);
            }

        } else {
            path.splice(path.length - 1, 1, '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c');
        }
    }

    if (option === 1) {
        sendMessage('handling incoming transaction (option 1): ' + tokenIn + ' => ' + tokenOut + ' amountIn: ' + amountToSell + ' amountOutMin: ' + amountOutWithSlippage);
        let transaction = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            Ethers.utils.parseUnits(`${amountToSell}`, 'wei'),
            amountOutWithSlippage,
            path,
            walletAddress,
            Math.floor(Date.now() / 1000) + 60 * 5, //5 minutes
            {
                //'gasLimit': 30000,
                'gasLimit': gasLimit,
                'gasPrice': newGasPrice,
                'nonce': null
            })
        transaction.wait().then(async (result: any) => {
                sendMessage(new Date().toISOString() + ` - Transaction receipt : https://bscscan.com/tx/${result.logs[1].transactionHash}`);
                //if not approve, approve the coin
                if (allowanceApprove === "0") {
                    // sendMessage(new Date().toISOString() + '- storing approving coin to database')
                    let approve = new Ethers.Contract(
                        tokenOut.toLowerCase(),
                        ['function approve(address spender, uint amount) public returns(bool)'],
                        account
                    )
                    const trans = await approve.approve(
                        '0x10ED43C718714eb63d5aA57B78B54704E256024E',
                        // Approve max amount for token.
                        BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
                        {
                            'gasPrice': 5000000000,
                        }
                    );
                }
                for (const log of result.logs) {
                    if (log.address.toLowerCase() === tokenOut.toLowerCase()) {
                        var amountToSell = Web3.utils.hexToNumberString(log.data);
                        if (parseInt(amountToSell) > biggestAmount) {
                            biggestAmount = parseInt(amountToSell);
                            amountBig = eToNumber(amountToSell).split('.')[0];
                        }
                    }
                }
            },
            async (e: any) => {
                transactionOursFailed = true;
                sendMessage(new Date().toISOString() + `tx failed via ethers ${e}`);
            });
    }
    if (option === 2) {
        if (isSell(tokenOut) && Number(amountInMax) > Number(balance)) {
            // op balans, get amountOutMin + 5% minder (0,95)
            amountOutRetreived = await pancakeContract.methods.getAmountsOut(balance, [tokenIn, tokenOut]).call();
            amountInToCalculate = amountOutRetreived[1] * 0.970000000
            sendMessage(`Selling, amountinmax greater then balance (option 2) : ${txHash} selling token now` + tokenIn + ' , amountInMax: ' + amountInMax + ' > Balance: ' + balance)
            let transaction = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                Ethers.utils.parseUnits(`${balance}`, 'wei'),
                amountInToCalculate,
                path,
                walletAddress,
                Math.floor(Date.now() / 1000) + 60 * 5, //5 minutes
                {
                    //'gasLimit': 30000,
                    'gasLimit': gasLimit,
                    'gasPrice': newGasPrice,
                    'nonce': null
                })
            transaction.wait().then(async (result: any) => {
                    sendMessage(new Date().toISOString() + ` - Transaction receipt : https://bscscan.com/tx/${result.logs[1].transactionHash}`);
                },
                async (e: any) => {
                    transactionOursFailed = true;
                    sendMessage(new Date().toISOString() + `tx failed via ethers ${e}`);
                });
        } else {
            sendMessage(`Handling transaction for Amountinmax (option 2) : ${txHash} ` + ' token: ' + tokenIn + ' , amountOut:' + amountOutMin + ' Balance: ' + balance)
            let transaction = await router.swapTokensForExactTokens(
                Ethers.utils.parseUnits(`${amountOutMin}`, 'wei'),
                amountOutWithSlippage,
                path,
                walletAddress,
                Math.floor(Date.now() / 1000) + 60 * 5, //5 minutes
                {
                    'gasLimit': gasLimit,
                    'gasPrice': newGasPrice,
                    'nonce': null //set you want buy at where position in blocks
                })
            transaction.wait().then(async (result: any) => {
                    sendMessage(new Date().toISOString() + ` - Transaction receipt : https://bscscan.com/tx/${result.logs[1].transactionHash}`);
                    if (allowanceApprove === "0") {
                        sendMessage(new Date().toISOString() + '- storing approving coin to database')
                        let approve = new Ethers.Contract(
                            tokenOut.toLowerCase(),
                            ['function approve(address spender, uint amount) public returns(bool)'],
                            account
                        )
                        const trans = await approve.approve(
                            '0x10ED43C718714eb63d5aA57B78B54704E256024E',
                            // Approve max amount for token.
                            BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
                            {
                                'gasPrice': 5000000000,
                            }
                        );
                    }
                    // it is a buy and get biggest amount from the log
                    if (!isSell(tokenOut)) {
                        var transactionReceipt = await getTransactionReceipt(txHash);
                        if (!transactionReceipt.status) {
                            for (const log of result.logs) {
                                if (log.address.toLowerCase() === tokenOut.toLowerCase()) {
                                    var amountToSell = Web3.utils.hexToNumberString(log.data);
                                    if (parseInt(amountToSell) > biggestAmount) {
                                        biggestAmount = parseInt(amountToSell);
                                        // Amount of tokens we have bought
                                        amountBig = eToNumber(amountToSell).split('.')[0];
                                    }
                                }
                            }
                        }
                    }
                },
                async (e: any) => {
                    // set transaction failed, our transaction failed.
                    transactionOursFailed = true;
                    sendMessage(new Date().toISOString() + `tx failed via ethers ${e}`);
                });
        }
    }

    var transactionReceipt = await getTransactionReceipt(txHash);
    if (!transactionReceipt.status) {
        transactionFollowFailed = true;
    }

    // after 10 sec, check if the transaction all completed succesfully otherwise sell the tokens
    await new Promise(r => setTimeout(r, 10000));
    var balanceOut = await getBalance(tokenOut);
    // if it is a buy and the transaction we follow fails and ours did not fail sell the tokens we bought
    if (!isSell(tokenOut) && transactionFollowFailed && !transactionOursFailed) {
        if (option === 1) {
            sendMessage(`Buy transaction Failed from check (option 1): ${txHash} selling token now` + tokenIn + ' , ' + amountBig)
            amountOutRetreived = await pancakeContract.methods.getAmountsOut(balance, [tokenIn, tokenOut]).call();
            amountInToCalculate = amountOutRetreived[1] * 0.970000000
            let transaction2 = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amountBig,
                amountInToCalculate,
                path.reverse(),
                walletAddress,
                Math.floor(Date.now() / 1000) + 60 * 5, //5 minutes
                {
                    'gasLimit': gasLimitEnv,
                    'gasPrice': gasPriceEnv,
                    'nonce': null //set you want buy at where position in blocks
                })
            transaction2.wait().then(async (result: any) => {
                    sendMessage(new Date().toISOString() + ` - Transaction receipt : https://bscscan.com/tx/${result.logs[1].transactionHash}`);
                },
                (error: any) => {
                    sendCriticalMessage('Buy failed option 1 and follow address did fail and 2nd sell failed , token not sold: ' + tokenIn + ' Amount to sell : ' + amountBig + 'tx: ' + txHash)
                });
        }
        // option 2 sell what we have bought
        if (option === 2) {
            sendMessage(`Buy transaction Failed from check (option2) : ${txHash} selling token now: ` + tokenIn + ' , ' + amountOutMin)
            amountOutRetreived = await pancakeContract.methods.getAmountsOut(amountToSell, [tokenIn, tokenOut]).call();
            amountInToCalculate = amountOutRetreived[1] * 0.970000000
            let transaction2 = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                Ethers.utils.parseUnits(`${amountBig}`, 'wei'),
                amountInToCalculate,
                path.reverse(),
                walletAddress,
                Math.floor(Date.now() / 1000) + 60 * 5, //5 minutes
                {
                    'gasLimit': gasLimitEnv,
                    'gasPrice': gasPriceEnv,
                    'nonce': null //set you want buy at where position in blocks
                })
            transaction2.wait().then(async (result: any) => {
                    sendMessage(new Date().toISOString() + ` - Transaction receipt : https://bscscan.com/tx/${result.logs[1].transactionHash}`);
                },
                (error: any) => {
                    sendCriticalMessage('Buy failed option 2 and follow address did fail and 2nd sell failed , token not sold: ' + tokenIn + ' Amount to sell : ' + amountBig + 'tx: ' + txHash)
                });
        }
    }

    // if it is a sell and the transaction we followed did not fail and ours did, we need to retry the sell
    if (isSell(tokenOut) && !transactionFollowFailed && transactionOursFailed) {
        if (option === 1) {
            sendMessage(`Sell transaction Failed from check (option 1): ${txHash} retry sell now: ` + tokenIn + ' , ' + amountToSell)
            let balance = await getBalance(tokenIn);
            if (Number(amountToSell) >= Number(balance)) {
                amountToSell = balance
                sendMessage('Retry sell with more out then balance switch to balance: ' + balance + ' tokenswap: ' + tokenIn + ' => ' + tokenOut);
            }
            if (balance === 0) {
                return;
            }
            amountOutRetreived = await pancakeContract.methods.getAmountsOut(amountToSell, [tokenIn, tokenOut]).call();
            amountInToCalculate = amountOutRetreived[1] * 0.970000000;
            let transaction2 = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                Ethers.utils.parseUnits(`${amountToSell}`, 'wei'),
                amountInToCalculate,
                path,
                walletAddress,
                Math.floor(Date.now() / 1000) + 60 * 5, //5 minutes
                {
                    'gasLimit': gasLimitEnv,
                    'gasPrice': gasPriceEnv,
                    'nonce': null //set you want buy at where position in blocks
                })
            transaction2.wait().then(async (result: any) => {
                    sendMessage(new Date().toISOString() + ` - Transaction receipt : https://bscscan.com/tx/${result.logs[1].transactionHash}`);
                },
                (error: any) => {
                    sendCriticalMessage('Sell failed option 1 and follow address did not fail , token not sold: ' + tokenIn + ' Amount to sell : ' + amountToSell + 'tx: ' + txHash)
                });
        }
        // Sell failed and amountInMax is smaller then balance ( we got more)
        if (option === 2 && Number(amountInMax) < Number(balance)) {
            sendMessage(`Sell transaction Failed from check (option 2): ${txHash} amountInMax < Balance selling token now: ` + tokenIn + ' , ' + amountOutMin + ' amountinmax: ' + amountInMax + ' < balance: ' + balance)
            let transaction2 = await router.swapTokensForExactTokens(
                Ethers.utils.parseUnits(`${amountOutMin}`, 'wei'),
                BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935"),
                path,
                walletAddress,
                Math.floor(Date.now() / 1000) + 60 * 5, //5 minutes
                {
                    'gasLimit': gasLimitEnv,
                    'gasPrice': gasPriceEnv,
                    'nonce': null //set you want buy at where position in blocks
                })
            transaction2.wait().then(async (result: any) => {
                    sendMessage(new Date().toISOString() + ` - Transaction receipt : https://bscscan.com/tx/${result.logs[1].transactionHash}`);
                })
        }
        if (option === 2 && Number(amountInMax) > Number(balance)) {
            sendMessage(`Sell transaction Failed from check (option 2): ${txHash} amountInMax > Balance  selling token now: ` + tokenIn + ' amountinmax: ' + amountInMax + ' > balance: ' + balance)
            let newBalance = await getBalance(tokenIn);
            if (newBalance === 0) {
                return;
            }
            amountOutRetreived = await pancakeContract.methods.getAmountsOut(newBalance, [tokenIn, tokenOut]).call();
            amountInToCalculate = amountOutRetreived[1] * 0.970000000
            let transaction2 = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                newBalance,
                amountInToCalculate,
                path,
                walletAddress,
                Math.floor(Date.now() / 1000) + 60 * 5, //5 minutes
                {
                    'gasLimit': gasLimitEnv,
                    'gasPrice': gasPriceEnv,
                    'nonce': null //set you want buy at where position in blocks
                })
            transaction2.wait().then(async (result: any) => {
                    sendMessage(new Date().toISOString() + ` - Transaction receipt : https://bscscan.com/tx/${result.logs[1].transactionHash}`);
                },
                (error: any) => {
                    sendCriticalMessage('Sell failed option 2 and amountInMAx > Balance, token not sold: ' + tokenIn + ' Balance is: ' + balance + 'tx: ' + txHash)
                });
        }
    }


}


function eToNumber(num: any) {
    let sign = "";
    (num += "").charAt(0) == "-" && (num = num.substring(1), sign = "-");
    let arr = num.split(/[e]/ig);
    if (arr.length < 2) return sign + num;
    let dot = (.1).toLocaleString().substr(1, 1), n = arr[0], exp = +arr[1],
        w = (n = n.replace(/^0+/, '')).replace(dot, ''),
        pos = n.split(dot)[1] ? n.indexOf(dot) + exp : w.length + exp,
        L: any = pos - w.length, s = "" + BigInt(w);
    w = exp >= 0 ? (L >= 0 ? s + "0".repeat(L) : r()) : (pos <= 0 ? "0" + dot + "0".repeat(Math.abs(pos)) + s : r());
    L = w.split(dot);
    if (L[0] == 0 && L[1] == 0 || (+w == 0 && +s == 0)) w = 0; //** added 9/10/2021
    return sign + w;

    function r() {
        return w.replace(new RegExp(`^(.{${pos}})(.)`), `$1${dot}$2`)
    }
}
