const {BlockChain} = require('./src/blockchain')
const {PeerToPeerServer} = require('./src/p2p')
const {initHTTPServer} = require('./src/http')
const {Wallet} = require('./src/wallet')

/*
TODO:
- Test p2p
- Ensure that blocks and chaines are properly reconstructed once recieved from peer.
*/

const startNode = (httpPort = '3456', p2pPort = '3400', walletLocation = 'node/wallet/private_key') => {
  let blockchain = new BlockChain()
  let p2pServer = new PeerToPeerServer(p2pPort, blockchain)
  let wallet = new Wallet(walletLocation)
  initHTTPServer(httpPort, blockchain, p2pServer, wallet)
}

module.exports = {
  startNode
}
