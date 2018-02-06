const CryptoJS = require('crypto-js')
const hexToBinary = require('hex-to-binary')

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
        typeof block.previousHash === 'string' &&
        typeof block.timestamp === 'number' &&
        typeof block.data === 'string' &&
        typeof block.nonce === 'number' &&
        typeof block.difficulty === 'number'
  }
}

class BlockChain {
  constructor () {
    this.chain = [this.createGenesisBlock()]
    this.blockGenerationInterval = 10
    this.difficultyAdjustmentInterval = 10
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

  generateNextBlock (blockData) {
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
      console.log('Added block to chain. ')
    }
    return newBlock
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
      this.chain.push(newBlock)
      return true
    }
    return false
  }

  createGenesisBlock () {
    return new Block(
      0, null, this.currentTimestamp(), 'GENESIS', 0, 3
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
      return false
    }

    for (let i = 1; i < chain.length; i++) {
      if (!this.isValidNewBlock(chain[i], chain[i - 1])) {
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

    if (this.isValid(newBlocks) && getAccumulativeDifficulty(newBlocks) > getAccumulativeDifficulty(this.chain)) {
      this.chain = newBlocks
    }
  }
}

module.exports = {
  BlockChain,
  Block
}
