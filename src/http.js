const express = require('express')

const initHTTPServer = (httpPort, blockChain, p2pserver) => {
  const app = express()

  app.get('/', (req, res) => res.redirect('/blocks'))

  app.get('/blocks', (req, res) =>
    res.send(blockChain.chain)
  )

  app.get('/mine', (req, res) => {
    if (req.query.data) {
      // Create and mine the new block
      const newBlock = blockChain.generateNextBlock(req.query.data)

      // Respond to http
      res.send(newBlock)

      // Tell everyone
      p2pserver.broadcastLatest()
    } else {
      console.log('Invalid Request - requires valid ?data query')
      res.send('Invalid request - requires valid ?data query')
    }
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

module.exports = initHTTPServer
