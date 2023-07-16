
const sellTokens = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c, 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56, 0x4fabb145d64652a948d72533023f6e7a623c7c53, 0x55d398326f99059fF775485246999027B3197955, 0x2170Ed0880ac9A755fd29B2688956BD959F933F8'.toLowerCase()

export const isSell = (address:string) => {
    return sellTokens.includes(address.toLowerCase());
}
