const abiDecoder = require('abi-decoder')
import {SellToPancake, PancakeRouterABI, ERC20ABI, WBNB_ABI} from '../abis'
import logger from './logger'

const decoder = (input: string | undefined) => {
  if (input === undefined) {
    return
  }

  try {
    abiDecoder.addABI(PancakeRouterABI)
    abiDecoder.addABI(SellToPancake)
    const result = abiDecoder.decodeMethod(input);

    return result
  }
  catch (err) {
    logger.error(err)
    return
  }
}

export default decoder