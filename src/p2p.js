const {Block} = require('./blockchain')
const WebSocket = require('ws')

const QUERY_LATEST = 0
const QUERY_ALL = 1
const RESPONSE_BLOCKCHAIN = 2

class PeerToPeerServer {
  constructor (port, blockchain) {
    this.port = port
    this.blockchain = blockchain
    this.server = new WebSocket.Server({port})
    this.sockets = []

    this.server.on('connection', (ws) => this.initConnection(ws))
    console.log('Started p2p node on port: ' + port)
  }

  initConnection (ws) {
    this.sockets.push(ws)
    this.initMessageHandler(ws)
    this.initErrorHandler(ws)
    this.write(ws, this.queryChainLengthMessage())
  }

  initMessageHandler (ws) {
    ws.on('message', data => {
      let message = this.tryParseJSON(data)
      if (message == null) {
        return console.warn(`Failed to parse received JSON Message: ${data}`)
      } else {
        console.log(`Received Message: ${JSON.stringify(message)}`)
        switch (message.type) {
          case QUERY_LATEST:
            this.write(ws, this.responseLatestMessage())
            break
          case QUERY_ALL:
            this.write(ws, this.responseChainMessage())
            break
          case RESPONSE_BLOCKCHAIN:
            let receivedBlocks = this.tryParseJSON(message.data)
            if (receivedBlocks === null) {
              console.warn(`Failed to parse receieved chain: ${message.data}`)
              break
            } else {
              this.handleBlockChainResponse(receivedBlocks)
            }
            break
        }
      }
    })
  }

  initErrorHandler (ws) {
    const closeConnection = aws => {
      console.log(`Connection failed to peer: ${aws.url}`)
      this.sockets.splice(this.sockets.indexOf(aws, 1))
    }
    ws.on('close', _ => closeConnection(ws))
    ws.on('error', _ => closeConnection(ws))
  }

  handleBlockChainResponse (receivedBlocks) {
    if (receivedBlocks.length === 0) {
      return console.log('Received 0 length chain.')
    }

    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1]
    if (!Block.isValidStructure(latestBlockReceived)) {
      return console.log('Block structure invalid')
    }

    const latestBlockHeld = this.chain.latestBlock()
    if (latestBlockReceived.index > latestBlockHeld.index) {
      console.log(
        `Chain possibly behind - peer latest index: ${latestBlockReceived.index}, our latest index: ${latestBlockHeld.index}`
      )
      if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
        if (this.blockchain.addBlock(latestBlockReceived)) {
          this.broadcast(this.responseLatestMessage())
        }
      } else if (receivedBlocks.length === 1) {
        console.log('We have to query the chain from our peer.')
        this.broadcast(this.queryAllMsg())
      } else {
        console.log('Receieved chainis longer than ours, replacing...')
        this.blockchain.replace(receivedBlocks)
      }
    } else {
      console.log('Receieved chain is not longer - do nothing')
    }
  }

  write (ws, message) {
    ws.send(JSON.stringify(message))
  }

  broadcast (message) {
    this.sockets.forEach(socket => this.write(socket, message))
  }

  queryChainLengthMessage () { return ({type: QUERY_LATEST, data: null}) }
  queryAllMsg () { return ({type: QUERY_ALL, data: null}) }
  responseChainMessage () {
    return {
      type: RESPONSE_BLOCKCHAIN,
      data: JSON.stringify(bc.chain)
    }
  }
  responseLatestMessage () {
    return {
      type: RESPONSE_BLOCKCHAIN,
      data: JSON.stringify([bc.latestBlock()])
    }
  }

  broadcastLatest () {
    this.broadcast(this.responseLatestMessage())
  }

  connectToPeer (newPeer) {
    let ws = new WebSocket(newPeer)
    ws.on('open', _ => this.initConnection(ws))
    ws.on('error', _ => console.warn('Connection failed'))
  }

  tryParseJSON (data) {
    try {
      return JSON.parse(data)
    } catch (e) {
      console.warn(e)
      return null
    }
  }
}

module.exports = {
  PeerToPeerServer
}
