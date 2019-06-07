const {TxIn, TxOut, Transaction, getPublicKey} = require('./transactions') 
const ec = require('elliptic').ec('secp256k1')
const fs = require('fs')

class Wallet {
  constructor (privateKeyLocation) {
    this.privateKeyLocation = privateKeyLocation
    this.init()
  }

  init () {
    if (fs.existsSync(this.privateKeyLocation)) {
      console.log('Private key already exists')
      return null
    }

    const newPrivateKey = this.generatePrivateKey()
    fs.writeFileSync(this.privateKeyLocation, newPrivateKey)
    console.log('New wallet created')
  }

  generatePrivateKey () {
    const keyPair = ec.genKeyPair()
    const privateKey = keyPair.getPrivate()
    return privateKey.toString(16)
  }

  getPrivate () {
    if (!fs.existsSync(this.privateKeyLocation)) {
      return null
    } else {
      const contents = fs.readFileSync(this.privateKeyLocation)
      return contents
    }
  }

  getPublic () {
    const privateKey = this.getPrivate()
    const key = ec.keyFromPrivate(privateKey, 'hex')
    return key.getPublic().encode('hex')
  }

  getBalance (publicAddress, unspentTxOuts) {
    return unspentTxOuts
      .filter(utxo => utxo.address === publicAddress)
      .map(utxo => utxo.amount)
      .reduce((a, b) => a + b, 0)
  }

  findTxOutsForAmount (amount, myUnspentTxOuts) {
    let currentAmount = 0
    const includedUnspentTxOuts = []
    for (const myUnspentTxOut of myUnspentTxOuts) {
      includedUnspentTxOuts.push(myUnspentTxOut)
      currentAmount += myUnspentTxOut.amount
      if (currentAmount >= amount) {
        const leftOverAmount = currentAmount - amount
        return {
          includedUnspentTxOuts,
          leftOverAmount
        }
      }
    }
    throw Error('Not enough coins to send transaction')
  }

  toUnsignedTxIn (unspentTxOut) {
    const txIn = new TxIn()
    txIn.txOutId = unspentTxOut.txOutId
    txIn.txOutIndex = unspentTxOut.txOutIndex
    return txIn
  }

  createTxOuts (recieverAddress, myAddress, amount, leftOverAmount) {
    const txOut = new TxOut(recieverAddress, amount)
    if (leftOverAmount === 0) {
      return [txOut]
    } else {
      const leftOverTx = new TxOut(myAddress, leftOverAmount)
      return [txOut, leftOverTx]
    }
  }

  createTransaction (recieverAddress, amount, unspentTxOuts) {
    const myAddress = getPublicKey(this.getPrivate())
    const myUnspentTxOuts =
      unspentTxOuts
        .filter(utxo => utxo.address === myAddress)

    const {
      includedUnspentTxOuts,
      leftOverAmount
    } = this.findTxOutsForAmount(amount, myUnspentTxOuts)

    const unsignedTxIns =
      includedUnspentTxOuts
        .map(this.toUnsignedTxIn)

    const tx = new Transaction()
    tx.txIns = unsignedTxIns
    tx.txOuts = this.createTxOuts(recieverAddress, myAddress, amount, leftOverAmount)
    tx.id = tx.getId()
    tx.txIns = tx.txIns.map((txIn, index) => {
      txIn.signature = tx.signTxIn(index, this.getPrivate(), unspentTxOuts)
      return txIn
    })

    return tx
  }
}

module.exports = {
  Wallet
}
