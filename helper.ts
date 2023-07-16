const axios = require('axios')

let apiKey = process.env.APIKEY?.toLowerCase() as string;

export class Helper {
    static sleep(ms: number) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

export async function checkTransaction(txHash: any, timeOut: number = 1000, tries: number = 120) {
    await newTimeout(timeOut);
    let failedTransaction = true;
    let attempts = 0;
    for (let i = 0; i < tries; i++) {
        await axios.get(`https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${apiKey}`)
            .then((res: any) => {
                //Transaction is correct according to BSCSCAN
                if (res.data.result.status === "1") {
                    i = tries
                    failedTransaction = false;
                }
                //Transaction is failed according to BSCSCAN
                else if (res.data.result.status === "0") {
                    i = tries
                    failedTransaction = true;
                }
                //Transaction is still being processed by BSCSCAN
                else {
                    attempts++
                    failedTransaction = true;
                }
            }).catch((error: any) => {
                // HTTP GET call failed, log error
                console.log('fout: ' + error)
            })
        await newTimeout(timeOut); // wait till try again
    }
    if(failedTransaction){
        console.log('failed transaction after attempts: ' + attempts)
    }
    return failedTransaction;
}

function newTimeout(ms: any) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}



