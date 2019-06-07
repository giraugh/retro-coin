const CryptoJS = require('crypto-js')
const ec = require('elliptic').ec('secp256k1')

const COINBASE_AMOUNT = 50 // Coim reward for mining

const toHexString = (byteArray) => {
  return Array.from(byteArray, (byte) => {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2)
  }).join('')
}

class TxOut {
  constructor (address, amount) {
    this.address = address
    this.amount = amount
  }

  isValidStructure () {
    if (typeof this.address !== 'string') {
      console.log('Invalid txOut address type')
      return false
    } else if (!isValidAddress(this.address)) {
      console.log('Invalid txOut address')
      return false
    } else if (typeof this.amount !== 'number') {
      console.log('Invalid txOut amount type')
      return false
    } else {
      return true
    }
  }
}

class UnspentTxOut {
  constructor (txOutId, txOutIndex, address, amount) {
    this.txOutId = txOutId
    this.txOutIndex = txOutIndex
    this.address = address
    this.amount = amount
  }
}

class TxIn {
  constructor () {
    this.txOutId = ''
    this.txOutIndex = null
    this.signature = ''
  }

  isValidStructure () {
    if (typeof this.signature !== 'string') {
      console.log('Invalid txIn signature type')
      return false
    } else if (typeof this.txOutId !== 'string') {
      console.log('Invalid txIn txOutId type')
      return false
    } else if (typeof this.txOutIndex !== 'number') {
      console.log('Invalid txIn txOutIndex type')
      return false
    } else {
      return true
    }
  }
}

class Transaction {
  constructor () {
    this.id = null
    this.txIns = []
    this.txOuts = []
  }

  getId () {
    const txInContent =
      this.txIns
        .map(txIn => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b)
    const txOutContent =
      this.txOuts
        .map(txOut => txOut.address + txOut.amount)
        .reduce((a, b) => a + b)
    return CryptoJS.SHA256(txInContent + txOutContent).toString()
  }

  signTxIn (txInIndex, privateKey, unspentTxOuts) {
    const txIn = this.txIns[txInIndex]
    const dataToSign = this.id
    const referencedUnspentTxOut = findUnspentTxOut(
      txIn.txOutId,
      txIn.txOutIndex,
      unspentTxOuts
    )
    const referencedAddress = referencedUnspentTxOut.address

    if (getPublicKey(privateKey) !== referencedAddress) {
      console.log(
        `Trying to sign an input with a private key that does
        not match the address that is referenced in the txIn`
      )
      throw Error()
    }

    const key = ec.keyFromPrivate(privateKey, 'hex')
    const signature = toHexString(key.sign(dataToSign).toDER())
    return signature
  }

  isValidStructure () {
    if (typeof this.id !== 'string') {
      console.log('Missing transaction.id')
      return false
    }
    if (!(this.txIns instanceof Array)) {
      console.log('Invalid txIns type')
      return false
    }
    if (!(this.txOuts instanceof Array)) {
      console.log('Invalid txOuts type')
      return false
    }
    let txInsStructureValid =
      this.txIns
        .every(txIn => txIn.isValidStructure())
    if (!txInsStructureValid) {
      console.log('Invalid txIns structure')
      return false
    }
    let txOutsStructureValid =
      this.txOuts
        .every(txOut => txOut.isValidStructure())
    if (!txOutsStructureValid) {
      return false
    }
    return true
  }
}

Transaction.fromObject = ({id, txIns, txOuts}) => {
  let tx = new Transaction()
  tx.id = id
  tx.txIns = txIns.map(({txOutId, txOutIndex, signature}) => {
    let txi = new TxIn()
    txi.txOutId = txOutId
    txi.txOutIndex = txOutIndex
    txi.signature = signature
    return txi
  })
  tx.txOuts = txOuts.map(({address, amount}) => {
    let txo = new TxOut(address, amount)
    return txo
  })
  return tx
}

const isValidAddress = (address) => {
  if (address.length !== 130) {
    console.log('Invalid public key length')
    return false
  } else if (address.match('^[a-fA-F0-9]+$') == null) {
    console.log('Public key must only contain hex characters')
    return false
  } else if (!address.startsWith('04')) {
    console.log('Public key must start with 04')
    return false
  } else {
    return true
  }
}

const validateCoinbaseTx = (transaction, blockIndex) => {
  if (transaction === null) {
    console.log('The first transaction in the block must be a coinbase tx')
    return false
  }
  if (transaction.id !== transaction.getId()) {
    console.log('Invalid coinbase tx id')
    return false
  }
  if (transaction.txIns.length !== 1) {
    console.log('Exactly One txIn must be specified in the coinbase tx')
    return false
  }
  if (transaction.txIns[0].txOutIndex !== blockIndex) {
    console.log('The txIn signature in coinbase tx must be the block index')
    return false
  }
  if (transaction.txOuts[0].amount !== COINBASE_AMOUNT) {
    console.log('Invalid coinbase amount in coinbase tx')
    return false
  }
  return true
}

const validateTxIn = (txIn, transaction, unspentTxOuts) => {
  const referencedUnspentTxOut =
    unspentTxOuts
      .find(utxo => utxo.txOutId === txIn.txOutId)
  if (referencedUnspentTxOut == null) {
    console.log(`Referenced txOut not found: ${JSON.stringify(txIn)}`)
    return false
  }
  const {address} = referencedUnspentTxOut
  const key = ec.keyFromPublic(address, 'hex')
  return key.verify(transaction.id, txIn.signature)
}

const getTxInAmount = (txIn, unspentTxOuts) =>
  findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, unspentTxOuts).amount

const findUnspentTxOut = (transactionId, index, unspentTxOuts) =>
  unspentTxOuts
    .find(utxo => utxo.txOutId === transactionId && utxo.txOutIndex === index)

const validateTransaction = (transaction, unspentTxOuts) => {
  if (transaction.id !== transaction.getId()) {
    console.log('Invalid tx id')
    return false
  }
  const hasValidTxIns =
    transaction.txIns
      .every(txIn => validateTxIn(txIn, transaction, unspentTxOuts))
  if (!hasValidTxIns) {
    console.log(`txIns are invalid in tx: ${transaction.id}`)
    return false
  }

  const totalTxInValue =
    transaction.txIns
      .map(txIn => getTxInAmount(txIn, unspentTxOuts))
      .reduce((a, b) => a + b, 0)
  const totalTxOutValue =
  transaction.txOuts
    .map(txOut => txOut.amount)
    .reduce((a, b) => a + b, 0)
  if (totalTxOutValue !== totalTxInValue) {
    console.log(`txIn txOut value mismatch in tx: ${transaction}`)
    return false
  }

  return true
}

const validateBlockTransactions = (transactions, unspentTxOuts, blockIndex) => {
  const coinBaseTx = transactions[0]
  if (!validateCoinbaseTx(coinBaseTx, blockIndex)) {
    console.log(`Invalid coinbase transaction: ${JSON.stringify(coinBaseTx)}`)
    return false
  }

  // Check for duplicate txIns. Each can only be included once
  const txIns =
    transactions
     .map(tx => tx.txIns)
     .reduce((a, b) => a.concat(b), [])
  if (txIns.length !== [...(new Set(txIns))].length) {
    console.log('Transactions have duplicate TxIns')
    return false
  }

  const normalTransactions = transactions.slice(1)
  const transactionsValid =
    normalTransactions
      .every(tx => validateTransaction(tx, unspentTxOuts))
  if (!transactionsValid) {
    console.log('Invalid transactions')
    return false
  }

  return true
}

const isValidTransactionsStructure = (transactions) =>
  Array.isArray(transactions) &&
  transactions
    .every(transaction => transaction.isValidStructure())

const updateUnspentTxOuts = (transactions, unspentTxOuts) => {
  const newUnspentTxOuts =
    transactions
      .map(t => t.txOuts.map(
        (txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount)
      ))
      .reduce((a, b) => a.concat(b), [])
  const consumedTxOuts =
    transactions
      .map(t => t.txIns)
      .reduce((a, b) => a.concat(b), [])
      .map(txIn => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0))
  const resultingUnspentTxOuts =
    unspentTxOuts
      .filter(utxo => !findUnspentTxOut(utxo.txOutId, utxo.txOutIndex, consumedTxOuts))
      .concat(newUnspentTxOuts)
  return resultingUnspentTxOuts
}

const processTransactions = (transactions, unspentTxOuts, blockIndex) => {
  if (!isValidTransactionsStructure(transactions)) {
    console.log('Invalid transactions structure')
    return null
  }

  if (!validateBlockTransactions(transactions, unspentTxOuts, blockIndex)) {
    console.log('Invalid block transactions')
    return null
  }

  return updateUnspentTxOuts(transactions, unspentTxOuts)
}

const getPublicKey = (privateKey) =>
  ec.keyFromPrivate(privateKey, 'hex').getPublic().encode('hex')

const newCoinbaseTransaction = (address, blockIndex) => {
  const tx = new Transaction()
  const txIn = new TxIn()
  txIn.signature = ''
  txIn.txOutId = ''
  txIn.txOutIndex = blockIndex

  tx.txIns = [txIn]
  tx.txOuts = [new TxOut(address, COINBASE_AMOUNT)]
  tx.id = tx.getId()
  return tx
}

module.exports = {
  processTransactions,
  getPublicKey,
  newCoinbaseTransaction,
  Transaction,
  TxIn,
  TxOut
}
