const express = require('express')

const initHTTPServer = (httpPort, blockChain, p2pserver, wallet) => {
  const app = express()

  app.get('/', (req, res) => res.redirect('/blocks'))

  app.get('/blocks', (req, res) =>
    res.send(blockChain.chain)
  )

  app.get('/mineRaw', (req, res) => {
    if (req.query.data) {
      // Create and mine the new block
      const newBlock = blockChain.generateRawNextBlock(req.query.data)

      // Tell everyone
      if (newBlock) {
        res.send(newBlock)
        p2pserver.broadcastLatest()
      } else {
        res.send('Failed to add block to chain.')
      }
    } else {
      console.log('Invalid Request - requires valid ?data query')
      res.send('Invalid request - requires valid ?data query')
    }
  })

  app.get('/mineBlock', (req, res) => {
    const newBlock = blockChain.generateNextBlock(wallet.getPublic())
    // Tell everyone
    if (newBlock) {
      res.send(newBlock)
      p2pserver.broadcastLatest()
    } else {
      res.send('Failed to add block to chain.')
    }
  })

  app.get('/mineTransaction', (req, res) => {
    if (req.query.address && req.query.amount) {
      let address = req.query.address
      let amount = Number(req.query.amount)
      const transaction = wallet.createTransaction(
        address,
        amount,
        blockChain.unspentTxOuts
      )
      const newBlock = blockChain.generateNextBlock(wallet.getPublic(), [transaction])
      // Tell everyone
      if (newBlock) {
        res.send(newBlock)
        p2pserver.broadcastLatest()
      } else {
        res.send('Failed to add block to chain.')
      }
    } else {
      console.log('Invalid Request - requires valid ?address and ?amount query')
      res.send('Invalid request - requires valid ?address and ?amount query')
    }
  })

  app.get('/balance', (req, res) => {
    console.log(wallet.getPublic())
    console.log(blockChain.unspentTxOuts)
    const balance = wallet.getBalance(wallet.getPublic(), blockChain.unspentTxOuts)
    res.send(`Account balance is ${balance}`)
  })

  app.get('/peers', (req, res) => {
    res.send(p2pserver.sockets.map(({_socket}) => `${_socket.remoteAddress}:${_socket.remotePort}`))
  })

  app.get('/addPeer', (req, res) => {
    if (req.query.peer) {
      p2pserver.connectToPeer(req.query.peer)
      res.send('Added new peer')
    } else {
      console.log('Invalid Request - requires valid ?peer query')
      res.send('Invalid Request - requires valid ?peer query')
    }
  })

  app.listen(httpPort, () => {
    console.log(`Started http interface on port: ${httpPort}`)
  })
}

module.exports = {
  initHTTPServer
}
