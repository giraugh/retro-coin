const express = require('express')

const initHTTPServer = (httpPort, blockChain, p2pserver) => {
  const app = express()

  app.get('/', (req, res) => res.redirect('/blocks'))

  app.get('/blocks', (req, res) =>
    res.send(blockChain.chain)
  )

  app.get('/mine', (req, res) => {
    if (req.query.data) {
      const newBlock = blockChain.generateNextBlock(req.query.data)
      res.send(newBlock)
    } else {
      console.log('Invalid Request - requires valid ?data query')
      res.send('Invalid request - requires valid ?data query')
    }
  })

  app.get('/peers', (req, res) => {
    res.send(p2pserver.sockets.map(({_socket}) => `${_socket.remoteAddress}:${_socket.remotePort}`))
  })

  app.get('/addPeers', (req, res) => {
    if (req.query.peer) {
      p2pserver.connectTopeer(req.query.peer)
      res.send()
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
