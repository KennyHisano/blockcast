var txHexToJSON = require('bitcoin-tx-hex-to-json')

var bitcoinTransactionBuilder = require('./bitcoin-transaction-builder')
var dataPayload = require('./data-payload')

var post = function (options, callback) {
  var commonWallet = options.commonWallet
  var commonBlockchain = options.commonBlockchain
  var data = options.data
  var fee = options.fee
  var primaryTxHex = options.primaryTxHex
  var destinationAddress = options.destinationAddress
  var value = options.value
  var signPrimaryTxHex = options.signPrimaryTxHex
  var propagationStatus = options.propagationStatus || function () {}
  var buildStatus = options.buildStatus || function () {}
  var retryMax = options.retryMax || 5
  var onSignedTransactions = function (err, signedTransactions, txid) {
    if (err) { } // TODO
    var reverseSignedTransactions = signedTransactions.reverse()
    var transactionTotal = reverseSignedTransactions.length
    var propagateCounter = 0
    var retryCounter = []
    var propagateResponse = function (err, res) {
      propagationStatus({
        response: res,
        count: propagateCounter,
        transactionTotal: transactionTotal
      })
      if (err) {
        var rc = retryCounter[propagateCounter] || 0
        if (rc < retryMax) {
          retryCounter[propagateCounter] = rc + 1
          commonBlockchain.Transactions.Propagate(reverseSignedTransactions[propagateCounter], propagateResponse)
        } else {
          callback(err, false)
        }
      }
      propagateCounter++
      if (propagateCounter < transactionTotal) {
        commonBlockchain.Transactions.Propagate(reverseSignedTransactions[propagateCounter], propagateResponse)
      } else {
        callback(false, {
          txid: txid,
          data: data,
          transactionTotal: transactionTotal
        })
      }
    }
    commonBlockchain.Transactions.Propagate(reverseSignedTransactions[0], propagateResponse)
  }
  if (options.signedTransactions && options.txid) {
    return onSignedTransactions(false, options.signedTransactions, options.txid)
  }
  bitcoinTransactionBuilder.createSignedTransactionsWithData({
    destinationAddress: destinationAddress,
    value: value,
    primaryTxHex: primaryTxHex,
    signPrimaryTxHex: signPrimaryTxHex,
    data: data,
    fee: fee,
    buildStatus: buildStatus,
    commonBlockchain: commonBlockchain,
    commonWallet: commonWallet
  }, onSignedTransactions)
}

var payloadsLength = function (options, callback) {
  dataPayload.create({data: options.data, id: 0}, function (err, payloads) {
    if (err) {
      callback(err, payloads)
      return
    }
    callback(false, payloads.length)
  })
}

var scanSingle = function (options, callback) {
  var txid = options.txid
  var tx = options.tx ? options.tx.txHex ? txHexToJSON(options.tx.txHex) : options.tx : false
  var commonBlockchain = options.commonBlockchain
  var allTransactions = []
  var payloads = []
  var transactionTotal
  var addresses = []
  var primaryTx
  var onTransaction = function (err, transactions, tx) {
    if (!tx && transactions[0].txHex) {
      tx = txHexToJSON(transactions[0].txHex)
    }
    if (!tx) {
      return callback(err, false)
    }
    if (allTransactions.length === 0) {
      primaryTx = tx
      tx.vin.forEach(function (vin) {
        vin.addresses.forEach(function (address) {
          if (addresses.indexOf(address) === -1) {
            addresses.push(address)
          }
        })
      })
    }
    var vout = tx.vout
    for (var j = vout.length - 1; j >= 0; j--) {
      var output = vout[j]
      var scriptPubKeyASM = output.scriptPubKey.asm
      if (scriptPubKeyASM.split(' ')[0] === 'OP_RETURN') {
        var hex = scriptPubKeyASM.split(' ')[1] || ''
        var data
        try {
          data = new Buffer(hex, 'hex')
        } catch (e) {
          data = new Buffer('', 'hex')
        }
        var parsedLength = dataPayload.parse(data)
        if (!transactionTotal) {
          transactionTotal = parsedLength
        }
        payloads.push(data)
      }
    }
    if (allTransactions.length === 0 && !parsedLength) {
      return callback('not blockcast', false)
    }
    allTransactions.push(tx)
    if (allTransactions.length === transactionTotal) {
      dataPayload.decode(payloads, function (err, data) {
        callback(err, data, addresses, primaryTx)
      })
      return
    }
    var prevTxid = tx.vin[tx.vin.length - 1].txid
    if (!prevTxid) {
      callback('missing: ' + (allTransactions.length + 1), false)
      return
    } else {
      commonBlockchain.Transactions.Get([prevTxid], onTransaction)
    }
  }
  if (tx) {
    onTransaction(false, [], tx)
  } else {
    commonBlockchain.Transactions.Get([txid], onTransaction)
  }
}

module.exports = {
  post: post,
  scanSingle: scanSingle,
  payloadsLength: payloadsLength,
  bitcoinTransactionBuilder: bitcoinTransactionBuilder
}
