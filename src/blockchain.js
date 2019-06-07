const CryptoJS = require('crypto-js')
const hexToBinary = require('hex-to-binary')
const {
  processTransactions,
  newCoinbaseTransaction,
  Transaction
} = require('./transactions')

const INITIAL_DIFFICULTY = 7

class Block {
  constructor (index, previousHash, timestamp, data, nonce, difficulty) {
    this.index = index
    this.previousHash = previousHash
    this.timestamp = timestamp
    this.data = data
    this.nonce = nonce
    this.difficulty = difficulty
    this.hash = this.calculateHash()
  }

  mineHash () {
    while (!this.hashSatisfiesDifficulty(this.hash, this.difficulty)) {
      this.nonce++
      this.hash = this.calculateHash()
    }
    console.log('Mined hash @ ' + this.difficulty + ' -> ' + hexToBinary(this.hash))
    return this.hash
  }

  hashSatisfiesDifficulty (hash, difficulty) {
    const hashInBinary = hexToBinary(hash)
    const requiredPrefix = '0'.repeat(difficulty)
    return hashInBinary.startsWith(requiredPrefix)
  }

  hasValidHash () {
    return this.hashSatisfiesDifficulty(this.hash, this.difficulty)
  }

  calculateHash () {
    return CryptoJS.SHA256(
      this.index +
      this.previousHash +
      this.timestamp +
      this.data +
      this.nonce
    ).toString()
  }

  static isValidStructure (block) {
    return typeof block.index === 'number' &&
        typeof block.hash === 'string' &&
        (typeof block.previousHash === 'string' || block.index === 0) &&
        typeof block.timestamp === 'number' &&
        typeof block.data === 'object' &&
        typeof block.nonce === 'number' &&
        typeof block.difficulty === 'number'
  }
}

class BlockChain {
  constructor () {
    this.chain = [this.createGenesisBlock()]
    this.blockGenerationInterval = 10
    this.difficultyAdjustmentInterval = 10
    this.unspentTxOuts = []
  }

  latestBlock () {
    return this.chain[this.chain.length - 1]
  }

  currentDifficulty () {
    let latest = this.latestBlock()
    if (latest.index % this.difficultyAdjustmentInterval === 0 && latest.index !== 0) {
      return this.getAdjustedDifficulty(latest)
    } else {
      return latest.difficulty
    }
  }

  getAdjustedDifficulty (latest) {
    let prevAdjustmentBlock = this.chain[this.chain.length - this.difficultyAdjustmentInterval]
    let timeExpected = this.blockGenerationInterval * this.difficultyAdjustmentInterval
    let timeTaken = latest.timestamp - prevAdjustmentBlock.timestamp
    if (timeTaken < timeExpected / 2) {
      return prevAdjustmentBlock.difficulty + 1
    } else if (timeTaken > timeExpected * 2) {
      return prevAdjustmentBlock.difficulty - 1
    } else {
      return prevAdjustmentBlock.difficulty
    }
  }

  generateRawNextBlock (blockData) {
    const previousBlock = this.latestBlock()
    const nextIndex = previousBlock.index + 1
    const nextTimestamp = this.currentTimestamp()
    const newBlock = new Block(
      nextIndex,
      previousBlock.hash,
      nextTimestamp,
      blockData,
      0, this.currentDifficulty()
    )
    console.log('Mining block....')
    newBlock.mineHash()
    if (this.addBlock(newBlock)) {
      console.log('Added block to chain')
      return newBlock
    } else {
      console.log('Failed to add block to chain')
      return null
    }
  }

  generateNextBlock (publicAddress, transactions = []) {
    const coinbaseTx = newCoinbaseTransaction(
      publicAddress,
      this.latestBlock().index + 1
    )
    const blockData = [coinbaseTx]
    for (let transaction of transactions) {
      blockData.push(transaction)
    }
    return this.generateRawNextBlock(blockData)
  }

  currentTimestamp () {
    return Math.round(Date.now() / 1000)
  }

  isValidTimestamp (newBlock, previousBlock) {
    return (previousBlock.timestamp - 60 < newBlock.timestamp) &&
            newBlock.timestamp - 60 < (this.currentTimestamp())
  }

  addBlock (newBlock) {
    if (this.isValidNewBlock(newBlock, this.latestBlock())) {
      // Convert block data to Transactions
      newBlock.data = newBlock.data.map(Transaction.fromObject)
      console.log(newBlock.data[1] instanceof Transaction)

      const retVal = processTransactions(
        newBlock.data,
        this.unspentTxOuts,
        newBlock.index
      )
      if (retVal == null) {
        console.log('Invalid block data')
        return false
      } else {
        this.chain.push(newBlock)
        this.unspentTxOuts = retVal
        return true
      }
    } else {
      return false
    }
  }

  createGenesisBlock () {
    return new Block(
      0, null, 0, [], 0, INITIAL_DIFFICULTY
    )
  }

  isValidNewBlock (newBlock, previousBlock) {
    if (previousBlock.index + 1 !== newBlock.index) {
      console.log('Invalid index')
      return false
    } else if (previousBlock.hash !== newBlock.previousHash) {
      console.log('Incorrect previous hash')
      return false
    } else if (newBlock.calculateHash() !== newBlock.hash) {
      console.log('Invalid hash')
      return false
    } else if (!this.isValidTimestamp(newBlock, previousBlock)) {
      console.log('Invalid timestamp')
      return false
    } else if (!newBlock.hasValidHash()) {
      console.log('Doesnt meet the difficulty requirement')
      return false
    } else {
      return true
    }
  }

  isValid (chain) {
    if (!this.isValidGenesis(chain[0])) {
      console.log('Chain has invalid genesis Block')
      return false
    }

    for (let i = 1; i < chain.length; i++) {
      if (!this.isValidNewBlock(chain[i], chain[i - 1])) {
        console.log(`Block is invalid: ${JSON.stringify(chain[i], null, 4)}`)
        return false
      }
    }
  }

  isValidGenesis (block) {
    let genesis = JSON.stringify(this.createGenesisBlock())
    return JSON.stringify(block) === genesis
  }

  replace (newBlocks) {
    const getAccumulativeDifficulty = (blockChain) =>
      blockChain
        .map(block => block.difficulty)
        .map(difficulty => Math.pow(2, difficulty))
        .reduce((acc, val) => acc + val)

    console.log(`REPLACING | Validity      -> ${this.isValid(newBlocks)}`)
    console.log(`REPLACING | THEIR ACC Dif -> ${getAccumulativeDifficulty(newBlocks)}`)
    console.log(`REPLACING | OUR ACC Dif   -> ${getAccumulativeDifficulty(this.chain)}`)
    if (this.isValid(newBlocks) && getAccumulativeDifficulty(newBlocks) > getAccumulativeDifficulty(this.chain)) {
      this.chain = newBlocks
      console.log(`Replaced chain with: ${JSON.stringify(this.chain, null, 4)}`)
    }
  }
}

Block.fromString = (string) =>
  Block.fromObject(
    JSON.parse(string)
  )

Block.fromObject = (object) =>
  new Block(
    object.index,
    object.previousHash,
    object.timestamp,
    object.data,
    object.nonce,
    object.difficulty
  )

module.exports = {
  BlockChain,
  Block
}
