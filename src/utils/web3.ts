import 'dotenv/config'
import Web3 from 'web3'

const getWeb3 = () => {
  /**
   * 56: Mainnet
   * 97: Testnet
   */
  const chainId = Number(process.env.CHAIN_ID)
  const provider = 'http://localhost:8546'


  return new Web3(new Web3.providers.WebsocketProvider(provider, {
    reconnect: {
      auto: true,
      delay: 1, // ms
      onTimeout: false
    }
  }))
}

export default getWeb3