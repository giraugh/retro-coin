const {BlockChain} = require('./src/blockchain')
const {PeerToPeerServer} = require('./src/p2p')
const initHTTPServer = require('./src/http')

/*
TODO:
- Test p2p
- Ensure that blocks and chaines are properly reconstructed once recieved from peer.
*/

const startNode = (httpPort = '3456', p2pPort = '3400') => {
  let retroCoin = new BlockChain()
  let p2pServer = new PeerToPeerServer(httpPort, retroCoin)
  initHTTPServer(p2pPort, retroCoin, p2pServer)
}

startNode()

module.exports = {
  startNode
}
