/* global jasmine, it, expect, describe */

jasmine.getEnv().defaultTimeoutInterval = 50000

var blockcast = require('../src/index')

var env = require('node-env-file')
env('./.env', { raise: false })

var loremIpsum = 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?'

var BLOCKCYPHER_TOKEN = process.env.BLOCKCYPHER_TOKEN

var commonBlockchain = require('blockcypher-unofficial')({
  key: BLOCKCYPHER_TOKEN,
  network: 'testnet'
})

var memCommonBlockchain = require('mem-common-blockchain')()

var randomString = function (length) {
  var characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'
  var output = ''
  for (var i = 0; i < length; i++) {
    var r = Math.floor(Math.random() * characters.length)
    output += characters.substring(r, r + 1)
  }
  return output
}

var testCommonWallet = require('test-common-wallet')

var commonWallet = testCommonWallet({
  seed: 'test',
  network: 'testnet',
  commonBlockchain: commonBlockchain
})

var anotherCommonWallet = testCommonWallet({
  seed: 'test1',
  network: 'testnet',
  commonBlockchain: commonBlockchain
})

var JSONdata = JSON.stringify({
  op: 'r',
  btih: '335400c43179bb1ad0085289e4e60c0574e6252e',
  sha1: 'dc724af18fbdd4e59189f5fe768a5f8311527050',
  ipfs: 'QmcJf1w9bVpquGdzCp86pX4K21Zcn7bJBUtrBP1cr2NFuR',
  name: 'test.txt',
  size: 7,
  type: 'text/plain',
  title: 'A text file for testing',
  keywords: 'test, text, txt'
})

describe('blockcast', function () {
  it('should post a message of a random string of 170 bytes', function (done) {
    var data = randomString(170)

    blockcast.post({
      data: data,
      commonWallet: commonWallet,
      commonBlockchain: commonBlockchain
    }, function (err, blockcastTx) {
      if (err) { } // TODO
      console.log(blockcastTx)
      expect(blockcastTx.data).toBe(data)
      expect(blockcastTx.txid).toBeDefined()
      expect(blockcastTx.transactionTotal).toBe(2)
      done()
    })
  })

  it('should post a message of a random string of 276 bytes', function (done) {
    blockcast.post({
      data: JSONdata,
      commonWallet: commonWallet,
      commonBlockchain: commonBlockchain
    }, function (err, blockcastTx) {
      if (err) { } // TODO
      console.log(blockcastTx)
      expect(blockcastTx.data).toBe(JSONdata)
      expect(blockcastTx.txid).toBeDefined()
      expect(blockcastTx.transactionTotal).toBe(3)
      done()
    })
  })

  it('should post a message with a primaryTx', function (done) {
    var data = JSON.stringify({
      op: 't',
      value: 50000000,
      sha1: 'dd09da17ec523e92e38b5f141d9625a5e77bb9fa'
    })

    var signPrimaryTxHex = function (txHex, callback) {
      anotherCommonWallet.signRawTransaction({txHex: txHex, input: 0}, callback)
    }

    var value = 12345
    anotherCommonWallet.createTransaction({
      destinationAddress: commonWallet.address,
      value: value,
      skipSign: true
    }, function (err, primaryTxHex) {
      if (err) { } // TODO
      blockcast.post({
        primaryTxHex: primaryTxHex,
        signPrimaryTxHex: signPrimaryTxHex,
        data: data,
        commonWallet: commonWallet,
        commonBlockchain: commonBlockchain
      }, function (err, blockcastTx) {
        if (err) { } // TODO
        console.log(blockcastTx)
        expect(blockcastTx.data).toBe(data)
        expect(blockcastTx.txid).toBeDefined()
        expect(blockcastTx.transactionTotal).toBe(1)
        done()
      })
    })
  })

  it('should get the payloads length', function (done) {
    var data = loremIpsum
    blockcast.payloadsLength({data: data}, function (err, payloadsLength) {
      if (err) { } // TODO
      expect(payloadsLength).toBe(6)
      done()
    })
  })

  it('should warn when the payloads length is too big', function (done) {
    var data = randomString(4200)
    blockcast.payloadsLength({data: data}, function (err, payloadsLength) {
      expect(err).toBe('data payload > 1277')
      expect(payloadsLength).toBe(false)
      done()
    })
  })

  it('should scan single txid 7be2dbaab47b7f71d0fb8919824119a3e2ebbff23d0b5d4f15fa023f3d55eb95', function (done) {
    var txid = '7be2dbaab47b7f71d0fb8919824119a3e2ebbff23d0b5d4f15fa023f3d55eb95'
    blockcast.scanSingle({
      txid: txid,
      commonBlockchain: commonBlockchain
    }, function (err, data, addresses, primaryTx) {
      if (err) { } // TODO
      expect(addresses[0]).toBe('mwaj74EideMcpe4cjieuPFpqacmpjtKSk1')
      expect(data).toBe('{"op":"t","value":50000000,"sha1":"dd09da17ec523e92e38b5f141d9625a5e77bb9fa"}')
      expect(primaryTx.txid).toBe(txid)
      expect(primaryTx.vin.length).toBe(2)
      done()
    })
  })

  it('should scan single txid 7cf57a5a9c7db909298db28b09271b497039e50ab8a26f200c8edaba68d0a190', function (done) {
    var txid = '7cf57a5a9c7db909298db28b09271b497039e50ab8a26f200c8edaba68d0a190'
    blockcast.scanSingle({
      txid: txid,
      commonBlockchain: commonBlockchain
    }, function (err, data, addresses, primaryTx) {
      if (err) { } // TODO
      expect(addresses[0]).toBe('msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ')
      expect(data).toBe(JSONdata)
      expect(primaryTx.vin.length).toBe(1)
      done()
    })
  })

  it('should not scan single txid b32192c9d2d75a8a28dd4034ea61eacb0dfe4f226acb502cfe108df20fbddebc', function (done) {
    var txid = 'b32192c9d2d75a8a28dd4034ea61eacb0dfe4f226acb502cfe108df20fbddebc'
    blockcast.scanSingle({
      txid: txid,
      commonBlockchain: commonBlockchain
    }, function (err, data) {
      if (err) { } // TODO
      expect(data).toBe(false)
      expect(err).toBe('not blockcast')
      done()
    })
  })

  it('should post a message of a random string of 720 bytes and then scan (memCommonBlockchain) ', function (done) {
    var randomStringData = randomString(720)
    blockcast.post({
      data: randomStringData,
      commonWallet: commonWallet,
      commonBlockchain: memCommonBlockchain
    }, function (err, blockcastTx) {
      if (err) { } // TODO
      expect(blockcastTx.txid).toBeDefined()
      expect(blockcastTx.transactionTotal).toBe(8)
      blockcast.scanSingle({
        txid: blockcastTx.txid,
        commonBlockchain: memCommonBlockchain
      }, function (err, data, addresses) {
        if (err) { } // TODO
        expect(addresses[0]).toBe('msLoJikUfxbc2U5UhRSjc2svusBSqMdqxZ')
        expect(data).toBe(randomStringData)
        done()
      })
      done()
    })
  })
})
